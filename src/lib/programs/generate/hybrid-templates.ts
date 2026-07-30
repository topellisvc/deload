import { needsHumanReason, recommendConsultationReason } from "@/lib/programs/generate/injuries";
import { buildResistanceTemplate, isResistanceGoal } from "@/lib/programs/generate/resistance-templates";
import { buildRunningTemplate, isRunGoal } from "@/lib/programs/generate/running-templates";
import type {
  DayPlan,
  ExerciseSlot,
  ProgramGenerationInput,
  ProgramTemplate,
  RunningHistory,
  TemplateResult,
  TrainingGoal,
  WeekSetPlan,
} from "@/lib/programs/generate/types";

/**
 * §13's hybrid template — resistance combined with running. The priority
 * side (HybridProfile.priority) gets its full normal template, built by
 * delegating straight to buildResistanceTemplate/buildRunningTemplate; the
 * other side is maintained, not developed, at the specific reduced doses §13
 * gives by name: "2 sessions/week, 2-3x4-6 @ RPE 7-8, full-body, ~35 min" for
 * maintenance lifting, "2-3 runs/week including one longer easy run, Zone 2
 * biased" for maintenance running.
 *
 * V1 SCOPE: RESISTANCE <-> RUNNING ONLY
 * ----------------------------------------
 * §13's own maintenance-dose answers only cover a lifting/running pairing.
 * Cardio-as-secondary isn't given an explicit maintenance protocol in the
 * source document, so this file returns an error for any hybrid combination
 * involving improve_conditioning, sport_specific, powerlifting_peak, or
 * power_athletic on either side, rather than guessing at a dose the coach
 * never specified.
 *
 * SEQUENCING, APPROXIMATED
 * --------------------------
 * §13's hardest rule to get right in a static weekly skeleton is "never place
 * heavy lower-body lifting in the 24 h before a long run." This file
 * approximates day-of-week ordering by always putting the long run last in
 * the day list and, if the day immediately before it would otherwise load
 * the lower body, swapping it with an earlier day that doesn't — a real
 * guarantee for the common cases, not a full calendar-aware scheduler. The
 * "count hard sessions across modalities, cap at 3/week" rule is enforced as
 * a warning rather than by reshaping the split, since forcibly cutting a
 * session to fit under the cap is a bigger decision than this template
 * should make silently.
 */

export function isHybridGoal(goal: TrainingGoal): goal is "hybrid" {
  return goal === "hybrid";
}

type MaintainableGoal = Exclude<TrainingGoal, "hybrid">;

function isMaintainable(goal: TrainingGoal): goal is MaintainableGoal {
  return isResistanceGoal(goal) || isRunGoal(goal);
}

/** §13's named maintenance-lifting dose: full-body, 2 sessions/week, 2-3
 * sets of 4-6 @ RPE 7-8 (RIR 2-3), ~35 minutes. Deliberately not built from
 * resistance-templates.ts's split/progression machinery — that machinery is
 * for developing a lift, and this is explicitly the "small enough not to
 * cost quality on the priority side" dose the coach names directly, with no
 * periodization of its own. */
function maintenanceResistanceDays(): DayPlan[] {
  const flatSet: WeekSetPlan = { prescriptionType: "rir", sets: 3, minReps: 4, maxReps: 6, rir: 2, restSeconds: 120, notes: "Maintenance dose — enough to hold strength, not enough to cost the priority goal." };
  const slotFor = (movementPattern: ExerciseSlot["movementPattern"], primaryMuscleGroup: ExerciseSlot["primaryMuscleGroup"], isPrimary: boolean): ExerciseSlot => ({
    role: "main",
    category: "strength",
    movementPattern,
    primaryMuscleGroup,
    isPrimary,
    autoregulationEligible: false,
    prescription: { forWeek: () => flatSet },
  });

  const dayA: DayPlan = {
    label: "Maintenance Full Body A",
    isRestDay: false,
    intensity: "moderate",
    loadsLowerBody: true,
    slots: [slotFor("squat_bilateral", "quadriceps", true), slotFor("horizontal_push", "chest", false), slotFor("horizontal_pull", "back", false)],
  };
  const dayB: DayPlan = {
    label: "Maintenance Full Body B",
    isRestDay: false,
    intensity: "moderate",
    loadsLowerBody: true,
    slots: [slotFor("hinge_bilateral", "hamstrings", true), slotFor("vertical_push", "shoulders", false), slotFor("vertical_pull", "back", false)],
  };
  return [dayA, dayB];
}

/** §13's named maintenance-running dose: 2-3 runs/week including one longer
 * easy run, Zone 2 biased, frequency kept but intensity dropped — held at a
 * reduced share of the athlete's current volume rather than built toward a
 * peak, since this side isn't being developed. */
