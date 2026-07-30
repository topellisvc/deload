import type { SupabaseClient } from "@supabase/supabase-js";
import { completeSessionLog, createLoggedSet, createSessionLog } from "@/lib/logging/mutations";
import { todayDateString } from "@/lib/dates";
import { decideReadinessDownregulation, JOINT_PATTERNS, nextRungExerciseId } from "@/lib/training/autoregulation";
import type { AutoregulationEventKind, JointCheckAnswer, JointKey, ReadinessCheck } from "@/lib/training/autoregulation";
import type { DraftSet, TrainingModeSession, TrainingModeSessionRow } from "@/lib/training/types";
import { mapTrainingModeSessionRow } from "@/lib/training/types";
import { listExercises } from "@/lib/exercises/queries";
import { getAthleteInjuryProfile } from "@/lib/profile/queries";
import { activeTags, isSafeForInjuries } from "@/lib/programs/generate/injuries";
import { resolveSlotPatterns } from "@/lib/programs/generate/patterns";

interface DraftSessionParams {
  trainingDayId: string;
  athleteId: string;
  draftSets: DraftSet[];
  exerciseNotes: Record<string, string>;
  /** block_exercise_id -> optional reason, or null if none given. */
  skippedExercises: Record<string, string | null>;
  workoutNote: string | null;
  /** Rule 3's readiness answer (autoregulation.ts) — null until the
   * athlete answers it. Required, not optional, matching every other field
   * on this type: training-session.tsx's persist() always resolves every
   * field from current component state before calling saveDraftSession, the
   * same "always pass the full current draft" convention the other fields
   * already use, rather than a partial-update semantic this upsert doesn't
   * actually implement. */
  readiness: ReadinessCheck | null;
}

/**
 * Upserts the athlete's scratch state for this day — called after every
 * completed set/segment and whenever a note changes, so a refresh or a
 * dropped connection never loses more than the single most recent edit
 * (spec: "The athlete should never lose an in-progress workout").
 */
export async function saveDraftSession(
  supabase: SupabaseClient,
  params: DraftSessionParams
): Promise<{ session: TrainingModeSession | null; error: string | null }> {
  const { data, error } = await supabase
    .from("training_mode_sessions")
    .upsert(
      {
        training_day_id: params.trainingDayId,
        athlete_id: params.athleteId,
        draft_sets: params.draftSets,
        exercise_notes: params.exerciseNotes,
        skipped_exercises: params.skippedExercises,
        workout_note: params.workoutNote,
        readiness: params.readiness ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "training_day_id,athlete_id" }
    )
    .select()
    .single<TrainingModeSessionRow>();

  if (error || !data) return { session: null, error: "Couldn't save your progress. Try again." };
  return { session: mapTrainingModeSessionRow(data), error: null };
}

export async function deleteDraftSession(supabase: SupabaseClient, trainingDayId: string, athleteId: string): Promise<void> {
  await supabase.from("training_mode_sessions").delete().eq("training_day_id", trainingDayId).eq("athlete_id", athleteId);
}

/**
 * Records one autoregulation adjustment — append-only, never mutates
 * set_prescriptions (see migration 0044's header comment on why: a coach
 * may have hand-edited the plan, so the authored number stays authored;
 * the novice-to-intermediate reclassification counts these events directly;
 * and it matches this app's existing "derived state isn't stored"
 * convention).
 *
 * Deliberately doesn't write for RirGateOutcome === "no_change" — see
 * autoregulation.ts's header comment on why that's the correct fourth
 * outcome for this rule despite the DB only modeling three kinds. Callers
 * should simply not call this for a no_change result rather than passing
 * one through; there's nothing here that validates that, the same
 * trust-the-caller convention every other mutation in this file uses.
 */
export async function createAutoregulationEvent(
  supabase: SupabaseClient,
  params: { athleteId: string; blockExerciseId: string; kind: AutoregulationEventKind; detail?: Record<string, unknown> }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("autoregulation_events").insert({
    athlete_id: params.athleteId,
    block_exercise_id: params.blockExerciseId,
    kind: params.kind,
    detail: params.detail ?? {},
  });
  return { error: error ? "Couldn't record that adjustment. Try again." : null };
}

