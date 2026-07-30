import { easyPrescription } from "@/lib/programs/generate/cardio-templates";
import { needsHumanReason, recommendConsultationReason } from "@/lib/programs/generate/injuries";
import { applyLoadCalculationMethod, withTestingWeek } from "@/lib/programs/generate/load-calculation";
import { chooseSplit, missingWeeklyPatterns, slotSequenceForDayRole, type DayRole, type SlotRequest } from "@/lib/programs/generate/splits";
import type {
  DayPlan,
  DeloadKind,
  ExerciseSlot,
  LoadCalculationMethod,
  ProgramGenerationInput,
  ProgramPhase,
  ProgramTemplate,
  SlotPattern,
  SlotPrescription,
  TemplateResult,
  TrainingGoal,
  WeekContext,
  WeekSetPlan,
  WeekStructure,
} from "@/lib/programs/generate/types";

/**
 * §1-4, §8, §9's resistance templates: general hypertrophy, bodybuilding,
 * general strength, general fitness, and fat loss while lifting. Powerlifting
 * peaking (§5) and power/athletic development (§6) are separate templates
 * (#21, #22) — different enough in structure (a terminal meet date; output-
 * quality-driven rather than fatigue-driven prescription) that folding them
 * in here would make every function take a "but not if it's one of these two
 * goals" branch.
 *
 * WHAT THIS FILE DOES NOT MODEL, STATED ONCE
 * --------------------------------------------
 * - Intermediate's top-set-plus-backoff wave (§2) is genuinely two numbers —
 *   a top set and a lower-percentage backoff — but WeekSetPlan has one `sets`
 *   count and one rir/rpe target. This file represents the wave's *effort*
 *   progression (rir tightening week to week) faithfully and explains the
 *   top-set/backoff split in the slot's notes text rather than as structured
 *   data. A real "two-tier set" type would be a types.ts change affecting
 *   every template, not something to slip in here.
 * - Advanced periodization only implements the 4-week block (§2), not the
 *   8-week accumulation/intensification variant the same section also gives.
 *   ProgramPhase already reserves accumulation/transition/intensification/
 *   realization for that variant — building it is follow-up work, not a
 *   change to the type system.
 * - The deadlift-specific exception (progress weekly, not every session,
 *   after week 4) is approximated at the hinge_bilateral pattern level via a
 *   note, since prescriptions are pattern-based, not exercise-name-based.
 * - Bodybuilding's weak-point emphasis adds extra volume for lagging muscle
 *   groups every day rather than concentrating it on specific higher-
 *   frequency days — §4 asks for 3x/week frequency on lagging groups
 *   specifically, which needs a multi-week rotation scheme this v1 doesn't
 *   build.
 */

export type ResistanceGoal = "build_muscle_hypertrophy" | "build_muscle_bodybuilding" | "get_stronger" | "general_fitness" | "lose_fat";

export function isResistanceGoal(goal: TrainingGoal): goal is ResistanceGoal {
  return (
    goal === "build_muscle_hypertrophy" ||
    goal === "build_muscle_bodybuilding" ||
    goal === "get_stronger" ||
    goal === "general_fitness" ||
    goal === "lose_fat"
  );
}

interface RepRangeSpec {
  sets: number;
  minReps: number;
  maxReps: number;
  /** Reps in reserve target — see e1rm.ts's rirFromRpe/rpeFromRir for the
   * conversion the coach's answers treat as exact. */
  rir: number;
  restSeconds: number;
}

/** §4's main-lift table, translated from RPE ranges to their RIR equivalent
 * (RPE = 10 - RIR) and to the bottom of each range, per this document's own
 * instruction: "where a range is given, code the range and default to the
 * bottom of it." */
const MAIN_LIFT_SPEC: Record<ResistanceGoal, RepRangeSpec> = {
  build_muscle_hypertrophy: { sets: 3, minReps: 6, maxReps: 10, rir: 3, restSeconds: 150 }, // RPE 7-9
  build_muscle_bodybuilding: { sets: 3, minReps: 6, maxReps: 12, rir: 2, restSeconds: 150 }, // RPE 8-9
  get_stronger: { sets: 3, minReps: 3, maxReps: 6, rir: 3, restSeconds: 240 }, // RPE 7-9, 3-5 min rest
  general_fitness: { sets: 2, minReps: 8, maxReps: 12, rir: 4, restSeconds: 90 }, // RPE 6-8, deliberately submaximal
  lose_fat: { sets: 3, minReps: 5, maxReps: 10, rir: 3, restSeconds: 120 }, // RPE 7-8 — "maintain load/intensity"
};

