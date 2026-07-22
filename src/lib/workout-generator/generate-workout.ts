import { EXERCISES, type Exercise, type EquipmentTier, type MovementPattern } from "./exercises";

export type Goal = "strength" | "hypertrophy" | "general_fitness";
export type FocusArea = "full_body" | "upper" | "lower" | "push" | "pull";

export const GOAL_LABELS: Record<Goal, string> = {
  strength: "Strength",
  hypertrophy: "Hypertrophy",
  general_fitness: "General fitness",
};

export const FOCUS_LABELS: Record<FocusArea, string> = {
  full_body: "Full body",
  upper: "Upper body",
  lower: "Lower body",
  push: "Push",
  pull: "Pull",
};

export const EQUIPMENT_LABELS: Record<EquipmentTier, string> = {
  bodyweight: "Bodyweight only",
  dumbbell: "Dumbbells",
  full_gym: "Full gym",
};

interface RepScheme {
  sets: number;
  reps: string;
  repsAvg: number;
  restSeconds: number;
}

interface GoalScheme {
  compound: RepScheme;
  isolation: RepScheme;
  /** Rough seconds per rep, used only for time-budget estimation. */
  repSecondsEstimate: number;
}

const GOAL_SCHEMES: Record<Goal, GoalScheme> = {
  strength: {
    compound: { sets: 4, reps: "4-6", repsAvg: 5, restSeconds: 150 },
    isolation: { sets: 3, reps: "6-8", repsAvg: 7, restSeconds: 90 },
    repSecondsEstimate: 4,
  },
  hypertrophy: {
    compound: { sets: 3, reps: "8-12", repsAvg: 10, restSeconds: 90 },
    isolation: { sets: 3, reps: "12-15", repsAvg: 13, restSeconds: 60 },
    repSecondsEstimate: 3,
  },
  general_fitness: {
    compound: { sets: 3, reps: "12-15", repsAvg: 13, restSeconds: 45 },
    isolation: { sets: 2, reps: "15-20", repsAvg: 17, restSeconds: 30 },
    repSecondsEstimate: 2.5,
  },
};

interface FocusPatterns {
  primary: MovementPattern[];
  secondary: MovementPattern[];
}

const FOCUS_PATTERNS: Record<FocusArea, FocusPatterns> = {
  full_body: {
    primary: ["squat", "hinge", "push_horizontal", "pull_horizontal"],
    secondary: ["push_vertical", "pull_vertical", "core", "carry"],
  },
  upper: {
    primary: ["push_horizontal", "pull_horizontal", "push_vertical", "pull_vertical"],
    secondary: ["core"],
  },
  lower: {
    primary: ["squat", "hinge"],
    secondary: ["core", "carry"],
  },
  push: {
    primary: ["push_horizontal", "push_vertical"],
    secondary: ["core"],
  },
  pull: {
    primary: ["pull_horizontal", "pull_vertical"],
    secondary: ["core", "carry"],
  },
};

const MIN_EXERCISES = 2;
const MAX_EXERCISES = 8;
const TRANSITION_BUFFER_SECONDS = 30;

export interface WorkoutExercise {
  exercise: Exercise;
  sets: number;
  reps: string;
  restSeconds: number;
}

export interface GeneratedWorkout {
  exercises: WorkoutExercise[];
  goal: Goal;
  focus: FocusArea;
  equipment: EquipmentTier;
  requestedMinutes: number;
  estimatedMinutes: number;
}

function equipmentPool(tier: EquipmentTier): EquipmentTier[] {
  if (tier === "full_gym") return ["bodyweight", "dumbbell", "full_gym"];
  if (tier === "dumbbell") return ["bodyweight", "dumbbell"];
  return ["bodyweight"];
}

function schemeFor(goal: Goal, exercise: Exercise): RepScheme {
  const scheme = GOAL_SCHEMES[goal];
  return exercise.isCompound ? scheme.compound : scheme.isolation;
}

