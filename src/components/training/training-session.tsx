"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createSessionLog } from "@/lib/logging/mutations";
import { todayDateString } from "@/lib/dates";
import { getExerciseDisplayName } from "@/lib/programs/exercise-catalog";
import { buildExerciseSequence, buildSetTargets, findResumeStepIndex } from "@/lib/training/sequence";
import { estimateWorkoutDurationSeconds } from "@/lib/training/estimate-duration";
import { computeWorkoutTotals } from "@/lib/training/totals";
import { saveDraftSession, deleteDraftSession, finishWorkout } from "@/lib/training/mutations";
import type { DraftSet, PreviousPerformance, TrainingModeSession } from "@/lib/training/types";
import type { BlockRow } from "@/lib/programs/types";
import type { PersonalRecord } from "@/lib/supabase/types";
import { WorkoutOverviewScreen } from "@/components/training/workout-overview-screen";
import { ExerciseScreen } from "@/components/training/exercise-screen";
import { RestScreen } from "@/components/training/rest-screen";
import { ExerciseCompleteScreen } from "@/components/training/exercise-complete-screen";
import { WorkoutSummaryScreen } from "@/components/training/workout-summary-screen";

type Phase = "overview" | "exercise" | "rest" | "exercise-complete" | "summary";

interface TrainingSessionProps {
  trainingDayId: string;
  athleteId: string;
  programId: string;
  programName: string;
  weekLabel: string;
  weekPosition: number;
  totalWeeks: number;
  dayLabel: string;
  coachEmail: string | null;
  blocks: BlockRow[];
  personalRecords: PersonalRecord[];
  previousPerformance: Record<string, PreviousPerformance>;
  initialDraft: TrainingModeSession | null;
}

function draftSetCounts(sets: DraftSet[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of sets) map.set(s.blockExerciseId, (map.get(s.blockExerciseId) ?? 0) + 1);
  return map;
}

function nextPosition(blockExerciseId: string, sets: DraftSet[]): number {
  return sets.filter((s) => s.blockExerciseId === blockExerciseId).reduce((max, s) => Math.max(max, s.position), 0) + 1;
}

/**
 * The whole Training Mode state machine — overview -> (exercise <-> rest)*
 * -> summary -> finish. Every meaningful change (a completed set, an
 * exercise/workout note, an exercise finishing) is persisted to
 * training_mode_sessions immediately (lib/training/mutations.ts's
 * saveDraftSession) so a refresh or a dropped connection never loses more
 * than the single most recent edit — that's what makes resuming mid-workout
 * possible at all (see the initial-state derivation below, which is the
 * exact same logic a fresh mount uses whether or not `initialDraft` exists).
 */