const ACCESSORY_SPEC: Record<ResistanceGoal, RepRangeSpec> = {
  build_muscle_hypertrophy: { sets: 2, minReps: 10, maxReps: 15, rir: 2, restSeconds: 75 }, // RPE 8-10
  build_muscle_bodybuilding: { sets: 3, minReps: 8, maxReps: 20, rir: 1, restSeconds: 75 }, // RPE 9-10, closer to failure
  get_stronger: { sets: 3, minReps: 8, maxReps: 12, rir: 2, restSeconds: 100 }, // RPE 8
  general_fitness: { sets: 2, minReps: 10, maxReps: 15, rir: 3, restSeconds: 60 }, // RPE 7-8
  lose_fat: { sets: 2, minReps: 10, maxReps: 15, rir: 2, restSeconds: 60 }, // RPE 8-9, cut before main lifts do
};

function calibrationOverride(spec: RepRangeSpec): Partial<WeekSetPlan> {
  // §4: "cap all of week 1 at RPE 7, every set including accessories" and
  // "first session of a new exercise ever: 2 sets, not 4." A calibration week
  // always relaxes toward *more* reserve, never less, regardless of goal.
  return { sets: Math.min(spec.sets, 2), rir: Math.max(spec.rir, 3), notes: "Calibration week — leave 3+ reps in the tank on every set. This is about finding a starting weight, not testing a limit." };
}

function reduceSets(sets: number, factor: number): number {
  return Math.max(1, Math.round(sets * factor));
}

/** §3's two deload kinds need opposite treatment; both are expressed here as
 * adjustments to a resolved (non-deload) WeekSetPlan rather than duplicated
 * per goal. */
function applyDeload(base: WeekSetPlan, kind: DeloadKind): WeekSetPlan {
  switch (kind) {
    case "volume_cut":
      return { ...base, sets: reduceSets(base.sets, 0.5), rir: 4, notes: "Deload week — fewer sets, same-ish weight, stop every set well short of failure." };
    case "joint_connective":
      return { ...base, sets: reduceSets(base.sets, 0.8), rir: 4, notes: "Deload week — drop the weight more than usual today. The joints are the target, not fatigue, so load comes down further than sets do." };
    case "systemic":
      return { ...base, sets: reduceSets(base.sets, 0.6), rir: 3, notes: "Deload week — lighter overall. Keep effort easy; this isn't the week to chase numbers." };
  }
}

function flatPrescription(spec: RepRangeSpec, extraNote?: string): SlotPrescription {
  return {
    forWeek(ctx: WeekContext): WeekSetPlan {
      const base: WeekSetPlan = {
        prescriptionType: "rir",
        sets: spec.sets,
        minReps: spec.minReps,
        maxReps: spec.maxReps,
        rir: spec.rir,
        restSeconds: spec.restSeconds,
        notes: extraNote ?? null,
      };
      // A testing week (see ProgramPhase's doc comment) isn't a calibration
      // week by name, but every slot that isn't itself being tested this
      // week (accessories, secondary compounds, an untested main lift) gets
      // the same light, conservative treatment — nothing here should be
      // pushed hard the same week another lift is getting a graded max
      // effort attempt.
      if (ctx.phase === "calibration" || ctx.phase === "testing") return { ...base, ...calibrationOverride(spec) };
      if (ctx.deload) return applyDeload(base, ctx.deload.kind);
      return base;
    },
  };
}

/**
 * Novice (beginner) primary lift — §2's session-to-session linear rule.
 * Deliberately flat week to week: the actual kg trajectory is the runtime
 * RIR-gate's job (task #25), reading autoregulation_events, not something
 * this static skeleton can compute from a week index alone. What this
 * function fixes is the *target* the runtime layer autoregulates against —
 * the rep range and effort ceiling — and the double-progression fallback
 * (§2: once linear progression dies, "give a rep range, add reps until the
 * top is hit on all sets, then add load and drop to the bottom") is exactly
 * what a stable minReps-maxReps range across weeks already expresses.
 */
