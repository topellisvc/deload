import type { SupabaseClient } from "@supabase/supabase-js";
import { createLoggedSet, createSessionLog } from "@/lib/logging/mutations";
import { todayDateString } from "@/lib/dates";
import type { DraftSet, TrainingModeSession, TrainingModeSessionRow } from "@/lib/training/types";
import { mapTrainingModeSessionRow } from "@/lib/training/types";

interface DraftSessionParams {
  trainingDayId: string;
  athleteId: string;
  draftSets: DraftSet[];
  exerciseNotes: Record<string, string>;
  workoutNote: string | null;
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
        workout_note: params.workoutNote,
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
 * Turns a finished draft into a real workout log — exactly the same
 * createSessionLog + createLoggedSet calls the manual "Log today" flow has
 * always used (spec: "Create the workout log exactly as the current system
 * does"), so nothing downstream (Coach Review, History, dashboard stats)
 * needs to know Training Mode was involved at all. The draft row is deleted
 * only after this succeeds, so a failure here never strands progress.
 */
export async function finishWorkout(
  supabase: SupabaseClient,
  params: DraftSessionParams
): Promise<{ sessionLogId: string | null; error: string | null }> {
  const { log, error: logError } = await createSessionLog(supabase, {
    trainingDayId: params.trainingDayId,
    athleteId: params.athleteId,
    performedOn: todayDateString(),
    note: params.workoutNote,
  });
  if (logError || !log) return { sessionLogId: null, error: logError ?? "Couldn't save this workout. Try again." };

  const maxPositionByExercise = new Map<string, number>();
  for (const s of params.draftSets) {
    maxPositionByExercise.set(s.blockExerciseId, Math.max(maxPositionByExercise.get(s.blockExerciseId) ?? 0, s.position));
  }

  const writes = params.draftSets.map((s) =>
    createLoggedSet(supabase, {
      sessionLogId: log.id,
      blockExerciseId: s.blockExerciseId,
      setPrescriptionId: s.setPrescriptionId,
      position: s.position,
      performedWeight: s.performedWeight,
      performedReps: s.performedReps,
      performedRpe: s.performedRpe,
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
  for (const [blockExerciseId, note] of Object.entries(params.exerciseNotes)) {
    const trimmed = note.trim();
    if (!trimmed) continue;
    writes.push(
      createLoggedSet(supabase, {
        sessionLogId: log.id,
        blockExerciseId,
        setPrescriptionId: null,
        position: (maxPositionByExercise.get(blockExerciseId) ?? 0) + 1,
        notes: trimmed,
      })
    );
  }

  await Promise.all(writes);
  await deleteDraftSession(supabase, params.trainingDayId, params.athleteId);
  return { sessionLogId: log.id, error: null };
}
