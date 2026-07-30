import { needsHumanReason, recommendConsultationReason } from "@/lib/programs/generate/injuries";
import { applyLoadCalculationMethod, withTestingWeek } from "@/lib/programs/generate/load-calculation";
import type {
  DayPlan,
  ExerciseSlot,
  LoadCalculationMethod,
  ProgramGenerationInput,
  ProgramPhase,
  ProgramTemplate,
  TemplateResult,
  TrainingGoal,
  WeekContext,
  WeekSetPlan,
  WeekStructure,
} from "@/lib/programs/generate/types";
import type { ExperienceLevel } from "@/lib/supabase/types";

/**
 * §6's power/athletic development template — "the goal most often mangled
 * by general-purpose generators, because power training is prescribed by
 * output quality, not fatigue." Genuinely separate prescription logic from
 * resistance-templates.ts: 1-5 reps/set never more, long rest, never to
 * failure, and the coach's key coding difference — "autoregulate on output
 * drop-off, not RPE." That autoregulation rule (stop the exercise once a
 * jump/throw/sprint clearly falls short of the session's best) needs
 * measured output tracked session to session, which is a runtime concern
 * (task #25) this static skeleton can't compute from a week index alone;
 * what this file fixes is the *target* — volume in the right units (foot
 * contacts, total throws, metres of sprinting, never generic "sets") and
 * the stopping rule stated in every relevant slot's notes.
 *
 * THE STRENGTH-VS-POWER THRESHOLD ISN'T COLLECTED YET
 * ---------------------------------------------------------
 * §6 point 8 gates emphasis on an actual number: "below ~1.5x bodyweight
 * squat, prioritize strength; above ~2x, prioritize rate of force
 * development." ProgramGenerationInput doesn't collect a current squat max
 * (not asked anywhere in this questionnaire), so this file uses
 * experienceLevel as a documented stand-in — beginner/intermediate get more
 * maximal-strength volume and a longer, more conservative sprint
 * progression; advanced gets more jump/throw/sprint volume and a shorter
 * one. This is a real, named gap, not the actual rule, and is surfaced to
 * the athlete as a warning rather than pretended away.
 *
 * WHAT'S EXCLUDED OUTRIGHT, MATCHING §6'S OWN "DO NOT AUTO-PRESCRIBE" LIST
 * -----------------------------------------------------------------------------
 * The full snatch and clean & jerk are already excluded from the pattern-
 * ladder system entirely by the seed migration (task #26) — empty
 * slot_patterns regardless of coaching claims. Depth jumps are excluded the
 * same way. Hang power clean / power snatch (§6's "allowed but not
 * default" middle ground) are *also* tagged with an empty slot_patterns
 * array in the seed data, per that migration's own reasoning — §6 says to
 * "default template to trap-bar jumps and DB snatches instead," and this
 * library has neither a trap-bar jump nor a DB snatch exercise yet, so this
 * template defaults to jump-squat (loaded, tagged `jump`) and push-press
 * (tagged `vertical_push`, explicitly on §6's safe-to-auto-prescribe list)
 * instead, rather than trying to special-case a gated Olympic-lift
 * selection this generator's ladder mechanism doesn't support for these
 * three lifts. Heavy contrast/complex training (a heavy lift followed
 * minutes later by a jump/throw, "advanced only") isn't built at all — it's
 * a two-exercise block linked in time, a shape ExerciseSlot doesn't model,
 * and §6 itself calls it advanced-only and higher-risk.
 *
 * SPRINTING IS PRESCRIBED DIRECTLY, LIKE RUNNING/CARDIO SLOTS
 * ------------------------------------------------------------------
 * No exercise in the library is tagged (or taggable, today) with the
 * `sprint` SlotPattern — the closest real row is "Hill Sprints," a running-
 * category exercise the seed migration deliberately left untagged (see its
 * own header comment: running/cardio rows aren't consumed through the
 * pattern ladder by anything built so far). So the sprint slot here works
 * the same way running-templates.ts's slots do: movementPattern null, a
 * label and prescription carried directly rather than resolved against the
 * Exercise Library, with its notes recommending hill sprints by name — §6's
 * own pick for "the safest sprinting modality."
 *
 * THE MANDATORY HAMSTRING-PREPARATION GATE
 * ---------------------------------------------
 * §6 calls this "one of the strongest injury-prevention evidence bases in
 * the field... hard-coded prerequisite, not an accessory suggestion." The
 * sprint slot's own forWeek enforces it structurally: the first 3
 * (advanced) or 4 (beginner/intermediate) weeks carry no sprinting at all —
 * just the hamstring-prep accessory slots this template always includes —
 * then three weeks ramp submaximal effort (70% -> 85% -> 95%) before full
 * intent is ever prescribed. There's no Nordic curl or slider curl exercise
 * in the library yet (a gap the seed migration's own header names), so the
 * prep accessories use leg-curl-machine (the library's one knee_flexion
 * entry) and a hinge slot for RDL-style hip-extension work instead.
 *
 * NOT MODELED, STATED ONCE
 * ----------------------------
 * §6's "48h between high-CNS-demand sessions" and "never program sprints/
 * plyos onto sore legs — swap in technical/aerobic work if the readiness
 * check flags significant lower-body soreness" both need runtime session
 * data (calendar spacing, a logged readiness check) this static skeleton
 * doesn't have; both belong with task #25, not here. Days are clamped to
 * 2-4 — this volume of high-CNS work doesn't scale usefully higher without
 * the spacing rule actually being enforced.
 *
 * LOAD CALCULATION METHOD
 * -----------------------------
 * The strength-base slots (squat_bilateral/hinge_bilateral/horizontal_push,
 * all isPrimary) support the same LoadCalculationMethod choices resistance-
 * templates.ts does, via load-calculation.ts's shared dispatcher. The sprint
 * slot (category "running") is structurally exempt — see that dispatcher's
 * category guard. Jump/throw/weightlifting-derivative slots stay
 * RIR-untouched by the two %1RM methods (their patterns aren't in
 * TRACKABLE_PATTERN_LIFT — there's no personal-records type for a jump),
 * but coach_entered/athlete_choice still apply to them like any other
 * strength-category slot.
 */

