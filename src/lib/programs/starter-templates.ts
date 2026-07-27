import type {
  BlockExerciseRow,
  BlockRow,
  DayRow,
  ExerciseCategory,
  PrescriptionType,
  ProgramDiscipline,
  SetRow,
  WeekRow,
} from "@/lib/programs/types";

export interface StarterProgramTemplate {
  slug: string;
  name: string;
  description: string;
  discipline: ProgramDiscipline;
  daysPerWeek: number;
  totalWeeks: number;
  /**
   * Week 1's full content, shaped like a real WeekRow but never itself
   * persisted — createProgramFromTemplate (lib/programs/mutations.ts) feeds
   * this straight into addWeek's existing clone path, which already
   * generates fresh ids for every day/block/exercise/set regardless of
   * what's on the source object. The id/week_id/etc. placeholder strings
   * below are never read for anything other than structural typing.
   */
  week1: WeekRow;
  /** % load/volume increase for each week after week 1, applied relative
   * to week 1 (not compounding week-over-week) — e.g. [3, 6, 9] on top of
   * week1 makes a 4-week block. Only fixed_weight/percent_1rm/distance
   * values actually scale (see addWeek) — the exercise selection and
   * everything else stays identical across all 4 weeks by design; the
   * variation that matters for a beginner block is load/mileage, not a
   * different day pattern each week. */
  progressionSteps: number[];
}

// ---- authoring helpers ----
// Every id/week_id/day_id/block_id/block_exercise_id below is a throwaway
// placeholder: addWeek's clone path never reads them, it only reads content
// fields and always generates real ids fresh. Positions ARE read, so every
// helper assigns them from array order rather than requiring the caller to
// track numbers by hand.

function row(prescriptionType: PrescriptionType, overrides: Partial<SetRow> = {}): SetRow {
  return {
    id: "",
    block_exercise_id: "",
    position: 1,
    prescription_type: prescriptionType,
    sets: 3,
    reps: null,
    min_reps: null,
    max_reps: null,
    weight_value: null,
    percent_1rm_value: null,
    pr_record_type: null,
    rpe_value: null,
    rir_value: null,
    heart_rate_zone: null,
    calories: null,
    rest_seconds: 90,
    notes: null,
    distance_meters: null,
    duration_seconds: null,
    pace_seconds_per_km: null,
    ...overrides,
  };
}

function ex(name: string, category: ExerciseCategory, set: SetRow, notes: string | null = null): BlockExerciseRow {
  return {
    id: "",
    block_id: "",
    position: 1,
    exercise_id: null,
    custom_name: name,
    notes,
    exercise_category: category,
    sets: [{ ...set, position: 1 }],
  };
}

/** Every exercise below gets its own straight (non-superset) block — none
 * of these templates use supersets, keeping a first program as simple to
 * read (and to later edit in the builder) as possible. */
function b(exercise: BlockExerciseRow): BlockRow {
  return { id: "", day_id: "", position: 1, block_type: "straight", rounds: 1, exercises: [exercise] };
}

function day(label: string, isRestDay: boolean, blocks: BlockRow[] = []): DayRow {
  return {
    id: "",
    week_id: "",
    position: 1,
    label,
    is_rest_day: isRestDay,
    blocks: blocks.map((block, i) => ({ ...block, position: i + 1 })),
  };
}

function week1Of(days: DayRow[]): WeekRow {
  return {
    id: "",
    program_id: "",
    position: 1,
    label: "Week 1",
    based_on_week_id: null,
    created_at: "",
    days,
  };
}

// ---- templates ----
// percent_1rm is only used for the four lifts personal_records actually
// tracks (squat, bench_press, deadlift, overhead_press — see
// lib/profile/personal-records.ts's RECORD_TYPES) so the suggested-weight
// lookup has a real PR to resolve against once the athlete logs one.
// Everything else uses rep_range (or coach_notes_only for holds) instead of
// guessing an absolute load for someone we know nothing about yet.

