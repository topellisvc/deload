import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BlockExerciseRow,
  BlockRow,
  DayRow,
  LoadType,
  ProgramDiscipline,
  ProgramTree,
  SetRow,
  WeekRow,
} from "@/lib/programs/types";

/**
 * Every row in the program tree gets its id generated here on the client
 * (not left to the database default) so a whole new branch — a week with
 * its days, blocks, exercises and sets — can be built as one local object
 * and inserted in a handful of batched requests, with the local state
 * already matching the DB rows exactly. No round trip needed to learn an
 * id before the next level can reference it.
 */
function newId(): string {
  return crypto.randomUUID();
}

function newSet(blockExerciseId: string, position: number, overrides?: Partial<SetRow>): SetRow {
  return {
    id: newId(),
    block_exercise_id: blockExerciseId,
    position,
    sets: 3,
    reps: "8-10",
    load_type: "weight",
    load_value: null,
    rest_seconds: 90,
    notes: null,
    ...overrides,
  };
}

// ============================================================
// Programs
// ============================================================

export async function createProgram(
  supabase: SupabaseClient,
  params: {
    userId: string;
    name: string;
    discipline: ProgramDiscipline;
    dayLabels: string[];
  }
): Promise<{ program: ProgramTree | null; error: string | null }> {
  const programId = newId();
  const weekId = newId();
  const now = new Date().toISOString();

  const days: DayRow[] = params.dayLabels.map((label, i) => ({
    id: newId(),
    week_id: weekId,
    position: i + 1,
    label,
    is_rest_day: false,
    blocks: [],
  }));

  const { error: programError } = await supabase.from("programs").insert({
    id: programId,
    owner_id: params.userId,
    athlete_id: params.userId,
    name: params.name,
    discipline: params.discipline,
  });
  if (programError) return { program: null, error: programError.message };

  const { error: weekError } = await supabase.from("program_weeks").insert({
    id: weekId,
    program_id: programId,
    position: 1,
    label: "Week 1",
  });
  if (weekError) return { program: null, error: weekError.message };

  const { error: daysError } = await supabase.from("training_days").insert(
    days.map(({ id, week_id, position, label, is_rest_day }) => ({
      id,
      week_id,
      position,
      label,
      is_rest_day,
    }))
  );
  if (daysError) return { program: null, error: daysError.message };

  const program: ProgramTree = {
    id: programId,
    owner_id: params.userId,
    athlete_id: params.userId,
    name: params.name,
    discipline: params.discipline,
    created_at: now,
    updated_at: now,
    weeks: [{ id: weekId, program_id: programId, position: 1, label: "Week 1", based_on_week_id: null, created_at: now, days }],
  };

  return { program, error: null };
}

export async function updateProgram(
  supabase: SupabaseClient,
  programId: string,
  patch: { name?: string; discipline?: ProgramDiscipline }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("programs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", programId);
  return { error: error?.message ?? null };
}

export async function deleteProgram(
  supabase: SupabaseClient,
  programId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("programs").delete().eq("id", programId);
  return { error: error?.message ?? null };
}

// ============================================================
// Weeks
// ============================================================

/**
 * Adds a new week. With no `sourceWeek`, it gets a blank copy of the day
 * skeleton (labels + rest flags) so day counts stay consistent across a
 * program's weeks. With a `sourceWeek`, every block/exercise/set is
 * duplicated too — `progressionPercent` scales `load_value` on rows whose
 * `load_type` is 'weight' or 'percent_1rm' (the only load types where
 * scaling a number makes sense).
 */