function maintenanceRunningDays(running: RunningHistory | null): DayPlan[] {
  const weeklyKm = Math.max(12, (running?.currentWeeklyKm ?? 15) * 0.6);
  const longerKm = Math.round(weeklyKm * 0.4);
  const easyKm = Math.round((weeklyKm - longerKm) / 2);

  const easySlot = (km: number, label: string): DayPlan => ({
    label,
    isRestDay: false,
    intensity: "easy",
    loadsLowerBody: true,
    slots: [
      {
        role: "main",
        category: "running",
        movementPattern: null,
        primaryMuscleGroup: null,
        isPrimary: label === "Longer Easy Run",
        autoregulationEligible: false,
        prescription: {
          forWeek: () => ({ prescriptionType: "distance", sets: 1, distanceMeters: km * 1000, heartRateZone: 2, notes: "Maintenance dose — easy, conversational pace." }),
        },
      },
    ],
  });

  return [easySlot(easyKm, "Easy Run"), easySlot(easyKm, "Easy Run"), easySlot(longerKm, "Longer Easy Run")];
}

function maintenanceDaysFor(goal: MaintainableGoal, running: RunningHistory | null): DayPlan[] | null {
  if (isResistanceGoal(goal)) return maintenanceResistanceDays();
  if (isRunGoal(goal)) return maintenanceRunningDays(running);
  return null;
}

/**
 * §13 point 3: never place heavy lower-body lifting in the 24 h before a
 * long run. Approximated by putting the long run (if any) last, and, if the
 * day immediately before it loads the lower body, swapping it with the
 * earliest day that doesn't.
 */
function sequenceDays(days: readonly DayPlan[]): DayPlan[] {
  const longRunIndex = days.findIndex((d) => d.label === "Long Run" || d.label === "Longer Easy Run");
  if (longRunIndex === -1) return [...days];

  const ordered = [...days];
  const [longRun] = ordered.splice(longRunIndex, 1);
  ordered.push(longRun!);

  const dayBeforeIndex = ordered.length - 2;
  if (dayBeforeIndex >= 0 && ordered[dayBeforeIndex]!.loadsLowerBody) {
    const safeIndex = ordered.findIndex((d, i) => i < dayBeforeIndex && !d.loadsLowerBody);
    if (safeIndex !== -1) {
      const [safeDay] = ordered.splice(safeIndex, 1);
      ordered.splice(dayBeforeIndex, 0, safeDay!);
    }
  }

  return ordered;
}

export function buildHybridTemplate(input: ProgramGenerationInput): TemplateResult {
  const routeOut = needsHumanReason({ redFlags: input.redFlags, globalRefusals: input.globalRefusals, injuries: input.injuries });
  if (routeOut) return { needsHumanReason: routeOut };

  if (!isHybridGoal(input.goal)) {
    return { error: `buildHybridTemplate does not handle goal "${input.goal}"` };
  }
  if (!input.hybrid) {
    return { error: "Hybrid goal requires a HybridProfile (priority + primaryGoal + secondaryGoal)." };
  }

  const { priority, primaryGoal, secondaryGoal } = input.hybrid;
  if (!isMaintainable(primaryGoal) || !isMaintainable(secondaryGoal)) {
    return { error: "This generator's hybrid template only supports resistance <-> running combinations for now." };
  }

  const primaryInput: ProgramGenerationInput = { ...input, goal: primaryGoal };
  const primaryResult = isResistanceGoal(primaryGoal) ? buildResistanceTemplate(primaryInput) : buildRunningTemplate(primaryInput);
  if (!("template" in primaryResult)) return primaryResult;

  const secondaryDays = maintenanceDaysFor(secondaryGoal, input.running);
  if (!secondaryDays) {
    return { error: `No maintenance dose defined for secondary goal "${secondaryGoal}".` };
  }

  const combinedDays = sequenceDays([...primaryResult.template.weekStructure.days, ...secondaryDays]);

  const hardSessionCount = combinedDays.filter((d) => d.intensity === "hard").length;
  const template: ProgramTemplate = {
    name: `Hybrid — ${primaryGoal} + maintained ${secondaryGoal}`,
    discipline: "hybrid",
    weekStructure: { days: combinedDays },
    deloadWeeks: primaryResult.template.deloadWeeks,
    phaseByWeek: primaryResult.template.phaseByWeek,
  };

  const warnings = [
    ...primaryResult.warnings,
    priority === "resistance_primary"
      ? "Running is being maintained here, not developed — expect your running fitness to hold steady rather than improve while this block prioritises lifting."
      : "Lifting is being maintained here, not developed — expect strength to hold steady rather than climb while this block prioritises running.",
    "Hybrid training raises energy requirements more than either discipline alone — under-fuelling is the most common reason these plans stall.",
  ];
  if (hardSessionCount > 3) {
    warnings.push(
      `This combination has ${hardSessionCount} hard sessions in one week — 3 is the sustainable ceiling for most people across any combination of modalities. Consider dropping a hard session or moving one of these goals to a different block.`
    );
  }

  return { template, warnings, recommendConsultation: recommendConsultationFrom(input) };
}

function recommendConsultationFrom(input: ProgramGenerationInput): { reason: string } | null {
  const reason = recommendConsultationReason(input.injuries);
  return reason ? { reason } : null;
}