/**
 * Records one raw better/same/worse answer to joint_check_answers
 * (migration 0047) — unlike Rule 1's isSecondConsecutiveMiss, every answer
 * gets written here, not just the ones that produce a regress/progress.
 * decideJointCheck's own doc comment explains why: a single "worse" has no
 * natural event to record under Rule 1's convention, but Rule 4's
 * two-in-a-row comparison is symmetric in both directions and needs *every*
 * answer on hand as tomorrow's "previous," including "same" ones, which
 * reset the streak.
 */
export async function createJointCheckAnswer(
  supabase: SupabaseClient,
  params: { athleteId: string; joint: JointKey; answer: JointCheckAnswer }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("joint_check_answers").insert({ athlete_id: params.athleteId, joint: params.joint, answer: params.answer });
  return { error: error ? "Couldn't record that answer. Try again." : null };
}

/**
 * Walks one joint's substitution ladder one step, for every currently-
 * assigned exercise (from this week onward — past weeks are left alone,
 * same "never rewrite history" principle as everything else in this app)
 * that JOINT_PATTERNS says belongs to this joint. Called after Rule 4's
 * decideJointCheck returns "regress" or "progress". Writes one
 * autoregulation_events row (kind 'joint_regress'/'joint_progress') per
 * exercise actually substituted, same rationale migration 0044 gives for
 * why this whole layer is an append-only event log rather than a silent
 * rewrite: a coach should be able to see *why* an exercise changed.
 *
 * TWO DELIBERATE SIMPLIFICATIONS
 * -------------------------------
 * 1. The candidate pool is filtered by injury safety (activeTags /
 *    isSafeForInjuries, same as generation time) but *not* by equipment
 *    access or the lift-coaching gate — neither is persisted anywhere past
 *    the one-off generation request that used to read them (see
 *    generate/select-exercises.ts's passesHardFilters, which has all
 *    three). Persisting a standing equipment/coaching profile the way
 *    migration 0047 now does for injuries is a further, separate piece of
 *    work; flagging rather than silently pretending this filter is
 *    complete.
 * 2. block_exercises' own RLS ("block exercises follow their program's
 *    access") restricts writes to the *program owner*, not the athlete —
 *    the same gap Rule 2's repeat-week control hit. For a self-programmed
 *    athlete (owner_id === athlete_id) this works today; for a
 *    coach-assigned program it will silently affect zero rows. This
 *    function detects that (via `.select()` on the update, so a
 *    zero-row result is visible) and reports it through `skippedCount`
 *    rather than claiming success it didn't have.
 */
