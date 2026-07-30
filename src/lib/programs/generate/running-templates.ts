import { needsHumanReason, recommendConsultationReason } from "@/lib/programs/generate/injuries";
import type { ExperienceLevel } from "@/lib/supabase/types";
import type {
  DayPlan,
  DeloadKind,
  ExerciseSlot,
  ProgramGenerationInput,
  ProgramPhase,
  ProgramTemplate,
  RunningHistory,
  TemplateResult,
  TrainingGoal,
  WeekContext,
  WeekSetPlan,
  WeekStructure,
} from "@/lib/programs/generate/types";

/**
 * §11's running templates: general fitness, 5k, 10k, half marathon, and
 * marathon. Structure throughout is base -> quality -> taper with 80% of
 * weekly volume easy and ~20% hard, one long run at ~25-30% of weekly volume
 * (never more than ~35%) — the coach's "common architecture for all of them."
 *
 * THE WEEK STRUCTURE IS FIXED; ONLY THE NUMBERS VARY BY WEEK
 * -------------------------------------------------------------
 * Same principle as every other template in this generator (see types.ts's
 * comment on WeekStructure): the day roles and their order don't change week
 * to week, only what each day's prescription resolves to. That mattered more
 * here than it first looks — a race goal doesn't get a quality day until its
 * build reaches the quality phase, so the *quality slot* still exists as a
 * day every week; during base weeks its prescription simply resolves to an
 * easy run instead of a hard session, decided inside that slot's own
 * `forWeek` by reading `ctx.phase`. An earlier version of this file instead
 * added or removed days per week and reshaped the result into a shared
 * skeleton after the fact, which meant a day's *label* could silently stop
 * matching what its prescription actually returned once the phase changed.
 * Fixed slots, phase-aware prescriptions closes that gap by construction.
 *
 * THE 10% RULE, DELIBERATELY NOT USED
 * -------------------------------------
 * §11 rejects the commonly-cited 10%-per-week rule outright (percentage-based,
 * ignores intensity, and the best-known trial of it found no injury
 * reduction). buildWeeklyDistances implements what the coach says to use
 * instead: 3-weeks-up/1-week-down cycling (~30-40% cut on the down week),
 * an absolute weekly-increase cap rather than a percentage one (~5-8 km,
 * this file uses the bottom of that range per the document's own "default to
 * the bottom" instruction), and never raising volume and intensity in the
 * same week (approximated by the quality slot staying an easy run until the
 * quality phase, rather than both ramping at once).
 *
 * WHAT THIS FILE DOES NOT MODEL, STATED ONCE
 * ---------------------------------------------
 * - Only one canonical quality-session shape per goal is built (the coach
 *   gives several valid options per distance, e.g. 5k's VO2max session as
 *   either 5-6x3min or 12x400m) — same "pick the default the prose leans on"
 *   scope cut splits.ts documents for the resistance split table.
 * - The acute:chronic workload ratio soft flag (§11 point 7) and the
 *   single-run-spike flag (point 6) aren't computed — both are explicitly
 *   optional/contested in the coach's own answer ("use as a warning, never a
 *   hard gate"), and the 3-up/1-down cap already bounds week-to-week jumps.
 * - Beginner run/walk intervals (§11 point 8) aren't built — every day here
 *   is prescribed as continuous running. A real beginner-specific easy-run
 *   prescription is follow-up work, not a structural change to this file.
 */

export type RunGoal = "run_general" | "run_5k" | "run_10k" | "run_half_marathon" | "run_marathon";

export function isRunGoal(goal: TrainingGoal): goal is RunGoal {
  return goal === "run_general" || goal === "run_5k" || goal === "run_10k" || goal === "run_half_marathon" || goal === "run_marathon";
}

interface RaceSpec {
  /** §11's own per-goal minimum, e.g. "5k -- 8-12 weeks." Below this, the
   * program still builds (marathon is the one goal with a hard downgrade
   * instead — see buildRunningTemplate) but carries a warning. */
  minWeeks: number;
  /** Bottom of §11's peak weekly volume range for this distance. */
  peakKm: number;
  taperWeeks: number;
  qualityLabel: string;
  qualityPrescription: (level: ExperienceLevel) => WeekSetPlan;
  /** §11: half marathon and marathon get their race-specificity mainly
   * through pace segments inserted into the long run, not a separate
   * session — null for 5k/10k, whose quality work is entirely the
   * interval/threshold day. */
  longRunPaceNote: string | null;
}

