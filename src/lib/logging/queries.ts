import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlockExercise, ExerciseBlock, LoggedSet, SessionLog, SetPrescription, TrainingDay } from "@/lib/supabase/types";
import type { BlockRow } from "@/lib/programs/types";

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

/** One dated session, with enough of its planned structure attached
 * (program name, day label, and its full block/exercise/prescription tree)
 * to render Prescription-above-Performance for the whole thing — the unit
 * getSessionHistory below returns one of per session_log. */
export interface SessionHistoryEntry {
  log: SessionLog;
  programId: string;
  programName: string;
  dayLabel: string;
  blocks: BlockRow[];
}

/**
 * Every session an athlete has ever logged, across every program they've
 * trained on — not scoped to one training_day or one program the way
 * getSessionLogs is, since a history view needs to span all of them at
 * once. Fetched as flat, indexed queries and stitched into a tree the same
 * way getProgramTree does (see that function's comment for why: nested
 * Supabase selects get brittle at this depth, flat + stitch in JS doesn't).
 * No date range or limit — "history" means all of it; a very long-running
 * athlete revisiting this page a lot is a real-world scale problem for
 * later, not a reason to silently truncate their own record now.
 */
export async function getSessionHistory(supabase: SupabaseClient, athleteId: string): Promise<SessionHistoryEntry[]> {
  const { data: logsData } = await supabase
    .from("session_logs")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("performed_on", { ascending: false })
    .order("created_at", { ascending: false });
  const logs = (logsData ?? []) as SessionLog[];
  if (logs.length === 0) return [];

  const dayIds = Array.from(new Set(logs.map((l) => l.training_day_id)));

  // Two independent chains from here — days->weeks->programs (for display
  // labels) and blocks->blockExercises->sets (the prescription tree) both
  // only need dayIds, neither needs the other's result — but they used to
  // run as one strict 6-deep sequential chain of round-trips. Running the
  // two chains concurrently roughly halves this function's total latency.
  const [{ days, weeks, programsMeta }, { blocks, blockExercises, sets }] = await Promise.all([
    (async () => {
      const { data: daysData } = await supabase.from("training_days").select("*").in("id", dayIds);
      const days = (daysData ?? []) as TrainingDay[];

      const weekIds = Array.from(new Set(days.map((d) => d.week_id)));
      const { data: weeksData } = weekIds.length
        ? await supabase.from("program_weeks").select("id, program_id").in("id", weekIds)
        : { data: [] };
      const weeks = (weeksData ?? []) as { id: string; program_id: string }[];

      const programIds = Array.from(new Set(weeks.map((w) => w.program_id)));
      const { data: programsData } = programIds.length
        ? await supabase.from("programs").select("id, name").in("id", programIds)
        : { data: [] };
      const programsMeta = (programsData ?? []) as { id: string; name: string }[];

      return { days, weeks, programsMeta };
    })(),
    (async () => {
      const { data: blocksData } = dayIds.length
        ? await supabase.from("exercise_blocks").select("*").in("day_id", dayIds).order("position", { ascending: true })
        : { data: [] };
      const blocks = (blocksData ?? []) as ExerciseBlock[];
      const blockIds = blocks.map((b) => b.id);

      const { data: blockExercisesData } = blockIds.length
        ? await supabase.from("block_exercises").select("*").in("block_id", blockIds).order("position", { ascending: true })
        : { data: [] };
      const blockExercises = (blockExercisesData ?? []) as BlockExercise[];
      const blockExerciseIds = blockExercises.map((be) => be.id);

      const { data: setsData } = blockExerciseIds.length
        ? await supabase.from("set_prescriptions").select("*").in("block_exercise_id", blockExerciseIds).order("position", { ascending: true })
        : { data: [] };
      const sets = (setsData ?? []) as SetPrescription[];

      return { blocks, blockExercises, sets };
    })(),
  ]);

  const dayById = new Map(days.map((d) => [d.id, d]));
  const weekById = new Map(weeks.map((w) => [w.id, w]));
  const programById = new Map(programsMeta.map((p) => [p.id, p]));
  const setsByBlockExercise = groupBy(sets, (s) => s.block_exercise_id);
  const blockExercisesByBlock = groupBy(blockExercises, (be) => be.block_id);
  const blocksByDay = groupBy(blocks, (b) => b.day_id);

  return logs.map((log): SessionHistoryEntry => {
    const day = dayById.get(log.training_day_id);
    const week = day ? weekById.get(day.week_id) : undefined;
    const program = week ? programById.get(week.program_id) : undefined;

    const dayBlocks: BlockRow[] = (day ? blocksByDay.get(day.id) ?? [] : []).map((block) => ({
      ...block,
      exercises: (blockExercisesByBlock.get(block.id) ?? []).map((be) => ({
        ...be,
        sets: setsByBlockExercise.get(be.id) ?? [],
      })),
    }));

    return {
      log,
      programId: program?.id ?? "",
      programName: program?.name ?? "a program",
      dayLabel: day?.label || `Day ${day?.position ?? "?"}`,
      blocks: dayBlocks,
    };
  });
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = map.get(k);
    if (arr) arr.push(item);
    else map.set(k, [item]);
  }
  return map;
}
