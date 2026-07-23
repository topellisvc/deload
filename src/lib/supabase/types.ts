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

/**
 * What kind of exercise this is — determines which prescription types are
 * even offered (see lib/programs/prescription-types.ts, the single
 * declarative source of truth for category -> allowed types -> visible
 * fields). Renamed from the old 'strength' | 'run' activity_type
 * (migration 0012): 'run' didn't leave room for general conditioning
 * (bike, row, ski erg, carries...) without either mislabeling it as a
 * run or bolting on a third ad-hoc flag.
 */
export type ExerciseCategory = "strength" | "running" | "cardio";

export interface BlockExercise {
  id: string;
  block_id: string;
  position: number;
  exercise_id: string | null;
  custom_name: string | null;
  notes: string | null;
  exercise_category: ExerciseCategory;
}

export type StrengthPrescriptionType =
  | "fixed_weight"
  | "percent_1rm"
  | "rpe"
  | "rir"
  | "rep_range"
  | "athlete_chooses_weight"
  | "coach_notes_only";

export type RunningPrescriptionType =
  | "distance"
  | "time"
  | "pace"
  | "heart_rate_zone"
  | "rpe"
  | "intervals"
  /** Distance + time prescribed together — the shape every running row
   * already had before this migration (RunSetRowEditor always showed both
   * fields). Kept as its own type rather than forcing old data into a
   * single-purpose bucket; new rows can still use plain 'distance' or
   * 'time' if only one target matters. */
  | "distance_time"
  | "coach_notes";

export type CardioPrescriptionType = "time" | "distance" | "calories" | "heart_rate_zone" | "rpe" | "coach_notes";

export type PrescriptionType = StrengthPrescriptionType | RunningPrescriptionType | CardioPrescriptionType;

/**
 * One planned set/segment — never mutated by what actually happened (see
 * LoggedSet). `prescription_type` (migration 0012) replaced the old
 * strength-only `load_type`/`load_value` pair with a value that spans all
 * three exercise categories, so the columns below are reused across
 * categories rather than duplicated per category: `rpe_value` serves both
 * strength's RPE type and running/cardio's RPE type, `distance_meters` /
 * `duration_seconds` serve running and cardio alike, etc. Which columns a
 * given prescription_type actually reads is defined once in
 * lib/programs/prescription-types.ts, not scattered across components.
 */
export interface SetPrescription {
  id: string;
  block_exercise_id: string;
  position: number;
  prescription_type: PrescriptionType;
  /** Strength "sets" count; doubles as the repeat count for running's
   * 'intervals' type (e.g. sets=6 + distance_meters=400 == "6x400m"). */
  sets: number;
  /** Free-text reps for every strength type except 'rep_range' (which uses
   * min_reps/max_reps instead) — e.g. "8", "8-10", "AMRAP". */
  reps: string | null;
  min_reps: number | null;
  max_reps: number | null;
  /** 'fixed_weight' only — the prescribed load. */
  weight_value: number | null;
  /** 'percent_1rm' only — the percentage; the suggested kg is computed at
   * render/log time from the athlete's current PR, never persisted here,
   * so it can never go stale. */
  percent_1rm_value: number | null;
  /** Which personal_records.record_type the percent_1rm suggestion reads
   * (e.g. 'bench_press') — free text, not a foreign key, since a PR for
   * that type may not exist yet when the prescription is written. */
  pr_record_type: string | null;
  /** Strength 'rpe' type AND running/cardio 'rpe' type — same concept, one column. */
  rpe_value: number | null;
  /** Strength 'rir' type only. */
  rir_value: number | null;
  /** Running & cardio 'heart_rate_zone' type — 1-5. */
  heart_rate_zone: number | null;
  /** Cardio 'calories' type only. */
  calories: number | null;
  rest_seconds: number | null;
  /** Primary content for the *_notes types; supplementary guidance for any other type. */
  notes: string | null;
  /** Running (distance/distance_time/intervals) + cardio (distance). */
  distance_meters: number | null;
  /** Running (time/distance_time/intervals) + cardio (time). */
  duration_seconds: number | null;
  /** Running 'pace' type only — target pace. */
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

/**
 * One performed set/segment — the permanent record of what actually
 * happened, wholly separate from SetPrescription (migration 0012). Never
 * written by anything that also writes a prescription; the two only ever
 * meet by being displayed side by side (see ExercisePerformanceComparison).
 * `set_prescription_id` is nullable and best-effort provenance only (the
 * athlete can log more sets than were prescribed, and the prescription
 * itself can be edited or removed later without invalidating history —
 * see migration 0012's comment on why that FK is `on delete set null`).
 */
export interface LoggedSet {
  id: string;
  session_log_id: string;
  block_exercise_id: string;
  set_prescription_id: string | null;
  position: number;
  performed_weight: number | null;
  performed_reps: number | null;
  performed_rpe: number | null;
  performed_distance_meters: number | null;
  performed_duration_seconds: number | null;
  performed_pace_seconds_per_km: number | null;
  performed_heart_rate: number | null;
  performed_calories: number | null;
  notes: string | null;
  created_at: string;
}
