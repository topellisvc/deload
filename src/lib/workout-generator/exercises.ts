/**
 * Curated exercise database for the quick workout generator.
 *
 * Every exercise is tagged with a movement pattern (the functional role it
 * plays in a session, not the muscle group — this is what lets the
 * generator balance a workout rather than just picking randomly) and an
 * equipment tier. Equipment tiers are additive: a "full_gym" session can
 * also draw from "dumbbell" and "bodyweight" exercises, and a "dumbbell"
 * session can also draw from "bodyweight" ones, matching how a real gym
 * session actually works.
 */

export type MovementPattern =
  | "squat"
  | "hinge"
  | "push_horizontal"
  | "push_vertical"
  | "pull_horizontal"
  | "pull_vertical"
  | "core"
  | "carry";

export type EquipmentTier = "bodyweight" | "dumbbell" | "full_gym";

export interface Exercise {
  id: string;
  name: string;
  pattern: MovementPattern;
  equipment: EquipmentTier;
  /** Multi-joint movements are prioritized first when building a session. */
  isCompound: boolean;
}

export const EXERCISES: readonly Exercise[] = [
  // Squat
  { id: "bodyweight-squat", name: "Bodyweight Squat", pattern: "squat", equipment: "bodyweight", isCompound: true },
  { id: "jump-squat", name: "Jump Squat", pattern: "squat", equipment: "bodyweight", isCompound: true },
  { id: "bulgarian-split-squat", name: "Bulgarian Split Squat", pattern: "squat", equipment: "bodyweight", isCompound: true },
  { id: "walking-lunge", name: "Walking Lunge", pattern: "squat", equipment: "bodyweight", isCompound: true },
  { id: "goblet-squat", name: "Goblet Squat", pattern: "squat", equipment: "dumbbell", isCompound: true },
  { id: "dumbbell-lunge", name: "Dumbbell Lunge", pattern: "squat", equipment: "dumbbell", isCompound: true },
  { id: "barbell-back-squat", name: "Barbell Back Squat", pattern: "squat", equipment: "full_gym", isCompound: true },
  { id: "barbell-front-squat", name: "Barbell Front Squat", pattern: "squat", equipment: "full_gym", isCompound: true },
  { id: "leg-press", name: "Leg Press", pattern: "squat", equipment: "full_gym", isCompound: true },
  { id: "leg-extension", name: "Leg Extension", pattern: "squat", equipment: "full_gym", isCompound: false },

  // Hinge
  { id: "glute-bridge", name: "Glute Bridge", pattern: "hinge", equipment: "bodyweight", isCompound: true },
  { id: "single-leg-glute-bridge", name: "Single-Leg Glute Bridge", pattern: "hinge", equipment: "bodyweight", isCompound: true },
  { id: "single-leg-rdl-bodyweight", name: "Single-Leg Romanian Deadlift", pattern: "hinge", equipment: "bodyweight", isCompound: true },
  { id: "dumbbell-rdl", name: "Dumbbell Romanian Deadlift", pattern: "hinge", equipment: "dumbbell", isCompound: true },
  { id: "dumbbell-hip-thrust", name: "Dumbbell Hip Thrust", pattern: "hinge", equipment: "dumbbell", isCompound: true },
  { id: "dumbbell-swing", name: "Dumbbell Swing", pattern: "hinge", equipment: "dumbbell", isCompound: true },
  { id: "barbell-rdl", name: "Barbell Romanian Deadlift", pattern: "hinge", equipment: "full_gym", isCompound: true },
  { id: "barbell-deadlift", name: "Barbell Deadlift", pattern: "hinge", equipment: "full_gym", isCompound: true },
  { id: "barbell-good-morning", name: "Barbell Good Morning", pattern: "hinge", equipment: "full_gym", isCompound: true },
  { id: "leg-curl-machine", name: "Leg Curl Machine", pattern: "hinge", equipment: "full_gym", isCompound: false },

  // Push (horizontal)
  { id: "push-up", name: "Push-Up", pattern: "push_horizontal", equipment: "bodyweight", isCompound: true },
  { id: "incline-push-up", name: "Incline Push-Up", pattern: "push_horizontal", equipment: "bodyweight", isCompound: true },
  { id: "decline-push-up", name: "Decline Push-Up", pattern: "push_horizontal", equipment: "bodyweight", isCompound: true },
  { id: "dumbbell-bench-press", name: "Dumbbell Bench Press", pattern: "push_horizontal", equipment: "dumbbell", isCompound: true },
  { id: "dumbbell-floor-press", name: "Dumbbell Floor Press", pattern: "push_horizontal", equipment: "dumbbell", isCompound: true },
  { id: "dumbbell-chest-fly", name: "Dumbbell Chest Fly", pattern: "push_horizontal", equipment: "dumbbell", isCompound: false },
  { id: "barbell-bench-press", name: "Barbell Bench Press", pattern: "push_horizontal", equipment: "full_gym", isCompound: true },
  { id: "chest-press-machine", name: "Chest Press Machine", pattern: "push_horizontal", equipment: "full_gym", isCompound: true },
  { id: "cable-chest-fly", name: "Cable Chest Fly", pattern: "push_horizontal", equipment: "full_gym", isCompound: false },

  // Push (vertical)
  { id: "pike-push-up", name: "Pike Push-Up", pattern: "push_vertical", equipment: "bodyweight", isCompound: true },
  { id: "dumbbell-shoulder-press", name: "Dumbbell Shoulder Press", pattern: "push_vertical", equipment: "dumbbell", isCompound: true },
  { id: "dumbbell-arnold-press", name: "Dumbbell Arnold Press", pattern: "push_vertical", equipment: "dumbbell", isCompound: true },
  { id: "dumbbell-lateral-raise", name: "Dumbbell Lateral Raise", pattern: "push_vertical", equipment: "dumbbell", isCompound: false },
  { id: "barbell-overhead-press", name: "Barbell Overhead Press", pattern: "push_vertical", equipment: "full_gym", isCompound: true },
  { id: "machine-shoulder-press", name: "Machine Shoulder Press", pattern: "push_vertical", equipment: "full_gym", isCompound: true },
  { id: "cable-lateral-raise", name: "Cable Lateral Raise", pattern: "push_vertical", equipment: "full_gym", isCompound: false },

  // Pull (horizontal)
  { id: "inverted-row", name: "Inverted Row", pattern: "pull_horizontal", equipment: "bodyweight", isCompound: true },
  { id: "dumbbell-row", name: "Dumbbell Row", pattern: "pull_horizontal", equipment: "dumbbell", isCompound: true },
  { id: "dumbbell-renegade-row", name: "Dumbbell Renegade Row", pattern: "pull_horizontal", equipment: "dumbbell", isCompound: true },
  { id: "barbell-row", name: "Barbell Row", pattern: "pull_horizontal", equipment: "full_gym", isCompound: true },
  { id: "seated-cable-row", name: "Seated Cable Row", pattern: "pull_horizontal", equipment: "full_gym", isCompound: true },
  { id: "chest-supported-row-machine", name: "Chest-Supported Row Machine", pattern: "pull_horizontal", equipment: "full_gym", isCompound: true },
  { id: "rear-delt-fly-machine", name: "Rear Delt Fly Machine", pattern: "pull_horizontal", equipment: "full_gym", isCompound: false },

  // Pull (vertical)
  { id: "pull-up", name: "Pull-Up", pattern: "pull_vertical", equipment: "bodyweight", isCompound: true },
  { id: "chin-up", name: "Chin-Up", pattern: "pull_vertical", equipment: "bodyweight", isCompound: true },
  { id: "dumbbell-pullover", name: "Dumbbell Pullover", pattern: "pull_vertical", equipment: "dumbbell", isCompound: false },
  { id: "lat-pulldown", name: "Lat Pulldown", pattern: "pull_vertical", equipment: "full_gym", isCompound: true },
  { id: "assisted-pull-up-machine", name: "Assisted Pull-Up Machine", pattern: "pull_vertical", equipment: "full_gym", isCompound: true },
  { id: "straight-arm-pulldown", name: "Straight-Arm Pulldown", pattern: "pull_vertical", equipment: "full_gym", isCompound: false },

  // Core
  { id: "plank", name: "Plank", pattern: "core", equipment: "bodyweight", isCompound: false },
  { id: "side-plank", name: "Side Plank", pattern: "core", equipment: "bodyweight", isCompound: false },
  { id: "dead-bug", name: "Dead Bug", pattern: "core", equipment: "bodyweight", isCompound: false },
  { id: "bird-dog", name: "Bird Dog", pattern: "core", equipment: "bodyweight", isCompound: false },
  { id: "hanging-knee-raise", name: "Hanging Knee Raise", pattern: "core", equipment: "bodyweight", isCompound: false },
  { id: "russian-twist", name: "Russian Twist", pattern: "core", equipment: "bodyweight", isCompound: false },
  { id: "weighted-russian-twist", name: "Weighted Russian Twist", pattern: "core", equipment: "dumbbell", isCompound: false },
  { id: "weighted-sit-up", name: "Weighted Sit-Up", pattern: "core", equipment: "dumbbell", isCompound: false },
  { id: "cable-crunch", name: "Cable Crunch", pattern: "core", equipment: "full_gym", isCompound: false },

  // Carry
  { id: "farmers-carry", name: "Farmer's Carry", pattern: "carry", equipment: "dumbbell", isCompound: true },
  { id: "suitcase-carry", name: "Suitcase Carry", pattern: "carry", equipment: "dumbbell", isCompound: true },
  { id: "waiters-carry", name: "Waiter's Carry", pattern: "carry", equipment: "dumbbell", isCompound: true },
] as const;
