import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionLog } from "@/lib/supabase/types";

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