export function isPowerAthleticGoal(goal: TrainingGoal): goal is "power_athletic" {
  return goal === "power_athletic";
}

const SPRINT_HAMSTRING_PREP_WEEKS: Record<ExperienceLevel, number> = { beginner: 4, intermediate: 4, advanced: 3 };

// §6: "1-5 reps/set, never more... never to failure, never with fatigue as
// a goal... rest long relative to work." Jump/throw/weightlifting-derivative
// slots below share that shape; the actual stopping rule is stated in each
// one's notes, since it depends on measured output the runtime layer tracks
// (task #25), not a rep count this static skeleton can enforce.

function jumpPrescription(): { forWeek: (ctx: WeekContext) => WeekSetPlan } {
  return {
    forWeek: (): WeekSetPlan => ({
      prescriptionType: "rep_range",
      sets: 4,
      reps: "3-5",
      restSeconds: 150,
      notes: "Every rep should look like your best rep. Stop this exercise once a jump clearly falls short of today's best — that's the real stopping rule, not the rep count.",
    }),
  };
}

function throwPrescription(): { forWeek: (ctx: WeekContext) => WeekSetPlan } {
  return {
    forWeek: (): WeekSetPlan => ({
      prescriptionType: "rep_range",
      sets: 3,
      reps: "3-5",
      restSeconds: 150,
      notes: "Full recovery between throws — this is about throwing far, not conditioning. Stop once throw distance drops off from today's best.",
    }),
  };
}

function weightliftingDerivativePrescription(): { forWeek: (ctx: WeekContext) => WeekSetPlan } {
  return {
    forWeek: (): WeekSetPlan => ({
      prescriptionType: "rep_range",
      sets: 4,
      reps: "3",
      restSeconds: 150,
      notes: "Light load, moved as fast as possible — speed is the point, not the weight on the bar. Stop the set the moment it stops feeling snappy.",
    }),
  };
}

/** §6 point 8: "still necessary... can't express power without force to
 * produce it." A plain, moderate-effort main-lift slot — not power work,
 * just the strength base it depends on. */
