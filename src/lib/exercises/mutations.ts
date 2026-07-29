import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Exercise,
  ExerciseCoachingCue,
  ExerciseCommonMistake,
  ExerciseDifficulty,
  ExerciseEquipment,
  ExerciseLibraryCategory,
  ExerciseRelationshipType,
  ExerciseReviewStatus,
  MovementPattern,
  MuscleGroup,
} from "@/lib/exercises/types";
import { exerciseLibraryCategoryToPrescriptionCategory } from "@/lib/exercises/constants";
import type { ExerciseCategory } from "@/lib/programs/types";

/** Slugifies a name into an id in the same style as the seeded catalog
 * ("Barbell Back Squat" -> "barbell-back-squat"). A numeric suffix is
 * appended by the caller (see createExercise) if the slug collides. */
function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "exercise"
  );
}

export interface CreateExerciseInput {
  name: string;
  category: ExerciseLibraryCategory;
  movementPattern?: MovementPattern | null;
  primaryMuscleGroup: MuscleGroup;
  secondaryMuscleGroups?: string[];
  equipment: ExerciseEquipment;
  difficulty: ExerciseDifficulty;
  description?: string | null;
  instructionsSetup?: string | null;
  instructionsExecution?: string | null;
  instructionsBreathing?: string | null;
  instructionsFinishing?: string | null;
  tags?: string[];
  /** null creates a global exercise (admin-only per RLS) — a coach's own
   * create always passes their own id. */
  ownerId: string | null;
}

/** Creates a new library exercise, retrying with a numeric suffix if the
 * slugified id collides with an existing one (id is the primary key, not
 * auto-generated — see 0035's header comment on why ids are stable text
 * slugs rather than uuids). */
export async function createExercise(supabase: SupabaseClient, input: CreateExerciseInput): Promise<{ exercise: Exercise | null; error: string | null }> {
  const base = slugify(input.name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const { data, error } = await supabase
      .from("exercises")
      .insert({
        id,
        name: input.name.trim(),
        category: input.category,
        movement_pattern: input.movementPattern ?? null,
        primary_muscle_group: input.primaryMuscleGroup,
        secondary_muscle_groups: input.secondaryMuscleGroups ?? [],
        equipment: input.equipment,
        difficulty: input.difficulty,
        description: input.description ?? null,
        instructions_setup: input.instructionsSetup ?? null,
        instructions_execution: input.instructionsExecution ?? null,
        instructions_breathing: input.instructionsBreathing ?? null,
        instructions_finishing: input.instructionsFinishing ?? null,
        tags: input.tags ?? [],
        owner_id: input.ownerId,
        // Global/admin exercises (ownerId null) skip review entirely; a
        // coach's own exercise starts pending until an admin approves it
        // (migration 0038 — RLS keeps it hidden from everyone else in the
        // meantime, and only lets it through the INSERT policy at all
        // when it's exactly this value).
        review_status: input.ownerId === null ? "approved" : "pending",
      })
      .select()
      .maybeSingle();

    if (!error) return { exercise: (data as Exercise | null) ?? null, error: null };
    // 23505 = unique_violation (id collision) — try the next suffix.
    if (error.code !== "23505") return { exercise: null, error: "Couldn't create that exercise." };
  }
  return { exercise: null, error: "Couldn't create that exercise (name collision)." };
}

/**
 * The Program Builder picker's "Create <name>" flow (see
 * ExerciseSearchField's onCreateInLibrary prop) — a coach typing a name
 * that doesn't exist yet gets a *real* library exercise, not just a
 * one-off custom_name, per the spec ("Create New Exercise, which
 * immediately adds it to the library"). The picker only ever collects a
 * name, so this fills in reasonable, obviously-placeholder defaults for
 * the required classification fields — a coach can refine them later from
 * the exercise's own detail/edit page.
 */
export async function createCustomExerciseFromPicker(
  supabase: SupabaseClient,
  params: { name: string; blockCategory: ExerciseCategory; ownerId: string }
): Promise<{ id: string; name: string } | null> {
  const category: ExerciseLibraryCategory = params.blockCategory === "running" ? "running" : params.blockCategory === "cardio" ? "cardio" : "strength";
  const { exercise } = await createExercise(supabase, {
    name: params.name,
    category,
    primaryMuscleGroup: "full_body",
    equipment: category === "strength" ? "bodyweight" : "bodyweight",
    difficulty: "intermediate",
    ownerId: params.ownerId,
  });
  if (!exercise) return null;
  return { id: exercise.id, name: exercise.name };
}

