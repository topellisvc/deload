import { needsHumanReason, recommendConsultationReason } from "@/lib/programs/generate/injuries";
import type {
  ConditioningModality,
  DayPlan,
  DeloadKind,
  ExerciseSlot,
  ProgramGenerationInput,
  ProgramPhase,
  ProgramTemplate,
  TemplateResult,
  TrainingGoal,
  WeekContext,
  WeekSetPlan,
} from "@/lib/programs/generate/types";
import type { ExperienceLevel } from "@/lib/supabase/types";

/**
 * §12's conditioning-only template — "improve_conditioning," non-running
 * cardio (bike, rower, elliptical, swim, incline walk). Running has its own
 * templates (running-templates.ts) because §11 gives it a genuinely different
 * shape (race distances, a taper, a base-building macrocycle); this goal has
 * no race to build toward, so it's simpler: a steady weekly structure with
 * duration/frequency/intensity progressing by level, no phases beyond a
 * periodic down week.
 *
 * WHAT THIS FILE DOES NOT MODEL, STATED ONCE
 * ---------------------------------------------
 * - §12's "progress one variable per week, in order: frequency -> duration
 *   -> density -> intensity, never two at once" is approximated rather than
 *   run as a literal state machine: duration ramps for a beginner's first
 *   month, then frequency/intensity are fixed by level from the templates
 *   below. A real implementation of the full one-variable-at-a-time rule
 *   needs to react to logged performance, which belongs with the runtime
 *   autoregulation layer (task #25), not a static calendar skeleton.
 * - Advanced's "cycling the hard-session emphasis in 3-4 week blocks" always
 *   uses the same hard-session format (long intervals) rather than rotating
 *   through long intervals / threshold / short intervals. The coach names
 *   long intervals as the best-evidenced default for raising VO2max, so
 *   that's what ships; rotation is follow-up work.
 * - Objective-output progression (watts, split, pace) isn't wired up —
 *   there's no athlete baseline to progress from yet. Sessions are
 *   prescribed by RPE/heart-rate zone instead, which is what the coach's
 *   own answer falls back to when equipment data isn't available.
 */

export function isCardioGoal(goal: TrainingGoal): goal is "improve_conditioning" {
  return goal === "improve_conditioning";
}

function modalityLabel(modality: ConditioningModality): string {
  const labels: Record<ConditioningModality, string> = {
    cycling: "the bike",
    rowing: "the rower",
    incline_walking: "an incline treadmill walk",
    elliptical: "the elliptical",
    swimming: "swimming",
    no_preference: "whatever cardio modality you'll actually do",
  };
  return labels[modality];
}

function easyPrescription(durationSeconds: number, modality: ConditioningModality): WeekSetPlan {
  return {
    prescriptionType: "heart_rate_zone",
    sets: 1,
    durationSeconds,
    heartRateZone: 2,
    notes: `Conversational pace on ${modalityLabel(modality)} — Zone 2, RPE 3-4/10.`,
  };
}

/** §12's "best-evidenced protocol for raising VO2max" — long intervals,
 * 4-5 x 4 min at RPE 8 with 3 min easy. Used as the one hard-session shape
 * this file builds, for intermediate and advanced alike (see file header). */
function longIntervalsPrescription(): WeekSetPlan {
  return {
    prescriptionType: "intervals",
    sets: 4,
    durationSeconds: 240,
    restSeconds: 180,
    rpe: 8,
    notes: "4 x 4 min hard (RPE 8), 3 min easy between reps.",
  };
}

/** §12's beginner-only short-interval introduction from week 4 — long rests,
 * low technical demand, low injury risk. */
function shortIntervalsPrescription(): WeekSetPlan {
  return {
    prescriptionType: "intervals",
    sets: 8,
    durationSeconds: 30,
    restSeconds: 90,
    rpe: 8,
    notes: "8 x 30 sec hard, 90 sec easy — a first taste of intervals, not a fitness test.",
  };
}