function maximalStrengthPrescription(level: ExperienceLevel): { forWeek: (ctx: WeekContext) => WeekSetPlan } {
  const sets = level === "advanced" ? 3 : 4; // more strength volume for the lower end of the (unmeasured) strength threshold — see header comment
  return {
    forWeek: (): WeekSetPlan => ({
      prescriptionType: "rir",
      sets,
      minReps: 3,
      maxReps: 5,
      rir: 3,
      restSeconds: 210,
      notes: "Real effort, but always leave a couple of reps in the tank — this is the strength base under the power work, not a max-effort day.",
    }),
  };
}

function sprintPrescription(level: ExperienceLevel): { forWeek: (ctx: WeekContext) => WeekSetPlan } {
  const prepWeeks = SPRINT_HAMSTRING_PREP_WEEKS[level];
  return {
    forWeek(ctx: WeekContext): WeekSetPlan {
      const week = ctx.weekIndex;
      if (week <= prepWeeks) {
        return {
          // "coach_notes_only" is strength-only (prescription-types.ts) —
          // this slot's category is "running" (sprintDaySlot below), whose
          // notes-only equivalent is "coach_notes". Using the wrong one trips
          // the set_prescriptions_valid_type DB trigger (migration 0012) and
          // blocks program creation outright during the prep phase.
          prescriptionType: "coach_notes",
          sets: 1,
          notes: `Hamstring-prep phase (week ${week} of ${prepWeeks}) — no sprinting yet. This is the mandatory prerequisite, not an optional accessory: it's what protects the hamstrings once sprinting starts. Use the hip-hinge and knee-flexion work below.`,
        };
      }
      const rampWeek = week - prepWeeks;
      if (rampWeek <= 3) {
        const effort = [70, 85, 95][rampWeek - 1]!;
        return {
          prescriptionType: "distance",
          sets: 6,
          distanceMeters: 30,
          restSeconds: 180,
          notes: `Submaximal sprint ramp, week ${rampWeek} of 3 — cap effort at about ${effort}%. Hill sprints are the safest option here (the incline caps velocity and reduces hamstring strain risk). Full recovery between reps.`,
        };
      }
      return {
        prescriptionType: "distance",
        sets: 6,
        distanceMeters: 40,
        restSeconds: 210,
        notes: "Full-effort sprinting, capped at 150-300m of real high-speed running for the session. Hill sprints remain the safer default. Stop if two reps in a row feel slower than your best.",
      };
    },
  };
}

function hamstringPrepAccessorySlots(): ExerciseSlot[] {
  return [
    {
      role: "main",
      category: "strength",
      movementPattern: "knee_flexion",
      primaryMuscleGroup: "hamstrings",
      isPrimary: false,
      autoregulationEligible: false,
      prescription: { forWeek: () => ({ prescriptionType: "rir", sets: 3, minReps: 6, maxReps: 10, rir: 3, restSeconds: 90, notes: "Direct knee-flexion work — the single most evidence-backed piece of sprint-injury prevention there is." }) },
    },
    {
      role: "main",
      category: "strength",
      movementPattern: "hinge_bilateral",
      primaryMuscleGroup: "hamstrings",
      isPrimary: false,
      autoregulationEligible: false,
      prescription: { forWeek: () => ({ prescriptionType: "rir", sets: 3, minReps: 6, maxReps: 10, rir: 3, restSeconds: 90, notes: "Hip-extension strength — the other half of sprint-readiness prep." }) },
    },
  ];
}

function sprintDaySlot(level: ExperienceLevel): ExerciseSlot {
  return {
    role: "main",
    category: "running",
    movementPattern: null,
    primaryMuscleGroup: null,
    isPrimary: true,
    autoregulationEligible: false,
    prescription: sprintPrescription(level),
    // This slot shares its day ("Speed & Power A") with a jump slot,
    // hamstring-prep accessories and a squat — unlike running-templates.ts/
    // cardio-templates.ts's pattern-less slots, which always have a day to
    // themselves, so assemble.ts can't fall back to the day's own label
    // here without naming this specific exercise after the whole session.
    // See placeholderLabel's doc comment (types.ts).
    placeholderLabel: "Sprints",
  };
}