export async function applyJointLadderStep(
  supabase: SupabaseClient,
  params: { athleteId: string; programId: string; fromWeekPosition: number; joint: JointKey; direction: "regress" | "progress" }
): Promise<{ updatedCount: number; skippedCount: number; error: string | null }> {
  const [injuries, exercises] = await Promise.all([getAthleteInjuryProfile(supabase, params.athleteId), listExercises(supabase)]);
  const tags = activeTags(injuries);
  const pool = exercises.filter((e) => !e.is_archived && e.review_status === "approved" && isSafeForInjuries(e, tags));
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));

  const { data: weeksData } = await supabase.from("program_weeks").select("id").eq("program_id", params.programId).gte("position", params.fromWeekPosition);
  const weekIds = ((weeksData ?? []) as { id: string }[]).map((w) => w.id);
  if (weekIds.length === 0) return { updatedCount: 0, skippedCount: 0, error: null };

  const { data: daysData } = await supabase.from("training_days").select("id").in("week_id", weekIds);
  const dayIds = ((daysData ?? []) as { id: string }[]).map((d) => d.id);
  if (dayIds.length === 0) return { updatedCount: 0, skippedCount: 0, error: null };

  const { data: blocksData } = await supabase.from("exercise_blocks").select("id").in("day_id", dayIds);
  const blockIds = ((blocksData ?? []) as { id: string }[]).map((b) => b.id);
  if (blockIds.length === 0) return { updatedCount: 0, skippedCount: 0, error: null };

  const { data: blockExercisesData } = await supabase
    .from("block_exercises")
    .select("id, exercise_id")
    .in("block_id", blockIds)
    .not("exercise_id", "is", null);
  const blockExercises = ((blockExercisesData ?? []) as { id: string; exercise_id: string }[]).filter((be) => exerciseById.has(be.exercise_id));

  const patterns = JOINT_PATTERNS[params.joint];
  let updatedCount = 0;
  let skippedCount = 0;

  for (const be of blockExercises) {
    const currentExercise = exerciseById.get(be.exercise_id)!;
    const relevantPatterns = resolveSlotPatterns(currentExercise).filter((p) => patterns.includes(p));
    if (relevantPatterns.length === 0) continue;

    let nextExerciseId: string | null = null;
    for (const pattern of relevantPatterns) {
      nextExerciseId = nextRungExerciseId(pool, pattern, be.exercise_id, params.direction);
      if (nextExerciseId) break;
    }
    if (!nextExerciseId || nextExerciseId === be.exercise_id) continue;

    const { data: updated, error } = await supabase.from("block_exercises").update({ exercise_id: nextExerciseId }).eq("id", be.id).select("id");
    if (error) continue;
    if (updated && updated.length > 0) {
      updatedCount += 1;
      // One event per substituted exercise, not one per joint-check answer —
      // matches migration 0044's own rationale for why this is a table and
      // not a silent mutation: a coach reading this exercise's history
      // should see "why did the exercise change," not just "why did the
      // load change." Best-effort; a failure here shouldn't undo or block
      // the substitution that already landed.
      void createAutoregulationEvent(supabase, {
        athleteId: params.athleteId,
        blockExerciseId: be.id,
        kind: params.direction === "regress" ? "joint_regress" : "joint_progress",
        detail: { joint: params.joint, fromExerciseId: be.exercise_id, toExerciseId: nextExerciseId },
      });
    } else {
      skippedCount += 1;
    }
  }

  return { updatedCount, skippedCount, error: null };
}

/**
 * Turns a finished draft into a real workout log — exactly the same
 * createSessionLog + createLoggedSet calls the manual "Log today" flow has
 * always used (spec: "Create the workout log exactly as the current system
 * does"), so nothing downstream (Coach Review, History, dashboard stats)
 * needs to know Training Mode was involved at all. The draft row is deleted
 * only after this succeeds, so a failure here never strands progress.
 *
 * If the athlete skipped today's day earlier and has now come back and
 * actually trained it, there's already a session_logs row for
 * (training_day_id, athlete_id, today) — the unique constraint means a
 * plain insert would fail with "Already logged for this date." Reusing
 * that row (turning it from skipped into completed) is what "going back
 * and completing a skipped workout" needs, so this checks for one first.
 */
