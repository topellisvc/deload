/**
 * Hand-written types matching supabase/schema.sql. Once the Supabase
 * project exists and the CLI is linked, these should be replaced with
 * generated types (`supabase gen types typescript`) so they can never
 * drift from the real schema — this version exists to unblock typed
 * queries before that's set up.
 */

export type UserRole = "athlete" | "coach";

export interface Profile {
  id: string;
  role: UserRole;
  display_name: string | null;
  created_at: string;
}

export type CoachClientStatus = "pending" | "active";

export interface CoachClient {
  id: string;
  coach_id: string;
  client_id: string | null;
  client_email: string;
  coach_email: string;
  status: CoachClientStatus;
  created_at: string;
}

export interface SavedResult {
  id: string;
  user_id: string;
  tool_slug: string;
  result: Record<string, unknown>;
  created_at: string;
}

export type ProgramDiscipline = "resistance" | "running" | "hybrid";

export interface Program {
  id: string;
  owner_id: string;
  athlete_id: string;
  name: string;
  discipline: ProgramDiscipline;
  created_at: string;
  updated_at: string;
}

export interface ProgramWeek {
  id: string;
  program_id: string;
  position: number;
  label: string | null;
  based_on_week_id: string | null;
  created_at: string;
}

export interface TrainingDay {
  id: string;
  week_id: string;
  position: number;
  label: string | null;
  is_rest_day: boolean;
}

export type BlockType = "straight" | "superset" | "circuit" | "dropset";

export interface ExerciseBlock {
  id: string;
  day_id: string;
  position: number;
  block_type: BlockType;
  rounds: number;
}

export type ActivityType = "strength" | "run";

export interface BlockExercise {
  id: string;
  block_id: string;
  position: number;
  exercise_id: string | null;
  custom_name: string | null;
  notes: string | null;
  activity_type: ActivityType;
}

export type LoadType = "weight" | "percent_1rm" | "rpe" | "bodyweight" | "other";

export interface SetPrescription {
  id: string;
  block_exercise_id: string;
  position: number;
  sets: number;
  reps: string | null;
  load_type: LoadType;
  load_value: number | null;
  rest_seconds: number | null;
  notes: string | null;
  /** Run rows only (activity_type === "run"); unused by strength rows. */
  distance_meters: number | null;
  duration_seconds: number | null;
  pace_seconds_per_km: number | null;
}