const KM_TO_METERS = 1000;

const RACE_SPECS: Record<Exclude<RunGoal, "run_general">, RaceSpec> = {
  run_5k: {
    minWeeks: 8,
    peakKm: 30,
    taperWeeks: 1,
    qualityLabel: "VO2max Intervals",
    qualityPrescription: () => ({
      prescriptionType: "intervals",
      sets: 5,
      durationSeconds: 180,
      restSeconds: 150,
      notes: "5 x 3 min at 5k effort, 2-3 min easy jog between reps. Hard but sustainable for the whole interval — not an all-out sprint.",
    }),
    longRunPaceNote: null,
  },
  run_10k: {
    minWeeks: 10,
    peakKm: 40,
    taperWeeks: 2,
    qualityLabel: "Threshold",
    qualityPrescription: () => ({
      prescriptionType: "intervals",
      sets: 2,
      durationSeconds: 1200,
      restSeconds: 180,
      notes: "2 x 20 min at threshold effort — comfortably hard, pace you could hold for about an hour if you had to.",
    }),
    longRunPaceNote: null,
  },
  run_half_marathon: {
    minWeeks: 12,
    peakKm: 50,
    taperWeeks: 2,
    qualityLabel: "Threshold",
    qualityPrescription: () => ({
      prescriptionType: "intervals",
      sets: 3,
      durationSeconds: 600,
      restSeconds: 180,
      notes: "3 x 10 min at threshold effort, 2-3 min easy jog between reps.",
    }),
    longRunPaceNote: "Insert the last 6-8 km at goal half-marathon pace once the long run is comfortably below your race distance's worth of fatigue.",
  },
  run_marathon: {
    minWeeks: 16,
    peakKm: 60,
    taperWeeks: 3,
    qualityLabel: "Threshold",
    qualityPrescription: () => ({
      prescriptionType: "intervals",
      sets: 2,
      durationSeconds: 900,
      restSeconds: 180,
      notes: "2 x 15 min at threshold effort. This goal's real quality work happens in the long run's marathon-pace segments, not here — this session just keeps threshold fitness ticking over.",
    }),
    longRunPaceNote: "Include marathon-pace segments in the back half of the long run as the block progresses — this is the highest-value quality work for this goal, more than the threshold session.",
  },
};

/** §11's run_general answer gets its own quality session — "fartlek, 20-30
 * min tempo, or short hills" — present every week bar a down week, since
 * that goal has "no periodization needed" rather than a base phase before
 * quality begins (see phaseForWeek's qualityStartWeek = 1 for this goal). */
const GENERAL_QUALITY: Pick<RaceSpec, "qualityLabel" | "qualityPrescription"> = {
  qualityLabel: "Tempo / Fartlek",
  qualityPrescription: () => ({
    prescriptionType: "time",
    sets: 1,
    durationSeconds: 1500,
    restSeconds: 0,
    notes: "20-30 min continuous tempo, or a fartlek — a few minutes of harder effort mixed into an otherwise easy run.",
  }),
};

function round(value: number): number {
  return Math.round(value);
}

/**
 * §11's volume progression, week by week: 3-up/1-down cycling toward peakKm,
 * capped at a flat ~5 km/week increase per cycle rather than a percentage,
 * then a taper that steps down from ~80% to ~40% of peak.
 */
export function buildWeeklyDistances(params: { totalWeeks: number; taperWeeks: number; startKm: number; peakKm: number }): number[] {
  const { totalWeeks, taperWeeks, startKm, peakKm } = params;
  const buildWeeks = Math.max(0, totalWeeks - taperWeeks);
  const maxWeeklyIncrease = 5; // km — bottom of §11's "no more than ~5-8 km/week" cap.
  const distances: number[] = [];
  let cycleBaseline = Math.min(startKm, peakKm);

  for (let week = 1; week <= buildWeeks; week++) {
    const posInCycle = ((week - 1) % 4) + 1; // 1,2,3 = up weeks; 4 = down week
    if (posInCycle === 4) {
      const lastUpWeek = distances[week - 2] ?? cycleBaseline;
      distances.push(round(lastUpWeek * 0.65)); // ~30-40% cut on the down week
      continue;
    }
    if (posInCycle === 1 && week > 1) {
      cycleBaseline = Math.min(peakKm, cycleBaseline + maxWeeklyIncrease);
    }
    const withinCycleStep = ((posInCycle - 1) * maxWeeklyIncrease) / 3;
    distances.push(round(Math.min(peakKm, cycleBaseline + withinCycleStep)));
  }

  for (let i = 0; i < taperWeeks; i++) {
    const fraction = taperWeeks === 1 ? 0.5 : 0.8 - (0.4 * i) / (taperWeeks - 1);
    distances.push(round(peakKm * fraction));
  }

  return distances;
}