function jumpSlot(): ExerciseSlot {
  return { role: "main", category: "strength", movementPattern: "jump", primaryMuscleGroup: "quadriceps", isPrimary: true, autoregulationEligible: false, prescription: jumpPrescription() };
}

function throwSlot(): ExerciseSlot {
  return { role: "main", category: "strength", movementPattern: "throw", primaryMuscleGroup: "core", isPrimary: true, autoregulationEligible: false, prescription: throwPrescription() };
}

function pushPressSlot(): ExerciseSlot {
  return {
    role: "main",
    category: "strength",
    movementPattern: "vertical_push",
    primaryMuscleGroup: "shoulders",
    isPrimary: false,
    autoregulationEligible: false,
    prescription: weightliftingDerivativePrescription(),
  };
}

function jumpSquatSlot(): ExerciseSlot {
  return { role: "main", category: "strength", movementPattern: "jump", primaryMuscleGroup: "quadriceps", isPrimary: false, autoregulationEligible: false, prescription: weightliftingDerivativePrescription() };
}

function strengthSlot(pattern: "squat_bilateral" | "hinge_bilateral" | "horizontal_push", muscleGroup: ExerciseSlot["primaryMuscleGroup"], level: ExperienceLevel): ExerciseSlot {
  return { role: "main", category: "strength", movementPattern: pattern, primaryMuscleGroup: muscleGroup, isPrimary: true, autoregulationEligible: true, prescription: maximalStrengthPrescription(level) };
}

function speedSprintDay(level: ExperienceLevel): DayPlan {
  return {
    label: "Speed & Power A",
    isRestDay: false,
    intensity: "hard",
    loadsLowerBody: true,
    slots: [sprintDaySlot(level), jumpSlot(), ...hamstringPrepAccessorySlots(), strengthSlot("squat_bilateral", "quadriceps", level)],
  };
}

function jumpThrowStrengthDay(level: ExperienceLevel): DayPlan {
  return {
    label: "Speed & Power B",
    isRestDay: false,
    intensity: "hard",
    loadsLowerBody: false,
    slots: [jumpSquatSlot(), throwSlot(), pushPressSlot(), strengthSlot("horizontal_push", "chest", level)],
  };
}

function strengthBaseDay(level: ExperienceLevel): DayPlan {
  return {
    label: "Strength Base",
    isRestDay: false,
    intensity: "hard",
    loadsLowerBody: true,
    slots: [strengthSlot("squat_bilateral", "quadriceps", level), strengthSlot("hinge_bilateral", "hamstrings", level), ...hamstringPrepAccessorySlots()],
  };
}

function buildDays(daysPerWeek: number, level: ExperienceLevel): { days: DayPlan[]; warnings: string[] } {
  const warnings: string[] = [];
  let effective = daysPerWeek;
  if (daysPerWeek < 2) {
    effective = 2;
    warnings.push("Power and speed work needs at least two dedicated sessions a week to be worth building a template around — this program uses 2.");
  } else if (daysPerWeek > 4) {
    effective = 4;
    warnings.push("This template caps at 4 days a week — high-CNS-demand work like sprinting and jumping needs real recovery between sessions, so more days would mean less quality per session, not more progress.");
  }

  if (effective === 2) return { days: [speedSprintDay(level), jumpThrowStrengthDay(level)], warnings };
  if (effective === 3) return { days: [speedSprintDay(level), jumpThrowStrengthDay(level), strengthBaseDay(level)], warnings };
  return { days: [speedSprintDay(level), jumpThrowStrengthDay(level), strengthBaseDay(level), jumpThrowStrengthDay(level)], warnings };
}

function phaseByWeekFor(programLengthWeeks: number): Map<number, ProgramPhase> {
  const phaseByWeek = new Map<number, ProgramPhase>();
  for (let week = 1; week <= programLengthWeeks; week++) phaseByWeek.set(week, "standard");
  return phaseByWeek;
}

/** Applies the chosen LoadCalculationMethod to every slot in every day —
 * see load-calculation.ts's own header comment for the shared dispatcher
 * this delegates to. The category guard baked into that dispatcher is what
 * keeps coach_entered/athlete_choice from touching the sprint slot (category
 * "running") the same way the hamstring-prep prescriptionType bug earlier
 * in this file's history got fixed: a strength-only prescriptionType on a
 * running-category slot trips the DB's set_prescriptions_valid_type
 * trigger. */
