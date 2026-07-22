import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BlockExercise,
  ExerciseBlock,
  Program,
  ProgramWeek,
  SetPrescription,
  TrainingDay,
} from "@/lib/supabase/types";
import type {
  BlockExerciseRow,
  BlockRow,
  DayRow,
  ProgramSummary,
  ProgramTree,
  WeekRow,
} from "@/lib/programs/types";

/**
 * The program tree is five tables deep (program -> weeks -> days -> blocks
 * -> block_exercises -> set_prescriptions). Rather than lean on Supabase's
 * nested-select + per-foreign-table `.order()` syntax — which gets brittle
 * fast at this depth — we fetch each level as a flat, indexed query and
 * stitch it into a tree in plain JS. Same number of round trips, much
 * easier to reason about and to keep ordered correctly by `position`.
 */
export async function getProgramTree(
  supabase: SupabaseClient,
  programId: string
): Promise<ProgramTree | null> {
  const { data: program, error: programError } = await supabase
    .from("programs")
    .select("*")
    .eq("id", programId)
    .maybeSingle<Program>();

  if (programError || !program) return null;

  const { data: weeksData } = await supabase
    .from("program_weeks")
    .select("*")
    .eq("program_id", programId)
    .order("position", { ascending: true });
  const weeks = (weeksData ?? []) as ProgramWeek[];
  const weekIds = weeks.map((w) => w.id);

  const { data: daysData } = weekIds.length
    ? await supabase
        .from("training_days")
        .select("*")
        .in("week_id", weekIds)
        .order("position", { ascending: true })
    : { data: [] };
  const days = (daysData ?? []) as TrainingDay[];
  const dayIds = days.map((d) => d.id);

  const { data: blocksData } = dayIds.length
    ? await supabase
        .from("exercise_blocks")
        .select("*")
        .in("day_id", dayIds)
        .order("position", { ascending: true })
    : { data: [] };
  const blocks = (blocksData ?? []) as ExerciseBlock[];
  const blockIds = blocks.map((b) => b.id);

  const { data: blockExercisesData } = blockIds.length
    ? await supabase
        .from("block_exercises")
        .select("*")
        .in("block_id", blockIds)
        .order("position", { ascending: true })
    : { data: [] };
  const blockExercises = (blockExercisesData ?? []) as BlockExercise[];
  const blockExerciseIds = blockExercises.map((be) => be.id);

  const { data: setsData } = blockExerciseIds.length
    ? await supabase
        .from("set_prescriptions")
        .select("*")
        .in("block_exercise_id", blockExerciseIds)
        .order("position", { ascending: true })
    : { data: [] };
  const sets = (setsData ?? []) as SetPrescription[];

  const setsByBlockExercise = groupBy(sets, (s) => s.block_exercise_id);
  const blockExercisesByBlock = groupBy(blockExercises, (be) => be.block_id);
  const blocksByDay = groupBy(blocks, (b) => b.day_id);
  const daysByWeek = groupBy(days, (d) => d.week_id);

  const weekRows: WeekRow[] = weeks.map((week) => ({
    ...week,
    days: (daysByWeek.get(week.id) ?? []).map((day): DayRow => ({
      ...day,
      blocks: (blocksByDay.get(day.id) ?? []).map((block): BlockRow => ({
        ...block,
        exercises: (blockExercisesByBlock.get(block.id) ?? []).map(
          (be): BlockExerciseRow => ({
            ...be,
            sets: setsByBlockExercise.get(be.id) ?? [],
          })
        ),
      })),
    })),
  }));

  return { ...program, weeks: weekRows };
}

export async function getProgramSummaries(
  supabase: SupabaseClient,
  userId: string
): Promise<ProgramSummary[]> {
  const { data: programs } = await supabase
    .from("programs")
    .select("*")
    .or(`owner_id.eq.${userId},athlete_id.eq.${userId}`)
    .order("updated_at", { ascending: false });

  const list = (programs ?? []) as Program[];
  if (list.length === 0) return [];

  const programIds = list.map((p) => p.id);
  const { data: weeksData } = await supabase
    .from("program_weeks")
    .select("id, program_id")
    .in("program_id", programIds);
  const weeks = (weeksData ?? []) as { id: string; program_id: string }[];
  const weekIds = weeks.map((w) => w.id);

  const { data: daysData } = weekIds.length
    ? await supabase.from("training_days").select("id, week_id").in("week_id", weekIds)
    : { data: [] };
  const days = (daysData ?? []) as { id: string; week_id: string }[];

  const weeksByProgram = groupBy(weeks, (w) => w.program_id);
  const daysByWeek = groupBy(days, (d) => d.week_id);

  return list.map((program) => {
    const programWeeks = weeksByProgram.get(program.id) ?? [];
    const firstWeek = programWeeks[0];
    const dayCount = firstWeek ? (daysByWeek.get(firstWeek.id) ?? []).length : 0;
    return { ...program, weekCount: programWeeks.length, dayCount };
  });
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const existing = map.get(k);
    if (existing) existing.push(item);
    else map.set(k, [item]);
  }
  return map;
}
