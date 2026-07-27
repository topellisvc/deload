import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BlockExerciseRow,
  BlockRole,
  BlockRow,
  BlockType,
  DayRow,
  DayTemplateRow,
  ExerciseCategory,
  ExerciseTemplateRow,
  PrescriptionType,
  ProgramDiscipline,
  ProgramTemplateRow,
  ProgramTree,
  SetRow,
  WeekRow,
} from "@/lib/programs/types";
import { defaultPrescriptionType } from "@/lib/programs/prescription-types";
import { getProgramTree } from "@/lib/programs/queries";
import type { StarterProgramTemplate } from "@/lib/programs/starter-templates";
import { notifyProgramAssigned } from "@/lib/notifications/mutations";

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

/**
 * Every field a set_prescriptions row can have exists on every row
 * regardless of category/prescription_type (migration 0012) — same
 * "wide nullable table" shape the schema already used for run vs strength
 * columns, just extended to every field the flexible model now supports.
 * Which columns actually mean anything for a given row is defined once in
 * lib/programs/prescription-types.ts, not here — this just picks sensible
 * defaults for a freshly-created row.
 */
function newSetRow(
  blockExerciseId: string,
  position: number,
  category: ExerciseCategory,
  prescriptionType: PrescriptionType,
  overrides?: Partial<SetRow>
): SetRow {
  const isStrength = category === "strength";
  const base: SetRow = {
    id: newId(),
    block_exercise_id: blockExerciseId,
    position,
    prescription_type: prescriptionType,
    sets: isStrength ? 3 : 1,
    reps: isStrength ? "8-10" : null,
    min_reps: null,
    max_reps: null,
    weight_value: null,
    percent_1rm_value: null,
    pr_record_type: null,
    rpe_value: null,
    rir_value: null,
    heart_rate_zone: null,
    calories: null,
    rest_seconds: isStrength ? 90 : null,
    notes: null,
    distance_meters: null,
    duration_seconds: null,
    pace_seconds_per_km: null,
    advanced_config: null,
  };
  return { ...base, ...overrides };
}

/** The full column set for a set_prescriptions insert/select — factored out
 * so every insert site (addExerciseBlock, addExerciseToBlock, addSetRow,
 * switchExerciseCategory, addWeek's clone path, copyDayContents) stays in
 * sync with SetRow's shape in exactly one place. */
function setRowInsertPayload(set: SetRow) {
  return {
    id: set.id,
    block_exercise_id: set.block_exercise_id,
    position: set.position,
    prescription_type: set.prescription_type,
    sets: set.sets,
    reps: set.reps,
    min_reps: set.min_reps,
    max_reps: set.max_reps,
    weight_value: set.weight_value,
    percent_1rm_value: set.percent_1rm_value,
    pr_record_type: set.pr_record_type,
    rpe_value: set.rpe_value,
    rir_value: set.rir_value,
    heart_rate_zone: set.heart_rate_zone,
    calories: set.calories,
    rest_seconds: set.rest_seconds,
    notes: set.notes,
    distance_meters: set.distance_meters,
    duration_seconds: set.duration_seconds,
    pace_seconds_per_km: set.pace_seconds_per_km,
    advanced_config: set.advanced_config,
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
    /** Who this program is for. Defaults to the creator (self-programming). */
    athleteId?: string;
  }
): Promise<{ program: ProgramTree | null; error: string | null }> {
  const programId = newId();
  const weekId = newId();
  const now = new Date().toISOString();
  const athleteId = params.athleteId ?? params.userId;

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
    athlete_id: athleteId,
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
    athlete_id: athleteId,
    name: params.name,
    discipline: params.discipline,
    is_active: false,
    removed_by_athlete_at: null,
    created_at: now,
    updated_at: now,
    weeks: [{ id: weekId, program_id: programId, position: 1, label: "Week 1", based_on_week_id: null, created_at: now, days }],
  };

  // Only a real assignment to someone else counts as "a coach sent a
  // program" — self-programming (the default, athleteId omitted) never
  // notifies yourself. See lib/notifications/mutations.ts for why the
  // athlete's email is looked up from coach_clients rather than passed in.
  if (athleteId !== params.userId) {
    await notifyProgramAssigned(supabase, {
      coachId: params.userId,
      athleteId,
      programId,
      programName: params.name,
    });
  }

  return { program, error: null };
}

/**
 * Deep-copies an entire program (every week/day/block/exercise/set) into a
 * brand-new program row for `athleteId` — this, not a "program shared with
 * many athletes" schema change, is how the same program gets sent to
 * multiple clients: each recipient gets their own independent copy they
 * can log against (session_logs/RLS already key off a program's single
 * athlete_id, so a fresh row is what makes that "just work") and the coach
 * can edit separately from the original without affecting anyone else's
 * copy. Reuses addWeek's existing sourceWeek deep-clone path — the same
 * logic that already powers "copy week with progression" — once per week,
 * rather than a second copy of that batched-insert logic.
 */
