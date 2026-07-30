import type { SupabaseClient } from "@supabase/supabase-js";
import { completeSessionLog, createLoggedSet, createSessionLog } from "@/lib/logging/mutations";
import { todayDateString } from "@/lib/dates";
import { decideReadinessDownregulation } from "@/lib/training/autoregulation";
import type { AutoregulationEventKind, ReadinessCheck } from "@/lib/training/autoregulation";
import type { DraftSet, TrainingModeSession, TrainingModeSessionRow } from "@/lib/training/types";
import { mapTrainingModeSessionRow } from "@/lib/training/types";

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
