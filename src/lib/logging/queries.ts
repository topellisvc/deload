import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoggedSet, SessionLog } from "@/lib/supabase/types";

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

/**
 * Every performed set/segment across a set of session_logs — the
 * Performance half of the planned/performed split (migration 0012). One
 * fetch for every log on a program page rather than one per session_log,
 * same batching principle as getSessionLogs itself.
 */
export async function getLoggedSets(supabase: SupabaseClient, sessionLogIds: string[]): Promise<LoggedSet[]> {
  if (sessionLogIds.length === 0) return [];
  const { data } = await supabase
    .from("logged_sets")
    .select("*")
    .in("session_log_id", sessionLogIds)
    .order("position", { ascending: true });
  return (data ?? []) as LoggedSet[];
}

/** Groups a flat logged_sets list by `${session_log_id}:${block_exercise_id}`
 * — the granularity the performance editor actually renders at (one
 * exercise, within one specific dated session). */
export function groupLoggedSetsByExercise(logs: LoggedSet[]): Record<string, LoggedSet[]> {
  const map: Record<string, LoggedSet[]> = {};
  for (const log of logs) {
    const key = `${log.session_log_id}:${log.block_exercise_id}`;
    (map[key] ??= []).push(log);
  }
  return map;
}