export async function cloneProgram(
  supabase: SupabaseClient,
  params: { sourceProgram: ProgramTree; ownerId: string; athleteId: string; name: string }
): Promise<{ program: ProgramTree | null; error: string | null }> {
  const programId = newId();

  const { error: programError } = await supabase.from("programs").insert({
    id: programId,
    owner_id: params.ownerId,
    athlete_id: params.athleteId,
    name: params.name,
    discipline: params.sourceProgram.discipline,
  });
  if (programError) return { program: null, error: programError.message };

  // Sequential rather than Promise.all: each week is several batched
  // inserts (days, blocks, exercises, sets) on its own, and cloning is a
  // low-frequency action where simplicity matters more than shaving off
  // the extra round trips.
  for (const week of params.sourceProgram.weeks) {
    const { error: weekError } = await addWeek(supabase, {
      programId,
      position: week.position,
      dayTemplate: [],
      sourceWeek: week,
    });
    if (weekError) return { program: null, error: weekError };
  }

  const cloned = await getProgramTree(supabase, programId);
  if (!cloned) {
    return { program: null, error: "Program was cloned, but couldn't be loaded back." };
  }

  // Same "only notify a real assignment to someone else" rule as
  // createProgram — cloning a copy "for Myself" never notifies yourself.
  if (params.athleteId !== params.ownerId) {
    await notifyProgramAssigned(supabase, {
      coachId: params.ownerId,
      athleteId: params.athleteId,
      programId,
      programName: params.name,
    });
  }

  return { program: cloned, error: null };
}

/**
 * Instantiates one of the starter templates (lib/programs/starter-templates.ts)
 * into a brand-new, real program for this user — the "pick a program to get
 * started" flow on the homepage/dashboard. Week 1 is materialized straight
 * from the template via addWeek's existing clone path (it already generates
 * fresh ids for every day/block/exercise/set regardless of what's on the
 * source object — recordProvenance:false just keeps the template's
 * placeholder id out of based_on_week_id). Every subsequent week reuses the
 * exact same "copy week with progression" mechanism the builder's own UI
 * uses for "duplicate week with progression", just driven by the template's
 * own progression curve instead of a coach's manual choice each time.
 */
export async function createProgramFromTemplate(
  supabase: SupabaseClient,
  params: { template: StarterProgramTemplate; userId: string; athleteId?: string }
): Promise<{ program: ProgramTree | null; error: string | null }> {
  const { template } = params;
  const programId = newId();
  const athleteId = params.athleteId ?? params.userId;

  const { error: programError } = await supabase.from("programs").insert({
    id: programId,
    owner_id: params.userId,
    athlete_id: athleteId,
    name: template.name,
    discipline: template.discipline,
  });
  if (programError) return { program: null, error: programError.message };

  const { week: week1, error: week1Error } = await addWeek(supabase, {
    programId,
    position: 1,
    dayTemplate: [],
    sourceWeek: template.week1,
    recordProvenance: false,
  });
  if (week1Error || !week1) return { program: null, error: week1Error ?? "Couldn't create week 1." };

  // Sequential, not Promise.all: each week's addWeek call depends on nothing
  // from the others, but this only ever runs 2-3 times for a one-off
  // "start this program" action — simplicity over shaving round trips (same
  // tradeoff cloneProgram makes above).
  for (let i = 0; i < template.progressionSteps.length; i++) {
    const { error } = await addWeek(supabase, {
      programId,
      position: i + 2,
      dayTemplate: [],
      sourceWeek: week1,
      progressionPercent: template.progressionSteps[i],
    });
    if (error) return { program: null, error };
  }

  const program = await getProgramTree(supabase, programId);
  return program
    ? { program, error: null }
    : { program: null, error: "Program was created, but couldn't be loaded back." };
}

// ============================================================
// Personal program templates (migration 0020) — "save as template" /
// coach tooling. See ProgramTemplateRow's doc comment (types.ts) for why
// this is a single jsonb snapshot rather than a parallel set of relational
// tables.
// ============================================================

/**
 * Snapshots a program's current weeks into a reusable template row. Just
 * the weeks/days/blocks/exercises/sets — not the program's own id,
 * owner/athlete, active flag, or timestamps, none of which mean anything
 * once this becomes a template someone reuses later for a different
 * person entirely.
 */
export async function saveProgramAsTemplate(
  supabase: SupabaseClient,
  params: { program: ProgramTree; ownerId: string; name: string }
): Promise<{ template: ProgramTemplateRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("program_templates")
    .insert({
      owner_id: params.ownerId,
      name: params.name,
      discipline: params.program.discipline,
      template_data: { weeks: params.program.weeks },
    })
    .select()
    .single<ProgramTemplateRow>();

  if (error) return { template: null, error: "Couldn't save this as a template. Try again." };
  return { template: data, error: null };
}

export async function deleteProgramTemplate(supabase: SupabaseClient, templateId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("program_templates").delete().eq("id", templateId);
  return { error: error ? "Couldn't delete this template. Try again." : null };
}