function noviceMainLiftPrescription(goal: ResistanceGoal, pattern: SlotPattern): SlotPrescription {
  const spec = MAIN_LIFT_SPEC[goal];
  const deadliftNote =
    pattern === "hinge_bilateral"
      ? "This pattern fatigues faster than it should be pushed every session — after the first month, look to add load about once a week here rather than every session."
      : undefined;
  return flatPrescription(spec, deadliftNote);
}

/**
 * Intermediate primary lift — §2's top-set-plus-backoff wave. RIR tightens
 * week to week within a 4-week cycle (weeks 1-3 build toward a harder top
 * set; week 4 is the wave's own deload) — see this file's header comment for
 * why the top-set/backoff split itself is a note, not structured data.
 */
function intermediateMainLiftPrescription(goal: ResistanceGoal): SlotPrescription {
  const spec = MAIN_LIFT_SPEC[goal];
  const waveRir = [3, 2, 1, 4]; // week 1..3 build, week 4 is the wave's deload
  const backoffNote = "First set is today's top set. Treat the remaining sets as backoff work at roughly 88-90% of that top set's load.";
  return {
    forWeek(ctx: WeekContext): WeekSetPlan {
      if (ctx.phase === "calibration" || ctx.phase === "testing") {
        return { prescriptionType: "rir", sets: Math.min(spec.sets, 2), minReps: spec.minReps, maxReps: spec.maxReps, rir: 3, restSeconds: spec.restSeconds, ...calibrationOverride(spec) };
      }
      const weekInWave = ((ctx.weekIndex - 1) % 4) + 1;
      const base: WeekSetPlan = {
        prescriptionType: "rir",
        sets: spec.sets + 1,
        minReps: spec.minReps,
        maxReps: spec.minReps, // top-set-plus-backoff runs a fixed rep target, not a range
        rir: waveRir[weekInWave - 1] ?? spec.rir,
        restSeconds: spec.restSeconds,
        notes: backoffNote,
      };
      if (ctx.deload) return applyDeload(base, ctx.deload.kind);
      return base;
    },
  };
}

/**
 * Advanced primary lift — §2's 4-week block (3:1). Volume and intensity move
 * in the direction the coach's table gives; the 8-week accumulation/
 * intensification variant is documented as not-yet-built in this file's
 * header comment.
 */
function advancedMainLiftPrescription(): SlotPrescription {
  // sets, rir (RPE 6-9 -> rir 4..1), reps, restSeconds per week-in-block
  const block: { sets: number; minReps: number; maxReps: number; rir: number }[] = [
    { sets: 5, minReps: 5, maxReps: 6, rir: 3 }, // week 1: RPE 6-7
    { sets: 6, minReps: 5, maxReps: 5, rir: 2 }, // week 2: RPE 7-8
    { sets: 6, minReps: 4, maxReps: 5, rir: 1 }, // week 3: RPE 8-9
    { sets: 3, minReps: 5, maxReps: 5, rir: 4 }, // week 4: deload, RPE 5-6
  ];
  return {
    forWeek(ctx: WeekContext): WeekSetPlan {
      if (ctx.phase === "calibration" || ctx.phase === "testing") {
        return { prescriptionType: "rir", sets: 2, minReps: 5, maxReps: 8, rir: 3, restSeconds: 240, notes: "Calibration week — leave 3+ reps in the tank on every set." };
      }
      const weekInBlock = ((ctx.weekIndex - 1) % 4) + 1;
      const step = block[weekInBlock - 1] ?? block[0]!;
      const base: WeekSetPlan = { prescriptionType: "rir", sets: step.sets, minReps: step.minReps, maxReps: step.maxReps, rir: step.rir, restSeconds: 240, notes: null };
      if (ctx.deload) return applyDeload(base, ctx.deload.kind);
      return base;
    },
  };
}

