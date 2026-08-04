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
  /** Migration 0053 — gates the questionnaire-driven "Build my program"
   * generator (/programs/generate) while it's in beta. Defaults to false
   * for everyone, including admins; granted per account from the /admin
   * roster's toggle, not inherited from is_admin. */
  beta_build_for_me: boolean;
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

/**
 * Migration 0054 — an append-only history of estimated 1RMs per athlete
 * per exercise (any exercise, not just personal_records' 4 fixed lift
 * strings). See lib/profile/queries.ts's getPersonalRecords, which merges
 * each exercise's *latest* row here into the same PersonalRecord[] shape
 * (using exercise_id as record_type — personal_records.record_type is
 * already free text, per migration 0009's own comment, so this needs no
 * new lookup path anywhere percent_1rm weight suggestions are resolved).
 */
export interface ExerciseMaxRecord {
  id: string;
  athlete_id: string;
  exercise_id: string;
  estimated_1rm_kg: number;
  performed_on: string;
  program_id: string | null;
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

export type NotificationType = "program_assigned" | "invite_accepted" | "invite_received" | "meal_plan_assigned";

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
  /** True for the one week (always position 1) the manual builder's "Add
   * testing week" button generated (migration 0054) — lets the button find
   * "the" testing week again on a repeat click to sync in newly-flagged
   * exercises, rather than guessing from position/label text. Optional,
   * same "undefined and false mean the same thing" convention as
   * BlockExercise.autoregulation_eligible: defaults to false at the
   * database level regardless, so the many hand-built WeekRow object
   * literals across this codebase don't all need updating. */
  is_testing_week?: boolean;
}

export interface TrainingDay {
  id: string;
  week_id: string;
  position: number;
  label: string | null;
  is_rest_day: boolean;
}

/**
 * What kind of block this is — the Workout Blocks architecture (migration
 * 0056). 'single' (renamed from the old 'straight') is one exercise;
 * 'superset' is an ad-hoc 2-exercise pairing with no round-based settings
 * of its own; 'circuit' is the fully-specified version of the same
 * grouping idea — name, rounds, rest-between-exercises/-rounds, goal,
 * completion method, notes (see ExerciseBlock's own fields below).
 * 'cardio_session'/'warmup'/'mobility'/'conditioning' are purpose-based
 * types the "+ Add Block" picker offers as their own first-class choices
 * rather than something inferred from exercise_category or block_role —
 * each still combines with those (a 'warmup'-typed block still defaults
 * into the 'warmup' block_role section; a 'cardio_session'-typed block's
 * exercises still default to exercise_category 'cardio') rather than
 * duplicating what those already handle. 'dropset' predates this
 * migration and stays valid but unused (see block_exercises' own
 * "multiple set_prescriptions rows on one exercise" pattern for how drop
 * sets are actually modeled today). Not yet selectable in the picker but
 * already legal at the database level for forward-compat: 'tri_set',
 * 'giant_set', 'complex', 'contrast_set', 'plyometric', 'olympic_lifting',
 * 'partner', 'relay' — adding real support for any of these later is a
 * check-constraint change plus a new entry in this union and
 * lib/programs/block-types.ts, not a schema redesign.
 */
export type BlockType =
  | "single"
  | "superset"
  | "circuit"
  | "cardio_session"
  | "warmup"
  | "mobility"
  | "conditioning"
  | "dropset";

/**
 * Which section of the day a block belongs to (migration 0032) — the
 * Program Builder's Warm-up and Conditioning/Finisher sections, both
 * visually separate from the main workout. 'main' is the default so every
 * block created before this existed keeps rendering exactly where it
 * always did. Position uniqueness is scoped to (day_id, block_role,
 * position), not just (day_id, position) — each section manages its own
 * independent ordering, the same way block_exercises are scoped to their
 * block and set_prescriptions to their block_exercise.
 *
 * Deliberately orthogonal to BlockType (migration 0056): block_role
 * answers "which section does this render in," block_type answers "what
 * kind of block is this." A block_type of 'warmup' sets a sensible
 * block_role default when first created, but the two are never forced to
 * agree — a coach can still drag a 'warmup'-typed block into the Main
 * section if that's genuinely where they want it to sit.
 */
export type BlockRole = "warmup" | "main" | "conditioning";

/** Circuit Completion Method (migration 0056) — each value changes which
 * of ExerciseBlock's timing fields are actually shown/used; see
 * lib/programs/completion-methods.ts, the declarative field map (same
 * pattern lib/programs/prescription-types.ts already uses for
 * PrescriptionType). Only meaningful for 'circuit'/'superset' blocks. */