const fullBodyStrength: StarterProgramTemplate = {
  slug: "full-body-strength",
  name: "Full Body Strength",
  description:
    "3 days a week, full-body every session. Squat, bench, deadlift, and overhead press form the base, with straightforward accessories around them.",
  discipline: "resistance",
  daysPerWeek: 3,
  totalWeeks: 4,
  progressionSteps: [3, 6, 9],
  week1: week1Of([
    day("Day 1", false, [
      b(ex("Back Squat", "strength", row("percent_1rm", { sets: 3, reps: "5", percent_1rm_value: 65, pr_record_type: "squat", rest_seconds: 150 }))),
      b(ex("Bench Press", "strength", row("percent_1rm", { sets: 3, reps: "5", percent_1rm_value: 65, pr_record_type: "bench_press", rest_seconds: 120 }))),
      b(ex("Barbell Row", "strength", row("rep_range", { sets: 3, min_reps: 8, max_reps: 10, rest_seconds: 90 }))),
      b(ex("Plank", "strength", row("coach_notes_only", { sets: 3, notes: "Hold 30-45 seconds.", rest_seconds: 45 }))),
    ]),
    day("Day 2", false, [
      b(ex("Deadlift", "strength", row("percent_1rm", { sets: 3, reps: "5", percent_1rm_value: 70, pr_record_type: "deadlift", rest_seconds: 150 }))),
      b(ex("Overhead Press", "strength", row("percent_1rm", { sets: 3, reps: "6", percent_1rm_value: 60, pr_record_type: "overhead_press", rest_seconds: 120 }))),
      b(ex("Lat Pulldown", "strength", row("rep_range", { sets: 3, min_reps: 8, max_reps: 12, rest_seconds: 90 }))),
      b(
        ex(
          "Dumbbell Romanian Deadlift",
          "strength",
          row("rep_range", { sets: 3, min_reps: 10, max_reps: 12, rest_seconds: 90 }),
          "Light-to-moderate load — this is about the hamstring stretch, not the weight on the bar."
        )
      ),
    ]),
    day("Day 3", false, [
      b(ex("Back Squat", "strength", row("percent_1rm", { sets: 3, reps: "8", percent_1rm_value: 55, pr_record_type: "squat", rest_seconds: 120 }))),
      b(ex("Incline Dumbbell Press", "strength", row("rep_range", { sets: 3, min_reps: 8, max_reps: 12, rest_seconds: 90 }))),
      b(ex("Seated Cable Row", "strength", row("rep_range", { sets: 3, min_reps: 8, max_reps: 12, rest_seconds: 90 }))),
      b(ex("Side Plank", "strength", row("coach_notes_only", { sets: 2, notes: "Hold 20-30 seconds each side.", rest_seconds: 30 }))),
    ]),
  ]),
};