export async function updateExercise(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Omit<CreateExerciseInput, "ownerId">>
): Promise<{ error: string | null }> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.movementPattern !== undefined) update.movement_pattern = patch.movementPattern;
  if (patch.primaryMuscleGroup !== undefined) update.primary_muscle_group = patch.primaryMuscleGroup;
  if (patch.secondaryMuscleGroups !== undefined) update.secondary_muscle_groups = patch.secondaryMuscleGroups;
  if (patch.equipment !== undefined) update.equipment = patch.equipment;
  if (patch.difficulty !== undefined) update.difficulty = patch.difficulty;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.instructionsSetup !== undefined) update.instructions_setup = patch.instructionsSetup;
  if (patch.instructionsExecution !== undefined) update.instructions_execution = patch.instructionsExecution;
  if (patch.instructionsBreathing !== undefined) update.instructions_breathing = patch.instructionsBreathing;
  if (patch.instructionsFinishing !== undefined) update.instructions_finishing = patch.instructionsFinishing;
  if (patch.tags !== undefined) update.tags = patch.tags;

  const { error } = await supabase.from("exercises").update(update).eq("id", id);
  return { error: error ? "Couldn't save that change." : null };
}

export async function archiveExercise(supabase: SupabaseClient, id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("exercises").update({ is_archived: true }).eq("id", id);
  return { error: error ? "Couldn't archive that exercise." : null };
}

export async function restoreExercise(supabase: SupabaseClient, id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("exercises").update({ is_archived: false }).eq("id", id);
  return { error: error ? "Couldn't restore that exercise." : null };
}

/** Admin-only approve/reject for a coach-submitted exercise (migration
 * 0038). The `protect_exercise_review_status` trigger silently no-ops this
 * column change for anyone who isn't an admin, so this is safe to expose
 * from any authenticated client — RLS/the trigger is the real gate, not
 * this function. */
export async function setExerciseReviewStatus(
  supabase: SupabaseClient,
  id: string,
  status: Extract<ExerciseReviewStatus, "approved" | "rejected">
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("exercises").update({ review_status: status }).eq("id", id);
  return { error: error ? "Couldn't update review status." : null };
}

/** Relies entirely on the "exercises are deletable by admins when unused"
 * RLS policy (0035) to enforce "only when safe" — if anything still
 * references this exercise, the delete affects zero rows rather than
 * erroring, so the caller checks rowCount, not just the absence of an
 * error. */
export async function deleteExercise(supabase: SupabaseClient, id: string): Promise<{ error: string | null }> {
  const { error, count } = await supabase.from("exercises").delete({ count: "exact" }).eq("id", id);
  if (error) return { error: "Couldn't delete that exercise." };
  if (!count) return { error: "This exercise is still used in a program and can't be deleted. Archive it instead." };
  return { error: null };
}

/** Admin-only "Merge Duplicate Exercises" (spec) — delegates to the
 * merge_exercises() security-definer function (migration 0035) so every
 * repointed reference happens in one transaction. */
export async function mergeExercises(supabase: SupabaseClient, sourceId: string, targetId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("merge_exercises", { source_id: sourceId, target_id: targetId });
  return { error: error ? error.message : null };
}

export async function addCoachingCue(supabase: SupabaseClient, exerciseId: string, cue: string, position: number): Promise<ExerciseCoachingCue | null> {
  const { data } = await supabase.from("exercise_coaching_cues").insert({ exercise_id: exerciseId, cue, position }).select().maybeSingle();
  return (data as ExerciseCoachingCue | null) ?? null;
}

export async function removeCoachingCue(supabase: SupabaseClient, cueId: string): Promise<void> {
  await supabase.from("exercise_coaching_cues").delete().eq("id", cueId);
}

export async function addCommonMistake(
  supabase: SupabaseClient,
  exerciseId: string,
  mistake: string,
  correction: string | null,
  position: number
): Promise<ExerciseCommonMistake | null> {
  const { data } = await supabase
    .from("exercise_common_mistakes")
    .insert({ exercise_id: exerciseId, mistake, correction, position })
    .select()
    .maybeSingle();
  return (data as ExerciseCommonMistake | null) ?? null;
}

export async function removeCommonMistake(supabase: SupabaseClient, mistakeId: string): Promise<void> {
  await supabase.from("exercise_common_mistakes").delete().eq("id", mistakeId);
}

export async function addExerciseRelationship(
  supabase: SupabaseClient,
  exerciseId: string,
  relatedExerciseId: string,
  relationshipType: ExerciseRelationshipType,
  position = 0
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("exercise_relationships")
    .insert({ exercise_id: exerciseId, related_exercise_id: relatedExerciseId, relationship_type: relationshipType, position });
  return { error: error ? "Couldn't add that relationship." : null };
}

export async function removeExerciseRelationship(supabase: SupabaseClient, relationshipId: string): Promise<void> {
  await supabase.from("exercise_relationships").delete().eq("id", relationshipId);
}

export { exerciseLibraryCategoryToPrescriptionCategory };