export type CompletionMethod = "traditional_rounds" | "timed" | "amrap" | "emom" | "for_time" | "quality";

export interface ExerciseBlock {
  id: string;
  day_id: string;
  position: number;
  block_type: BlockType;
  block_role: BlockRole;
  rounds: number;
  /** Circuit Name, e.g. "Circuit A", "Upper Body Circuit" — also usable as
   * a plain label for any block type. Null for a block the coach hasn't
   * named. */
  custom_name: string | null;
  /** Coach Notes for the whole block ("Move continuously..."), shown to
   * the athlete before they start it — distinct from any one exercise's
   * own block_exercises.notes. */
  notes: string | null;
  /** Circuit Goal (Strength/Hypertrophy/Conditioning/Mobility/
   * Rehabilitation/Warm-up/Power/Endurance) — free text, primarily
   * organisational (spec's own framing), not a hard enum. */
  goal: string | null;
  completion_method: CompletionMethod | null;
  /** The circuit-level default; an individual exercise's own
   * set_prescriptions.rest_seconds can still override it — "rest
   * inherited from circuit" when that's left null. */
  rest_between_exercises_seconds: number | null;
  rest_between_rounds_seconds: number | null;
  /** Total time cap — Timed Circuit (run for this long), AMRAP (as many
   * rounds as possible in this long), or an optional For Time cap. */
  duration_seconds: number | null;
  /** EMOM's "every N seconds" interval. */
  interval_seconds: number | null;
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
export type ExerciseCategory = "strength" | "running" | "cardio" | "mobility";

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
  /** Manual program builder's "Test max before" checkbox (migration 0054)
   * — marks that this exercise usage should get a max-test set generated
   * into the program's testing week (see program-builder's "Add testing
   * week" button, lib/programs/mutations.ts's syncTestingWeek). Optional,
   * same convention as autoregulation_eligible above. */
  test_max_before?: boolean;
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

/** 'reps' added for cardio-category movements that are naturally counted
 * rather than timed/measured — a circuit's "15 burpies" or "20 mountain
 * climbers" has no meaningful duration/distance/calorie target of its own
 * (that's the whole circuit's job — see completion-methods.ts), it just
 * needs a rep count like any bodyweight movement would. Shares the exact
 * string value with MobilityPrescriptionType's own 'reps' below — same
 * concept (a plain rep count), just valid for a different exercise_category
 * — not a collision; see the enforce_valid_prescription_type() trigger
 * (migration 0057) for the per-category allow-list this still respects. */
export type CardioPrescriptionType = "time" | "distance" | "calories" | "heart_rate_zone" | "rpe" | "intervals" | "coach_notes" | "reps";

/** Migration 0056 — a Mobility block's exercises (stretches, activation
 * drills, band work) don't fit strength/running/cardio's prescription
 * shapes, which all assume load, pace, or a heart-rate target. */
export type MobilityPrescriptionType = "hold_time" | "reps" | "coach_notes_only";

export type PrescriptionType = StrengthPrescriptionType | RunningPrescriptionType | CardioPrescriptionType | MobilityPrescriptionType;

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
  /** True for a testing-week single graded top set — see migration 0052.
   * When a set with this flag is actually logged, finishWorkout
   * (lib/training/mutations.ts) computes an e1RM from the performed
   * weight/reps/rir and (a) if pr_record_type is one of the 4 fixed main
   * lifts, writes it to personal_records[pr_record_type] (unchanged since
   * migration 0052), and (b) always writes it to exercise_max_records
   * keyed by this exercise's own exercise_id (migration 0054) — the
   * general "library of maxes" that covers any exercise, not just the 4
   * main lifts. No manual profile entry involved either way. False for
   * every other row, including a later percent_1rm row that reads that
   * same pr_record_type (or, if null, this exercise's own exercise_max_records
   * history) for display. Optional (not just nullable), same convention as
   * BlockExercise.autoregulation_eligible (migration 0046): defaults to
   * false at the database level regardless, so undefined and false mean
   * exactly the same thing here and the many existing hand-built
   * SetPrescription/SetRow object literals across this codebase (test
   * fixtures, starter-templates.ts, text-parse.ts) don't all need updating
   * for it. Only assemble.ts and lib/programs/mutations.ts's
   * syncTestingWeek need to set it explicitly. */
  is_max_test?: boolean;
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
  /** Reps in reserve, as reported by the ternary-plus-one question ("how
   * many more reps could you have done?") — 0/1/2/3, where 3 stands for "3
   * or more." Kept separate from performed_rpe rather than converted on the
   * way in; see migration 0044's comment on why. Nullable: only ever
   * populated for an autoregulation-eligible slot's final working set (see
   * lib/training/autoregulation.ts). */
  performed_rir: number | null;
  /** Which round of a circuit/superset this set belonged to (migration
   * 0056) — forward-compat for Training Mode's circuit-round sequencing,
   * not yet written by anything; null for every set logged today. */
  round_number: number | null;
  notes: string | null;
  created_at: string;
}

