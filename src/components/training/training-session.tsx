"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createSessionLog } from "@/lib/logging/mutations";
import { todayDateString } from "@/lib/dates";
import { getExerciseDisplayName } from "@/lib/programs/exercise-catalog";
import { buildExerciseList, buildSetTargets, dropLastSet, findResumeExerciseId } from "@/lib/training/sequence";
import { estimateWorkoutDurationSeconds } from "@/lib/training/estimate-duration";
import { computeWorkoutTotals } from "@/lib/training/totals";
import { saveDraftSession, deleteDraftSession, finishWorkout, createAutoregulationEvent, createJointCheckAnswer, applyJointLadderStep } from "@/lib/training/mutations";
import { isProgramComplete, getRecentAutoregulationEvents, getPreviousJointCheckAnswer } from "@/lib/training/queries";
import { decideReadinessDownregulation, decideRirGate, decideJointCheck } from "@/lib/training/autoregulation";
import type { JointCheckAnswer, JointKey, ReadinessCheck, SleepQuality, SorenessLevel } from "@/lib/training/autoregulation";
import type { DraftSet, PreviousPerformance, TrainingModeSession } from "@/lib/training/types";
import type { BlockRow, SetPrescription } from "@/lib/programs/types";
import type { PersonalRecord } from "@/lib/supabase/types";
import { WorkoutOverviewScreen } from "@/components/training/workout-overview-screen";
import { ExerciseListScreen } from "@/components/training/exercise-list-screen";
import { ExerciseScreen } from "@/components/training/exercise-screen";
import { RestScreen } from "@/components/training/rest-screen";
import { ExerciseCompleteScreen } from "@/components/training/exercise-complete-screen";
import { RirCheckScreen } from "@/components/training/rir-check-screen";
import { ReadinessCheckScreen } from "@/components/training/readiness-check-screen";
import { JointCheckScreen } from "@/components/training/joint-check-screen";
import { WorkoutSummaryScreen } from "@/components/training/workout-summary-screen";
import { ProgramCompleteScreen } from "@/components/training/program-complete-screen";
import { EndWorkoutDialog } from "@/components/training/end-workout-dialog";
import { SkipExerciseDialog } from "@/components/training/skip-exercise-dialog";