function mainLiftPrescription(level: ProgramGenerationInput["experienceLevel"], goal: ResistanceGoal, pattern: SlotPattern): SlotPrescription {
  if (level === "beginner") return noviceMainLiftPrescription(goal, pattern);
  if (level === "intermediate") return intermediateMainLiftPrescription(goal);
  return advancedMainLiftPrescription();
}

/** Secondary compounds and accessories progress "opportunistically" at every
 * level per §2 ("beat last week's reps or load if you can, otherwise
 * repeat") — this file represents that as a flat target, same shape as a
 * novice's main lift, since the runtime layer (not this static skeleton)
 * is what actually tracks "did they beat last week." */
function secondaryPrescription(goal: ResistanceGoal): SlotPrescription {
  return flatPrescription(MAIN_LIFT_SPEC[goal]);
}

function accessoryPrescription(goal: ResistanceGoal): SlotPrescription {
  return flatPrescription(ACCESSORY_SPEC[goal]);
}

const LOWER_BODY_PATTERNS: ReadonlySet<SlotPattern> = new Set<SlotPattern>([
  "squat_bilateral",
  "squat_unilateral",
  "hinge_bilateral",
  "hinge_unilateral",
  "knee_flexion",
  "hip_abduction",
  "hip_adduction",
  "calf_gastroc",
  "calf_soleus",
]);

/** Goals where cardio is a standard-enough expectation that an opt-in
 * toggle makes sense — the build_muscle_ goals and get_stronger
 * deliberately stay lifting-only regardless of
 * ProgramGenerationInput.includeCardio (see that field's doc comment). */
const CARDIO_ELIGIBLE_GOALS: ReadonlySet<ResistanceGoal> = new Set<ResistanceGoal>(["general_fitness", "lose_fat"]);

/** Two easy Zone 2 sessions/week, appended on top of the lifting split —
 * same "maintained, not developed" dose hybrid-templates.ts gives its
 * secondary side, reusing cardio-templates.ts's easyPrescription so this
 * reads identically to a dedicated conditioning day. Fixed 25 minutes
 * rather than scaling with experience level: this is meant to stay a small
 * addition next to the lifting split, not grow into its own program. */
function cardioDaysFor(modality: ProgramGenerationInput["conditioningModality"]): DayPlan[] {
  const slot = (): ExerciseSlot => ({
    role: "conditioning",
    category: "cardio",
    movementPattern: null,
    primaryMuscleGroup: null,
    isPrimary: false,
    autoregulationEligible: false,
    prescription: { forWeek: () => easyPrescription(25 * 60, modality) },
  });
  return [
    { label: "Cardio A", isRestDay: false, intensity: "easy", loadsLowerBody: false, slots: [slot()] },
    { label: "Cardio B", isRestDay: false, intensity: "easy", loadsLowerBody: false, slots: [slot()] },
  ];
}

// LoadCalculationMethod support lives in load-calculation.ts, shared with
// power-athletic-templates.ts and sport-specific-templates.ts — see that
// file's header comment.

function dayLabel(role: DayRole, index: number): string {
  const labels: Record<DayRole, string> = {
    full_body_a: "Full Body A",
    full_body_b: "Full Body B",
    upper_a: "Upper A",
    lower_a: "Lower A",
    upper_b: "Upper B",
    lower_b: "Lower B",
    specialization: "Specialization",
    push: "Push",
    pull: "Pull",
    legs: "Legs",
  };
  // Disambiguate repeated PPL labels (Push/Pull/Legs x2) the same way the
  // splits already repeat the underlying role.
  const base = labels[role];
  return index >= 3 && (role === "push" || role === "pull" || role === "legs") ? `${base} 2` : base;
}

