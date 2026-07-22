/**
 * Training style / discipline finder.
 *
 * A level above the Training Split Finder: that tool assumes you already
 * know you're doing general resistance training and just need help
 * structuring the week. This one answers the question underneath that —
 * which overall training discipline actually fits your goal, your
 * equipment, and how you like a session to feel.
 *
 * This is fit-and-preference matching, not a physiological claim. There's
 * no research result that says "you specifically should do bodybuilding
 * over powerlifting" — that's a genuinely personal call. What we can do
 * honestly is: (a) rule out disciplines your equipment access makes
 * impractical, and (b) match your stated goal and preferences to the style
 * built around them. We say so plainly in the UI rather than presenting
 * this as more scientific than it is.
 *
 * Scoring is a simple deterministic point system — no AI. Each answer adds
 * points toward one or more styles; equipment answers can also exclude a
 * style outright when it's genuinely impractical (powerlifting-style
 * training is built around barbell squat/bench/deadlift — without barbell
 * access it isn't really that discipline anymore).
 */

export type StyleId =
  | "powerlifting"
  | "bodybuilding"
  | "general_fitness"
  | "calisthenics"
  | "hybrid";

export interface StyleInfo {
  id: StyleId;
  name: string;
  tagline: string;
  description: string;
  goodFor: string;
  tradeoff: string;
}

export const STYLES: Record<StyleId, StyleInfo> = {
  powerlifting: {
    id: "powerlifting",
    name: "Powerlifting-Style Strength Training",
    tagline: "Squat, bench, deadlift — get as strong as possible on the big lifts.",
    description:
      "Training built around a small set of heavy barbell compound lifts, low-to-moderate rep ranges, and long-term progressive overload. Sessions are simple and repeatable by design.",
    goodFor:
      "People who want measurable strength progress above almost anything else, and who like a simple, predictable structure.",
    tradeoff:
      "Requires consistent barbell access. Less emphasis on muscle-by-muscle detail or variety than bodybuilding-style training.",
  },
  bodybuilding: {
    id: "bodybuilding",
    name: "Bodybuilding-Style Training",
    tagline: "Build visible muscle with higher-volume, muscle-focused sessions.",
    description:
      "Training organized around individual muscle groups, using a broader mix of compound and isolation exercises at moderate-to-high volume. Optimized for muscle growth and physique change over raw strength numbers.",
    goodFor:
      "People whose main goal is how they look and feel in their body, who don't mind longer sessions and more exercise variety.",
    tradeoff:
      "Takes more weekly volume and session time than the other styles here to do well, and progress is felt more than measured.",
  },
  general_fitness: {
    id: "general_fitness",
    name: "General Strength & Fitness",
    tagline: "Balanced, sustainable training for long-term health and capability.",
    description:
      "A moderate mix of compound strength work and general conditioning, without specializing hard into any one direction. Built to be sustainable indefinitely, not to maximize one specific outcome.",
    goodFor:
      "People who want to be generally strong, capable, and healthy without training for a specific sport, look, or number.",
    tradeoff:
      "Won't produce the fastest strength or muscle gains of a more specialized approach — that's the deliberate tradeoff for sustainability and simplicity.",
  },
  calisthenics: {
    id: "calisthenics",
    name: "Calisthenics / Bodyweight Training",
    tagline: "Build strength and control using progressions of your own bodyweight.",
    description:
      "Training built around bodyweight skill progressions — pull-ups, push-up variations, pistol squats, handstands, and similar — tracked and progressed over time like any other strength discipline.",
    goodFor:
      "People with limited or no equipment access, or who are specifically motivated by mastering bodyweight skills rather than adding external load.",
    tradeoff:
      "Progressive overload is harder to fine-tune than with external weight, and some strength qualities (especially in the lower body) are harder to develop with bodyweight alone.",
  },
  hybrid: {
    id: "hybrid",
    name: "Hybrid / Conditioning Training",
    tagline: "Strength, cardio, and work capacity — a bit of everything, on purpose.",
    description:
      "Varied training that deliberately mixes strength work with conditioning (intervals, circuits, engine-building work), aimed at being well-rounded across multiple fitness qualities rather than specializing in one.",
    goodFor:
      "People who get bored doing the same structure every session, and who value being broadly fit over maximizing one specific quality.",
    tradeoff:
      "Because effort is split across strength and conditioning, progress in any single quality (max strength, or pure endurance) will be slower than a specialized approach.",
  },
};

export type EquipmentAccess = "bodyweight" | "dumbbell" | "full_gym" | "full_gym_conditioning";

type StyleScores = Partial<Record<StyleId, number | "excluded">>;

export interface QuestionOption {
  id: string;
  label: string;
  scores: StyleScores;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: readonly QuestionOption[];
}