export async function finishWorkout(
  supabase: SupabaseClient,
  params: DraftSessionParams
): Promise<{ sessionLogId: string | null; error: string | null }> {
  const performedOn = todayDateString();

  // Rule 3 (coach-answers §2 Rule 3): "folded into the session log at
  // Finish Workout" — the raw sleep/soreness answers themselves don't need
  // their own permanent column (the consequence that actually matters,
  // excluding this session from Rule 1's miss-streak count, is captured per
  // exercise via createAutoregulationEvent's 'readiness_downregulated' kind
  // instead — see training-session.tsx's handleRirAnswer), but a coach
  // reading this session later should still see plainly why less was asked
  // of the athlete today, not silently reduced sets with no explanation.
  const readinessNote =
    params.readiness && decideReadinessDownregulation(params.readiness)
      ? "Reduced load today — reported a rough night's sleep and high soreness."
      : null;
  const note = readinessNote ? [readinessNote, params.workoutNote].filter(Boolean).join("\n\n") || null : params.workoutNote;

  const { data: existing } = await supabase
    .from("session_logs")
    .select("id")
    .eq("training_day_id", params.trainingDayId)
    .eq("athlete_id", params.athleteId)
    .eq("performed_on", performedOn)
    .maybeSingle<{ id: string }>();

  let sessionLogId: string;
  if (existing) {
    const { error: completeError } = await completeSessionLog(supabase, existing.id, note);
    if (completeError) return { sessionLogId: null, error: completeError };
    sessionLogId = existing.id;
  } else {
    const { log, error: logError } = await createSessionLog(supabase, {
      trainingDayId: params.trainingDayId,
      athleteId: params.athleteId,
      performedOn,
      note,
    });
    if (logError || !log) return { sessionLogId: null, error: logError ?? "Couldn't save this workout. Try again." };
    sessionLogId = log.id;
  }

  const maxPositionByExercise = new Map<string, number>();
  for (const s of params.draftSets) {
    maxPositionByExercise.set(s.blockExerciseId, Math.max(maxPositionByExercise.get(s.blockExerciseId) ?? 0, s.position));
  }

  const writes = params.draftSets.map((s) =>
    createLoggedSet(supabase, {
      sessionLogId,
      blockExerciseId: s.blockExerciseId,
      setPrescriptionId: s.setPrescriptionId,
      position: s.position,
      performedWeight: s.performedWeight,
      performedReps: s.performedReps,
      performedRpe: s.performedRpe,
      performedRir: s.performedRir,
      performedDistanceMeters: s.performedDistanceMeters,
      performedDurationSeconds: s.performedDurationSeconds,
      performedPaceSecondsPerKm: s.performedPaceSecondsPerKm,
      performedHeartRate: s.performedHeartRate,
      performedCalories: s.performedCalories,
      notes: s.notes,
    })
  );

  // Exercise-level notes ("Left shoulder felt tight") aren't a field on
  // logged_sets — they become their own notes-only row, one position past
  // that exercise's last real set. PerformanceRowEditor/PerformanceRowReadOnly
  // already render a sets-only-notes row correctly (nothing else in the app
  // needed to change for these to show up in Coach Review or History).
  //
  // maxPositionByExercise is incremented after each notes-only write below
  // (both here and in the skipped-exercises loop that follows) rather than
  // being computed once up front — logged_sets has a unique constraint on
  // (session_log_id, block_exercise_id, position), so a second notes-only
  // row for the same exercise (a note *and* a skip reason, in the unusual
  // case both exist) would otherwise collide on the same position.
  for (const [blockExerciseId, note] of Object.entries(params.exerciseNotes)) {
    const trimmed = note.trim();
    if (!trimmed) continue;
    const position = (maxPositionByExercise.get(blockExerciseId) ?? 0) + 1;
    maxPositionByExercise.set(blockExerciseId, position);
    writes.push(
      createLoggedSet(supabase, {
        sessionLogId,
        blockExerciseId,
        setPrescriptionId: null,
        position,
        notes: trimmed,
      })
    );
  }

  // Skipped exercises ("didn't do this one today") become a notes-only row
  // too, same mechanism as exercise notes above. Guarded by "no real draft
  // sets were logged for this exercise" — if the athlete skipped, then came
  // back and actually trained the exercise, it should already have been
  // dropped from skippedExercises client-side (see training-session.tsx),
  // but this is a defensive belt-and-suspenders check against writing a
  // stale "Skipped" row over real logged sets.
  for (const [blockExerciseId, reason] of Object.entries(params.skippedExercises)) {
    const hasRealSets = params.draftSets.some((s) => s.blockExerciseId === blockExerciseId);
    if (hasRealSets) continue;
    const position = (maxPositionByExercise.get(blockExerciseId) ?? 0) + 1;
    maxPositionByExercise.set(blockExerciseId, position);
    const trimmedReason = reason?.trim();
    writes.push(
      createLoggedSet(supabase, {
        sessionLogId,
        blockExerciseId,
        setPrescriptionId: null,
        position,
        notes: trimmedReason ? `Skipped — ${trimmedReason}` : "Skipped",
      })
    );
  }

  await Promise.all(writes);
  await deleteDraftSession(supabase, params.trainingDayId, params.athleteId);
  return { sessionLogId, error: null };
}
