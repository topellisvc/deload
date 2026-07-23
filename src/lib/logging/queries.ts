import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionLog } from "@/lib/supabase/types";

/**
 * All logs for a set of training days, newest first. RLS already scopes
 * this to programs the caller owns or is the athlete on, so a coach
 * calling this only ever sees logs for their own clients' programs.
 */
export async function getSessionLogs(supabase: SupabaseClient, trainingDayIds: string[]): Promise<SessionLog[]> {
  if (trainingDayIds.length === 0) return [];
  const { data } = await supabase
    .from("session_logs")
    .select("*")
    .in("training_day_id", trainingDayIds)
    .order("performed_on", { ascending: false });
  return (data ?? []) as SessionLog[];
}

/** Groups a flat log list by training_day_id — the shape components actually want. */
export function groupLogsByDay(logs: SessionLog[]): Record<string, SessionLog[]> {
  const map: Record<string, SessionLog[]> = {};
  for (const log of logs) {
    (map[log.training_day_id] ??= []).push(log);
  }
  return map;
}
