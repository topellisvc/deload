import { z } from "zod";
import type { WeekRow, DayRow, BlockRow, BlockExerciseRow, SetRow, ProgramDiscipline, ExerciseCategory, PrescriptionType } from "@/lib/programs/types";

/**
 * "Describe a program" feature (coach types/pastes a plain-English program
 * description, an LLM converts it to structured weeks/days/exercises/sets).
 *
 * This file is the one place that defines what the LLM is allowed to
 * return, deliberately much narrower than the full WeekRow tree
 * (types.ts) — the LLM only ever produces the handful of fields a coach
 * would plausibly state in prose (sets, reps, weight, RPE, distance, ...).
 * `parsedProgramToWeeks` below fills in everything else (block structure,
 * every other nullable SetRow field, fresh-but-placeholder ids) the same
 * way starter-templates.ts's hand-authored literals do, so the result can
 * go straight into addWeek's existing clone path (mutations.ts) without
 * that function needing to know this feature exists.
 */

const PRESCRIPTION_TYPE_VALUES = [
  "fixed_weight",
  "percent_1rm",
  "rpe",
  "rir",
  "rep_range",
  "athlete_chooses_weight",
  "coach_notes_only",
  "distance",
  "time",
  "distance_time",
  "pace",
  "heart_rate_zone",
  "intervals",
  "coach_notes",
  "calories",
] as const satisfies readonly PrescriptionType[];

/** Fallback prescription type per category if the model picks one that
 * doesn't actually belong to that category (e.g. "fixed_weight" for a
 * running exercise) — keeps a mismatched response usable instead of
 * rejecting the whole parse. */
// The "Describe a program" LLM parse doesn't offer 'mobility' as a
// category the model can return (see ParsedExerciseSchema's category enum
// below, deliberately unchanged) — these two maps still need a 'mobility'
// entry to satisfy Record<ExerciseCategory, ...>'s exhaustiveness, but it
// can never actually be read through this file's own parse path.
const CATEGORY_FALLBACK_TYPE: Record<ExerciseCategory, PrescriptionType> = {
  strength: "coach_notes_only",
  running: "coach_notes",
  cardio: "coach_notes",
  mobility: "coach_notes_only",
};

const VALID_TYPES_BY_CATEGORY: Record<ExerciseCategory, Set<PrescriptionType>> = {
  strength: new Set(["fixed_weight", "percent_1rm", "rpe", "rir", "rep_range", "athlete_chooses_weight", "coach_notes_only"]),
  running: new Set(["distance", "time", "distance_time", "pace", "heart_rate_zone", "rpe", "intervals", "coach_notes"]),
  cardio: new Set(["time", "distance", "calories", "heart_rate_zone", "rpe", "intervals", "coach_notes"]),
  mobility: new Set(["hold_time", "reps", "coach_notes_only"]),
};

const ParsedSetSchema = z.object({
  sets: z.number().int().min(1).max(20),
  reps: z.string().nullable().optional(),
  weight_kg: z.number().nullable().optional(),
  percent_1rm: z.number().nullable().optional(),
  rpe: z.number().nullable().optional(),
  rir: z.number().nullable().optional(),
  rest_seconds: z.number().nullable().optional(),
  distance_meters: z.number().nullable().optional(),
  duration_seconds: z.number().nullable().optional(),
  pace_seconds_per_km: z.number().nullable().optional(),
  heart_rate_zone: z.number().int().min(1).max(5).nullable().optional(),
  calories: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const ParsedExerciseSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["strength", "running", "cardio"]),
  role: z.enum(["warmup", "main", "conditioning"]).nullable().optional(),
  prescription_type: z.enum(PRESCRIPTION_TYPE_VALUES),
  notes: z.string().nullable().optional(),
  sets: z.array(ParsedSetSchema).min(1),
});

const ParsedDaySchema = z.object({
  label: z.string().nullable().optional(),
  is_rest_day: z.boolean(),
  exercises: z.array(ParsedExerciseSchema),
});

const ParsedWeekSchema = z.object({
  label: z.string().nullable().optional(),
  days: z.array(ParsedDaySchema).min(1),
});

export const ParsedProgramSchema = z.object({
  name: z.string().min(1),
  discipline: z.enum(["resistance", "running", "hybrid", "cardio"]),
  weeks: z.array(ParsedWeekSchema).min(1),
});

export type ParsedProgram = z.infer<typeof ParsedProgramSchema>;

/** The tool `input_schema` sent to the Claude API — hand-written rather
 * than generated from the Zod schema above (no zod-to-json-schema
 * dependency in this project) but must stay in sync with it; Zod is still
 * the real gate (parseTextRoute validates the tool call's input against
 * ParsedProgramSchema before ever trusting it). */