function beginnerDayPlans(modality: ConditioningModality): DayPlan[] {
  const easySlot = (): ExerciseSlot => ({
    role: "conditioning",
    category: "cardio",
    movementPattern: null,
    primaryMuscleGroup: null,
    isPrimary: false,
    autoregulationEligible: false,
    prescription: {
      forWeek(ctx: WeekContext): WeekSetPlan {
        // +5 min/week toward a 40-minute ceiling, per §12's beginner
        // progression, then hold.
        const duration = Math.min(40, 20 + (ctx.weekIndex - 1) * 5) * 60;
        return easyPrescription(duration, modality);
      },
    },
  });

  const introSlot: ExerciseSlot = {
    role: "conditioning",
    category: "cardio",
    movementPattern: null,
    primaryMuscleGroup: null,
    isPrimary: false,
    autoregulationEligible: false,
    prescription: {
      forWeek(ctx: WeekContext): WeekSetPlan {
        if (ctx.weekIndex < 4) {
          const duration = Math.min(40, 20 + (ctx.weekIndex - 1) * 5) * 60;
          return easyPrescription(duration, modality);
        }
        return shortIntervalsPrescription();
      },
    },
  };

  return [
    { label: "Conditioning A", isRestDay: false, intensity: "easy", loadsLowerBody: false, slots: [easySlot()] },
    { label: "Conditioning B (intervals from week 4)", isRestDay: false, intensity: "moderate", loadsLowerBody: false, slots: [introSlot] },
  ];
}

function intermediateOrAdvancedDayPlans(daysPerWeek: number, modality: ConditioningModality): DayPlan[] {
  // §12: "3-4 sessions: 2 x Zone 2 (40-60 min) plus 1-2 harder sessions" —
  // scaled up to "4-6, polarised ~80/20" for advanced by adding more easy
  // days rather than more hard ones, per the coach's own ~80/20 framing.
  const hardSessions = daysPerWeek >= 5 ? 2 : 1;
  const easySessions = Math.max(1, daysPerWeek - hardSessions);

  const days: DayPlan[] = [];
  for (let i = 0; i < hardSessions; i++) {
    const slot: ExerciseSlot = {
      role: "conditioning",
      category: "cardio",
      movementPattern: null,
      primaryMuscleGroup: null,
      isPrimary: true,
      autoregulationEligible: false,
      prescription: { forWeek: () => longIntervalsPrescription() },
    };
    days.push({ label: "Long Intervals", isRestDay: false, intensity: "hard", loadsLowerBody: false, slots: [slot] });
  }
  for (let i = 0; i < easySessions; i++) {
    const slot: ExerciseSlot = {
      role: "conditioning",
      category: "cardio",
      movementPattern: null,
      primaryMuscleGroup: null,
      isPrimary: false,
      autoregulationEligible: false,
      prescription: { forWeek: () => easyPrescription(50 * 60, modality) },
    };
    days.push({ label: "Zone 2", isRestDay: false, intensity: "easy", loadsLowerBody: false, slots: [slot] });
  }
  return days;
}

export function buildCardioTemplate(input: ProgramGenerationInput): TemplateResult {
  const routeOut = needsHumanReason({ redFlags: input.redFlags, globalRefusals: input.globalRefusals, injuries: input.injuries });
  if (routeOut) return { needsHumanReason: routeOut };

  if (!isCardioGoal(input.goal)) {
    return { error: `buildCardioTemplate does not handle goal "${input.goal}"` };
  }

  const daysPerWeek = clampDays(input.experienceLevel, input.daysPerWeek);
  const days =
    input.experienceLevel === "beginner" ? beginnerDayPlans(input.conditioningModality) : intermediateOrAdvancedDayPlans(daysPerWeek, input.conditioningModality);

  const phaseByWeek = new Map<number, ProgramPhase>();
  for (let week = 1; week <= input.programLengthWeeks; week++) {
    phaseByWeek.set(week, phaseFor(week));
  }
  const deloadWeeks = new Map<number, DeloadKind>();
  for (const [week, phase] of phaseByWeek) {
    if (phase === "down_week") deloadWeeks.set(week, "volume_cut");
  }

  const template: ProgramTemplate = {
    name: `Conditioning — ${input.experienceLevel === "beginner" ? "Base Building" : "Polarised"}`,
    discipline: "cardio",
    weekStructure: { days },
    deloadWeeks,
    phaseByWeek,
  };

  const warnings: string[] = [];
  if (input.experienceLevel !== "beginner") {
    warnings.push(
      `${modalityLabel(input.conditioningModality)} is this plan's default modality — cycling or rowing produce far less muscle damage than running or incline treadmill work, which matters if you're also lifting.`
    );
  }

  return { template, warnings, recommendConsultation: recommendConsultationFrom(input) };
}

function clampDays(level: ExperienceLevel, daysPerWeek: number): number {
  if (level === "beginner") return Math.min(3, Math.max(2, daysPerWeek));
  if (level === "intermediate") return Math.min(4, Math.max(3, daysPerWeek));
  return Math.min(6, Math.max(4, daysPerWeek));
}

function phaseFor(week: number): ProgramPhase {
  return week % 4 === 0 ? "down_week" : "standard";
}

function recommendConsultationFrom(input: ProgramGenerationInput): { reason: string } | null {
  const reason = recommendConsultationReason(input.injuries);
  return reason ? { reason } : null;
}