export async function addWeek(
  supabase: SupabaseClient,
  params: {
    programId: string;
    position: number;
    dayTemplate: { label: string | null; is_rest_day: boolean }[];
    sourceWeek?: WeekRow;
    progressionPercent?: number;
  }
): Promise<{ week: WeekRow | null; error: string | null }> {
  const weekId = newId();
  const label = `Week ${params.position}`;

  const { error: weekError } = await supabase.from("program_weeks").insert({
    id: weekId,
    program_id: params.programId,
    position: params.position,
    label,
    based_on_week_id: params.sourceWeek?.id ?? null,
  });
  if (weekError) return { week: null, error: weekError.message };

  const sourceDays = params.sourceWeek?.days ?? params.dayTemplate.map((t) => ({ ...t, blocks: [] }));
  const scale = 1 + (params.progressionPercent ?? 0) / 100;

  const days: DayRow[] = [];
  const blocksToInsert: Record<string, unknown>[] = [];
  const exercisesToInsert: Record<string, unknown>[] = [];
  const setsToInsert: Record<string, unknown>[] = [];

  sourceDays.forEach((sourceDay, dayIndex) => {
    const dayId = newId();
    const sourceBlocks = "blocks" in sourceDay ? sourceDay.blocks : [];
    const day: DayRow = {
      id: dayId,
      week_id: weekId,
      position: dayIndex + 1,
      label: sourceDay.label,
      is_rest_day: sourceDay.is_rest_day,
      blocks: [],
    };

    const newBlocks: BlockRow[] = sourceBlocks.map((sourceBlock) => {
      const blockId = newId();
      blocksToInsert.push({
        id: blockId,
        day_id: dayId,
        position: sourceBlock.position,
        block_type: sourceBlock.block_type,
        rounds: sourceBlock.rounds,
      });

      const newExercises: BlockExerciseRow[] = sourceBlock.exercises.map((sourceExercise) => {
        const exerciseId = newId();
        exercisesToInsert.push({
          id: exerciseId,
          block_id: blockId,
          position: sourceExercise.position,
          exercise_id: sourceExercise.exercise_id,
          custom_name: sourceExercise.custom_name,
          notes: sourceExercise.notes,
        });

        const newSets: SetRow[] = sourceExercise.sets.map((sourceSet) => {
          const setId = newId();
          const scaledLoad =
            sourceSet.load_value != null && (sourceSet.load_type === "weight" || sourceSet.load_type === "percent_1rm")
              ? Math.round(sourceSet.load_value * scale * 10) / 10
              : sourceSet.load_value;
          setsToInsert.push({
            id: setId,
            block_exercise_id: exerciseId,
            position: sourceSet.position,
            sets: sourceSet.sets,
            reps: sourceSet.reps,
            load_type: sourceSet.load_type,
            load_value: scaledLoad,
            rest_seconds: sourceSet.rest_seconds,
            notes: sourceSet.notes,
          });
          return { ...sourceSet, id: setId, block_exercise_id: exerciseId, load_value: scaledLoad };
        });

        return { ...sourceExercise, id: exerciseId, block_id: blockId, sets: newSets };
      });

      return { ...sourceBlock, id: blockId, day_id: dayId, exercises: newExercises };
    });

    day.blocks = newBlocks;
    days.push(day);
  });

  if (days.length) {
    const { error: daysError } = await supabase.from("training_days").insert(
      days.map(({ id, week_id, position, label: l, is_rest_day }) => ({ id, week_id, position, label: l, is_rest_day }))
    );
    if (daysError) return { week: null, error: daysError.message };
  }
  if (blocksToInsert.length) {
    const { error } = await supabase.from("exercise_blocks").insert(blocksToInsert);
    if (error) return { week: null, error: error.message };
  }
  if (exercisesToInsert.length) {
    const { error } = await supabase.from("block_exercises").insert(exercisesToInsert);
    if (error) return { week: null, error: error.message };
  }
  if (setsToInsert.length) {
    const { error } = await supabase.from("set_prescriptions").insert(setsToInsert);
    if (error) return { week: null, error: error.message };
  }

  return {
    week: {
      id: weekId,
      program_id: params.programId,
      position: params.position,
      label,
      based_on_week_id: params.sourceWeek?.id ?? null,
      created_at: new Date().toISOString(),
      days,
    },
    error: null,
  };
}