// ============================================================
// Nutrition (migration 0058) — meal plans built and sent to athletes the
// same way programs are. See that migration's own header comment for the
// full design rationale (flatter tree than programs, swappable meal
// options, foods catalog). Types here mirror the Program/TrainingDay/
// ExerciseBlock/BlockExercise/SetPrescription shapes above as closely as
// the two domains actually match.
// ============================================================

/** A food catalog entry — either a global USDA-seeded row (owner_id null,
 * source 'usda') or a coach's own custom food (owner_id set, source
 * 'custom'). All macro/nutrient fields are per 100g; meal_items.quantity_g
 * is what actually scales them for a given plan. */
export interface Food {
  id: string;
  name: string;
  brand: string | null;
  source: "usda" | "custom";
  /** USDA's own identifier for this food when source is 'usda' (SR28's NDB
   * number, not necessarily a literal FoodData Central fdc_id — see
   * scripts/import-usda-foods.py). Null for custom foods. */
  fdc_id: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  /** UI convenience only — pre-fills a sensible quantity_g when a coach adds
   * this food to a meal ("1 medium egg (50g)"). Never used to compute
   * macros; quantity_g always is. */
  default_serving_g: number | null;
  default_serving_label: string | null;
  owner_id: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

/** Same owner/athlete shape as Program — owner_id is always the coach (or
 * the self-programming athlete, when athlete_id = owner_id). */
export interface NutritionPlan {
  id: string;
  owner_id: string;
  athlete_id: string;
  name: string;
  notes: string | null;
  /** Plan-wide default macro targets; any nutrition_days row can override
   * one or more, falling back to these when its own value is null. All
   * nullable — a coach can build a plan with no numeric targets at all. */
  daily_calories_target: number | null;
  daily_protein_target_g: number | null;
  daily_carbs_target_g: number | null;
  daily_fat_target_g: number | null;
  is_active: boolean;
  removed_by_athlete_at: string | null;
  created_at: string;
  updated_at: string;
}

/** One day in a plan's flat, coach-ordered list (no weeks layer — see
 * migration 0058's header for why). Target overrides fall back to the
 * parent NutritionPlan's own value when null. */
export interface NutritionDay {
  id: string;
  plan_id: string;
  position: number;
  label: string | null;
  notes: string | null;
  calories_target: number | null;
  protein_target_g: number | null;
  carbs_target_g: number | null;
  fat_target_g: number | null;
  created_at: string;
}

/** One meal slot ("Breakfast", "Lunch", "Snack 1" — coach free text). Always
 * has at least one MealOption; allow_athlete_swap gates whether the athlete
 * may change selected_option_id themselves (enforced by
 * enforce_meal_update_permissions — RLS alone can't express "only this one
 * column," see the migration). */
export interface Meal {
  id: string;
  day_id: string;
  position: number;
  name: string;
  notes: string | null;
  allow_athlete_swap: boolean;
  /** Which MealOption is currently "the" version of this meal. Null means
   * "use the option at position 1" — the default before anyone (coach or
   * athlete) has explicitly chosen one. Only ever athlete-writable when
   * allow_athlete_swap is true; always coach-writable regardless. */
  selected_option_id: string | null;
  created_at: string;
}

/** One coach-defined alternative for a meal — "Option A"/"Option B", roughly
 * macro-equivalent by convention, not by any DB-enforced constraint. A meal
 * with only one option (the common case) just never surfaces a swap UI. */
export interface MealOption {
  id: string;
  meal_id: string;
  position: number;
  label: string;
  notes: string | null;
  created_at: string;
}

/** One food line item within a MealOption. quantity_g is grams — the only
 * unit macros are ever computed from. display_label is a purely cosmetic
 * override ("2 eggs", "1 scoop") so a coach can build naturally without the
 * athlete needing to think in grams. */
export interface MealItem {
  id: string;
  meal_option_id: string;
  position: number;
  food_id: string;
  quantity_g: number;
  display_label: string | null;
  notes: string | null;
  created_at: string;
}