export const QUESTIONS: readonly QuizQuestion[] = [
  {
    id: "goal",
    question: "What matters most to you right now?",
    options: [
      { id: "strength", label: "Lifting as much weight as possible on the big lifts", scores: { powerlifting: 3 } },
      { id: "muscle", label: "Building visible muscle and improving how I look", scores: { bodybuilding: 3 } },
      { id: "health", label: "Being generally strong, healthy, and capable long-term", scores: { general_fitness: 3 } },
      { id: "skills", label: "Building strength and control over my own bodyweight", scores: { calisthenics: 3 } },
      { id: "well_rounded", label: "Being well-rounded — strong, fit, and good across the board", scores: { hybrid: 3 } },
    ],
  },
  {
    id: "equipment",
    question: "What equipment can you consistently access?",
    options: [
      {
        id: "bodyweight",
        label: "Just my bodyweight, or minimal equipment (bands, etc.)",
        scores: { powerlifting: "excluded", calisthenics: 3, general_fitness: 1 },
      },
      {
        id: "dumbbell",
        label: "Dumbbells and machines, no barbell or rack",
        scores: { powerlifting: "excluded", bodybuilding: 2, general_fitness: 1, hybrid: 1 },
      },
      {
        id: "full_gym",
        label: "A full gym with barbells and a rack",
        scores: { powerlifting: 2, bodybuilding: 1, general_fitness: 1 },
      },
      {
        id: "full_gym_conditioning",
        label: "A full gym plus conditioning equipment (kettlebells, rower, sled, etc.)",
        scores: { hybrid: 2, powerlifting: 1, bodybuilding: 1 },
      },
    ],
  },
  {
    id: "structure",
    question: "How do you want your sessions to feel?",
    options: [
      {
        id: "simple",
        label: "Simple and predictable — the same core lifts, adding weight over time",
        scores: { powerlifting: 2, general_fitness: 1 },
      },
      {
        id: "varied",
        label: "Varied — different exercises targeting each muscle in detail",
        scores: { bodybuilding: 2 },
      },
      {
        id: "skill",
        label: "Working toward specific skills or movements, tracked over time",
        scores: { calisthenics: 2 },
      },
      {
        id: "mixed",
        label: "A different workout each time, testing different fitness qualities",
        scores: { hybrid: 2 },
      },
      {
        id: "consistent",
        label: "Doesn't matter much — just keep me consistent",
        scores: { general_fitness: 2 },
      },
    ],
  },
] as const;

export interface StyleRecommendation {
  primary: StyleInfo;
  /** A close second, shown only when its score is within 1 point of the primary. */
  secondary: StyleInfo | null;
  scores: Record<StyleId, number | "excluded">;
}

/**
 * Scores every style from a full set of quiz answers (one option id per
 * question, keyed by question id) and returns the top recommendation plus
 * an honest "close second" when the top two are nearly tied.
 */
export function recommendTrainingStyle(answers: Record<string, string>): StyleRecommendation {
  const totals: Record<StyleId, number | "excluded"> = {
    powerlifting: 0,
    bodybuilding: 0,
    general_fitness: 0,
    calisthenics: 0,
    hybrid: 0,
  };

  for (const question of QUESTIONS) {
    const selectedOptionId = answers[question.id];
    if (!selectedOptionId) {
      throw new RangeError(`missing answer for question: ${question.id}`);
    }
    const option = question.options.find((o) => o.id === selectedOptionId);
    if (!option) {
      throw new RangeError(`unknown option "${selectedOptionId}" for question: ${question.id}`);
    }
    for (const [styleId, value] of Object.entries(option.scores) as [StyleId, number | "excluded"][]) {
      if (totals[styleId] === "excluded" || value === "excluded") {
        totals[styleId] = "excluded";
      } else {
        totals[styleId] = totals[styleId] + value;
      }
    }
  }

  const ranked = (Object.keys(totals) as StyleId[])
    .filter((id) => totals[id] !== "excluded")
    .sort((a, b) => (totals[b] as number) - (totals[a] as number));

  if (ranked.length === 0) {
    // Every style excluded is only reachable if the equipment answer set
    // ever excludes everything, which it doesn't today — defend anyway
    // rather than crash.
    throw new RangeError("no eligible training style for the given answers");
  }

  const primaryId = ranked[0]!;
  const secondaryId = ranked[1];
  const primaryScore = totals[primaryId] as number;
  const secondaryScore = secondaryId ? (totals[secondaryId] as number) : null;

  const isCloseSecond = secondaryId !== undefined && secondaryScore !== null && primaryScore - secondaryScore <= 1;

  return {
    primary: STYLES[primaryId],
    secondary: isCloseSecond ? STYLES[secondaryId!] : null,
    scores: totals,
  };
}
