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
  /** Migration 0040 — gates the one-time WelcomeTour modal, same
   * show-once pattern as role_selected/RoleOnboarding. */
  tour_seen: boolean;
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
  /** Denormalized from auth.users at signup (migration 0021) — profiles
   * otherwise has no way to show a user's email under RLS, since client
   * code can't query auth.users directly (no service-role key in this
   * app). Only ever populated by the handle_new_user trigger / the
   * migration's one-time backfill, never written from app code. */
  email: string | null;
  /** Migration 0021 — gates the /admin roster page. Not a UserRole
   * value on purpose: admin-ness is orthogonal to athlete/coach (an
   * admin is still whichever of those they were before), so it's its
   * own boolean rather than a third role value. */
  is_admin: boolean;
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

export type NotificationType = "program_assigned" | "invite_accepted" | "invite_received";

/**
 * One in-app notification (migration 0019). `link` is an app-relative path
 * the bell navigates to when clicked ('/programs/<id>', '/coaching'); null
 * for a type that has nothing to point at. Named `AppNotification` (not
 * `Notification`) to avoid colliding with the browser's own global.
 */
export interface AppNotification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
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

export type ProgramDiscipline = "resistance" | "running" | "hybrid" | "cardio";

export interface Program {
  id: string;
  owner_id: string;
  athlete_id: string;
  name: string;
  discipline: ProgramDiscipline;
  /** At most one true per athlete_id, enforced by a partial unique index
   * (migration 0010) — the program that drives /dashboard. */
  is_active: boolean;
  /** Set when the assigned athlete has removed their copy of a
   * coach-assigned program (migration 0018's remove_assigned_program) —
   * a soft delete, not a real row delete, so the coach still sees it
   * (with a "removed" note) instead of it silently disappearing from
   * their Client programs list. Null for a program still active on both
   * sides, and never set at all for a self-programmed row. */
  removed_by_athlete_at: string | null;
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

/**
 * Which section of the day a block belongs to (migration 0032) — the
 * Program Builder's Warm-up and Conditioning/Finisher sections, both
 * visually separate from the main workout. 'main' is the default so every
 * block created before this existed keeps rendering exactly where it
 * always did. Position uniqueness is scoped to (day_id, block_role,
 * position), not just (day_id, position) — each section manages its own
 * independent ordering, the same way block_exercises are scoped to their
 * block and set_prescriptions to their block_exercise.
 */
export type BlockRole = "warmup" | "main" | "conditioning";

export interface ExerciseBlock {
  id: string;
  day_id: string;
  position: number;
  block_type: BlockType;
  block_role: BlockRole;
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
  /** True for the 3-5 movements a generated program's template designated
   * as scheduled-progression lifts (see generate/types.ts's
   * ExerciseSlot.autoregulationEligible) — the flag the runtime RIR gate
   * (task #25) reads to decide which rows it's allowed to progress/hold/
   * reset. Optional (not just nullable) rather than required, so the many
   * existing object literals across this codebase that build a
   * BlockExerciseRow by hand (test fixtures, starter-templates.ts,
   * text-parse.ts) don't all need updating for a column that defaults to
   * false at the database level regardless — undefined and false mean
   * exactly the same thing here, "the gate leaves this row alone." Only
   * assemble.ts (the generator's own row-builder) and the mutation paths
   * that clone an existing BlockExerciseRow (addWeek, copyDayContents,
   * duplicateExercise) need to read/preserve it explicitly. Migration
   * 0046. */
  autoregulation_eligible?: boolean;
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

export type CardioPrescriptionType = "time" | "distance" | "calories" | "heart_rate_zone" | "rpe" | "intervals" | "coach_notes";

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
  /** Program Builder Advanced Mode's extensibility point — label/value
   * pairs for whatever a coach attaches beyond the standard prescription
   * fields (tempo, cluster rest, band/chain load, or a plain custom note).
   * Null for every row Advanced Mode has never touched; Simple Mode never
   * reads or writes this. See lib/programs/advanced-fields.ts. */
  advanced_config: Record<string, string> | null;
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
  /** True when this row records a deliberate skip ("move on to the next
   * day") rather than a completed session — see migration 0015. Excluded
   * from completion %, consistency %, and streak calculations, but still
   * used to advance which training day counts as "today". */
  skipped: boolean;
  /** When this became a real completed session — null while skipped is
   * true. Set explicitly (not just read off created_at) because a skipped
   * row can later be turned into a completed one (see finishWorkout in
   * lib/training/mutations.ts) without created_at changing — migration
   * 0016. */
  completed_at: string | null;
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