function buildDayPlan(
  role: DayRole,
  index: number,
  goal: ResistanceGoal,
  level: ProgramGenerationInput["experienceLevel"],
  extraSlots: SlotRequest[],
  loadCalculationMethod: LoadCalculationMethod
): DayPlan {
  const baseSlots = slotSequenceForDayRole(role);
  // §4's bodybuilding weak-point rule: "put them first in the session" —
  // inserted right after the compounds, ahead of the base accessories.
  const compoundCount = baseSlots.filter((s) => s.emphasis !== "accessory").length;
  const slots = [...baseSlots.slice(0, compoundCount), ...extraSlots, ...baseSlots.slice(compoundCount)];

  const exerciseSlots: ExerciseSlot[] = slots.map((slot) => {
    const isPrimary = slot.emphasis === "primary";
    const basePrescription = isPrimary
      ? slot.pattern
        ? mainLiftPrescription(level, goal, slot.pattern)
        : accessoryPrescription(goal)
      : slot.emphasis === "secondary"
        ? secondaryPrescription(goal)
        : accessoryPrescription(goal);
    const prescription = applyLoadCalculationMethod(basePrescription, loadCalculationMethod, isPrimary, slot.pattern, "strength");
    return {
      role: "main",
      category: "strength",
      movementPattern: slot.pattern,
      primaryMuscleGroup: slot.primaryMuscleGroup,
      isPrimary,
      autoregulationEligible: isPrimary,
      prescription,
    };
  });

  const loadsLowerBody = slots.some((s) => s.emphasis !== "accessory" && s.pattern && LOWER_BODY_PATTERNS.has(s.pattern));
  // General fitness is deliberately submaximal throughout (§4); every other
  // goal treats a lower-body-loading compound day as hard.
  const intensity = goal === "general_fitness" ? "moderate" : loadsLowerBody || slots.some((s) => s.emphasis === "primary") ? "hard" : "moderate";

  return { label: dayLabel(role, index), isRestDay: false, intensity, loadsLowerBody, slots: exerciseSlots };
}

/** §3's deload cadence and §4's calibration week, by experience level. */
function buildPhaseAndDeloadMaps(
  level: ProgramGenerationInput["experienceLevel"],
  programLengthWeeks: number,
  calibrationWeeks: number
): { phaseByWeek: Map<number, ProgramPhase>; deloadWeeks: Map<number, DeloadKind> } {
  const phaseByWeek = new Map<number, ProgramPhase>();
  const deloadWeeks = new Map<number, DeloadKind>();

  const deloadEvery = level === "advanced" ? 4 : level === "intermediate" ? 5 : null; // null: beginner gets no scheduled deload (§3)

  for (let week = 1; week <= programLengthWeeks; week++) {
    const isCalibration = week <= calibrationWeeks;
    const isScheduledDeload = deloadEvery !== null && week % deloadEvery === 0;
    if (isCalibration) {
      phaseByWeek.set(week, "calibration");
    } else if (isScheduledDeload) {
      phaseByWeek.set(week, "deload");
      deloadWeeks.set(week, "volume_cut");
    } else {
      phaseByWeek.set(week, "standard");
    }
  }

  return { phaseByWeek, deloadWeeks };
}