function applyLoadMethodToDays(days: DayPlan[], method: LoadCalculationMethod): DayPlan[] {
  return days.map((day) => ({
    ...day,
    slots: day.slots.map((slot) => ({
      ...slot,
      prescription: applyLoadCalculationMethod(slot.prescription, method, slot.isPrimary, slot.movementPattern, slot.category),
    })),
  }));
}

export function buildPowerAthleticTemplate(input: ProgramGenerationInput): TemplateResult {
  const routeOut = needsHumanReason({ redFlags: input.redFlags, globalRefusals: input.globalRefusals, injuries: input.injuries });
  if (routeOut) return { needsHumanReason: routeOut };

  if (!isPowerAthleticGoal(input.goal)) {
    return { error: `buildPowerAthleticTemplate does not handle goal "${input.goal}"` };
  }

  // See LoadCalculationMethod's doc comment (types.ts) — a beginner
  // requesting test_then_percent_1rm is downgraded rather than honoured,
  // same defensive backstop resistance-templates.ts uses.
  const beginnerRequestedTesting = input.loadCalculationMethod === "test_then_percent_1rm" && input.experienceLevel === "beginner";
  const loadCalculationMethod: LoadCalculationMethod = beginnerRequestedTesting ? "autoregulated_rir" : input.loadCalculationMethod;
  const includesTestingWeek = loadCalculationMethod === "test_then_percent_1rm";

  const { days: rawDays, warnings: dayWarnings } = buildDays(input.daysPerWeek, input.experienceLevel);
  const days = applyLoadMethodToDays(rawDays, loadCalculationMethod);
  const basePhaseByWeek = phaseByWeekFor(input.programLengthWeeks);
  const { phaseByWeek, deloadWeeks } = includesTestingWeek ? withTestingWeek(basePhaseByWeek, new Map()) : { phaseByWeek: basePhaseByWeek, deloadWeeks: new Map() };

  const template: ProgramTemplate = {
    name: "Power & Athletic Development",
    discipline: "resistance",
    weekStructure: { days } satisfies WeekStructure,
    deloadWeeks,
    phaseByWeek,
  };

  const warnings = [
    ...dayWarnings,
    "This program uses your experience level as a stand-in for section 6's actual question (roughly, how big your squat is relative to your bodyweight) — this questionnaire doesn't collect a current squat max yet, so the strength-versus-power emphasis is an approximation.",
    `Sprinting doesn't start until week ${SPRINT_HAMSTRING_PREP_WEEKS[input.experienceLevel] + 1} — the weeks before that are mandatory hamstring preparation, not a delay.`,
    "The full snatch, clean & jerk, depth jumps, and heavy contrast training are never included here regardless of your answers — those need a coach physically present.",
  ];
  if (beginnerRequestedTesting) {
    warnings.push(
      "Testing a working max isn't something this generator does for beginners — it's using autoregulated RIR targets instead, the safer way to find a starting weight without a coach present to catch a bad rep."
    );
  }
  if (includesTestingWeek) {
    warnings.push(
      `This program includes an extra testing week at the start to establish your working maxes on the squat/bench/deadlift slots — your requested ${input.programLengthWeeks}-week program now spans ${input.programLengthWeeks + 1} weeks total. Sprinting is delayed by that same week, on top of the usual hamstring-prep gate.`
    );
    if (days.some((d) => d.label === "Strength Base")) {
      warnings.push(
        "Your Strength Base day tests both the squat and the deadlift in the same session during the testing week — pace yourself, and prioritise whichever lift matters more to you if you're gassed by the second one."
      );
    }
  }
  if (loadCalculationMethod === "percent_1rm" || includesTestingWeek) {
    warnings.push(
      "Weights shown as a percentage need a saved max to calculate an actual number — add or update your squat/bench/deadlift maxes on your profile so these resolve to real working weights."
    );
  }

  return { template, warnings, recommendConsultation: consultationFrom(input) };
}

function consultationFrom(input: ProgramGenerationInput): { reason: string } | null {
  const reason = recommendConsultationReason(input.injuries);
  return reason ? { reason } : null;
}
