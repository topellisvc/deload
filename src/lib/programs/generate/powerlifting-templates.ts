import { needsHumanReason, recommendConsultationReason } from "@/lib/programs/generate/injuries";
import type { SlotRequest } from "@/lib/programs/generate/splits";
import type {
  DayPlan,
  ExerciseSlot,
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
 * §5's powerlifting/strength-sport peak — a terminal meet date with
 * everything timed backwards from it, genuinely different in shape from
 * resistance-templates.ts's indefinite waves (see that file's header
 * comment for why the two aren't folded together): volume only ever falls
 * from GPP onward, intensity climbs past anything general strength uses,
 * and the whole macrocycle length is *derived* from the meet date rather
 * than asked for directly — programLengthWeeks is ignored for this goal on
 * purpose.
 *
 * PHASE ALLOCATION, IN ONE PARAGRAPH
 * -------------------------------------
 * §5's own table is a fixed 16-week shape: gpp(4) -> strength(4) ->
 * intensification(4) -> peaking(2) -> taper(1) -> meet_week(1). Weeks out
 * from the meet drive which of three regimes applies. 12-16 weeks out: the
 * full six phases, with only gpp compressed to absorb anything short of 16
 * (gpp = weeksOut - 12, so exactly 0 at 12 weeks out — "competition lifts
 * become primary" essentially from day one). 4-11 weeks out: a compressed
 * peak — meet_week and taper are protected first (1 week each, always),
 * then peaking, then intensification, then strength each get what's left
 * up to their reference length, and gpp is dropped entirely. This isn't a
 * separate rule for "under 8 weeks" versus "8-11 weeks" — it's the same
 * formula, and it happens to reduce to almost exactly the reference table's
 * own late-phase timing at the boundary (4 weeks out lands on meet+taper+
 * peaking, which is where the *original* 16-week table already puts weeks
 * 4-3 anyway). Under 4 weeks out: taper-only, per §5's explicit instruction
 * that there's no time left to build anything — the plan is to arrive
 * fresh. Over 16 weeks out: only the final 16-week peaking block is
 * generated, with a warning that the weeks before it need a different
 * program (general strength, not this one).
 *
 * WHAT'S AUTOMATABLE VERSUS WHAT §5 SAYS TO REFUSE
 * -----------------------------------------------------
 * Main-lift prescriptions here are RPE/RIR-driven (via e1rm.ts's approach),
 * never a flat percentage of a stale 1RM — §5 names this explicitly as
 * "arguably better than % of a stale 1RM" and the one thing worth
 * automating in this area. What's explicitly NOT automated, surfaced as
 * warnings instead of features: third-attempt selection (depends on
 * watching the second attempt happen), weight-cut guidance (refused
 * outright — medical-adjacent liability, per §5's own words), and meet-day
 * logistics. The opener is *structured* (a taper-week single at RPE 7-8,
 * described as ~91-93% of a realistic goal max) but never given a numeric
 * kg — that number depends on the athlete's actual e1RM trend, which is a
 * runtime concern (task #25), not something this static skeleton can
 * compute from a week index alone.
 *
 * NOT BUILT HERE, ON PURPOSE
 * ------------------------------
 * §5's "gate the peaking phase on logging compliance — no RPE logged on
 * main lifts for 2 weeks means intensification loads are guesses" needs
 * session history this generator's static types deliberately don't carry
 * (see types.ts's header comment); it belongs with the runtime
 * autoregulation layer, not this file. Days per week are clamped to 3-4 —
 * a real peaking block built around only three competition lifts doesn't
 * gain much from higher frequency without a more elaborate per-lift wave
 * this v1 doesn't model, so 5+ day requests are served with a 4-day split
 * rather than inventing a 5th or 6th day's worth of content.
 */

export function isPowerliftingGoal(goal: TrainingGoal): goal is "powerlifting_peak" {
  return goal === "powerlifting_peak";
}

type PeakPhase = "gpp" | "strength" | "intensification" | "peaking" | "taper" | "meet_week";
const PHASE_ORDER: PeakPhase[] = ["gpp", "strength", "intensification", "peaking", "taper", "meet_week"];

interface PhasePlan {
  weeks: Partial<Record<PeakPhase, number>>;
  totalWeeks: number;
  regime: "taper_only" | "compressed" | "full" | "capped_at_16";
}

/** §5's own weeks-out -> phase table, collapsed to one deterministic
 * allocation formula — see this file's header comment for the reasoning. */
function allocatePhases(weeksOut: number): PhasePlan {
  if (weeksOut <= 3) {
    const taper = weeksOut >= 2 ? weeksOut - 1 : 0;
    const weeks: Partial<Record<PeakPhase, number>> = { meet_week: 1 };
    if (taper > 0) weeks.taper = taper;
    return { weeks, totalWeeks: weeksOut, regime: "taper_only" };
  }

  if (weeksOut >= 12) {
    const capped = Math.min(weeksOut, 16);
    const gpp = capped - 12;
    const weeks: Partial<Record<PeakPhase, number>> = { strength: 4, intensification: 4, peaking: 2, taper: 1, meet_week: 1 };
    if (gpp > 0) weeks.gpp = gpp;
    return { weeks, totalWeeks: capped, regime: weeksOut > 16 ? "capped_at_16" : "full" };
  }

  // 4-11 weeks out: compressed. Protect meet_week and taper first, then
  // peaking, then intensification, then strength, up to each phase's
  // reference length; gpp gets nothing.
  let remaining = weeksOut - 2;
  const peaking = Math.min(2, remaining);
  remaining -= peaking;
  const intensification = Math.min(4, remaining);
  remaining -= intensification;
  const strength = Math.min(4, remaining);
  remaining -= strength;

  const weeks: Partial<Record<PeakPhase, number>> = { meet_week: 1, taper: 1 };
  if (peaking > 0) weeks.peaking = peaking;
  if (intensification > 0) weeks.intensification = intensification;
  if (strength > 0) weeks.strength = strength;
  return { weeks, totalWeeks: weeksOut, regime: "compressed" };
}

/** Expands a PhasePlan into a 1-based week -> phase map, phases in
 * PHASE_ORDER, earliest phase first, ending on meet_week at the final
 * week. */
function phaseByWeekFrom(plan: PhasePlan): Map<number, ProgramPhase> {
  const phaseByWeek = new Map<number, ProgramPhase>();
  let week = 1;
  for (const phase of PHASE_ORDER) {
    const count = plan.weeks[phase] ?? 0;
    for (let i = 0; i < count; i++) {
      phaseByWeek.set(week, phase);
      week += 1;
    }
  }
  return phaseByWeek;
}

function weeksUntil(meetDateISO: string, now: Date): number {
  const meetDate = new Date(meetDateISO);
  const daysUntil = (meetDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
  return Math.ceil(daysUntil / 7);
}

interface MainSpec {
  sets: number;
  minReps: number;
  maxReps: number;
  rir: number;
  restSeconds: number;
  notes: string;
}

// §5's table, translated from RPE to RIR (RPE = 10 - RIR) and to the top of
// each range's reps (the more conservative end when a range is given, same
// convention as resistance-templates.ts).
const MAIN_LIFT_SPEC: Record<PeakPhase, MainSpec> = {
  gpp: { sets: 5, minReps: 5, maxReps: 8, rir: 3, restSeconds: 150, notes: "GPP block — variations of the lift are fine here; save the exact competition version for later phases." },
  strength: { sets: 4, minReps: 3, maxReps: 5, rir: 2, restSeconds: 210, notes: "Competition form from here on — the same depth/pause/lockout commands you'll hear at the meet." },
  intensification: { sets: 3, minReps: 1, maxReps: 3, rir: 1, restSeconds: 240, notes: "Variations are gone — just the competition lift, every session, with commands practiced every rep." },
  peaking: { sets: 2, minReps: 1, maxReps: 2, rir: 1, restSeconds: 240, notes: "The heaviest phase of the whole prep. Bar speed matters more here than grinding out a rep." },
  taper: {
    sets: 1,
    minReps: 1,
    maxReps: 1,
    rir: 3,
    restSeconds: 240,
    notes: "Opener rehearsal — roughly 91-93% of your realistic goal max, at RPE 7-8. If it isn't easy, it's not a real opener. This is close to your last genuinely heavy session before the meet.",
  },
  meet_week: { sets: 2, minReps: 1, maxReps: 1, rir: 4, restSeconds: 180, notes: "A few crisp, fast singles at 60-75% — this is about staying sharp, not adding fitness. Last session at least 3 days before the meet." },
};

const ACCESSORY_SPEC: Record<PeakPhase, { sets: number; minReps: number; maxReps: number; rir: number; restSeconds: number; notesOnly?: string }> = {
  gpp: { sets: 3, minReps: 8, maxReps: 12, rir: 3, restSeconds: 90 },
  strength: { sets: 3, minReps: 8, maxReps: 10, rir: 2, restSeconds: 90 },
  intensification: { sets: 2, minReps: 8, maxReps: 10, rir: 3, restSeconds: 75 },
  peaking: { sets: 1, minReps: 8, maxReps: 10, rir: 4, restSeconds: 60 },
  taper: { sets: 1, minReps: 8, maxReps: 10, rir: 4, restSeconds: 60, notesOnly: "Skip this or keep it very light — today is about the main lift, not accessories." },
  meet_week: { sets: 1, minReps: 8, maxReps: 10, rir: 4, restSeconds: 60, notesOnly: "Skip accessories this week — the only priority is arriving fresh." },
};

function phaseFor(ctx: WeekContext): PeakPhase {
  return (ctx.phase in MAIN_LIFT_SPEC ? ctx.phase : "gpp") as PeakPhase;
}

function mainLiftPrescription(): SlotPrescription {
  return {
    forWeek(ctx: WeekContext): WeekSetPlan {
      const spec = MAIN_LIFT_SPEC[phaseFor(ctx)];
      return { prescriptionType: "rir", sets: spec.sets, minReps: spec.minReps, maxReps: spec.maxReps, rir: spec.rir, restSeconds: spec.restSeconds, notes: spec.notes };
    },
  };
}

function accessoryPrescription(): SlotPrescription {
  return {
    forWeek(ctx: WeekContext): WeekSetPlan {
      const spec = ACCESSORY_SPEC[phaseFor(ctx)];
      if (spec.notesOnly) {
        return { prescriptionType: "coach_notes_only", sets: spec.sets, notes: spec.notesOnly };
      }
      return { prescriptionType: "rir", sets: spec.sets, minReps: spec.minReps, maxReps: spec.maxReps, rir: spec.rir, restSeconds: spec.restSeconds, notes: null };
    },
  };
}

function main(pattern: SlotPattern, primaryMuscleGroup: SlotRequest["primaryMuscleGroup"]): ExerciseSlot {
  return { role: "main", category: "strength", movementPattern: pattern, primaryMuscleGroup, isPrimary: true, autoregulationEligible: true, prescription: mainLiftPrescription() };
}

function accessory(pattern: SlotPattern | null, primaryMuscleGroup: SlotRequest["primaryMuscleGroup"]): ExerciseSlot {
  return { role: "main", category: "strength", movementPattern: pattern, primaryMuscleGroup, isPrimary: false, autoregulationEligible: false, prescription: accessoryPrescription() };
}

function squatDay(): DayPlan {
  return {
    label: "Squat",
    isRestDay: false,
    intensity: "hard",
    loadsLowerBody: true,
    slots: [main("squat_bilateral", "quadriceps"), accessory("hinge_unilateral", "hamstrings"), accessory("anti_extension", "core")],
  };
}

function benchDay(label = "Bench"): DayPlan {
  return {
    label,
    isRestDay: false,
    intensity: "hard",
    loadsLowerBody: false,
    slots: [main("horizontal_push", "chest"), accessory("horizontal_pull", "back"), accessory(null, "triceps")],
  };
}

function deadliftDay(): DayPlan {
  return {
    label: "Deadlift",
    isRestDay: false,
    intensity: "hard",
    loadsLowerBody: true,
    slots: [main("hinge_bilateral", "hamstrings"), accessory("squat_unilateral", "quadriceps"), accessory("horizontal_pull", "back")],
  };
}

/** Clamped to 3-4 days — see this file's header comment. A 4th day adds a
 * second, lighter bench exposure (bench tolerates frequency better than
 * squat/deadlift do), which is a common real-world choice, not a novel one. */
function buildDays(daysPerWeek: number): { days: DayPlan[]; warnings: string[] } {
  const warnings: string[] = [];
  let effective = daysPerWeek;
  if (daysPerWeek < 3) {
    effective = 3;
    warnings.push("A meaningful peak needs each competition lift trained weekly with real intent — this program uses 3 days a week rather than fewer.");
  } else if (daysPerWeek > 4) {
    effective = 4;
    warnings.push("This peaking template caps at 4 days a week — with only three competition lifts to build around, more days would mean padding rather than adding anything that moves the total.");
  }

  const days = effective === 4 ? [squatDay(), benchDay(), deadliftDay(), benchDay("Bench — Volume")] : [squatDay(), benchDay(), deadliftDay()];
  return { days, warnings };
}

function regimeWarnings(plan: PhasePlan, isFirstMeet: boolean, requestedWeeksOut: number): string[] {
  const warnings: string[] = [];
  if (plan.regime === "taper_only") {
    warnings.push("There isn't time to build anything new before this meet — the plan from here is to arrive fresh, not to get stronger.");
  } else if (plan.regime === "compressed" && requestedWeeksOut < 8) {
    warnings.push(
      "Your meet is under 8 weeks away, so this compresses straight into a shortened peak with no dedicated GPP block. Expect less room to build before the taper starts" +
        (isFirstMeet ? " — for a first meet especially, keep the early sessions conservative rather than trying to force a big number this late." : ".")
    );
  } else if (plan.regime === "compressed") {
    warnings.push("Your meet is closer than the standard 12-16 week structure calls for, so the early strength-building phase is compressed to fit.");
  } else if (plan.regime === "capped_at_16") {
    warnings.push(`Your meet is ${requestedWeeksOut} weeks away — this generates only the final 16-week peaking block. Use a general strength program for the weeks before that starts.`);
  }

  warnings.push(
    isFirstMeet
      ? "First meet: going 9 for 9 (making every attempt) is worth more than chasing a slightly bigger total — take conservative jumps, especially on the third attempt."
      : "Third-attempt sizing is a calculated risk that depends on how your second attempt actually moved — this program can't make that call for you."
  );
  warnings.push("This program doesn't give weight-cut guidance — that's a decision for you and a coach, not something to automate.");
  warnings.push("From about 4 weeks out, a coach watching your bar speed live is worth more than any program. Get eyes on your lifts for the last month if you can.");
  return warnings;
}

export function buildPowerliftingTemplate(input: ProgramGenerationInput, now: Date = new Date()): TemplateResult {
  const routeOut = needsHumanReason({ redFlags: input.redFlags, globalRefusals: input.globalRefusals, injuries: input.injuries });
  if (routeOut) return { needsHumanReason: routeOut };

  if (!isPowerliftingGoal(input.goal)) {
    return { error: `buildPowerliftingTemplate does not handle goal "${input.goal}"` };
  }
  if (!input.powerlifting) {
    return { error: "Powerlifting peaking requires meet details (meet date and whether this is a first meet)." };
  }

  const weeksOut = weeksUntil(input.powerlifting.meetDateISO, now);
  if (weeksOut < 1) {
    return { error: "The meet date needs to be in the future." };
  }

  const plan = allocatePhases(weeksOut);
  const phaseByWeek = phaseByWeekFrom(plan);
  const { days, warnings: dayWarnings } = buildDays(input.daysPerWeek);

  const template: ProgramTemplate = {
    name: `Powerlifting Peak — ${plan.totalWeeks} weeks out`,
    discipline: "resistance",
    weekStructure: { days } satisfies WeekStructure,
    deloadWeeks: new Map(),
    phaseByWeek,
  };

  const warnings = [...dayWarnings, ...regimeWarnings(plan, input.powerlifting.isFirstMeet, weeksOut)];

  return { template, warnings, recommendConsultation: consultationFrom(input) };
}

function consultationFrom(input: ProgramGenerationInput): { reason: string } | null {
  const reason = recommendConsultationReason(input.injuries);
  return reason ? { reason } : null;
}