function estimateExerciseSeconds(goal: Goal, exercise: Exercise): number {
  const scheme = schemeFor(goal, exercise);
  const repSeconds = GOAL_SCHEMES[goal].repSecondsEstimate;
  return scheme.sets * (scheme.repsAvg * repSeconds + scheme.restSeconds) + TRANSITION_BUFFER_SECONDS;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Pick a random eligible exercise for a pattern, preferring compound
 * movements when available (they're prioritized first in a session), and
 * excluding anything already selected.
 */
function pickExercise(
  pool: Exercise[],
  pattern: MovementPattern,
  usedIds: Set<string>,
  rng: () => number
): Exercise | null {
  const candidates = pool.filter((e) => e.pattern === pattern && !usedIds.has(e.id));
  if (candidates.length === 0) return null;

  const compoundCandidates = candidates.filter((e) => e.isCompound);
  const pickFrom = compoundCandidates.length > 0 ? compoundCandidates : candidates;
  const index = Math.floor(rng() * pickFrom.length);
  return pickFrom[Math.min(index, pickFrom.length - 1)] ?? null;
}

export interface GenerateWorkoutInput {
  goal: Goal;
  equipment: EquipmentTier;
  focus: FocusArea;
  timeMinutes: number;
  /** Injectable for deterministic tests; defaults to Math.random. */
  rng?: () => number;
}

/**
 * Build a single workout session: pick exercises that balance the chosen
 * focus area's movement patterns, filtered to available equipment, sized
 * to roughly fit the requested time budget under the chosen goal's
 * set/rep/rest scheme.
 */
export function generateWorkout(input: GenerateWorkoutInput): GeneratedWorkout {
  const { goal, equipment, focus, timeMinutes, rng = Math.random } = input;

  const pool = EXERCISES.filter((e) => equipmentPool(equipment).includes(e.equipment)) as Exercise[];
  const { primary, secondary } = FOCUS_PATTERNS[focus];
  const patternOrder = [...primary, ...secondary];

  // Rough average exercise duration for this goal, used only to size the
  // session — actual duration is computed per-exercise afterward.
  const compoundEstimate = estimateExerciseSeconds(goal, {
    id: "", name: "", pattern: "squat", equipment: "bodyweight", isCompound: true,
  });
  const rawCount = Math.round((timeMinutes * 60) / compoundEstimate);
  const targetCount = clamp(rawCount, MIN_EXERCISES, MAX_EXERCISES);

  const selected: Exercise[] = [];
  const usedIds = new Set<string>();

  // Pass 1: one exercise per pattern, priority order, until every pattern
  // has a representative or we've hit the target count.
  for (const pattern of patternOrder) {
    if (selected.length >= targetCount) break;
    const exercise = pickExercise(pool, pattern, usedIds, rng);
    if (exercise) {
      selected.push(exercise);
      usedIds.add(exercise.id);
    }
  }

  // Pass 2: if there's still room, add accessory volume by cycling through
  // the pattern order again, skipping patterns with nothing left to offer.
  let guard = 0;
  while (selected.length < targetCount && guard < patternOrder.length * 4) {
    const pattern = patternOrder[guard % patternOrder.length]!;
    const exercise = pickExercise(pool, pattern, usedIds, rng);
    if (exercise) {
      selected.push(exercise);
      usedIds.add(exercise.id);
    }
    guard += 1;
  }

  const workoutExercises: WorkoutExercise[] = selected.map((exercise) => {
    const scheme = schemeFor(goal, exercise);
    return {
      exercise,
      sets: scheme.sets,
      reps: scheme.reps,
      restSeconds: scheme.restSeconds,
    };
  });

  const estimatedSeconds = workoutExercises.reduce((sum, we) => {
    const repSeconds = GOAL_SCHEMES[goal].repSecondsEstimate;
    const avgReps = Number(we.reps.split("-")[1] ?? we.reps) || 0;
    return sum + we.sets * (avgReps * repSeconds + we.restSeconds) + TRANSITION_BUFFER_SECONDS;
  }, 0);

  return {
    exercises: workoutExercises,
    goal,
    focus,
    equipment,
    requestedMinutes: timeMinutes,
    estimatedMinutes: Math.round(estimatedSeconds / 60),
  };
}