export async function deleteWeek(supabase: SupabaseClient, weekId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("program_weeks").delete().eq("id", weekId);
  return { error: error?.message ?? null };
}

// ============================================================
// Days
// ============================================================

export async function updateDay(
  supabase: SupabaseClient,
  dayId: string,
  patch: { label?: string | null; is_rest_day?: boolean }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("training_days").update(patch).eq("id", dayId);
  return { error: error?.message ?? null };
}

/**
 * Duplicates every block in `sourceDay` and appends the copies to the end
 * of the target day (non-destructive — existing content on the target day
 * is left alone).
 */
export async function copyDayContents(
  supabase: SupabaseClient,
  params: { sourceDay: DayRow; targetDayId: string; targetStartPosition: number }
): Promise<{ blocks: BlockRow[]; error: string | null }> {
  const blocksToInsert: Record<string, unknown>[] = [];
  const exercisesToInsert: Record<string, unknown>[] = [];
  const setsToInsert: Record<string, unknown>[] = [];

  const newBlocks: BlockRow[] = params.sourceDay.blocks.map((sourceBlock, i) => {
    const blockId = newId();
    const position = params.targetStartPosition + i;
    blocksToInsert.push({
      id: blockId,
      day_id: params.targetDayId,
      position,
      block_type: sourceBlock.block_type,
      rounds: sourceBlock.rounds,
    });

    const newExercises: BlockExerciseRow[] = sourceBlock.exercises.map((sourceExercise) => {
      const exerciseId = newId();
      exercisesToInsert.push({
        id: exerciseId,
        block_id: blockId,
        position: sourceExercise.position,
        exercise_id: sourceExercise.exercise_id,
        custom_name: sourceExercise.custom_name,
        notes: sourceExercise.notes,
      });

      const newSets: SetRow[] = sourceExercise.sets.map((sourceSet) => {
        const setId = newId();
        setsToInsert.push({
          id: setId,
          block_exercise_id: exerciseId,
          position: sourceSet.position,
          sets: sourceSet.sets,
          reps: sourceSet.reps,
          load_type: sourceSet.load_type,
          load_value: sourceSet.load_value,
          rest_seconds: sourceSet.rest_seconds,
          notes: sourceSet.notes,
        });
        return { ...sourceSet, id: setId, block_exercise_id: exerciseId };
      });

      return { ...sourceExercise, id: exerciseId, block_id: blockId, sets: newSets };
    });

    return { ...sourceBlock, id: blockId, day_id: params.targetDayId, position, exercises: newExercises };
  });

  if (blocksToInsert.length) {
    const { error } = await supabase.from("exercise_blocks").insert(blocksToInsert);
    if (error) return { blocks: [], error: error.message };
  }
  if (exercisesToInsert.length) {
    const { error } = await supabase.from("block_exercises").insert(exercisesToInsert);
    if (error) return { blocks: [], error: error.message };
  }
  if (setsToInsert.length) {
    const { error } = await supabase.from("set_prescriptions").insert(setsToInsert);
    if (error) return { blocks: [], error: error.message };
  }

  return { blocks: newBlocks, error: null };
}

// ============================================================
// Exercise blocks + exercises
// ============================================================