export const PARSED_PROGRAM_JSON_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "A short program name, e.g. 'Off-season strength block'." },
    discipline: { type: "string", enum: ["resistance", "running", "hybrid", "cardio"] },
    weeks: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          label: { type: ["string", "null"], description: "e.g. 'Week 1'. Omit to auto-label." },
          days: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                label: { type: ["string", "null"], description: "e.g. 'Day 1' or 'Upper Body'." },
                is_rest_day: { type: "boolean" },
                exercises: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      category: { type: "string", enum: ["strength", "running", "cardio"] },
                      role: { type: ["string", "null"], enum: ["warmup", "main", "conditioning", null] },
                      prescription_type: { type: "string", enum: PRESCRIPTION_TYPE_VALUES },
                      notes: { type: ["string", "null"] },
                      sets: {
                        type: "array",
                        minItems: 1,
                        items: {
                          type: "object",
                          properties: {
                            sets: { type: "integer", minimum: 1, maximum: 20 },
                            reps: { type: ["string", "null"], description: "e.g. '5' or '8-10'." },
                            weight_kg: { type: ["number", "null"] },
                            percent_1rm: { type: ["number", "null"] },
                            rpe: { type: ["number", "null"] },
                            rir: { type: ["number", "null"] },
                            rest_seconds: { type: ["number", "null"] },
                            distance_meters: { type: ["number", "null"], description: "Convert km/miles to meters." },
                            duration_seconds: { type: ["number", "null"], description: "Convert minutes to seconds." },
                            pace_seconds_per_km: { type: ["number", "null"], description: "Convert min/km or min/mile to seconds per km." },
                            heart_rate_zone: { type: ["integer", "null"], minimum: 1, maximum: 5 },
                            calories: { type: ["number", "null"] },
                            notes: { type: ["string", "null"] },
                          },
                          required: ["sets"],
                        },
                      },
                    },
                    required: ["name", "category", "prescription_type", "sets"],
                  },
                },
              },
              required: ["is_rest_day", "exercises"],
            },
          },
        },
        required: ["days"],
      },
    },
  },
  required: ["name", "discipline", "weeks"],
} as const;

function toSetRow(blockExerciseId: string, position: number, parsed: z.infer<typeof ParsedSetSchema>, prescriptionType: PrescriptionType): SetRow {
  return {
    id: "",
    block_exercise_id: blockExerciseId,
    position,
    prescription_type: prescriptionType,
    sets: parsed.sets,
    reps: parsed.reps ?? null,
    min_reps: null,
    max_reps: null,
    weight_value: parsed.weight_kg ?? null,
    percent_1rm_value: parsed.percent_1rm ?? null,
    pr_record_type: null,
    rpe_value: parsed.rpe ?? null,
    rir_value: parsed.rir ?? null,
    heart_rate_zone: parsed.heart_rate_zone ?? null,
    calories: parsed.calories ?? null,
    rest_seconds: parsed.rest_seconds ?? null,
    notes: parsed.notes ?? null,
    distance_meters: parsed.distance_meters ?? null,
    duration_seconds: parsed.duration_seconds ?? null,
    pace_seconds_per_km: parsed.pace_seconds_per_km ?? null,
    advanced_config: null,
  };
}

/**
 * Converts the LLM's narrow ParsedProgram into the same WeekRow[] shape
 * `createProgramFromSavedTemplate` already knows how to materialize (one
 * addWeek call per week, ids all blank placeholders — addWeek's clone path
 * never reads them, only content fields, and mints fresh uuids). Every
 * exercise becomes its own single-exercise "straight" block — grouping
 * into supersets is left for the coach to do by hand afterward in the
 * builder, same as every other program-creation path in this app (no
 * existing flow infers supersets automatically either).
 */
export function parsedProgramToWeeks(parsed: ParsedProgram): WeekRow[] {
  return parsed.weeks.map((week, weekIndex): WeekRow => ({
    id: "",
    program_id: "",
    position: weekIndex + 1,
    label: week.label ?? `Week ${weekIndex + 1}`,
    based_on_week_id: null,
    created_at: "",
    days: week.days.map((day, dayIndex): DayRow => {
      const blocks: BlockRow[] = day.is_rest_day
        ? []
        : day.exercises.map((exercise, exerciseIndex): BlockRow => {
            const category = exercise.category;
            const prescriptionType = VALID_TYPES_BY_CATEGORY[category].has(exercise.prescription_type)
              ? exercise.prescription_type
              : CATEGORY_FALLBACK_TYPE[category];
            const blockExercise: BlockExerciseRow = {
              id: "",
              block_id: "",
              position: 1,
              exercise_id: null,
              custom_name: exercise.name,
              notes: exercise.notes ?? null,
              exercise_category: category,
              sets: exercise.sets.map((set, setIndex) => toSetRow("", setIndex + 1, set, prescriptionType)),
            };
            return {
              id: "",
              day_id: "",
              position: exerciseIndex + 1,
              block_type: "single",
              block_role: exercise.role ?? "main",
              rounds: 1,
              custom_name: null,
              notes: null,
              goal: null,
              completion_method: null,
              rest_between_exercises_seconds: null,
              rest_between_rounds_seconds: null,
              duration_seconds: null,
              interval_seconds: null,
              exercises: [blockExercise],
            };
          });

      return {
        id: "",
        week_id: "",
        position: dayIndex + 1,
        label: day.label ?? `Day ${dayIndex + 1}`,
        is_rest_day: day.is_rest_day,
        blocks,
      };
    }),
  }));
}

export interface ProgramDisciplineAndWeeks {
  name: string;
  discipline: ProgramDiscipline;
  weeks: WeekRow[];
}

export function parsedProgramToTree(parsed: ParsedProgram): ProgramDisciplineAndWeeks {
  return { name: parsed.name, discipline: parsed.discipline, weeks: parsedProgramToWeeks(parsed) };
}