const pushPullLegs: StarterProgramTemplate = {
  slug: "push-pull-legs",
  name: "Push Pull Legs",
  description:
    "6 days a week (with a rest day), lifting paired with a short conditioning finisher every session — for someone ready for more volume and frequency.",
  discipline: "hybrid",
  daysPerWeek: 6,
  totalWeeks: 4,
  progressionSteps: [3, 6, 9],
  week1: week1Of([
    day("Push", false, [
      b(ex("Bench Press", "strength", row("percent_1rm", { sets: 4, reps: "6", percent_1rm_value: 70, pr_record_type: "bench_press", rest_seconds: 120 }))),
      b(ex("Overhead Press", "strength", row("percent_1rm", { sets: 3, reps: "8", percent_1rm_value: 55, pr_record_type: "overhead_press", rest_seconds: 90 }))),
      b(ex("Incline Dumbbell Press", "strength", row("rep_range", { sets: 3, min_reps: 8, max_reps: 12, rest_seconds: 75 }))),
      b(ex("Cable Tricep Pushdown", "strength", row("rep_range", { sets: 3, min_reps: 10, max_reps: 15, rest_seconds: 60 }))),
      b(ex("Assault Bike", "cardio", row("time", { sets: 1, duration_seconds: 300, rest_seconds: null }), "Steady, conversational pace.")),
    ]),
    day("Pull", false, [
      b(ex("Deadlift", "strength", row("percent_1rm", { sets: 3, reps: "5", percent_1rm_value: 72.5, pr_record_type: "deadlift", rest_seconds: 150 }))),
      b(ex("Lat Pulldown", "strength", row("rep_range", { sets: 4, min_reps: 6, max_reps: 10, rest_seconds: 90 }))),
      b(ex("Barbell Row", "strength", row("rep_range", { sets: 3, min_reps: 8, max_reps: 10, rest_seconds: 90 }))),
      b(ex("Face Pull", "strength", row("rep_range", { sets: 3, min_reps: 12, max_reps: 15, rest_seconds: 60 }))),
      b(ex("Rowing Machine", "cardio", row("distance", { sets: 1, distance_meters: 1000, rest_seconds: null }), "Moderate effort, steady split.")),
    ]),
    day("Legs", false, [
      b(ex("Back Squat", "strength", row("percent_1rm", { sets: 4, reps: "6", percent_1rm_value: 67.5, pr_record_type: "squat", rest_seconds: 150 }))),
      b(ex("Romanian Deadlift", "strength", row("rep_range", { sets: 3, min_reps: 8, max_reps: 10, rest_seconds: 90 }))),
      b(ex("Walking Lunge", "strength", row("rep_range", { sets: 3, min_reps: 10, max_reps: 12, rest_seconds: 75 }), "Reps per leg.")),
      b(ex("Standing Calf Raise", "strength", row("rep_range", { sets: 3, min_reps: 12, max_reps: 15, rest_seconds: 60 }))),
      b(ex("Stationary Bike", "cardio", row("time", { sets: 1, duration_seconds: 300, rest_seconds: null }))),
    ]),
    day("Push", false, [
      b(ex("Overhead Press", "strength", row("percent_1rm", { sets: 4, reps: "6", percent_1rm_value: 62.5, pr_record_type: "overhead_press", rest_seconds: 120 }))),
      b(ex("Bench Press", "strength", row("percent_1rm", { sets: 3, reps: "8", percent_1rm_value: 60, pr_record_type: "bench_press", rest_seconds: 90 }))),
      b(ex("Dumbbell Lateral Raise", "strength", row("rep_range", { sets: 3, min_reps: 12, max_reps: 15, rest_seconds: 60 }))),
      b(ex("Tricep Dip", "strength", row("rep_range", { sets: 3, min_reps: 8, max_reps: 12, rest_seconds: 75 }))),
      b(ex("Assault Bike", "cardio", row("time", { sets: 1, duration_seconds: 300, rest_seconds: null }))),
    ]),
    day("Pull", false, [
      b(ex("Barbell Row", "strength", row("rep_range", { sets: 4, min_reps: 6, max_reps: 10, rest_seconds: 90 }))),
      b(ex("Deadlift", "strength", row("percent_1rm", { sets: 2, reps: "5", percent_1rm_value: 60, pr_record_type: "deadlift", rest_seconds: 120 }))),
      b(ex("Lat Pulldown", "strength", row("rep_range", { sets: 3, min_reps: 10, max_reps: 12, rest_seconds: 75 }))),
      b(ex("Barbell Curl", "strength", row("rep_range", { sets: 3, min_reps: 10, max_reps: 12, rest_seconds: 60 }))),
      b(ex("Rowing Machine", "cardio", row("distance", { sets: 1, distance_meters: 1000, rest_seconds: null }))),
    ]),
    day("Legs", false, [
      b(ex("Back Squat", "strength", row("percent_1rm", { sets: 3, reps: "10", percent_1rm_value: 55, pr_record_type: "squat", rest_seconds: 120 }))),
      b(ex("Leg Press", "strength", row("rep_range", { sets: 3, min_reps: 10, max_reps: 12, rest_seconds: 90 }))),
      b(ex("Leg Curl", "strength", row("rep_range", { sets: 3, min_reps: 10, max_reps: 12, rest_seconds: 75 }))),
      b(ex("Standing Calf Raise", "strength", row("rep_range", { sets: 3, min_reps: 15, max_reps: 20, rest_seconds: 60 }))),
      b(ex("Stationary Bike", "cardio", row("time", { sets: 1, duration_seconds: 300, rest_seconds: null }))),
    ]),
    day("Rest", true, []),
  ]),
};