export function TrainingSession({
  trainingDayId,
  athleteId,
  programId,
  programName,
  weekLabel,
  weekPosition,
  totalWeeks,
  dayLabel,
  coachEmail,
  blocks,
  personalRecords,
  previousPerformance,
  initialDraft,
}: TrainingSessionProps) {
  const router = useRouter();
  const sequence = useMemo(() => buildExerciseSequence(blocks), [blocks]);
  // Distinct exercises, not sequence.length — since buildExerciseSequence
  // now emits one step per SET/turn (to interleave supersets), its length
  // is a turn count, not an exercise count. The Overview screen's "X
  // Exercises" badge and the in-workout progress bar both need the latter.
  const totalExerciseCount = useMemo(() => blocks.reduce((n, b) => n + b.exercises.length, 0), [blocks]);
  const estimatedSeconds = useMemo(() => estimateWorkoutDurationSeconds(blocks), [blocks]);
  const coachNoteTexts = useMemo(
    () => blocks.flatMap((b) => b.exercises).filter((e) => e.notes).map((e) => `${getExerciseDisplayName(e)}: ${e.notes}`),
    [blocks]
  );

  const [draftSets, setDraftSets] = useState<DraftSet[]>(initialDraft?.draftSets ?? []);
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>(initialDraft?.exerciseNotes ?? {});
  const [workoutNote, setWorkoutNote] = useState(initialDraft?.workoutNote ?? "");
  const [startedAt, setStartedAt] = useState<string | null>(initialDraft?.startedAt ?? null);

  const [stepIndex, setStepIndex] = useState<number>(() => {
    if (!initialDraft) return 0;
    return findResumeStepIndex(sequence, draftSetCounts(initialDraft.draftSets)) ?? sequence.length;
  });
  const [phase, setPhase] = useState<Phase>(() => {
    if (!initialDraft) return "overview";
    return stepIndex >= sequence.length ? "summary" : "exercise";
  });
  const [completedAt, setCompletedAt] = useState<string | null>(() => (phase === "summary" ? new Date().toISOString() : null));
  const [restSeconds, setRestSeconds] = useState(0);

  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [skippingWorkout, setSkippingWorkout] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transitionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (transitionTimeout.current) clearTimeout(transitionTimeout.current);
  }, []);

  const currentStep = sequence[stepIndex];
  const loggedSetCounts = useMemo(() => draftSetCounts(draftSets), [draftSets]);
  const totals = useMemo(() => computeWorkoutTotals(draftSets), [draftSets]);

  async function persist(overrides: { draftSets?: DraftSet[]; exerciseNotes?: Record<string, string>; workoutNote?: string | null }) {
    const supabase = createClient();
    const { session, error: saveError } = await saveDraftSession(supabase, {
      trainingDayId,
      athleteId,
      draftSets: overrides.draftSets ?? draftSets,
      exerciseNotes: overrides.exerciseNotes ?? exerciseNotes,
      workoutNote: overrides.workoutNote !== undefined ? overrides.workoutNote : workoutNote || null,
    });
    if (session) setStartedAt(session.startedAt);
    if (saveError) setError(saveError);
  }

  async function handleBegin() {
    setStarting(true);
    setError(null);
    const supabase = createClient();
    const { session, error: saveError } = await saveDraftSession(supabase, {
      trainingDayId,
      athleteId,
      draftSets: [],
      exerciseNotes: {},
      workoutNote: null,
    });
    setStarting(false);
    if (saveError || !session) {
      setError(saveError ?? "Couldn't start this workout. Try again.");
      return;
    }
    setStartedAt(session.startedAt);
    setPhase(sequence.length === 0 ? "summary" : "exercise");
    if (sequence.length === 0) setCompletedAt(new Date().toISOString());
  }

  // Moves the sequence pointer to whatever step is next — this is now the
  // only place stepIndex changes. Under the interleaved sequence (one step
  // per set/turn, see buildExerciseSequence), "next step" might be another
  // turn of the same exercise (a straight block) or a superset partner's
  // turn (a grouped block) — this function doesn't need to know which,
  // since sequence[] already encodes the correct order either way.
  function commitAdvance() {
    setStepIndex((prev) => {
      const next = prev + 1;
      if (next >= sequence.length) {
        setCompletedAt(new Date().toISOString());
        setPhase("summary");
      } else {
        setPhase("exercise");
      }
      return next;
    });
  }

  // showCompleteTransition is true only when the just-finished turn was
  // this exercise's LAST turn anywhere in the sequence (not just the last
  // one before a rest) — see the exerciseFinished checks in
  // handleCompleteSet/handleCardioFinish.
  function advanceStep(showCompleteTransition: boolean) {
    if (showCompleteTransition) {
      setPhase("exercise-complete");
      transitionTimeout.current = setTimeout(commitAdvance, 1100);
    } else {
      commitAdvance();
    }
  }

  async function handleCompleteSet(payload: { weight: number | null; reps: number | null; notes: string | null }) {
    if (!currentStep) return;
    const exercise = currentStep.blockExercise;
    const targets = buildSetTargets(exercise.sets);
    const loggedCount = loggedSetCounts.get(exercise.id) ?? 0;
    const target = targets[loggedCount] ?? targets[targets.length - 1];
    if (!target) return;

    const newSet: DraftSet = {
      blockExerciseId: exercise.id,
      setPrescriptionId: target.id,
      position: nextPosition(exercise.id, draftSets),
      performedWeight: payload.weight,
      performedReps: payload.reps,
      // No RPE input in Training Mode's strength logger — weight and reps
      // only, to keep each set to two taps (see StrengthSetLogger).
      performedRpe: null,
      performedDistanceMeters: null,
      performedDurationSeconds: null,
      performedPaceSecondsPerKm: null,
      performedHeartRate: null,
      performedCalories: null,
      notes: payload.notes,
    };
    const next = [...draftSets, newSet];
    setDraftSets(next);
    setSaving(true);
    await persist({ draftSets: next });
    setSaving(false);

    const newCount = loggedCount + 1;
    if (newCount < targets.length) {
      // This exercise still has turns left later in the sequence
      // (possibly after a superset partner's turn in between, if this is
      // a grouped block). Rest if this set prescribes it, then move on to
      // whatever the next step actually is — same exercise again for a
      // straight block, the partner exercise for a superset.
      if (target.rest_seconds != null && target.rest_seconds > 0) {
        setRestSeconds(target.rest_seconds);
        setPhase("rest");
      } else {
        commitAdvance();
      }
    } else {
      // This exercise's last turn, anywhere in the sequence — celebrate,
      // then move on.
      advanceStep(true);
    }
  }

  async function handleCardioFinish(payload: {
    distanceMeters: number | null;
    durationSeconds: number | null;
    paceSecondsPerKm: number | null;
    heartRate: number | null;
    calories: number | null;
    rpe: number | null;
    notes: string | null;
  }) {
    if (!currentStep) return;
    const exercise = currentStep.blockExercise;
    const target = exercise.sets[0];

    const newSet: DraftSet = {
      blockExerciseId: exercise.id,
      setPrescriptionId: target?.id ?? null,
      position: nextPosition(exercise.id, draftSets),
      performedWeight: null,
      performedReps: null,
      performedRpe: payload.rpe,
      performedDistanceMeters: payload.distanceMeters,
      performedDurationSeconds: payload.durationSeconds,
      performedPaceSecondsPerKm: payload.paceSecondsPerKm,
      performedHeartRate: payload.heartRate,
      performedCalories: payload.calories,
      notes: payload.notes,
    };
    const next = [...draftSets, newSet];
    setDraftSets(next);
    setSaving(true);
    await persist({ draftSets: next });
    setSaving(false);
    // Cardio/running exercises always contribute exactly one turn (see
    // turnCount in sequence.ts), so finishing one is always its last turn.
    advanceStep(true);
  }

  // Rest now always sits BETWEEN two distinct sequence entries rather than
  // "inside" a single exercise's step (see commitAdvance) — so finishing a
  // rest period always means moving the sequence pointer forward, same as
  // any other step transition.
  function handleRestDone() {
    commitAdvance();
  }

  function handleExerciseNoteChange(text: string) {
    if (!currentStep) return;
    const next = { ...exerciseNotes, [currentStep.blockExercise.id]: text };
    setExerciseNotes(next);
    void persist({ exerciseNotes: next });
  }

  function handleWorkoutNoteChange(text: string) {
    setWorkoutNote(text);
    void persist({ workoutNote: text || null });
  }

  async function handleSkipWorkout() {
    // Skipping from the Overview loses nothing (nothing's logged yet), but
    // skipping mid-workout discards any sets already completed — worth a
    // confirmation there, since it's not undoable.
    if (draftSets.length > 0 && !window.confirm("Skip this workout? The sets you've already logged won't be saved.")) {
      return;
    }
    setSkippingWorkout(true);
    setError(null);
    const supabase = createClient();
    const { error: skipError } = await createSessionLog(supabase, {
      trainingDayId,
      athleteId,
      performedOn: todayDateString(),
      skipped: true,
    });
    if (skipError) {
      setSkippingWorkout(false);
      setError(skipError);
      return;
    }
    // Discard any in-progress draft — skipping abandons this attempt
    // rather than leaving something to resume into later.
    await deleteDraftSession(supabase, trainingDayId, athleteId);
    setSkippingWorkout(false);
    router.refresh();
    router.push("/dashboard");
  }

  async function handleFinish() {
    setFinishing(true);
    setError(null);
    const supabase = createClient();
    const { error: finishError } = await finishWorkout(supabase, {
      trainingDayId,
      athleteId,
      draftSets,
      exerciseNotes,
      workoutNote: workoutNote.trim() || null,
    });
    setFinishing(false);
    if (finishError) {
      setError(finishError);
      return;
    }
    // The dashboard's "today's workout" card and hero may already be
    // prefetched/cached from before this workout was logged — refresh
    // busts that cache so it shows "completed today" immediately rather
    // than the stale "Start workout" state (same fix as ProgramViewer's
    // handleSetActive, same underlying router-cache-staleness cause).
    router.refresh();
    router.push("/dashboard");
  }

  const elapsedSeconds = startedAt && completedAt ? Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000)) : 0;

  // "X of Y Exercises" needs a count of DISTINCT exercises, not sequence
  // position — sequence[] is now one entry per set/turn (see
  // buildExerciseSequence), so raw stepIndex/sequence.length would count
  // individual sets instead once a superset interleaves. Reusing the
  // existing stepIndex/totalSteps prop names on ExerciseScreen (which just
  // forwards them to WorkoutProgressBar) keeps that component untouched.
  const exercisesSeenSoFar = new Set(sequence.slice(0, stepIndex + 1).map((s) => s.blockExercise.id)).size;
  const progressIndex = Math.max(0, exercisesSeenSoFar - 1);

  // The rest screen's "Next Set" preview is the literal next sequence
  // entry, which — for a superset — may belong to a different exercise
  // than the one just finished. Only shown once currentStep exists (i.e.
  // we're actually resting between two exercise steps).
  const nextStep = sequence[stepIndex + 1];
  const nextIsStrength = nextStep?.blockExercise.exercise_category === "strength";
  const restNextTarget =
    nextStep && nextIsStrength
      ? buildSetTargets(nextStep.blockExercise.sets)[loggedSetCounts.get(nextStep.blockExercise.id) ?? 0] ?? null
      : null;
  const restNextExerciseName = nextStep ? getExerciseDisplayName(nextStep.blockExercise) : null;
  const restNextLabel = nextStep && !nextIsStrength ? `Next: ${restNextExerciseName}` : null;
  const restShowExerciseName = !!(currentStep && nextStep && nextStep.blockExercise.id !== currentStep.blockExercise.id);

  return (
    <div className="min-h-screen">
      {phase === "overview" && (
        <WorkoutOverviewScreen
          programId={programId}
          programName={programName}
          weekLabel={weekLabel}
          weekPosition={weekPosition}
          totalWeeks={totalWeeks}
          dayLabel={dayLabel}
          coachEmail={coachEmail}
          exerciseCount={totalExerciseCount}
          estimatedSeconds={estimatedSeconds}
          blocks={blocks}
          onBegin={handleBegin}
          starting={starting}
          onSkip={handleSkipWorkout}
          skipping={skippingWorkout}
        />
      )}

      {phase === "exercise" && currentStep && (
        <ExerciseScreen
          key={currentStep.blockExercise.id}
          step={currentStep}
          stepIndex={progressIndex}
          totalSteps={totalExerciseCount}
          loggedSetCount={loggedSetCounts.get(currentStep.blockExercise.id) ?? 0}
          draftSets={draftSets}
          personalRecords={personalRecords}
          previous={previousPerformance[currentStep.blockExercise.id]}
          exerciseNote={exerciseNotes[currentStep.blockExercise.id] ?? ""}
          onExerciseNoteChange={handleExerciseNoteChange}
          onCompleteSet={handleCompleteSet}
          onCardioFinish={handleCardioFinish}
          onSkipWorkout={handleSkipWorkout}
          busy={saving}
        />
      )}

      {phase === "rest" && currentStep && (
        <RestScreen
          key={`${currentStep.blockExercise.id}-${loggedSetCounts.get(currentStep.blockExercise.id) ?? 0}`}
          initialSeconds={restSeconds}
          nextSetLabel={restNextLabel}
          nextTarget={restNextTarget}
          nextExerciseName={restShowExerciseName ? restNextExerciseName : null}
          category={nextStep?.blockExercise.exercise_category ?? currentStep.blockExercise.exercise_category}
          onSkip={handleRestDone}
          onContinue={handleRestDone}
        />
      )}

      {phase === "exercise-complete" && currentStep && <ExerciseCompleteScreen exerciseName={getExerciseDisplayName(currentStep.blockExercise)} />}

      {phase === "summary" && (
        <WorkoutSummaryScreen
          dayLabel={dayLabel}
          durationSeconds={elapsedSeconds}
          totals={totals}
          workoutNote={workoutNote}
          onWorkoutNoteChange={handleWorkoutNoteChange}
          coachNotes={coachNoteTexts}
          onFinish={handleFinish}
          finishing={finishing}
          error={error}
        />
      )}
    </div>
  );
}
