import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlockExercise, ExerciseBlock, LoggedSet, Program, SetPrescription, TrainingDay } from "@/lib/supabase/types";
import type { BlockExerciseRow, BlockRow } from "@/lib/programs/types";
import type { PreviousPerformance, TrainingDayDetail, TrainingModeSession, TrainingModeSessionRow } from "@/lib/training/types";
import { mapTrainingModeSessionRow } from "@/lib/training/types";

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

/**
 * Everything Training Mode needs about one training day — its own block
 * tree plus enough program/week context for the Overview screen (program
 * name, week label/position, total weeks). Deliberately scoped to a single
 * day rather than reusing getProgramTree: launching a workout only ever
 * needs one day, not the whole program's weeks fetched and discarded.
 * Same flat-query-and-stitch approach as getProgramTree (see that
 * function's comment) for the block/exercise/set levels.
 */
export async function getTrainingDayForTraining(supabase: SupabaseClient, trainingDayId: string): Promise<TrainingDayDetail | null> {
  const { data: dayData, error: dayError } = await supabase
    .from("training_days")
    .select("*")
    .eq("id", trainingDayId)
    .maybeSingle<TrainingDay>();
  if (dayError || !dayData) return null;

  const { data: weekData } = await supabase
    .from("program_weeks")
    .select("*")
    .eq("id", dayData.week_id)
    .maybeSingle<{ id: string; program_id: string; position: number; label: string | null }>();
  if (!weekData) return null;

  const [programResult, allWeeksResult, blocks] = await Promise.all([
    supabase.from("programs").select("*").eq("id", weekData.program_id).maybeSingle<Program>(),
    supabase.from("program_weeks").select("id").eq("program_id", weekData.program_id),
    (async (): Promise<BlockRow[]> => {
      const { data: blocksData } = await supabase
        .from("exercise_blocks")
        .select("*")
        .eq("day_id", trainingDayId)
        .order("position", { ascending: true });
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

      const setsByBlockExercise = groupBy(sets, (s) => s.block_exercise_id);
      const blockExercisesByBlock = groupBy(blockExercises, (be) => be.block_id);

      return blocks.map((block): BlockRow => ({
        ...block,
        exercises: (blockExercisesByBlock.get(block.id) ?? []).map((be): BlockExerciseRow => ({
          ...be,
          sets: setsByBlockExercise.get(be.id) ?? [],
        })),
      }));
    })(),
  ]);

  const program = programResult.data;
  if (!program) return null;
  const totalWeeks = (allWeeksResult.data ?? []).length;

  return {
    day: { ...dayData, blocks },
    week: { id: weekData.id, label: weekData.label, position: weekData.position },
    totalWeeks,
    program: { id: program.id, name: program.name, ownerId: program.owner_id, athleteId: program.athlete_id },
  };
}

/** The athlete's own in-progress draft for this day, if one exists — the
 * single source of truth resume reads from. */
export async function getDraftSession(supabase: SupabaseClient, trainingDayId: string, athleteId: string): Promise<TrainingModeSession | null> {
  const { data } = await supabase
    .from("training_mode_sessions")
    .select("*")
    .eq("training_day_id", trainingDayId)
    .eq("athlete_id", athleteId)
    .maybeSingle<TrainingModeSessionRow>();
  return data ? mapTrainingModeSessionRow(data) : null;
}

/**
 * Which of these training days currently have an in-progress draft for this
 * athlete — a single batched existence check (id column only) so callers
 * that need to label a whole list of days (dashboard, program view) don't
 * issue one query per day. Used to swap "Start workout" for "Continue
 * training" wherever the athlete exited mid-session.
 */
export async function getDraftSessionDayIds(
  supabase: SupabaseClient,
  trainingDayIds: string[],
  athleteId: string
): Promise<Set<string>> {
  if (trainingDayIds.length === 0) return new Set();
  const { data } = await supabase
    .from("training_mode_sessions")
    .select("training_day_id")
    .eq("athlete_id", athleteId)
    .in("training_day_id", trainingDayIds);
  return new Set(((data ?? []) as { training_day_id: string }[]).map((r) => r.training_day_id));
}

/**
 * Whether every non-rest day in this program now has at least one
 * non-skipped session log — checked right after Finish Workout to detect
 * "that was the last thing left to train" and show the Program Complete
 * screen. Skipped days don't count as done, matching the dashboard's own
 * completion % definition (see distinctLoggedNonRest in
 * lib/dashboard/queries.ts's getActiveProgramContext) so this never
 * disagrees with what the dashboard calls "100% complete." A program with
 * zero non-rest days (e.g. mid-setup) is never "complete" — there's
 * nothing to have finished.
 */
export async function isProgramComplete(supabase: SupabaseClient, programId: string, athleteId: string): Promise<boolean> {
  const { data: weeksData } = await supabase.from("program_weeks").select("id").eq("program_id", programId);
  const weekIds = ((weeksData ?? []) as { id: string }[]).map((w) => w.id);
  if (weekIds.length === 0) return false;

  const { data: daysData } = await supabase.from("training_days").select("id, is_rest_day").in("week_id", weekIds);
  const nonRestDayIds = ((daysData ?? []) as { id: string; is_rest_day: boolean }[])
    .filter((d) => !d.is_rest_day)
    .map((d) => d.id);
  if (nonRestDayIds.length === 0) return false;

  const { data: logsData } = await supabase
    .from("session_logs")
    .select("training_day_id")
    .eq("athlete_id", athleteId)
    .eq("skipped", false)
    .in("training_day_id", nonRestDayIds);
  const loggedDayIds = new Set(((logsData ?? []) as { training_day_id: string }[]).map((l) => l.training_day_id));

  return nonRestDayIds.every((id) => loggedDayIds.has(id));
}