const fiveKBaseBuilder: StarterProgramTemplate = {
  slug: "5k-base-builder",
  name: "5K Base Builder",
  description:
    "4 running days a week — easy running, one steadier effort, and a long run — built to safely grow your weekly mileage over 4 weeks.",
  discipline: "running",
  daysPerWeek: 4,
  totalWeeks: 4,
  progressionSteps: [8, 16, 24],
  week1: week1Of([
    day("Easy Run", false, [
      b(
        ex(
          "Easy Run",
          "running",
          row("distance", { sets: 1, distance_meters: 3000, rest_seconds: null }),
          "Conversational pace — you should be able to talk in full sentences."
        )
      ),
    ]),
    day("Rest", true, []),
    day("Steady Run", false, [
      b(ex("Steady Run", "running", row("distance", { sets: 1, distance_meters: 4000, rest_seconds: null }), "Comfortably hard — about a 6 or 7 out of 10 effort.")),
    ]),
    day("Rest", true, []),
    day("Easy Run", false, [
      b(ex("Easy Run", "running", row("distance", { sets: 1, distance_meters: 3000, rest_seconds: null }), "Easy, recovery-pace effort.")),
    ]),
    day("Rest", true, []),
    day("Long Run", false, [
      b(
        ex(
          "Long Run",
          "running",
          row("distance", { sets: 1, distance_meters: 5000, rest_seconds: null }),
          "Slow and steady — this is about time on your feet, not pace."
        )
      ),
    ]),
  ]),
};

const cardioConditioningBase: StarterProgramTemplate = {
  slug: "cardio-conditioning-base",
  name: "Cardio Conditioning Base",
  description:
    "3 cardio days a week across different machines — steady state, tempo, and an easy long effort — to build an aerobic base without touching a barbell.",
  discipline: "cardio",
  daysPerWeek: 3,
  totalWeeks: 4,
  // Only distance actually scales week-to-week (see addWeek's comment on
  // `scalable` above) — duration/heart-rate-zone blocks stay flat across
  // all 4 weeks, which is why the description above doesn't promise
  // specific weekly growth the way 5K Base Builder's does (every one of
  // its blocks is distance-based, so its whole week scales uniformly;
  // this template's Tempo Row is the only block that does).
  progressionSteps: [8, 16, 24],
  week1: week1Of([
    day("Steady State", false, [
      b(
        ex(
          "Stationary Bike",
          "cardio",
          row("heart_rate_zone", { sets: 1, duration_seconds: 1200, heart_rate_zone: 2, rest_seconds: null }),
          "Comfortable, sustainable pace — you should be able to hold a conversation the whole time."
        )
      ),
    ]),
    day("Rest", true, []),
    day("Tempo", false, [
      b(
        ex(
          "Rowing Machine",
          "cardio",
          row("distance", { sets: 1, distance_meters: 2500, rest_seconds: null }),
          "Faster than steady state — a pace you could hold for about 20 minutes, not an all-out effort."
        )
      ),
    ]),
    day("Rest", true, []),
    day("Long Steady", false, [
      b(
        ex(
          "Elliptical",
          "cardio",
          row("time", { sets: 1, duration_seconds: 1800, rest_seconds: null }),
          "Easy, steady effort — this is about time spent moving, not intensity."
        )
      ),
    ]),
    day("Rest", true, []),
    day("Rest", true, []),
  ]),
};

export const STARTER_PROGRAM_TEMPLATES: StarterProgramTemplate[] = [fullBodyStrength, pushPullLegs, fiveKBaseBuilder, cardioConditioningBase];

export function getStarterTemplate(slug: string): StarterProgramTemplate | undefined {
  return STARTER_PROGRAM_TEMPLATES.find((t) => t.slug === slug);
}
