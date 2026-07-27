"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createSessionLog } from "@/lib/logging/mutations";
import { todayDateString } from "@/lib/dates";
import { getExerciseDisplayName } from "@/lib/programs/exercise-catalog";
import { buildExerciseList, buildSetTargets, findResumeExerciseId } from "@/lib/training/sequence";
import { estimateWorkoutDurationSeconds } from "@/lib/training/estimate-duration";
import { computeWorkoutTotals } from "@/lib/training/totals";
import { saveDraftSession, deleteDraftSession, finishWorkout } from "@/lib/training/mutations";
import { isProgramComplete } from "@/lib/training/queries";
import type { DraftSet, PreviousPerformance, TrainingModeSession } from "@/lib/training/types";
import type { BlockRow } from "@/lib/programs/types";
import type { PersonalRecord } from "@/lib/supabase/types";
import { WorkoutOverviewScreen } from "@/components/training/workout-overview-screen";
import { ExerciseListScreen } from "@/components/training/exercise-list-screen";
import { ExerciseScreen } from "@/components/training/exercise-screen";
import { RestScreen } from "@/components/training/rest-screen";
import { ExerciseCompleteScreen } from "@/components/training/exercise-complete-screen";
import { WorkoutSummaryScreen } from "@/components/training/workout-summary-screen";
import { ProgramCompleteScreen } from "@/components/training/program-complete-screen";
import { EndWorkoutDialog } from "@/components/training/end-workout-dialog";