function phaseForWeek(weekIndex: number, buildWeeks: number, qualityStartWeek: number): ProgramPhase {
  if (weekIndex > buildWeeks) return "taper";
  if (weekIndex % 4 === 0) return "down_week";
  return weekIndex >= qualityStartWeek ? "quality" : "base";
}

function distanceAt(distances: readonly number[], weekIndex: number): number {
  return distances[weekIndex - 1] ?? distances[distances.length - 1] ?? 0;
}

function distancePrescription(km: number, notes?: string): WeekSetPlan {
  return { prescriptionType: "distance", sets: 1, distanceMeters: round(km * KM_TO_METERS), heartRateZone: 2, notes: notes ?? null };
}

function isQualityPhase(phase: ProgramPhase): boolean {
  return phase === "quality" || phase === "taper";
}

/**
 * Builds the one WeekStructure every week of the template shares. Day roles
 * and their count never change; each slot's `forWeek` reads `ctx.phase` and
 * `ctx.weekIndex` to decide this week's actual numbers (and, for the quality
 * slot, whether this week is even a quality week yet).
 */
function buildWeekStructure(params: {
  daysPerWeek: number;
  distances: readonly number[];
  spec: RaceSpec | null;
  level: ExperienceLevel;
}): WeekStructure {
  const { daysPerWeek, distances, spec, level } = params;
  const quality = spec ?? GENERAL_QUALITY;
  const hasQualitySlot = daysPerWeek >= 3;
  const easyDayCount = Math.max(0, daysPerWeek - 1 - (hasQualitySlot ? 1 : 0));

  const days: DayPlan[] = [];

  if (hasQualitySlot) {
    const slot: ExerciseSlot = {
      role: "main",
      category: "running",
      movementPattern: null,
      primaryMuscleGroup: null,
      isPrimary: true,
      autoregulationEligible: false,
      prescription: {
        forWeek(ctx: WeekContext): WeekSetPlan {
          const weeklyKm = distanceAt(distances, ctx.weekIndex);
          if (!isQualityPhase(ctx.phase)) {
            return distancePrescription(round(weeklyKm * 0.15), "Easy pace — the harder session starts once the base-building weeks are done.");
          }
          return quality.qualityPrescription(level);
        },
      },
    };
    days.push({ label: quality.qualityLabel, isRestDay: false, intensity: "hard", loadsLowerBody: true, slots: [slot] });
  }

  for (let i = 0; i < easyDayCount; i++) {
    const slot: ExerciseSlot = {
      role: "main",
      category: "running",
      movementPattern: null,
      primaryMuscleGroup: null,
      isPrimary: false,
      autoregulationEligible: false,
      prescription: {
        forWeek(ctx: WeekContext): WeekSetPlan {
          const weeklyKm = distanceAt(distances, ctx.weekIndex);
          const longRunKm = round(weeklyKm * 0.28);
          const qualityKm = hasQualitySlot && isQualityPhase(ctx.phase) ? round(weeklyKm * 0.15) : 0;
          const remainingKm = Math.max(0, weeklyKm - longRunKm - qualityKm);
          const easyKm = easyDayCount > 0 ? remainingKm / easyDayCount : 0;
          return distancePrescription(easyKm, "Easy, conversational pace — Zone 2. This run should feel almost too easy.");
        },
      },
    };
    days.push({ label: "Easy Run", isRestDay: false, intensity: "easy", loadsLowerBody: true, slots: [slot] });
  }

  const longRunSlot: ExerciseSlot = {
    role: "main",
    category: "running",
    movementPattern: null,
    primaryMuscleGroup: null,
    isPrimary: true,
    autoregulationEligible: false,
    prescription: {
      forWeek(ctx: WeekContext): WeekSetPlan {
        const weeklyKm = distanceAt(distances, ctx.weekIndex);
        const longRunKm = round(weeklyKm * 0.28);
        const notes = spec?.longRunPaceNote && isQualityPhase(ctx.phase) ? spec.longRunPaceNote : undefined;
        return distancePrescription(longRunKm, notes);
      },
    },
  };
  days.push({ label: "Long Run", isRestDay: false, intensity: "moderate", loadsLowerBody: true, slots: [longRunSlot] });

  return { days };
}