export async function addExerciseBlock(
  supabase: SupabaseClient,
  params: { dayId: string; position: number }
): Promise<{ block: BlockRow | null; error: string | null }> {
  const blockId = newId();
  const exerciseId = newId();

  const { error: blockError } = await supabase.from("exercise_blocks").insert({
    id: blockId,
    day_id: params.dayId,
    position: params.position,
    block_type: "straight",
    rounds: 1,
  });
  if (blockError) return { block: null, error: blockError.message };

  const { error: exerciseError } = await supabase.from("block_exercises").insert({
    id: exerciseId,
    block_id: blockId,
    position: 1,
    exercise_id: null,
    custom_name: "New exercise",
    notes: null,
  });
  if (exerciseError) return { block: null, error: exerciseError.message };

  const set = newSet(exerciseId, 1);
  const { error: setError } = await supabase.from("set_prescriptions").insert({
    id: set.id,
    block_exercise_id: exerciseId,
    position: set.position,
    sets: set.sets,
    reps: set.reps,
    load_type: set.load_type,
    load_value: set.load_value,
    rest_seconds: set.rest_seconds,
    notes: set.notes,
  });
  if (setError) return { block: null, error: setError.message };

  return {
    block: {
      id: blockId,
      day_id: params.dayId,
      position: params.position,
      block_type: "straight",
      rounds: 1,
      exercises: [{ id: exerciseId, block_id: blockId, position: 1, exercise_id: null, custom_name: "New exercise", notes: null, sets: [set] }],
    },
    error: null,
  };
}

export async function deleteBlock(supabase: SupabaseClient, blockId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("exercise_blocks").delete().eq("id", blockId);
  return { error: error?.message ?? null };
}

/** Swaps the `position` of two blocks within the same day (simple up/down reordering). */
export async function swapBlockPositions(
  supabase: SupabaseClient,
  a: { id: string; position: number },
  b: { id: string; position: number }
): Promise<{ error: string | null }> {
  // (day_id, position) is unique, so writing a straight to b's position
  // collides while b's row still holds it (confirmed live: this threw
  // "duplicate key value violates unique constraint" and silently left
  // the DB order unchanged under an optimistic UI that looked reordered).
  // Stage through a temporary out-of-range position so the two real
  // values are never both claimed at once.
  const tempPosition = -Math.abs(Date.now());
  const { error: e0 } = await supabase.from("exercise_blocks").update({ position: tempPosition }).eq("id", a.id);
  if (e0) return { error: e0.message };
  const { error: e1 } = await supabase.from("exercise_blocks").update({ position: a.position }).eq("id", b.id);
  if (e1) return { error: e1.message };
  const { error: e2 } = await supabase.from("exercise_blocks").update({ position: b.position }).eq("id", a.id);
  return { error: e2?.message ?? null };
}

export async function updateBlockExercise(
  supabase: SupabaseClient,
  blockExerciseId: string,
  patch: { exercise_id?: string | null; custom_name?: string | null; notes?: string | null }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("block_exercises").update(patch).eq("id", blockExerciseId);
  return { error: error?.message ?? null };
}

// ============================================================
// Set prescriptions
// ============================================================

export async function addSetRow(
  supabase: SupabaseClient,
  params: { blockExerciseId: string; position: number; copyFrom?: SetRow }
): Promise<{ set: SetRow | null; error: string | null }> {
  const set = newSet(params.blockExerciseId, params.position, params.copyFrom ? {
    sets: params.copyFrom.sets,
    reps: params.copyFrom.reps,
    load_type: params.copyFrom.load_type,
    load_value: params.copyFrom.load_value,
    rest_seconds: params.copyFrom.rest_seconds,
  } : undefined);
  const { error } = await supabase.from("set_prescriptions").insert({
    id: set.id,
    block_exercise_id: set.block_exercise_id,
    position: set.position,
    sets: set.sets,
    reps: set.reps,
    load_type: set.load_type,
    load_value: set.load_value,
    rest_seconds: set.rest_seconds,
    notes: set.notes,
  });
  if (error) return { set: null, error: error.message };
  return { set, error: null };
}

export async function updateSetRow(
  supabase: SupabaseClient,
  setId: string,
  patch: Partial<{
    sets: number;
    reps: string | null;
    load_type: LoadType;
    load_value: number | null;
    rest_seconds: number | null;
    notes: string | null;
  }>
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("set_prescriptions").update(patch).eq("id", setId);
  return { error: error?.message ?? null };
}

export async function deleteSetRow(supabase: SupabaseClient, setId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("set_prescriptions").delete().eq("id", setId);
  return { error: error?.message ?? null };
}