/**
 * Materializes a saved template into a brand-new program — functionally
 * identical to cloneProgram's per-week addWeek loop, just reading from a
 * stored snapshot instead of a live sibling program. Always
 * recordProvenance: false: the template's stored week ids point at
 * whatever program it was originally saved from (which may have since
 * been edited or deleted), so linking a fresh copy's based_on_week_id back
 * to them would be a stale, possibly-dangling reference rather than real
 * provenance — same reasoning as createProgramFromTemplate's starter
 * templates.
 */
export async function createProgramFromSavedTemplate(
  supabase: SupabaseClient,
  params: { template: ProgramTemplateRow; userId: string; athleteId?: string }
): Promise<{ program: ProgramTree | null; error: string | null }> {
  const { template } = params;
  const programId = newId();
  const athleteId = params.athleteId ?? params.userId;

  const { error: programError } = await supabase.from("programs").insert({
    id: programId,
    owner_id: params.userId,
    athlete_id: athleteId,
    name: template.name,
    discipline: template.discipline,
  });
  if (programError) return { program: null, error: programError.message };

  // Sequential, not Promise.all — same low-frequency-action tradeoff as
  // cloneProgram/createProgramFromTemplate above.
  for (const week of template.template_data.weeks) {
    const { error } = await addWeek(supabase, {
      programId,
      position: week.position,
      dayTemplate: [],
      sourceWeek: week,
      recordProvenance: false,
    });
    if (error) return { program: null, error };
  }

  const program = await getProgramTree(supabase, programId);
  return program
    ? { program, error: null }
    : { program: null, error: "Program was created, but couldn't be loaded back." };
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

/**
 * Deletes a program row outright — RLS (schema.sql) allows this for the
 * program's owner only. An assigned athlete can no longer reach this: 0017
 * briefly let them run this same hard delete on their own copy, but that
 * made a coach-assigned program vanish from the coach's Client programs
 * list with no trace (see removeAssignedProgram, which replaced it in
 * 0018). Call sites should route the athlete's own "delete/remove" action
 * through removeAssignedProgram instead — this one's for the owner
 * clearing out a program (theirs or a leftover removed client copy) for
 * real.
 */
export async function deleteProgram(
  supabase: SupabaseClient,
  programId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("programs").delete().eq("id", programId);
  return { error: error?.message ?? null };
}

/**
 * The athlete-side counterpart to deleteProgram: soft-removes their own
 * copy of a coach-assigned program (migration 0018's remove_assigned_program
 * function) instead of deleting the row. Since it's a SECURITY DEFINER
 * function with its own auth.uid() = athlete_id check (same pattern as
 * set_active_program), this can only ever touch the caller's own assigned
 * copy — never the coach's original or another client's copy, same
 * guarantee deleteProgram had, just without erasing the coach's visibility
 * into the assignment.
 */
export async function removeAssignedProgram(
  supabase: SupabaseClient,
  programId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("remove_assigned_program", { p_program_id: programId });
  return { error: error?.message ?? null };
}

/**
 * Makes `programId` the athlete's one active program, deactivating
 * whatever was active before it. Goes through the `set_active_program`
 * Postgres function (migration 0010, widened in 0017) rather than two
 * separate client updates, so there's never a window with zero or two
 * active programs — see that migration's comments for why this needs to be
 * atomic. The function is `security definer` (migration 0013) with its own
 * explicit permission check rather than relying on RLS: it allows either
 * the program's owner or its assigned athlete to activate it (migration
 * 0017), so an athlete can switch which of their coach-assigned programs
 * is active without the coach needing to do it for them.
 */
export async function setActiveProgram(
  supabase: SupabaseClient,
  programId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("set_active_program", { p_program_id: programId });
  return { error: error?.message ?? null };
}

/**
 * Turns off a program's active flag without making another one active —
 * "I don't want a dashboard right now" rather than "switch to a different
 * program." No RPC needed: unlike activating, deactivating can't collide
 * with the one-active-per-athlete constraint, so a plain RLS-scoped update
 * is enough.
 */
export async function deactivateProgram(
  supabase: SupabaseClient,
  programId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("programs").update({ is_active: false }).eq("id", programId);
  return { error: error?.message ?? null };
}

// ============================================================
// Weeks
// ============================================================

/**
 * Adds a new week. With no `sourceWeek`, it gets a blank copy of the day
 * skeleton (labels + rest flags) so day counts stay consistent across a
 * program's weeks. With a `sourceWeek`, every block/exercise/set is
 * duplicated too — `progressionPercent` scales weight-ish values on rows
 * whose prescription_type is 'fixed_weight' or 'percent_1rm' (the only
 * types where scaling a number by a percentage still means the same
 * thing — scaling an RPE target or a pace target doesn't), and always
 * scales distance/duration/calories whenever a row actually has one of
 * those set, regardless of prescription_type — see the inline comment
 * further down for why those three aren't gated the same way weight is.
 */
export async function addWeek(
  supabase: SupabaseClient,
  params: {
    programId: string;
    position: number;
    dayTemplate: { label: string | null; is_rest_day: boolean }[];
    sourceWeek?: WeekRow;
    progressionPercent?: number;
    /** False when sourceWeek isn't a real, persisted row — e.g. a starter
     * program template (see createProgramFromTemplate), whose placeholder
     * .id would otherwise violate program_weeks.based_on_week_id's foreign
     * key. Defaults to true, preserving every existing call site's
     * behavior (recording real "copied from" provenance). */
    recordProvenance?: boolean;
  }
): Promise<{ week: WeekRow | null; error: string | null }> {
  const weekId = newId();
  const label = `Week ${params.position}`;

  const { error: weekError } = await supabase.from("program_weeks").insert({
    id: weekId,
    program_id: params.programId,
    position: params.position,
    label,
    based_on_week_id: params.recordProvenance !== false ? (params.sourceWeek?.id ?? null) : null,
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
        block_role: sourceBlock.block_role,
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
          exercise_category: sourceExercise.exercise_category,
        });

        const newSets: SetRow[] = sourceExercise.sets.map((sourceSet) => {
          const setId = newId();
          const scalable = sourceSet.prescription_type === "fixed_weight" || sourceSet.prescription_type === "percent_1rm";
          const scaledWeight =
            scalable && sourceSet.weight_value != null ? Math.round(sourceSet.weight_value * scale * 10) / 10 : sourceSet.weight_value;
          const scaledPercent =
            scalable && sourceSet.percent_1rm_value != null
              ? Math.round(sourceSet.percent_1rm_value * scale * 10) / 10
              : sourceSet.percent_1rm_value;
          // distance/duration/calories are all "volume" fields reused
          // across running and cardio prescription types (a 'time' row's
          // duration_seconds, a 'calories' row's calories, an 'intervals'
          // row's distance_meters+duration_seconds together, etc.) — unlike
          // weight/percent_1rm, scaling isn't gated to specific
          // prescription_types here because whichever of these three is
          // actually populated always means "more of this by week N," no
          // matter which type set it. heart_rate_zone/rpe/pace deliberately
          // stay untouched — those are intensity targets, not volume, and
          // scaling "Zone 2" by 108% would be nonsensical.
          const scaledDistance =
            sourceSet.distance_meters != null ? Math.round(sourceSet.distance_meters * scale) : null;
          const scaledDuration =
            sourceSet.duration_seconds != null ? Math.round(sourceSet.duration_seconds * scale) : null;
          const scaledCalories = sourceSet.calories != null ? Math.round(sourceSet.calories * scale) : null;
          const newSet: SetRow = {
            ...sourceSet,
            id: setId,
            block_exercise_id: exerciseId,
            weight_value: scaledWeight,
            percent_1rm_value: scaledPercent,
            distance_meters: scaledDistance,
            duration_seconds: scaledDuration,
            calories: scaledCalories,
          };
          setsToInsert.push(setRowInsertPayload(newSet));
          return newSet;
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
      based_on_week_id: params.recordProvenance !== false ? (params.sourceWeek?.id ?? null) : null,
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
 * "Duplicate this day" — creates a brand-new day in the same week (appended
 * at the end, like Add Week always appends a new week) and clones every
 * block from `sourceDay` into it. Nothing in the schema caps how many days
 * a week can have (`unique (week_id, position)` allows any count, same as
 * program_weeks itself), so this is a straightforward extension of the
 * same "add another one" pattern Add Week already uses at the week level.
 * Reuses copyDayContents for the actual block cloning — an empty
 * `targetDayBlocks` (nothing exists in the new day yet) means every
 * section's position counter starts fresh at 1, exactly as it should for a
 * brand-new day.
 */
export async function duplicateDay(
  supabase: SupabaseClient,
  params: { sourceDay: DayRow; weekId: string; position: number }
): Promise<{ day: DayRow | null; error: string | null }> {
  const dayId = newId();
  const label = params.sourceDay.label ? `${params.sourceDay.label} copy` : null;

  const { error: dayError } = await supabase.from("training_days").insert({
    id: dayId,
    week_id: params.weekId,
    position: params.position,
    label,
    is_rest_day: false,
  });
  if (dayError) return { day: null, error: dayError.message };

  const { blocks, error: blocksError } = await copyDayContents(supabase, {
    sourceDay: params.sourceDay,
    targetDayId: dayId,
    targetDayBlocks: [],
  });
  if (blocksError) return { day: null, error: blocksError };

  return { day: { id: dayId, week_id: params.weekId, position: params.position, label, is_rest_day: false, blocks }, error: null };
}

/**
 * Duplicates every block in `sourceDay` and appends the copies to the end
 * of the target day (non-destructive — existing content on the target day
 * is left alone).
 *
 * Position is scoped per (day_id, block_role) (migration 0032), so a
 * single shared "next position" counter across the whole target day would
 * both misorder sections and risk colliding with an existing block in a
 * different role that happens to occupy the same number. Each role gets
 * its own counter, seeded from that role's actual next position in
 * `targetDayBlocks` — the target day's *current* blocks, passed in rather
 * than re-fetched, since the caller (ProgramBuilder) already has them in
 * local state.
 */
export async function copyDayContents(
  supabase: SupabaseClient,
  params: { sourceDay: DayRow; targetDayId: string; targetDayBlocks: BlockRow[] }
): Promise<{ blocks: BlockRow[]; error: string | null }> {
  const blocksToInsert: Record<string, unknown>[] = [];
  const exercisesToInsert: Record<string, unknown>[] = [];
  const setsToInsert: Record<string, unknown>[] = [];

  const nextPositionByRole = new Map<BlockRole, number>();
  function nextPositionFor(role: BlockRole): number {
    const current =
      nextPositionByRole.get(role) ??
      Math.max(0, ...params.targetDayBlocks.filter((b) => b.block_role === role).map((b) => b.position)) + 1;
    nextPositionByRole.set(role, current + 1);
    return current;
  }

  const newBlocks: BlockRow[] = params.sourceDay.blocks.map((sourceBlock) => {
    const blockId = newId();
    const position = nextPositionFor(sourceBlock.block_role);
    blocksToInsert.push({
      id: blockId,
      day_id: params.targetDayId,
      position,
      block_type: sourceBlock.block_type,
      block_role: sourceBlock.block_role,
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
        exercise_category: sourceExercise.exercise_category,
      });

      const newSets: SetRow[] = sourceExercise.sets.map((sourceSet) => {
        const setId = newId();
        const newSet: SetRow = { ...sourceSet, id: setId, block_exercise_id: exerciseId };
        setsToInsert.push(setRowInsertPayload(newSet));
        return newSet;
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

/**
 * Inserts a saved day template (migration 0033) into an existing day,
 * appending to whatever's already there — non-destructive, same as
 * copyDayContents. A day template's `template_data.blocks` is a full
 * `BlockRow[]` snapshot (see DayTemplateRow's doc comment), the exact
 * shape copyDayContents already clones with fresh ids and per-role
 * position scoping; the only difference from "copy another day's
 * contents" is where the source blocks come from, so this just wraps the
 * template's blocks in a placeholder DayRow and delegates.
 */
export async function insertDayTemplate(
  supabase: SupabaseClient,
  params: { targetDayId: string; targetDayBlocks: BlockRow[]; template: DayTemplateRow }
): Promise<{ blocks: BlockRow[]; error: string | null }> {
  return copyDayContents(supabase, {
    sourceDay: { id: "", week_id: "", position: 0, label: null, is_rest_day: false, blocks: params.template.template_data.blocks },
    targetDayId: params.targetDayId,
    targetDayBlocks: params.targetDayBlocks,
  });
}

/**
 * "Duplicate this exercise" — the single quick action the spec calls out
 * as especially important, since coaches frequently reuse the same
 * exercise (a working set followed by a backoff set of the same movement,
 * the same accessory on multiple days, etc.). Always lands as a new
 * standalone (straight) block immediately after the source exercise's own
 * block, carrying a full copy of its prescription rows — regardless of
 * whether the source was itself part of a superset, duplicating just the
 * one exercise the coach clicked is the least surprising result (cloning
 * the whole superset it happened to be grouped in is a different action,
 * not implemented here). Same clone-with-fresh-ids shape as
 * copyDayContents, just scoped to one exercise instead of a whole day.
 */
export async function duplicateExercise(
  supabase: SupabaseClient,
  /** `blockRole` defaults to 'main' — every existing call site predates
   * Warm-up/Conditioning sections and still means "duplicate into the main
   * workout." Callers that know the source block's role (see
   * ProgramBuilder's handleDuplicateExercise) should pass it through so a
   * warm-up exercise's duplicate lands back in Warm-up, not Main. */
  params: { dayId: string; position: number; exercise: BlockExerciseRow; blockRole?: BlockRole }
): Promise<{ block: BlockRow | null; error: string | null }> {
  const blockId = newId();
  const exerciseId = newId();
  const blockRole: BlockRole = params.blockRole ?? "main";

  const { error: blockError } = await supabase.from("exercise_blocks").insert({
    id: blockId,
    day_id: params.dayId,
    position: params.position,
    block_type: "straight",
    block_role: blockRole,
    rounds: 1,
  });
  if (blockError) return { block: null, error: blockError.message };

  const { error: exerciseError } = await supabase.from("block_exercises").insert({
    id: exerciseId,
    block_id: blockId,
    position: 1,
    exercise_id: params.exercise.exercise_id,
    custom_name: params.exercise.custom_name,
    notes: params.exercise.notes,
    exercise_category: params.exercise.exercise_category,
  });
  if (exerciseError) return { block: null, error: exerciseError.message };

  const newSets: SetRow[] = params.exercise.sets.map((sourceSet, i) => ({
    ...sourceSet,
    id: newId(),
    block_exercise_id: exerciseId,
    position: i + 1,
  }));
  if (newSets.length > 0) {
    const { error: setsError } = await supabase.from("set_prescriptions").insert(newSets.map(setRowInsertPayload));
    if (setsError) return { block: null, error: setsError.message };
  }

  const block: BlockRow = {
    id: blockId,
    day_id: params.dayId,
    position: params.position,
    block_type: "straight",
    block_role: blockRole,
    rounds: 1,
    exercises: [
      {
        ...params.exercise,
        id: exerciseId,
        block_id: blockId,
        position: 1,
        sets: newSets,
      },
    ],
  };
  return { block, error: null };
}

/**
 * Inserts a saved exercise template (migration 0033) as a new block — a
 * template's `template_data` is stored as a full `BlockExerciseRow`
 * snapshot (see ExerciseTemplateRow's doc comment), which is exactly the
 * shape duplicateExercise already knows how to clone with fresh ids. No
 * separate insert logic needed: "insert this template" and "duplicate this
 * live exercise" are the same operation, just sourced differently.
 */
export async function addExerciseBlockFromTemplate(
  supabase: SupabaseClient,
  params: { dayId: string; position: number; role: BlockRole; template: ExerciseTemplateRow }
): Promise<{ block: BlockRow | null; error: string | null }> {
  return duplicateExercise(supabase, {
    dayId: params.dayId,
    position: params.position,
    exercise: params.template.template_data,
    blockRole: params.role,
  });
}

/**
 * "Move to another day" — bulk-editing spec item distinct from Duplicate
 * Exercise (which deliberately leaves the original in place). Composed
 * from two already-tested operations rather than new insert/delete logic:
 * duplicateExercise clones the exercise into the target day, then the
 * source is cleaned up the same way deleting it there normally would —
 * removeExerciseFromBlock if it was one member of a superset (its
 * block-mates stay put), or deleteBlock if it was the block's only
 * exercise. Not a real database transaction (nothing in this codebase
 * uses one — see the file-level pattern of sequential Supabase calls
 * throughout), so a failure on the cleanup step after a successful copy
 * leaves the exercise in both places rather than neither; the returned
 * error says so explicitly rather than claiming a clean failure.
 */
export async function moveExerciseToDay(
  supabase: SupabaseClient,
  params: {
    targetDayId: string;
    targetPosition: number;
    blockRole: BlockRole;
    exercise: BlockExerciseRow;
    sourceBlockId: string;
    /** True when the source block has other exercises left after removing
     * this one (a superset losing one member) — false deletes the whole
     * (now-empty) block instead. */
    sourceBlockHasOtherExercises: boolean;
  }
): Promise<{ block: BlockRow | null; error: string | null }> {
  const { block, error } = await duplicateExercise(supabase, {
    dayId: params.targetDayId,
    position: params.targetPosition,
    exercise: params.exercise,
    blockRole: params.blockRole,
  });
  if (error || !block) return { block: null, error };

  const { error: removeError } = params.sourceBlockHasOtherExercises
    ? await removeExerciseFromBlock(supabase, params.exercise.id)
    : await deleteBlock(supabase, params.sourceBlockId);

  if (removeError) {
    return { block, error: "Moved, but couldn't remove it from the original day — you may need to delete it there yourself." };
  }
  return { block, error: null };
}

// ============================================================
// Exercise blocks + exercises
// ============================================================

export async function addExerciseBlock(
  supabase: SupabaseClient,
  /** `category` defaults to 'strength' when omitted (the original,
   * always-strength behavior) — callers that know the program's
   * discipline should pass `defaultCategoryForDiscipline(program.discipline)`
   * (lib/programs/prescription-types.ts) instead, so a Running or Cardio
   * program's new blocks don't all need switching by hand before they're
   * usable. Either way this is only ever a starting point:
   * switchExerciseCategory changes it same as before. */
  params: { dayId: string; position: number; category?: ExerciseCategory; role?: BlockRole }
): Promise<{ block: BlockRow | null; error: string | null }> {
  const blockId = newId();
  const exerciseId = newId();
  const category: ExerciseCategory = params.category ?? "strength";
  const role: BlockRole = params.role ?? "main";
  const prescriptionType = defaultPrescriptionType(category);

  const { error: blockError } = await supabase.from("exercise_blocks").insert({
    id: blockId,
    day_id: params.dayId,
    position: params.position,
    block_type: "straight",
    block_role: role,
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
    exercise_category: category,
  });
  if (exerciseError) return { block: null, error: exerciseError.message };

  const set = newSetRow(exerciseId, 1, category, prescriptionType);
  const { error: setError } = await supabase.from("set_prescriptions").insert(setRowInsertPayload(set));
  if (setError) return { block: null, error: setError.message };

  return {
    block: {
      id: blockId,
      day_id: params.dayId,
      position: params.position,
      block_type: "straight",
      block_role: role,
      rounds: 1,
      exercises: [
        {
          id: exerciseId,
          block_id: blockId,
          position: 1,
          exercise_id: null,
          custom_name: "New exercise",
          notes: null,
          exercise_category: category,
          sets: [set],
        },
      ],
    },
    error: null,
  };
}

export async function deleteBlock(supabase: SupabaseClient, blockId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("exercise_blocks").delete().eq("id", blockId);
  return { error: error?.message ?? null };
}

/**
 * Adds another exercise into an existing block — this is what turns a
 * straight block into a superset. The caller is responsible for flipping
 * `block_type` to 'superset' once the block has 2+ exercises (and back to
 * 'straight' if it drops to 1 via removeExerciseFromBlock) via
 * updateBlockType; this function only inserts the exercise + its default
 * set row.
 */
export async function addExerciseToBlock(
  supabase: SupabaseClient,
  /** `category` defaults to 'strength' when omitted — see
   * addExerciseBlock's doc comment above for the same rationale. */
  params: { blockId: string; position: number; category?: ExerciseCategory }
): Promise<{ exercise: BlockExerciseRow | null; error: string | null }> {
  const exerciseId = newId();
  const category: ExerciseCategory = params.category ?? "strength";
  const prescriptionType = defaultPrescriptionType(category);

  const { error: exerciseError } = await supabase.from("block_exercises").insert({
    id: exerciseId,
    block_id: params.blockId,
    position: params.position,
    exercise_id: null,
    custom_name: "New exercise",
    notes: null,
    exercise_category: category,
  });
  if (exerciseError) return { exercise: null, error: exerciseError.message };

  const set = newSetRow(exerciseId, 1, category, prescriptionType);
  const { error: setError } = await supabase.from("set_prescriptions").insert(setRowInsertPayload(set));
  if (setError) return { exercise: null, error: setError.message };

  return {
    exercise: {
      id: exerciseId,
      block_id: params.blockId,
      position: params.position,
      exercise_id: null,
      custom_name: "New exercise",
      notes: null,
      exercise_category: category,
      sets: [set],
    },
    error: null,
  };
}

/** Removes one exercise from a (superset/circuit) block, cascading its set rows. Does not delete the block itself — see deleteBlock for that. */
export async function removeExerciseFromBlock(
  supabase: SupabaseClient,
  blockExerciseId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("block_exercises").delete().eq("id", blockExerciseId);
  return { error: error?.message ?? null };
}

export async function updateBlockRounds(
  supabase: SupabaseClient,
  blockId: string,
  rounds: number
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("exercise_blocks").update({ rounds }).eq("id", blockId);
  return { error: error?.message ?? null };
}

export async function updateBlockType(
  supabase: SupabaseClient,
  blockId: string,
  blockType: BlockType
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("exercise_blocks").update({ block_type: blockType }).eq("id", blockId);
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
  // Stage through a temporary negative position so the two real values
  // are never both claimed at once — real positions are always positive,
  // so any negative number is safe. Random rather than a fixed constant
  // so two swaps racing on the same day (e.g. a double click) can't
  // collide with each other; NOT Date.now() — that's ~1.7 trillion,
  // which overflows Postgres's 32-bit `integer` column (confirmed live:
  // "value ... is out of range for type integer" on the very next test).
  const tempPosition = -(1 + Math.floor(Math.random() * 1_000_000));
  const { error: e0 } = await supabase.from("exercise_blocks").update({ position: tempPosition }).eq("id", a.id);
  if (e0) return { error: e0.message };
  const { error: e1 } = await supabase.from("exercise_blocks").update({ position: a.position }).eq("id", b.id);
  if (e1) return { error: e1.message };
  const { error: e2 } = await supabase.from("exercise_blocks").update({ position: b.position }).eq("id", a.id);
  return { error: e2?.message ?? null };
}

/**
 * Generalizes swapBlockPositions to a full reorder — drag-and-drop can move
 * a block several positions in one gesture, not just swap it with its
 * immediate neighbor, so a chain of pairwise swaps isn't the right
 * primitive here. `blocks` is the day's blocks in their new order; each
 * gets a fresh random negative temp position first (same reasoning as
 * swapBlockPositions: (day_id, position) is unique, so writing straight to
 * final positions would collide with whichever sibling currently holds
 * that number), then every block is set to its real final position in one
 * second pass.
 */
export async function reorderBlocks(supabase: SupabaseClient, blocks: { id: string; position: number }[]): Promise<{ error: string | null }> {
  for (const block of blocks) {
    const tempPosition = -(1 + Math.floor(Math.random() * 1_000_000));
    const { error } = await supabase.from("exercise_blocks").update({ position: tempPosition }).eq("id", block.id);
    if (error) return { error: error.message };
  }
  for (const block of blocks) {
    const { error } = await supabase.from("exercise_blocks").update({ position: block.position }).eq("id", block.id);
    if (error) return { error: error.message };
  }
  return { error: null };
}

/** Reorders the set rows within one exercise — same staged-negative-position
 * pattern as reorderBlocks (and for the same reason: `unique(block_exercise_id, position)`
 * would reject writing final positions directly if any of them collide with
 * an existing row's current position). Used by the Cardio Builder's
 * drag-and-drop interval reordering; nothing stops it being reused for a
 * future strength multi-row reorder too. */
export async function reorderSets(supabase: SupabaseClient, sets: { id: string; position: number }[]): Promise<{ error: string | null }> {
  for (const set of sets) {
    const tempPosition = -(1 + Math.floor(Math.random() * 1_000_000));
    const { error } = await supabase.from("set_prescriptions").update({ position: tempPosition }).eq("id", set.id);
    if (error) return { error: error.message };
  }
  for (const set of sets) {
    const { error } = await supabase.from("set_prescriptions").update({ position: set.position }).eq("id", set.id);
    if (error) return { error: error.message };
  }
  return { error: null };
}

export async function updateBlockExercise(
  supabase: SupabaseClient,
  blockExerciseId: string,
  patch: { exercise_id?: string | null; custom_name?: string | null; notes?: string | null }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("block_exercises").update(patch).eq("id", blockExerciseId);
  return { error: error?.message ?? null };
}

/**
 * Switches an exercise between categories (strength/running/cardio). The
 * three shapes don't share meaningful values — "3 sets of 8 reps" has no
 * equivalent as a distance — so this replaces all of the exercise's
 * existing set rows with a single fresh default row in the new category's
 * default prescription type, rather than trying to convert them. The UI
 * should confirm with the user before calling this if the exercise already
 * has real data entered, since it's destructive.
 */
export async function switchExerciseCategory(
  supabase: SupabaseClient,
  params: { blockExerciseId: string; category: ExerciseCategory }
): Promise<{ set: SetRow | null; error: string | null }> {
  const { error: updateError } = await supabase
    .from("block_exercises")
    .update({ exercise_category: params.category })
    .eq("id", params.blockExerciseId);
  if (updateError) return { set: null, error: updateError.message };

  const { error: deleteError } = await supabase
    .from("set_prescriptions")
    .delete()
    .eq("block_exercise_id", params.blockExerciseId);
  if (deleteError) return { set: null, error: deleteError.message };

  const prescriptionType = defaultPrescriptionType(params.category);
  const set = newSetRow(params.blockExerciseId, 1, params.category, prescriptionType);
  const { error: insertError } = await supabase.from("set_prescriptions").insert(setRowInsertPayload(set));
  if (insertError) return { set: null, error: insertError.message };

  return { set, error: null };
}

/**
 * Switches every existing set row on an exercise to a new prescription
 * type *without* touching category or wiping any of the row's field
 * values — unlike switchExerciseCategory this is non-destructive (e.g.
 * Fixed Weight -> RPE keeps whatever sets/reps/rest was already entered,
 * it just changes which fields the UI treats as the "real" ones). Any
 * previously-entered values on now-irrelevant columns are left in place
 * rather than nulled out, so toggling back doesn't lose data.
 */
export async function updatePrescriptionType(
  supabase: SupabaseClient,
  params: { blockExerciseId: string; prescriptionType: PrescriptionType }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("set_prescriptions")
    .update({ prescription_type: params.prescriptionType })
    .eq("block_exercise_id", params.blockExerciseId);
  return { error: error?.message ?? null };
}

// ============================================================
// Set prescriptions
// ============================================================

export async function addSetRow(
  supabase: SupabaseClient,
  params: { blockExerciseId: string; position: number; category: ExerciseCategory; prescriptionType: PrescriptionType; copyFrom?: SetRow }
): Promise<{ set: SetRow | null; error: string | null }> {
  // copyFrom is always an existing row on the *same* exercise, so it
  // already matches this category — safe to copy every field wholesale
  // rather than cherry-picking per type. id/position/block_exercise_id/
  // prescription_type are excluded (not just set to undefined — an
  // explicit `key: undefined` would still win over newSetRow's own
  // defaults when spread) so the new row gets its own identity and the
  // caller's requested prescriptionType, not copyFrom's.
  let overrides: Partial<SetRow> | undefined;
  if (params.copyFrom) {
    const { id: _id, position: _position, block_exercise_id: _blockExerciseId, prescription_type: _prescriptionType, ...rest } =
      params.copyFrom;
    overrides = rest;
  }
  const set = newSetRow(params.blockExerciseId, params.position, params.category, params.prescriptionType, overrides);
  const { error } = await supabase.from("set_prescriptions").insert(setRowInsertPayload(set));
  if (error) return { set: null, error: error.message };
  return { set, error: null };
}

export async function updateSetRow(
  supabase: SupabaseClient,
  setId: string,
  patch: Partial<{
    sets: number;
    reps: string | null;
    min_reps: number | null;
    max_reps: number | null;
    weight_value: number | null;
    percent_1rm_value: number | null;
    pr_record_type: string | null;
    rpe_value: number | null;
    rir_value: number | null;
    heart_rate_zone: number | null;
    calories: number | null;
    rest_seconds: number | null;
    notes: string | null;
    distance_meters: number | null;
    duration_seconds: number | null;
    pace_seconds_per_km: number | null;
    advanced_config: Record<string, string> | null;
  }>
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("set_prescriptions").update(patch).eq("id", setId);
  return { error: error?.message ?? null };
}

export async function deleteSetRow(supabase: SupabaseClient, setId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("set_prescriptions").delete().eq("id", setId);
  return { error: error?.message ?? null };
}
