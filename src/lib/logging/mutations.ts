import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoggedSet, SessionLog } from "@/lib/supabase/types";

/**
 * Marks a training day done for a given calendar date. The unique
 * constraint (training_day_id, athlete_id, performed_on) means logging
 * the same day twice on the same date is a friendly no-op error, not a
 * silent duplicate — the UI only ever calls this when there's no existing
 * log for that date, but the constraint is the real guarantee.
 */
export async function createSessionLog(
  supabase: SupabaseClient,
  params: { trainingDayId: string; athleteId: string; performedOn: string; note?: string | null }
): Promise<{ log: SessionLog | null; error: string | null }> {
  const { data, error } = await supabase
    .from("session_logs")
    .insert({
      training_day_id: params.trainingDayId,
      athlete_id: params.athleteId,
      performed_on: params.performedOn,
      note: params.note ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return { log: null, error: "Already logged for this date." };
    return { log: null, error: "Couldn't log this session. Try again." };
  }
  return { log: data as SessionLog, error: null };
}

export async function updateSessionLogNote(
  supabase: SupabaseClient,
  logId: string,
  note: string | null
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("session_logs").update({ note }).eq("id", logId);
  return { error: error ? "Couldn't save that note. Try again." : null };
}

export async function deleteSessionLog(supabase: SupabaseClient, logId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("session_logs").delete().eq("id", logId);
  return { error: error ? "Couldn't remove this log. Try again." : null };
}

/**
 * Records one performed set/segment — the Performance half of the
 * planned/performed split. Never touches set_prescriptions; this is a
 * wholly separate insert, so logging what actually happened can never
 * overwrite what was planned (see migration 0012's header comment).
 */
export async function createLoggedSet(
  supabase: SupabaseClient,
  params: {
    sessionLogId: string;
    blockExerciseId: string;
    setPrescriptionId: string | null;
    position: number;
    performedWeight?: number | null;
    performedReps?: number | null;
    performedRpe?: number | null;
    performedDistanceMeters?: number | null;
    performedDurationSeconds?: number | null;
    performedPaceSecondsPerKm?: number | null;
    performedHeartRate?: number | null;
    performedCalories?: number | null;
    notes?: string | null;
  }
): Promise<{ log: LoggedSet | null; error: string | null }> {
  const { data, error } = await supabase
    .from("logged_sets")
    .insert({
      session_log_id: params.sessionLogId,
      block_exercise_id: params.blockExerciseId,
      set_prescription_id: params.setPrescriptionId,
      position: params.position,
      performed_weight: params.performedWeight ?? null,
      performed_reps: params.performedReps ?? null,
      performed_rpe: params.performedRpe ?? null,
      performed_distance_meters: params.performedDistanceMeters ?? null,
      performed_duration_seconds: params.performedDurationSeconds ?? null,
      performed_pace_seconds_per_km: params.performedPaceSecondsPerKm ?? null,
      performed_heart_rate: params.performedHeartRate ?? null,
      performed_calories: params.performedCalories ?? null,
      notes: params.notes ?? null,
    })
    .select()
    .single();

  if (error) return { log: null, error: "Couldn't log that. Try again." };
  return { log: data as LoggedSet, error: null };
}

export async function updateLoggedSet(
  supabase: SupabaseClient,
  logId: string,
  patch: Partial<{
    performed_weight: number | null;
    performed_reps: number | null;
    performed_rpe: number | null;
    performed_distance_meters: number | null;
    performed_duration_seconds: number | null;
    performed_pace_seconds_per_km: number | null;
    performed_heart_rate: number | null;
    performed_calories: number | null;
    notes: string | null;
  }>
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("logged_sets").update(patch).eq("id", logId);
  return { error: error ? "Couldn't save that. Try again." : null };
}

export async function deleteLoggedSet(supabase: SupabaseClient, logId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("logged_sets").delete().eq("id", logId);
  return { error: error ? "Couldn't remove that. Try again." : null };
}
