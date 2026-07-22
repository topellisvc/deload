/**
 * Training split recommendation.
 *
 * Answers a different question than the Quick Workout Generator: not "what
 * should today's session look like" but "how should my whole training week
 * be structured, given my goal, experience, and how many days I actually
 * have." Rule-based and deterministic, like every other tool on this site —
 * no AI involved in the decision.
 *
 * Important honesty note, stated up front rather than buried: research
 * (e.g. Schoenfeld, Grgic & Krieger's frequency meta-analyses) generally
 * finds that training splits perform similarly for muscle growth once
 * weekly volume per muscle group is equated — no split is proven
 * objectively "best." What differs between splits is how that volume gets
 * distributed across your available days, and how much frequency each
 * muscle group gets as a result. This tool recommends a structure that fits
 * your constraints and goal, not a claim that it will outperform the
 * alternatives.
 *
 * The three splits covered here are the ones with the most consistent
 * support and the simplest, most teachable structure:
 *  - Full Body: every session covers all major movement patterns. The
 *    standard recommendation for low weekly frequency and for beginners,
 *    since it maximizes practice frequency on the same lifts (well
 *    established in beginner programming — e.g. Starting Strength,
 *    StrongLifts 5x5 — and supported by frequency research showing more
 *    frequent practice accelerates skill acquisition on compound lifts).
 *  - Upper/Lower: alternating upper- and lower-body sessions. A common
 *    middle ground once there's enough training frequency to specialize a
 *    little without dropping below roughly twice-a-week frequency per
 *    muscle group.
 *  - Push/Pull/Legs: a three-way rotation by movement direction. Suits
 *    higher weekly frequency aimed specifically at hypertrophy, where
 *    fitting enough per-session volume in matters more.
 */

export type Goal = "strength" | "hypertrophy" | "general_fitness";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type SplitId = "full_body" | "upper_lower" | "push_pull_legs";

export const MIN_DAYS_PER_WEEK = 2;
export const MAX_DAYS_PER_WEEK = 6;

export interface SplitInfo {
  id: SplitId;
  name: string;
  /** The repeating day-type cycle this split is built from. */
  dayTypes: readonly string[];
  summary: string;
}

export const SPLITS: Record<SplitId, SplitInfo> = {
  full_body: {
    id: "full_body",
    name: "Full Body",
    dayTypes: ["Full Body"],
    summary:
      "Every session trains all major movement patterns — squat, hinge, push, pull, and core.",
  },
  upper_lower: {
    id: "upper_lower",
    name: "Upper/Lower",
    dayTypes: ["Upper", "Lower"],
    summary: "Alternating upper-body and lower-body sessions.",
  },
  push_pull_legs: {
    id: "push_pull_legs",
    name: "Push/Pull/Legs",
    dayTypes: ["Push", "Pull", "Legs"],
    summary:
      "A three-day rotation by movement direction: pushing muscles, pulling muscles, then legs.",
  },
};

export interface GoalInfo {
  id: Goal;
  label: string;
}

export const GOALS: readonly GoalInfo[] = [
  { id: "strength", label: "Get stronger" },
  { id: "hypertrophy", label: "Build muscle" },
  { id: "general_fitness", label: "General fitness & health" },
] as const;

export interface ExperienceInfo {
  id: ExperienceLevel;
  label: string;
  description: string;
}

export const EXPERIENCE_LEVELS: readonly ExperienceInfo[] = [
  {
    id: "beginner",
    label: "Beginner",
    description: "Less than 1 year of consistent training.",
  },
  {
    id: "intermediate",
    label: "Intermediate",
    description: "1-3 years of consistent training.",
  },
  {
    id: "advanced",
    label: "Advanced",
    description: "3+ years of consistent training.",
  },
] as const;

export interface TrainingSplitInputs {
  goal: Goal;
  experience: ExperienceLevel;
  daysPerWeek: number;
}

export interface TrainingSplitRecommendation {
  split: SplitInfo;
  /** One entry per training day, e.g. ["Push", "Pull", "Legs", "Push", "Pull"]. */
  schedule: string[];
  frequencyDescription: string;
  reasoning: string;
}

function chooseSplitId({ goal, experience, daysPerWeek }: TrainingSplitInputs): SplitId {
  if (daysPerWeek <= 3) return "full_body";

  if (daysPerWeek === 4) {
    // Beginners get more out of repeated full-body practice than
    // specializing this early; everyone past that benefits from the extra
    // per-region volume upper/lower allows.
    return experience === "beginner" ? "full_body" : "upper_lower";
  }

  // 5-6 days/week.
  if (experience === "beginner") {
    // Still not ready for 3-way specialization — upper/lower is enough
    // differentiation to manage session length at this frequency.
    return "upper_lower";
  }
  // Intermediate/advanced: PPL only when the goal specifically benefits
  // from more per-session volume per muscle group (hypertrophy). Strength
  // and general fitness goals do better staying on upper/lower, which
  // keeps frequency per lift/pattern higher.
  return goal === "hypertrophy" ? "push_pull_legs" : "upper_lower";
}

function buildSchedule(splitId: SplitId, daysPerWeek: number): string[] {
  const cycle = SPLITS[splitId].dayTypes;
  return Array.from({ length: daysPerWeek }, (_, i) => cycle[i % cycle.length]!);
}

function describeFrequency(splitId: SplitId, schedule: string[]): string {
  if (splitId === "full_body") {
    return `Every major muscle group is trained in all ${schedule.length} sessions this week.`;
  }
  const counts = new Map<string, number>();
  for (const day of schedule) counts.set(day, (counts.get(day) ?? 0) + 1);
  const values = [...counts.values()];
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max
    ? `Each muscle group is trained about ${min}x per week.`
    : `Each muscle group is trained ${min}-${max}x per week, depending on the day.`;
}

function buildReasoning({ daysPerWeek }: TrainingSplitInputs, splitId: SplitId): string {
  if (splitId === "full_body") {
    if (daysPerWeek <= 3) {
      return `With ${daysPerWeek} day${daysPerWeek === 1 ? "" : "s"} a week, splitting your training into separate upper/lower or push/pull/legs days would drop how often each muscle group gets trained too low. A full-body approach keeps every pattern in play every session.`;
    }
    return `As a beginner, practicing the same core lifts more often builds skill and strength faster than specializing into separate days this early — full body at ${daysPerWeek} days a week keeps that frequency high while you're still building technique.`;
  }
  if (splitId === "upper_lower") {
    return `Alternating upper- and lower-body days lets you train each region about twice a week while keeping individual sessions shorter than a full-body day would need to be at ${daysPerWeek} days a week.`;
  }
  // push_pull_legs
  return `At ${daysPerWeek} days a week with muscle growth as the goal, a push/pull/legs rotation lets you put more volume into each muscle group per session while still hitting it more than once a week.`;
}

export function recommendTrainingSplit(inputs: TrainingSplitInputs): TrainingSplitRecommendation {
  const { daysPerWeek } = inputs;
  if (!Number.isInteger(daysPerWeek) || daysPerWeek < MIN_DAYS_PER_WEEK || daysPerWeek > MAX_DAYS_PER_WEEK) {
    throw new RangeError(
      `daysPerWeek must be an integer between ${MIN_DAYS_PER_WEEK} and ${MAX_DAYS_PER_WEEK}`
    );
  }

  const splitId = chooseSplitId(inputs);
  const split = SPLITS[splitId];
  const schedule = buildSchedule(splitId, daysPerWeek);

  return {
    split,
    schedule,
    frequencyDescription: describeFrequency(splitId, schedule),
    reasoning: buildReasoning(inputs, splitId),
  };
}