type Phase = "overview" | "exercises" | "exercise" | "rest" | "exercise-complete" | "summary" | "program-complete";

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
 * The whole Training Mode state machine — overview -> exercises (list) ->
 * (exercise <-> rest)* -> summary -> finish, with an End Workout escape
 * hatch reachable from any of the exercises/exercise/rest phases. Every
 * meaningful change (a completed set, an exercise/workout note, an
 * exercise finishing) is persisted to training_mode_sessions immediately
 * (lib/training/mutations.ts's saveDraftSession) so a refresh or a dropped
 * connection never loses more than the single most recent edit — that's
 * what makes resuming mid-workout possible at all (see the initial-state
 * derivation below, which is the exact same logic a fresh mount uses
 * whether or not `initialDraft` exists).
 *
 * Exercise order isn't enforced: `currentExerciseId` can move to any
 * exercise in `exerciseList` at any time, either by finishing the current
 * one (auto-advances to the next not-yet-done exercise) or by an explicit
 * jump via the exercise list (see ExerciseListScreen) — added after
 * athlete feedback that real gym order follows whatever equipment happens
 * to be free, not the program's listed order. Each exercise's progress is
 * tracked independently by its own logged-set count, never by position, so
 * visiting exercises out of order and coming back to one later loses
 * nothing.
 *
 * Stopping isn't all-or-nothing either: End Workout (see EndWorkoutDialog)
 * lets the athlete finish early with whatever's logged so far (routes
 * through the same summary/finish flow a fully completed workout uses) or
 * discard the attempt entirely (the same skip mutation the Overview
 * screen's "Skip Workout" always used) — added after feedback that the
 * only way to stop early used to be an unconditional discard.
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
  const exerciseList = useMemo(() => buildExerciseList(blocks), [blocks]);
  const estimatedSeconds = useMemo(() => estimateWorkoutDurationSeconds(blocks), [blocks]);
  const coachNoteTexts = useMemo(
    () => blocks.flatMap((b) => b.exercises).filter((e) => e.notes).map((e) => `${getExerciseDisplayName(e)}: ${e.notes}`),
    [blocks]
  );

  const [draftSets, setDraftSets] = useState<DraftSet[]>(initialDraft?.draftSets ?? []);
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>(initialDraft?.exerciseNotes ?? {});
  const [workoutNote, setWorkoutNote] = useState(initialDraft?.workoutNote ?? "");
  const [startedAt, setStartedAt] = useState<string | null>(initialDraft?.startedAt ?? null);

  const [currentExerciseId, setCurrentExerciseId] = useState<string | null>(() => {
    if (!initialDraft) return exerciseList[0]?.id ?? null;
    return findResumeExerciseId(exerciseList, draftSetCounts(initialDraft.draftSets));
  });
  const [phase, setPhase] = useState<Phase>(() => {
    if (!initialDraft) return "overview";
    return currentExerciseId === null ? "summary" : "exercise";
  });
  const [completedAt, setCompletedAt] = useState<string | null>(() => (phase === "summary" ? new Date().toISOString() : null));
  const [restSeconds, setRestSeconds] = useState(0);

  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [skippingWorkout, setSkippingWorkout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endWorkoutOpen, setEndWorkoutOpen] = useState(false);

  const transitionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (transitionTimeout.current) clearTimeout(transitionTimeout.current);
  }, []);

  // Belt-and-suspenders alongside createClient()'s keepalive fetch: warns
  // on a hard navigation (tab close, refresh, typing a new URL) while a
  // set/finish/skip write is actually in flight, rather than letting
  // someone walk away thinking they're done when the save hasn't landed
  // yet. Doesn't fire for in-app router.push navigation (there's no real
  // unload to hook), but that's the smaller risk here — nothing in this
  // component navigates away *during* an unawaited save.
  const persisting = saving || finishing || skippingWorkout || starting;
  // Read via a ref updated during render (not in an effect keyed on
  // `persisting`) rather than adding/removing the listener every time
  // `persisting` flips: an add/remove-on-dependency-change effect has a
  // window, between the state update that clears `persisting` and that
  // effect's own cleanup actually running, where a stale listener (closed
  // over the old `persisting`) is still attached — usually too brief to
  // notice, but a real CI flake (a beforeunload dispatched in that window
  // was still incorrectly blocked). Registering the listener once and
  // reading the ref instead makes it read whatever was most recently
  // rendered, with no such window at all.
  const persistingRef = useRef(persisting);
  persistingRef.current = persisting;
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!persistingRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const currentExercise = exerciseList.find((e) => e.id === currentExerciseId) ?? null;
  const currentExerciseIndex = currentExerciseId ? exerciseList.findIndex((e) => e.id === currentExerciseId) : -1;
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
    // Lands on the full exercise list rather than jumping straight into
    // exercise #1 — makes "these don't have to be done in order" obvious
    // from the first moment, instead of only discoverable via a button
    // once already mid-set (see ExerciseListScreen's doc comment).
    setPhase(exerciseList.length === 0 ? "summary" : "exercises");
    if (exerciseList.length === 0) setCompletedAt(new Date().toISOString());
  }

  // Moves to a specific exercise (or, when null, to the summary — every
  // exercise is done). Used both for auto-advance after finishing an
  // exercise and for an explicit jump via the exercise picker; either way
  // there's nothing else to reconcile, since progress lives entirely on
  // draftSets keyed by exercise id, never on which exercise is "current."
  function goToExercise(exerciseId: string | null) {
    if (exerciseId === null) {
      setCompletedAt(new Date().toISOString());
      setPhase("summary");
    } else {
      setCurrentExerciseId(exerciseId);
      setPhase("exercise");
    }
  }

  function handleJumpToExercise(exerciseId: string) {
    // A manual jump should win over any pending "exercise finished, about
    // to auto-advance" transition rather than being silently overridden a
    // moment later.
    if (transitionTimeout.current) {
      clearTimeout(transitionTimeout.current);
      transitionTimeout.current = null;
    }
    goToExercise(exerciseId);
  }

  function openExerciseList() {
    setPhase("exercises");
  }

  function handleEndWorkout() {
    setEndWorkoutOpen(true);
  }

  // "Save & Finish" from the End Workout dialog — routes through the exact
  // same summary/finish flow a fully completed workout uses, just possibly
  // with fewer exercises' worth of sets in it. Cancels any pending
  // auto-advance transition first, same reasoning as handleJumpToExercise.
  function handleSaveAndFinish() {
    setEndWorkoutOpen(false);
    if (transitionTimeout.current) {
      clearTimeout(transitionTimeout.current);
      transitionTimeout.current = null;
    }
    setCompletedAt(new Date().toISOString());
    setPhase("summary");
  }

  async function handleCompleteSet(payload: { weight: number | null; reps: number | null; notes: string | null }) {
    if (!currentExercise) return;
    const targets = buildSetTargets(currentExercise.sets);
    const loggedCount = loggedSetCounts.get(currentExercise.id) ?? 0;
    const target = targets[loggedCount] ?? targets[targets.length - 1];
    if (!target) return;

    const newSet: DraftSet = {
      blockExerciseId: currentExercise.id,
      setPrescriptionId: target.id,
      position: nextPosition(currentExercise.id, draftSets),
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

    const updatedCounts = draftSetCounts(next);
    const newCount = updatedCounts.get(currentExercise.id) ?? 0;
    if (newCount < targets.length) {
      // More sets left on this exercise — rest if this set prescribes it,
      // then come right back to the same exercise for the next one. No
      // forced switch to a different exercise mid-set anymore (see
      // sequence.ts's buildExerciseList doc comment).
      if (target.rest_seconds != null && target.rest_seconds > 0) {
        setRestSeconds(target.rest_seconds);
        setPhase("rest");
      }
    } else {
      // This exercise is fully logged — celebrate, then auto-advance to
      // whatever's actually still incomplete (which may not be the next
      // exercise in list order, if the athlete free-navigated earlier).
      setPhase("exercise-complete");
      transitionTimeout.current = setTimeout(() => goToExercise(findResumeExerciseId(exerciseList, updatedCounts)), 1100);
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
    if (!currentExercise) return;
    const target = currentExercise.sets[0];

    const newSet: DraftSet = {
      blockExerciseId: currentExercise.id,
      setPrescriptionId: target?.id ?? null,
      position: nextPosition(currentExercise.id, draftSets),
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
    // Cardio/running exercises are always logged as a single summary form
    // (see ExerciseScreen's category branch), so finishing one always
    // completes it in one shot.
    const updatedCounts = draftSetCounts(next);
    setPhase("exercise-complete");
    transitionTimeout.current = setTimeout(() => goToExercise(findResumeExerciseId(exerciseList, updatedCounts)), 1100);
  }

  // Resting only ever happens between two sets of the SAME exercise now
  // (see handleCompleteSet) — "done resting" just returns to that same
  // exercise's screen, ready for its next set.
  function handleRestDone() {
    setPhase("exercise");
  }

  function handleExerciseNoteChange(text: string) {
    if (!currentExercise) return;
    const next = { ...exerciseNotes, [currentExercise.id]: text };
    setExerciseNotes(next);
    void persist({ exerciseNotes: next });
  }

  function handleWorkoutNoteChange(text: string) {
    setWorkoutNote(text);
    void persist({ workoutNote: text || null });
  }

  // Discards this attempt entirely — used by the Overview screen's "Skip
  // Workout" (nothing's logged yet at that point, so there's nothing to
  // choose between) and by the End Workout dialog's "Discard" option
  // (where something usually has been logged, and the athlete has already
  // been shown the alternative of saving it instead).
  async function performSkipWorkout() {
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
      setEndWorkoutOpen(false);
      setError(skipError);
      return;
    }
    // Discard any in-progress draft — skipping abandons this attempt
    // rather than leaving something to resume into later.
    await deleteDraftSession(supabase, trainingDayId, athleteId);
    setSkippingWorkout(false);
    setEndWorkoutOpen(false);
    router.refresh();
    router.push("/dashboard");
  }

  function handleSkipWorkout() {
    void performSkipWorkout();
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
    if (finishError) {
      setFinishing(false);
      setError(finishError);
      return;
    }

    // Was that the last non-rest day left in the program? If so, show the
    // Program Complete screen instead of jumping straight to the dashboard
    // — a separate moment from "today's workout is done" (see
    // ProgramCompleteScreen). Checked after the log write succeeds, since
    // it's this exact workout finishing that might tip the program over
    // into "fully done."
    const complete = await isProgramComplete(supabase, programId, athleteId);
    setFinishing(false);
    if (complete) {
      setPhase("program-complete");
      return;
    }

    goToDashboard();
  }

  function goToDashboard() {
    // The dashboard's "today's workout" card and hero may already be
    // prefetched/cached from before this workout was logged — refresh
    // busts that cache so it shows "completed today" (or the Program
    // Complete hero) immediately rather than a stale "Start workout" state
    // (same fix as ProgramViewer's handleSetActive, same underlying
    // router-cache-staleness cause).
    router.refresh();
    router.push("/dashboard");
  }

  const elapsedSeconds = startedAt && completedAt ? Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000)) : 0;

  // Rest only ever happens between two sets of the current exercise (see
  // handleCompleteSet), so the preview is always that same exercise's next
  // target — never a different exercise's, the way a superset's
  // interleaved turns used to require.
  const restNextTarget = currentExercise ? buildSetTargets(currentExercise.sets)[loggedSetCounts.get(currentExercise.id) ?? 0] : undefined;

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
          exerciseCount={exerciseList.length}
          estimatedSeconds={estimatedSeconds}
          blocks={blocks}
          onBegin={handleBegin}
          starting={starting}
          onSkip={handleSkipWorkout}
          skipping={skippingWorkout}
        />
      )}

      {phase === "exercises" && (
        <ExerciseListScreen
          dayLabel={dayLabel}
          exercises={exerciseList}
          currentExerciseId={currentExerciseId}
          resumeExerciseId={findResumeExerciseId(exerciseList, loggedSetCounts)}
          loggedSetCounts={loggedSetCounts}
          onSelect={handleJumpToExercise}
          onEndWorkout={handleEndWorkout}
        />
      )}

      {phase === "exercise" && currentExercise && (
        <ExerciseScreen
          key={currentExercise.id}
          exercise={currentExercise}
          exerciseIndex={Math.max(0, currentExerciseIndex)}
          totalExercises={exerciseList.length}
          loggedSetCount={loggedSetCounts.get(currentExercise.id) ?? 0}
          draftSets={draftSets}
          personalRecords={personalRecords}
          previous={previousPerformance[currentExercise.id]}
          exerciseNote={exerciseNotes[currentExercise.id] ?? ""}
          onExerciseNoteChange={handleExerciseNoteChange}
          onCompleteSet={handleCompleteSet}
          onCardioFinish={handleCardioFinish}
          onOpenExerciseList={openExerciseList}
          onEndWorkout={handleEndWorkout}
          busy={saving}
        />
      )}

      {phase === "rest" && currentExercise && restNextTarget && (
        <RestScreen
          key={`${currentExercise.id}-${loggedSetCounts.get(currentExercise.id) ?? 0}`}
          initialSeconds={restSeconds}
          nextTarget={restNextTarget}
          category={currentExercise.exercise_category}
          onOpenExerciseList={openExerciseList}
          onEndWorkout={handleEndWorkout}
          onSkip={handleRestDone}
          onContinue={handleRestDone}
        />
      )}

      {phase === "exercise-complete" && currentExercise && <ExerciseCompleteScreen exerciseName={getExerciseDisplayName(currentExercise)} />}

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

      {phase === "program-complete" && <ProgramCompleteScreen programName={programName} onDone={goToDashboard} />}

      <EndWorkoutDialog
        open={endWorkoutOpen}
        onClose={() => setEndWorkoutOpen(false)}
        onSaveAndFinish={handleSaveAndFinish}
        onDiscard={performSkipWorkout}
        discarding={skippingWorkout}
      />
    </div>
  );
}