/**
 * The athlete's most recent *performed* occurrence of each given exercise —
 * "Last Session" comparisons never look at the programmed target (spec: "Do
 * not compare against the programmed workout"). Matched by exercise identity
 * (exercise_id, or custom_name when there's no catalog id), not
 * block_exercise_id, because each week's days/blocks/exercises are their own
 * rows — the "same" exercise in week 2 is a different block_exercise from
 * week 1 (see migration 0014's header). Batched across every exercise in the
 * day at once rather than one query per exercise.
 */
export async function getPreviousPerformanceForExercises(
  supabase: SupabaseClient,
  athleteId: string,
  exercises: { blockExerciseId: string; exerciseId: string | null; customName: string | null }[]
): Promise<Record<string, PreviousPerformance>> {
  const result: Record<string, PreviousPerformance> = {};
  if (exercises.length === 0) return result;

  const exerciseIds = Array.from(new Set(exercises.filter((e) => e.exerciseId).map((e) => e.exerciseId as string)));
  const customNames = Array.from(new Set(exercises.filter((e) => !e.exerciseId && e.customName).map((e) => e.customName as string)));

  const [byExerciseIdResult, byCustomNameResult] = await Promise.all([
    exerciseIds.length
      ? supabase.from("block_exercises").select("id, exercise_id").in("exercise_id", exerciseIds)
      : Promise.resolve({ data: [] as { id: string; exercise_id: string | null }[] }),
    customNames.length
      ? supabase.from("block_exercises").select("id, custom_name").is("exercise_id", null).in("custom_name", customNames)
      : Promise.resolve({ data: [] as { id: string; custom_name: string | null }[] }),
  ]);

  // block_exercise_id -> the identity key it matches (exercise_id or custom_name).
  const identityByBlockExerciseId = new Map<string, string>();
  for (const row of (byExerciseIdResult.data ?? []) as { id: string; exercise_id: string | null }[]) {
    if (row.exercise_id) identityByBlockExerciseId.set(row.id, row.exercise_id);
  }
  for (const row of (byCustomNameResult.data ?? []) as { id: string; custom_name: string | null }[]) {
    if (row.custom_name) identityByBlockExerciseId.set(row.id, row.custom_name);
  }

  const matchedBlockExerciseIds = Array.from(identityByBlockExerciseId.keys());
  if (matchedBlockExerciseIds.length === 0) return result;

  // Capped rather than unbounded: this is a "what did I do last time"
  // lookup across every exercise in today's workout at once, not a full
  // history read — 500 rows comfortably covers the most recent occurrence
  // of each exercise for any realistically-sized single day.
  const { data: loggedSetsData } = await supabase
    .from("logged_sets")
    .select("*, session_logs!inner(performed_on, created_at, athlete_id)")
    .in("block_exercise_id", matchedBlockExerciseIds)
    .eq("session_logs.athlete_id", athleteId)
    .limit(500);

  type Row = LoggedSet & { session_logs: { performed_on: string; created_at: string } };
  const rows = (loggedSetsData ?? []) as unknown as Row[];

  // Group by identity, find each identity's most recent session_log_id
  // (by performed_on desc, created_at desc, all in JS rather than relying
  // on multi-table ORDER BY composition), then keep only that session's sets.
  const rowsByIdentity = new Map<string, Row[]>();
  for (const row of rows) {
    const identity = identityByBlockExerciseId.get(row.block_exercise_id);
    if (!identity) continue;
    const arr = rowsByIdentity.get(identity) ?? [];
    arr.push(row);
    rowsByIdentity.set(identity, arr);
  }

  const mostRecentByIdentity = new Map<string, { sessionLogId: string; performedOn: string; sets: LoggedSet[] }>();
  for (const [identity, identityRows] of rowsByIdentity) {
    const bySessionLog = groupBy(identityRows, (r) => r.session_log_id);
    let best: { sessionLogId: string; performedOn: string; createdAt: string; sets: LoggedSet[] } | null = null;
    for (const [sessionLogId, sessionRows] of bySessionLog) {
      const { performed_on: performedOn, created_at: createdAt } = sessionRows[0]!.session_logs;
      if (!best || performedOn > best.performedOn || (performedOn === best.performedOn && createdAt > best.createdAt)) {
        best = { sessionLogId, performedOn, createdAt, sets: sessionRows };
      }
    }
    if (best) mostRecentByIdentity.set(identity, best);
  }

  for (const exercise of exercises) {
    const identity = exercise.exerciseId ?? exercise.customName;
    if (!identity) continue;
    const match = mostRecentByIdentity.get(identity);
    if (!match) continue;
    result[exercise.blockExerciseId] = {
      performedOn: match.performedOn,
      sets: [...match.sets].sort((a, b) => a.position - b.position),
    };
  }

  return result;
}