export function buildRunningTemplate(input: ProgramGenerationInput): TemplateResult {
  const routeOut = needsHumanReason({ redFlags: input.redFlags, globalRefusals: input.globalRefusals, injuries: input.injuries });
  if (routeOut) return { needsHumanReason: routeOut };

  if (!isRunGoal(input.goal)) {
    return { error: `buildRunningTemplate does not handle goal "${input.goal}"` };
  }

  const running: RunningHistory = input.running ?? { currentWeeklyKm: 0, weeksAtCurrentVolume: 0, hasRunContinuouslyThirtyMinutes: false };

  // §11's one hard refusal: a marathon request with a short timeline and no
  // real running base becomes a half-marathon plan instead, with a one-line
  // explanation — "the alternative is a stress fracture and a user who
  // blames the app."
  const hasRunningBase = running.hasRunContinuouslyThirtyMinutes && running.currentWeeklyKm >= 10;
  if (input.goal === "run_marathon" && input.programLengthWeeks < 24 && !hasRunningBase) {
    const downgraded = buildRunningTemplate({ ...input, goal: "run_half_marathon" });
    if (!("template" in downgraded)) return downgraded;
    return {
      ...downgraded,
      warnings: [
        "A marathon build needs at least 24 weeks without an existing running base, and this request had less — built a half-marathon plan instead. That's a safer target from here, and a marathon plan is a realistic next step once this one's done.",
        ...downgraded.warnings,
      ],
    };
  }

  const spec = input.goal === "run_general" ? null : RACE_SPECS[input.goal];
  const peakKm = spec ? Math.max(spec.peakKm, running.currentWeeklyKm) : Math.max(20, running.currentWeeklyKm);
  const taperWeeks = spec?.taperWeeks ?? 0;
  const startKm = Math.max(8, running.currentWeeklyKm); // never program from zero — even a true beginner needs a floor to build from.

  const distances = buildWeeklyDistances({ totalWeeks: input.programLengthWeeks, taperWeeks, startKm, peakKm });
  const buildWeeks = input.programLengthWeeks - taperWeeks;
  // Quality work starts partway through the build for a race goal (base
  // first, per §11's "weeks 1-5: base... weeks 6-10: quality" shape,
  // proportioned to whatever programLengthWeeks actually is); run_general
  // carries a quality session from week 1, per its own answer.
  const qualityStartWeek = spec ? Math.max(1, Math.round(buildWeeks * 0.4)) : 1;

  const phaseByWeek = new Map<number, ProgramPhase>();
  const deloadWeeks = new Map<number, DeloadKind>();
  for (let week = 1; week <= input.programLengthWeeks; week++) {
    const phase = phaseForWeek(week, buildWeeks, qualityStartWeek);
    phaseByWeek.set(week, phase);
    if (phase === "down_week") deloadWeeks.set(week, "volume_cut");
  }

  const daysPerWeek = Math.max(2, input.daysPerWeek);
  const weekStructure = buildWeekStructure({ daysPerWeek, distances, spec, level: input.experienceLevel });

  const template: ProgramTemplate = { name: templateName(input.goal), discipline: "running", weekStructure, deloadWeeks, phaseByWeek };

  const warnings: string[] = [];
  if (spec && input.programLengthWeeks < spec.minWeeks) {
    warnings.push(
      `${spec.minWeeks} weeks is the sane minimum for this goal from a real base — this program is shorter than that, so treat the early weeks conservatively and don't force the peak volume if it's not feeling sustainable.`
    );
  }

  return { template, warnings, recommendConsultation: recommendConsultationFrom(input) };
}

function recommendConsultationFrom(input: ProgramGenerationInput): { reason: string } | null {
  const reason = recommendConsultationReason(input.injuries);
  return reason ? { reason } : null;
}

function templateName(goal: RunGoal): string {
  const labels: Record<RunGoal, string> = {
    run_general: "General Running Fitness",
    run_5k: "5k",
    run_10k: "10k",
    run_half_marathon: "Half Marathon",
    run_marathon: "Marathon",
  };
  return labels[goal];
}
