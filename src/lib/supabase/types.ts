/**
 * Hand-written types matching supabase/schema.sql. Once the Supabase
 * project exists and the CLI is linked, these should be replaced with
 * generated types (`supabase gen types typescript`) so they can never
 * drift from the real schema — this version exists to unblock typed
 * queries before that's set up.
 */

export type UserRole = "athlete" | "coach";

/** Mirrors the unit types in lib/calculators/body-fat.ts — declared
 * separately here rather than imported so the core data model doesn't
 * depend on a specific calculator's module. */
export type ProfileLengthUnit = "cm" | "in";
export type ProfileMassUnit = "kg" | "lb";
export type ProfileSex = "male" | "female" | "other" | "prefer_not_to_say";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export interface Profile {
  id: string;
  role: UserRole;
  role_selected: boolean;
  display_name: string | null;
  height_value: number | null;
  height_unit: ProfileLengthUnit | null;
  weight_value: number | null;
  weight_unit: ProfileMassUnit | null;
  goal: string | null;
  bio: string | null;
  date_of_birth: string | null;
  sex: ProfileSex | null;
  experience_level: ExperienceLevel | null;
  /** One of StyleId from lib/training-style/recommend-style.ts — see
   * migration 0009 for why this is self-reported rather than pulled from
   * the finder tool automatically. */
  training_style: string | null;
  created_at: string;
}

/** A single current PR — one row per (user, record_type), see migration
 * 0009 for why record_type is a free text key instead of dedicated
 * columns per lift/distance. */
export interface PersonalRecord {
  id: string;
  user_id: string;
  record_type: string;
  value_number: number;
  unit: string;
  achieved_on: string | null;
  created_at: string;
  updated_at: string;
}

export type CoachClientStatus = "pending" | "active";

export interface CoachClient {
  id: string;
  coach_id: string;
  client_id: string | null;
  client_email: string;
  coach_email: string;
  status: CoachClientStatus;
  /** Optional note a coach can attach when inviting someone (migration 0011). */
  invite_message: string | null;
  /** When this invite was accepted — distinct from created_at, which is
   * when it was *sent*. Null until accepted (migration 0011). */
  accepted_at: string | null;
  created_at: string;
}

/**
 * One message in a coach<->athlete conversation. `coach_client_id` doubles
 * as the conversation id — each coaching relationship is inherently 1:1,
 * so there's no separate conversations table (migration 0011).
 */
export interface Message {
  id: string;
  coach_client_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  /** Reserved for future attachment support — unused today. */
  attachment_url: string | null;
  read_at: string | null;
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
  /** At most one true per athlete_id, enforced by a partial unique index
   * (migration 0010) — the program that drives /dashboard. */
  is_active: boolean;
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

/**
 * A logged training session: the existence of a row IS "this day was
 * done" — no separate completed flag. One training_day can have several
 * of these over time (repeating a program for a second cycle), each with
 * its own performed_on date.
 */
export interface SessionLog {
  id: string;
  training_day_id: string;
  athlete_id: string;
  performed_on: string;
  note: string | null;
  created_at: string;
}
