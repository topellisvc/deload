import type {
  ExerciseDifficulty,
  ExerciseEquipment,
  ExerciseLibraryCategory,
  ExerciseReviewStatus,
  MovementPattern,
  MuscleGroup,
} from "@/lib/exercises/types";
import type { ExerciseCategory } from "@/lib/programs/types";

export const EXERCISE_LIBRARY_CATEGORIES: readonly ExerciseLibraryCategory[] = [
  "strength",
  "running",
  "cardio",
  "mobility",
  "stretching",
  "plyometrics",
  "olympic_lifting",
];

export const EXERCISE_LIBRARY_CATEGORY_LABELS: Record<ExerciseLibraryCategory, string> = {
  strength: "Strength",
  running: "Running",
  cardio: "Cardio",
  mobility: "Mobility",
  stretching: "Stretching",
  plyometrics: "Plyometrics",
  olympic_lifting: "Olympic Lifting",
};

export const MOVEMENT_PATTERNS: readonly MovementPattern[] = [
  "push",
  "pull",
  "squat",
  "hinge",
  "lunge",
  "carry",
  "rotation",
  "anti_rotation",
  "jump",
  "throw",
];

export const MOVEMENT_PATTERN_LABELS: Record<MovementPattern, string> = {
  push: "Push",
  pull: "Pull",
  squat: "Squat",
  hinge: "Hinge",
  lunge: "Lunge",
  carry: "Carry",
  rotation: "Rotation",
  anti_rotation: "Anti-Rotation",
  jump: "Jump",
  throw: "Throw",
};

export const MUSCLE_GROUPS: readonly MuscleGroup[] = [
  "chest",
  "back",
  "shoulders",
  "quadriceps",
  "hamstrings",
  "glutes",
  "calves",
  "core",
  "biceps",
  "triceps",
  "forearms",
  "full_body",
];

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  quadriceps: "Quadriceps",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  core: "Core",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  full_body: "Full Body",
};

export const EXERCISE_EQUIPMENT: readonly ExerciseEquipment[] = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "resistance_band",
  "bodyweight",
  "kettlebell",
  "medicine_ball",
  "cardio_machine",
];

export const EXERCISE_EQUIPMENT_LABELS: Record<ExerciseEquipment, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  machine: "Machine",
  cable: "Cable",
  resistance_band: "Resistance Band",
  bodyweight: "Bodyweight",
  kettlebell: "Kettlebell",
  medicine_ball: "Medicine Ball",
  cardio_machine: "Cardio Machine",
};

export const EXERCISE_DIFFICULTIES: readonly ExerciseDifficulty[] = ["beginner", "intermediate", "advanced"];

export const EXERCISE_DIFFICULTY_LABELS: Record<ExerciseDifficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const EXERCISE_REVIEW_STATUS_LABELS: Record<ExerciseReviewStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

/**
 * The one place the Exercise Library's 7-category taxonomy meets
 * block_exercises.exercise_category's narrower 3-value one
 * (lib/programs/prescription-types.ts). A block only ever prescribes sets
 * the same three ways (strength-style, running-style, cardio-style), so
 * mobility/stretching/plyometrics/olympic_lifting exercises all prescribe
 * like a strength exercise (sets x reps, or coach notes) when added to a
 * program — this is what makes every seeded exercise selectable from the
 * Program Builder's picker regardless of its library category.
 */
export function exerciseLibraryCategoryToPrescriptionCategory(category: ExerciseLibraryCategory): ExerciseCategory {
  if (category === "running") return "running";
  if (category === "cardio") return "cardio";
  return "strength";
}

/** The reverse direction — which library categories a given picker tab
 * (block_exercises.exercise_category) should search across. */
export function prescriptionCategoryToLibraryCategories(category: ExerciseCategory): ExerciseLibraryCategory[] {
  if (category === "running") return ["running"];
  if (category === "cardio") return ["cardio"];
  return ["strength", "mobility", "stretching", "plyometrics", "olympic_lifting"];
}
