/**
 * The Exercise Library (migration 0035) — a shared, database-backed
 * catalog that's the single source of truth for every exercise across the
 * Program Builder, Training Mode, athlete workout view, and coach
 * workflow. See that migration's header comment for the scope decisions
 * (fixed-vocabulary columns instead of lookup tables, one `metadata` jsonb
 * extension point instead of a table per "future ready" feature).
 *
 * Deliberately a *separate, richer* taxonomy from
 * lib/programs/types.ts's `ExerciseCategory` ("strength" | "running" |
 * "cardio") — that narrower type drives which prescription fields
 * block_exercises exposes (lib/programs/prescription-types.ts) and isn't
 * changing. `ExerciseLibraryCategory` below is the fuller spec taxonomy;
 * exerciseLibraryCategoryToPrescriptionCategory (mapping.ts) is the one
 * place the two meet.
 */

export type ExerciseLibraryCategory =
  | "strength"
  | "running"
  | "cardio"
  | "mobility"
  | "stretching"
  | "plyometrics"
  | "olympic_lifting";

export type MovementPattern =
  | "push"
  | "pull"
  | "squat"
  | "hinge"
  | "lunge"
  | "carry"
  | "rotation"
  | "anti_rotation"
  | "jump"
  | "throw";

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "quadriceps"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "core"
  | "biceps"
  | "triceps"
  | "forearms"
  | "full_body";

export type ExerciseEquipment =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "resistance_band"
  | "bodyweight"
  | "kettlebell"
  | "medicine_ball"
  | "cardio_machine";

export type ExerciseDifficulty = "beginner" | "intermediate" | "advanced";

export type ExerciseRelationshipType = "progression" | "regression" | "variation";

/** One row of `public.exercises` — the library's core entity. */
export interface Exercise {
  id: string;
  name: string;
  category: ExerciseLibraryCategory;
  movement_pattern: MovementPattern | null;
  primary_muscle_group: MuscleGroup;
  secondary_muscle_groups: string[];
  equipment: ExerciseEquipment;
  difficulty: ExerciseDifficulty;
  description: string | null;
  instructions_setup: string | null;
  instructions_execution: string | null;
  instructions_breathing: string | null;
  instructions_finishing: string | null;
  tags: string[];
  thumbnail_url: string | null;
  /** Documented extension point (0035's header comment) — future "future
   * ready" fields (video urls, 3D model refs, fatigue score, ...) land
   * here as keys before ever earning a real column. */
  metadata: Record<string, unknown>;
  owner_id: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExerciseCoachingCue {
  id: string;
  exercise_id: string;
  cue: string;
  position: number;
}

export interface ExerciseCommonMistake {
  id: string;
  exercise_id: string;
  mistake: string;
  correction: string | null;
  position: number;
}

export interface ExerciseRelationship {
  id: string;
  exercise_id: string;
  related_exercise_id: string;
  relationship_type: ExerciseRelationshipType;
  position: number;
}

/** A relationship resolved to the related exercise's name — what the
 * detail page actually renders (a link needs a name, not just an id). */
export interface RelatedExercise {
  id: string;
  name: string;
  difficulty: ExerciseDifficulty;
}

export interface ExerciseDetail extends Exercise {
  coachingCues: ExerciseCoachingCue[];
  commonMistakes: ExerciseCommonMistake[];
  progressions: RelatedExercise[];
  regressions: RelatedExercise[];
  variations: RelatedExercise[];
}

/** "Used in N Programs, Completed N Times, Used by N Coaches" (spec) —
 * always computed live from block_exercises/session data, never a stored
 * counter, so it can never drift out of sync with reality. */
export interface ExerciseUsageStats {
  programCount: number;
  completedCount: number;
  coachCount: number;
}

/** What a coach sees on an athlete's exercise history — "Last Performed,
 * Previous Loads, Estimated 1RM, Recent Notes" (spec), to help make
 * programming decisions. */
export interface ExerciseHistoryEntry {
  performedOn: string;
  sets: { weight: number | null; reps: number | null; rpe: number | null }[];
  notes: string | null;
}

export interface ExerciseHistoryForAthlete {
  lastPerformed: string | null;
  estimated1RM: number | null;
  recentEntries: ExerciseHistoryEntry[];
}

export interface ExerciseFilters {
  search?: string;
  category?: ExerciseLibraryCategory;
  equipment?: ExerciseEquipment;
  primaryMuscleGroup?: MuscleGroup;
  movementPattern?: MovementPattern;
  difficulty?: ExerciseDifficulty;
  includeArchived?: boolean;
}