export function buildResistanceTemplate(input: ProgramGenerationInput): TemplateResult {
  const routeOut = needsHumanReason({ redFlags: input.redFlags, globalRefusals: input.globalRefusals, injuries: input.injuries });
  if (routeOut) return { needsHumanReason: routeOut };

  if (!isResistanceGoal(input.goal)) {
    return { error: `buildResistanceTemplate does not handle goal "${input.goal}"` };
  }
  const goal = input.goal;

  const { splitType, dayRoles, warnings: splitWarnings } = chooseSplit(input.daysPerWeek, input.experienceLevel, input.sessionLengthMinutes);

  const missing = missingWeeklyPatterns(dayRoles);
  if (missing.length > 0) {
    // Defensive — splits.ts's own tests assert this can't happen for any
    // split it produces, but a template builder should never silently ship
    // a week that fails its own non-negotiables.
    return { error: `Generated split is missing required weekly patterns: ${missing.join(", ")}` };
  }

  const laggingGroupSlots: SlotRequest[] =
    goal === "build_muscle_bodybuilding" && input.bodybuilding
      ? input.bodybuilding.laggingMuscleGroups.slice(0, 2).map((group) => ({ pattern: null, primaryMuscleGroup: group, emphasis: "accessory" as const }))
      : [];

  // See LoadCalculationMethod's doc comment — a beginner requesting
  // test_then_percent_1rm is downgraded rather than honoured; the UI
  // shouldn't offer this option to a beginner in the first place, but the
  // generator doesn't trust that and silently trusts an impossible combo.
  const beginnerRequestedTesting = input.loadCalculationMethod === "test_then_percent_1rm" && input.experienceLevel === "beginner";
  const loadCalculationMethod: LoadCalculationMethod = beginnerRequestedTesting ? "autoregulated_rir" : input.loadCalculationMethod;
  const includesTestingWeek = loadCalculationMethod === "test_then_percent_1rm";

  const liftingDays = dayRoles.map((role, index) => buildDayPlan(role, index, goal, input.experienceLevel, laggingGroupSlots, loadCalculationMethod));
  const includesCardio = input.includeCardio && CARDIO_ELIGIBLE_GOALS.has(goal);
  const days = includesCardio ? [...liftingDays, ...cardioDaysFor(input.conditioningModality)] : liftingDays;

  // §14 point 12: a returner needs a distinct ramp-in, not the first-week-
  // only calibration a brand-new user gets. Approximated here as an extended
  // calibration window rather than a separate phase value.
  const calibrationWeeks = input.athlete.recentLayoff ? Math.min(3, input.programLengthWeeks) : Math.min(1, input.programLengthWeeks);
  const basePhases = buildPhaseAndDeloadMaps(input.experienceLevel, input.programLengthWeeks, calibrationWeeks);
  const { phaseByWeek, deloadWeeks } = includesTestingWeek ? withTestingWeek(basePhases.phaseByWeek, basePhases.deloadWeeks) : basePhases;

  const template: ProgramTemplate = {
    name: templateName(goal, splitType),
    discipline: "resistance",
    weekStructure: { days } satisfies WeekStructure,
    deloadWeeks,
    phaseByWeek,
  };

  const warnings = [...splitWarnings];
  if (includesCardio) {
    warnings.push(
      "Cardio is included here, not developed — 2 easy sessions on top of your lifting days, not a conditioning program in its own right. If cardio is actually a priority for you, Conditioning or Hybrid will build it properly."
    );
  } else if (input.includeCardio && !CARDIO_ELIGIBLE_GOALS.has(goal)) {
    warnings.push(`Cardio wasn't added — this goal stays lifting-only by design, since extra cardio here would compete with recovery for the main lifts.`);
  }
  if (goal === "lose_fat") {
    warnings.push(
      "Expect load and reps to plateau rather than climb most weeks — that's the deficit, not a training failure. Success here looks like maintaining your numbers, not beating them every week."
    );
  }
  if (beginnerRequestedTesting) {
    warnings.push(
      "Testing a working max isn't something this generator does for beginners — it's using autoregulated RIR targets instead, the safer way to find a starting weight without a coach present to catch a bad rep."
    );
  }
  if (includesTestingWeek) {
    warnings.push(
      `This program includes an extra testing week at the start to establish your working maxes — your requested ${input.programLengthWeeks}-week program now spans ${input.programLengthWeeks + 1} weeks total.`
    );
  }
  if (loadCalculationMethod === "percent_1rm" || includesTestingWeek) {
    warnings.push(
      "Weights shown as a percentage need a saved max to calculate an actual number — add or update your squat/bench/deadlift/overhead press maxes on your profile so these resolve to real working weights."
    );
  }
  if (input.athlete.recentLayoff) {
    warnings.push("Because of the recent time off, the first couple of weeks are a lighter ramp-in rather than jumping back to your old working weights.");
  }

  return { template, warnings, recommendConsultation: consultationFrom(input) };
}

function consultationFrom(input: ProgramGenerationInput): { reason: string } | null {
  const reason = recommendConsultationReason(input.injuries);
  return reason ? { reason } : null;
}

function templateName(goal: ResistanceGoal, splitType: string): string {
  const goalLabel: Record<ResistanceGoal, string> = {
    build_muscle_hypertrophy: "Hypertrophy",
    build_muscle_bodybuilding: "Bodybuilding",
    get_stronger: "Strength",
    general_fitness: "General Fitness",
    lose_fat: "Fat Loss",
  };
  const splitLabel: Record<string, string> = {
    full_body: "Full Body",
    upper_lower: "Upper/Lower",
    upper_lower_plus_one: "Upper/Lower+",
    push_pull_legs_x2: "Push/Pull/Legs",
  };
  return `${goalLabel[goal]} — ${splitLabel[splitType] ?? splitType}`;
}