type Phase = "overview" | "readiness-check" | "joint-check" | "exercises" | "exercise" | "rest" | "exercise-complete" | "rir-check" | "summary" | "program-complete";

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
  /** Rule 4 (coach-answers §10 step 2) — which of the athlete's joints are
   * currently flagged (athlete_injury_profiles, migration 0047). Fetched
   * once server-side, same as personalRecords/previousPerformance; empty
   * means the joint-check screen is skipped entirely. */
  flaggedJoints: JointKey[];
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
  flaggedJoints,
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
  const [skippedExercises, setSkippedExercises] = useState<Record<string, string | null>>(initialDraft?.skippedExercises ?? {});
  const [workoutNote, setWorkoutNote] = useState(initialDraft?.workoutNote ?? "");
  const [startedAt, setStartedAt] = useState<string | null>(initialDraft?.startedAt ?? null);
  const [skipDialogExerciseId, setSkipDialogExerciseId] = useState<string | null>(null);
  // Rule 3 (coach-answers §2 Rule 3) — never re-asked on resume, even if a
  // prior attempt closed the tab before answering; see
  // TrainingModeSession.readiness's own doc comment.
  const [readiness, setReadiness] = useState<ReadinessCheck | null>(initialDraft?.readiness ?? null);

  const [currentExerciseId, setCurrentExerciseId] = useState<string | null>(() => {
    if (!initialDraft) return exerciseList[0]?.id ?? null;
    return findResumeExerciseId(exerciseList, draftSetCounts(initialDraft.draftSets), new Set(Object.keys(initialDraft.skippedExercises)));
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

  // Rule 3's mechanical half — see dropLastSet's own doc comment
  // (sequence.ts) for why every buildSetTargets call in this component
  // reads through this one helper rather than each independently deciding
  // whether to trim.
  const readinessDownregulated = readiness ? decideReadinessDownregulation(readiness) : false;
  function effectiveSets(sets: SetPrescription[]): SetPrescription[] {
    return readinessDownregulated ? dropLastSet(sets) : sets;
  }

  async function persist(overrides: {
    draftSets?: DraftSet[];
    exerciseNotes?: Record<string, string>;
    skippedExercises?: Record<string, string | null>;
    workoutNote?: string | null;
    readiness?: ReadinessCheck | null;
  }) {
    const supabase = createClient();
    const { session, error: saveError } = await saveDraftSession(supabase, {
      trainingDayId,
      athleteId,
      draftSets: overrides.draftSets ?? draftSets,
      exerciseNotes: overrides.exerciseNotes ?? exerciseNotes,
      skippedExercises: overrides.skippedExercises ?? skippedExercises,
      workoutNote: overrides.workoutNote !== undefined ? overrides.workoutNote : workoutNote || null,
      readiness: overrides.readiness !== undefined ? overrides.readiness : readiness,
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
      skippedExercises: {},
      workoutNote: null,
      readiness: null,
    });
    setStarting(false);
    if (saveError || !session) {
      setError(saveError ?? "Couldn't start this workout. Try again.");
      return;
    }
    setStartedAt(session.startedAt);
    // Rule 3's own question comes right after Begin, before the exercise
    // list — "these don't have to be done in order" is still the very next
    // thing shown once that's answered (see ExerciseListScreen's doc
    // comment), just one screen later than before. Skipped entirely for a
    // rest-only day with nothing to train.
    setPhase(exerciseList.length === 0 ? "summary" : "readiness-check");
    if (exerciseList.length === 0) setCompletedAt(new Date().toISOString());
  }

  async function handleReadinessAnswer(sleep: SleepQuality, soreness: SorenessLevel) {
    const next: ReadinessCheck = { sleep, soreness };
    setReadiness(next);
    setSaving(true);
    await persist({ readiness: next });
    setSaving(false);
    // Only ever reached when exerciseList.length > 0 (see handleBegin) —
    // there's always a real exercise list waiting on the other side. Rule
    // 4's own question (coach-answers §10 step 2) comes right after Rule
    // 3's, but only for athletes with at least one joint currently flagged.
    setPhase(flaggedJoints.length > 0 ? "joint-check" : "exercises");
  }

  /**
   * Handles Rule 4's per-joint better/same/worse answers, all collected at
   * once by JointCheckScreen. For each flagged joint: read what was
   * answered last time (joint_check_answers, migration 0047 — durable,
   * unlike training_mode_sessions.joint_check, which is deleted at Finish
   * Workout), decide via decideJointCheck (autoregulation.ts), always
   * record today's raw answer (unlike Rule 1, every answer here matters as
   * tomorrow's "previous" — see createJointCheckAnswer's own doc comment),
   * and only when two-in-a-row actually fired, walk that joint's
   * substitution ladder one step from this week onward
   * (applyJointLadderStep).
   *
   * Sequential rather than Promise.all across joints — there are at most a
   * handful (recommendConsultationReason already steers three-or-more-
   * flagged athletes toward a human consultation instead), and sequential
   * keeps this simple to reason about rather than meaningfully faster.
   */
  async function handleJointCheckAnswer(answers: Record<JointKey, JointCheckAnswer>) {
    setSaving(true);
    const supabase = createClient();
    for (const joint of flaggedJoints) {
      const answer = answers[joint];
      if (!answer) continue;
      const previous = await getPreviousJointCheckAnswer(supabase, { athleteId, joint });
      const outcome = decideJointCheck(answer, previous);
      await createJointCheckAnswer(supabase, { athleteId, joint, answer });
      if (outcome !== "no_change") {
        await applyJointLadderStep(supabase, { athleteId, programId, fromWeekPosition: weekPosition, joint, direction: outcome });
      }
    }
    setSaving(false);
    setPhase("exercises");
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

  // An exercise the athlete skipped earlier, then came back and actually
  // trained after all, is no longer "skipped" — clears it from state (and
  // the persisted draft) the moment a real set lands for it, so it doesn't
  // show a stale "Skipped" badge or get excluded from the resume sequence
  // once it genuinely has sets logged.
  function unskip(blockExerciseId: string): Record<string, string | null> {
    if (!(blockExerciseId in skippedExercises)) return skippedExercises;
    const next = { ...skippedExercises };
    delete next[blockExerciseId];
    setSkippedExercises(next);
    return next;
  }

  async function handleCompleteSet(payload: { weight: number | null; reps: number | null; notes: string | null }) {
    if (!currentExercise) return;
    const targets = buildSetTargets(effectiveSets(currentExercise.sets));
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
      // Filled in afterwards, once per exercise rather than per set — see
      // handleRirAnswer, which patches this same DraftSet once the athlete
      // answers the post-exercise RIR check.
      performedRir: null,
      performedDistanceMeters: null,
      performedDurationSeconds: null,
      performedPaceSecondsPerKm: null,
      performedHeartRate: null,
      performedCalories: null,
      notes: payload.notes,
    };
    const next = [...draftSets, newSet];
    setDraftSets(next);
    const nextSkipped = unskip(currentExercise.id);
    setSaving(true);
    await persist({ draftSets: next, skippedExercises: nextSkipped });
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
    } else if (currentExercise.exercise_category === "strength" && currentExercise.autoregulation_eligible && !readinessDownregulated) {
      // Rule 1's own question (coach-answers §2 Rule 1) — asked once per
      // autoregulation-eligible exercise, right after its last working set,
      // never per set. Auto-advance is deferred until the athlete answers
      // (see handleRirAnswer), rather than firing on the usual 1100ms
      // timer straight into exercise-complete.
      setPhase("rir-check");
    } else if (currentExercise.exercise_category === "strength" && currentExercise.autoregulation_eligible && readinessDownregulated) {
      // Rule 3 interaction: a session capped by a rough-sleep/high-soreness
      // readiness answer isn't a true reading of capacity (see
      // readiness-check-screen.tsx's header comment), so this skips the
      // question entirely — no advance/hold/reset decision is made — and
      // just records why, so Rule 1's own history correctly excludes this
      // session from its consecutive-miss count (migration 0044's
      // 'readiness_downregulated' kind exists specifically for this).
      void createAutoregulationEvent(createClient(), {
        athleteId,
        blockExerciseId: currentExercise.id,
        kind: "readiness_downregulated",
        detail: { reason: "Session was downregulated by the pre-session readiness check." },
      });
      setPhase("exercise-complete");
      transitionTimeout.current = setTimeout(
        () => goToExercise(findResumeExerciseId(exerciseList, updatedCounts, new Set(Object.keys(nextSkipped)))),
        1100
      );
    } else {
      // This exercise is fully logged — celebrate, then auto-advance to
      // whatever's actually still incomplete (which may not be the next
      // exercise in list order, if the athlete free-navigated earlier).
      setPhase("exercise-complete");
      transitionTimeout.current = setTimeout(
        () => goToExercise(findResumeExerciseId(exerciseList, updatedCounts, new Set(Object.keys(nextSkipped)))),
        1100
      );
    }
  }

  /**
   * Handles the RIR-check answer for the exercise that just finished. Reads
   * `draftSets`/`currentExercise`/`skippedExercises` straight from render
   * scope rather than threading extra state through from handleCompleteSet
   * — by the time this fires the athlete has seen a fresh render of the
   * "rir-check" phase, so those values already reflect the just-completed
   * exercise, the same way every other handler in this component reads
   * current state rather than stashed snapshots.
   *
   * Fetches this lift's own recent autoregulation_events, decides the
   * outcome via decideRirGate (autoregulation.ts), records it (skipping the
   * write entirely for a "no_change" result — see that module's header
   * comment on why that's correct), patches the raw RIR answer onto the
   * exercise's last DraftSet so Finish Workout persists it to
   * logged_sets.performed_rir, then proceeds into the normal
   * exercise-complete/auto-advance flow exactly as a non-eligible exercise
   * would have.
   */
  async function handleRirAnswer(performedRir: 0 | 1 | 2 | 3) {
    if (!currentExercise) return;
    setSaving(true);

    const exerciseDraftSets = draftSets.filter((s) => s.blockExerciseId === currentExercise.id);
    const lastDraftSet = exerciseDraftSets[exerciseDraftSets.length - 1] ?? null;
    const targets = buildSetTargets(effectiveSets(currentExercise.sets));
    const lastTarget = targets[targets.length - 1] ?? null;
    const expectedReps =
      lastTarget?.max_reps ?? (lastTarget?.reps && /^\d+$/.test(lastTarget.reps.trim()) ? Number(lastTarget.reps) : null);
    const repsMissed = expectedReps != null && lastDraftSet?.performedReps != null && lastDraftSet.performedReps < expectedReps;

    const supabase = createClient();
    const recentEvents = await getRecentAutoregulationEvents(supabase, { athleteId, blockExerciseId: currentExercise.id });
    const gate = decideRirGate({ performedRir, repsMissed, recentEvents });

    if (gate.outcome !== "no_change") {
      await createAutoregulationEvent(supabase, {
        athleteId,
        blockExerciseId: currentExercise.id,
        kind: gate.outcome,
        detail: { reason: gate.reason, multiplier: gate.multiplier, performedRir },
      });
    }

    const updated = lastDraftSet ? draftSets.map((s) => (s === lastDraftSet ? { ...s, performedRir } : s)) : draftSets;
    setDraftSets(updated);
    await persist({ draftSets: updated });
    setSaving(false);

    const updatedCounts = draftSetCounts(updated);
    setPhase("exercise-complete");
    transitionTimeout.current = setTimeout(
      () => goToExercise(findResumeExerciseId(exerciseList, updatedCounts, new Set(Object.keys(skippedExercises)))),
      1100
    );
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
      // No RIR gate for cardio/running exercises — Rule 1 is scoped to
      // strength primary lifts (see the autoregulation_eligible check this
      // file's handleCompleteSet makes before ever entering "rir-check").
      performedRir: null,
      performedDistanceMeters: payload.distanceMeters,
      performedDurationSeconds: payload.durationSeconds,
      performedPaceSecondsPerKm: payload.paceSecondsPerKm,
      performedHeartRate: payload.heartRate,
      performedCalories: payload.calories,
      notes: payload.notes,
    };
    const next = [...draftSets, newSet];
    setDraftSets(next);
    const nextSkipped = unskip(currentExercise.id);
    setSaving(true);
    await persist({ draftSets: next, skippedExercises: nextSkipped });
    setSaving(false);
    // Cardio/running exercises are always logged as a single summary form
    // (see ExerciseScreen's category branch), so finishing one always
    // completes it in one shot.
    const updatedCounts = draftSetCounts(next);
    setPhase("exercise-complete");
    transitionTimeout.current = setTimeout(
      () => goToExercise(findResumeExerciseId(exerciseList, updatedCounts, new Set(Object.keys(nextSkipped)))),
      1100
    );
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

  // Opened from either the exercise screen (skip the one currently on
  // screen) or the exercise list (skip any not-yet-done row directly) — see
  // SkipExerciseDialog. Which exercise it targets is tracked separately
  // from currentExerciseId since the list lets you skip something you
  // haven't navigated to yet.
  function handleOpenSkipDialog(exerciseId: string) {
    setSkipDialogExerciseId(exerciseId);
  }

  function handleConfirmSkip(reason: string | null) {
    const exerciseId = skipDialogExerciseId;
    setSkipDialogExerciseId(null);
    if (!exerciseId) return;
    const next = { ...skippedExercises, [exerciseId]: reason };
    setSkippedExercises(next);
    void persist({ skippedExercises: next });

    // Skipping the exercise currently on screen behaves like finishing it
    // (auto-advance to whatever's next incomplete) — no celebration screen
    // though, a skip isn't a completion.
    if (exerciseId === currentExerciseId) {
      goToExercise(findResumeExerciseId(exerciseList, loggedSetCounts, new Set(Object.keys(next))));
    }
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
      skippedExercises,
      workoutNote: workoutNote.trim() || null,
      readiness,
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
  const restNextTarget = currentExercise ? buildSetTargets(effectiveSets(currentExercise.sets))[loggedSetCounts.get(currentExercise.id) ?? 0] : undefined;

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

      {phase === "readiness-check" && <ReadinessCheckScreen onAnswer={handleReadinessAnswer} busy={saving} />}

      {phase === "joint-check" && <JointCheckScreen joints={flaggedJoints} onAnswer={handleJointCheckAnswer} busy={saving} />}

      {phase === "exercises" && (
        <ExerciseListScreen
          dayLabel={dayLabel}
          exercises={exerciseList}
          currentExerciseId={currentExerciseId}
          resumeExerciseId={findResumeExerciseId(exerciseList, loggedSetCounts, new Set(Object.keys(skippedExercises)))}
          loggedSetCounts={loggedSetCounts}
          skippedExerciseIds={new Set(Object.keys(skippedExercises))}
          onSelect={handleJumpToExercise}
          onSkipExercise={handleOpenSkipDialog}
          onEndWorkout={handleEndWorkout}
        />
      )}

      {phase === "exercise" && currentExercise && (
        <>
          {readinessDownregulated && currentExercise.exercise_category === "strength" && (
            <div className="mx-auto max-w-lg px-6 pt-6">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <p className="text-sm text-foreground">
                  Rough night — today has one fewer set on each exercise. Treat your top set as an RPE 7 ceiling: stop there even if the
                  plan would normally ask for more.
                </p>
              </div>
            </div>
          )}
          <ExerciseScreen
            key={currentExercise.id}
            exercise={{ ...currentExercise, sets: effectiveSets(currentExercise.sets) }}
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
            onSkipExercise={() => handleOpenSkipDialog(currentExercise.id)}
            onEndWorkout={handleEndWorkout}
            busy={saving}
          />
        </>
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

      {phase === "rir-check" && currentExercise && (
        <RirCheckScreen exerciseName={getExerciseDisplayName(currentExercise)} onAnswer={handleRirAnswer} busy={saving} />
      )}

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

      <SkipExerciseDialog
        open={skipDialogExerciseId !== null}
        exerciseName={skipDialogExerciseId ? getExerciseDisplayName(exerciseList.find((e) => e.id === skipDialogExerciseId)!) : ""}
        onClose={() => setSkipDialogExerciseId(null)}
        onConfirm={handleConfirmSkip}
        skipping={false}
      />
    </div>
  );
}
