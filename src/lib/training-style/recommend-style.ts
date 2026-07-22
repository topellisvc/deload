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
 * style outright when it's genuinely impractical (powerlifting-style and
 * powerbuilding are both built around barbell squat/bench/deadlift, and
 * CrossFit-style training's Olympic-lifting pillar needs a barbell too —
 * without one, none of those are really that discipline anymore).
 *
 * Eight styles, four questions. Three questions were enough to discriminate
 * cleanly between five styles; adding three more disciplines without adding
 * a question would have made results mushier, not more useful, so a fourth
 * question (what kind of progress actually motivates you) was added
 * specifically to separate the styles that otherwise looked similar on the
 * first three answers — e.g. Powerlifting, Powerbuilding, and CrossFit-Style
 * all skew toward barbell equipment and moderate-structure answers, but
 * differ a lot on whether someone is chasing a number, a look, a skill, or
 * raw performance.
 */

export type StyleId =
  | "powerlifting"
  | "bodybuilding"
  | "general_fitness"
  | "calisthenics"
  | "hybrid"
  | "power_speed"
  | "powerbuilding"
  | "crossfit";

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
      "Varied training that deliberately mixes strength work with conditioning (intervals, circuits, engine-building work), aimed at being well-rounded across multiple fitness qualities rather than specializing in one. Looser and less structured than CrossFit-style training — no benchmark workouts, no scoring.",
    goodFor:
      "People who get bored doing the same structure every session, and who value being broadly fit over maximizing one specific quality, without wanting a competitive or scored framework around it.",
    tradeoff:
      "Because effort is split across strength and conditioning, progress in any single quality (max strength, or pure endurance) will be slower than a specialized approach.",
  },
  power_speed: {
    id: "power_speed",
    name: "Power & Speed Training",
    tagline: "Get more explosive and faster — jumps, sprints, and speed-strength work.",
    description:
      "Training built around rate of force development and speed rather than maximal load — plyometrics (jumps, bounds), sprint mechanics, and explosive lifting variations like jump squats or Olympic-lift derivatives. The priority is moving fast and forcefully, not just moving heavy.",
    goodFor:
      "Athletes training for a sport where speed or explosiveness directly matters (field or court sports, sprinting, jumping events), or anyone who wants to feel more athletic, not just stronger.",
    tradeoff:
      "Needs more recovery between high-intensity efforts than steady strength work, and technique (sprint mechanics, landing form) matters more here — done sloppily, it carries more injury risk than most other styles on this list.",
  },
  powerbuilding: {
    id: "powerbuilding",
    name: "Powerbuilding",
    tagline: "Chase bigger lifts and bigger muscles at the same time.",
    description:
      "A deliberate blend of powerlifting and bodybuilding — heavy compound lifts for strength, paired with extra accessory and isolation volume for muscle growth. Not pure strength training and not pure bodybuilding; built for people who want both outcomes and are willing to trade some speed on each for progress on both.",
    goodFor:
      "People who want their lifts to keep going up and want to look more muscular, and don't want to fully commit to one over the other.",
    tradeoff:
      "Progresses more slowly on pure strength than dedicated powerlifting, and more slowly on pure size than dedicated bodybuilding — the direct cost of chasing both. Requires barbell access.",
  },
  crossfit: {
    id: "crossfit",
    name: "CrossFit-Style Training",
    tagline: "Constantly varied, high-intensity functional training, often benchmarked and scored.",
    description:
      "Training that mixes Olympic weightlifting, gymnastics-style bodyweight movements, and metabolic conditioning into varied, frequently-timed workouts. Built around measurable, comparable performance — many sessions are benchmarked against a specific time or score rather than just \"how it felt.\"",
    goodFor:
      "People motivated by competition, community, and measurable performance who want intensity and variety over a predictable routine.",
    tradeoff:
      "Combines high skill demands (Olympic lifts, gymnastics) with high intensity, which means technique breakdown under fatigue is a real risk without good coaching. Needs a well-equipped gym.",
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
      { id: "power_speed", label: "Becoming more explosive, powerful, or fast for sport", scores: { power_speed: 3 } },
      { id: "powerbuilding", label: "Getting stronger on my lifts and more muscular at the same time", scores: { powerbuilding: 3 } },
      { id: "crossfit", label: "Competing and testing myself in varied, intense workouts", scores: { crossfit: 3 } },
    ],
  },
  {
    id: "equipment",
    question: "What equipment can you consistently access?",
    options: [
      {
        id: "bodyweight",
        label: "Just my bodyweight, or minimal equipment (bands, etc.)",
        scores: {
          powerlifting: "excluded",
          powerbuilding: "excluded",
          crossfit: "excluded",
          calisthenics: 3,
          power_speed: 1,
          general_fitness: 1,
          hybrid: 1,
        },
      },
      {
        id: "dumbbell",
        label: "Dumbbells and machines, no barbell or rack",
        scores: {
          powerlifting: "excluded",
          powerbuilding: "excluded",
          bodybuilding: 2,
          general_fitness: 1,
          hybrid: 1,
          power_speed: 1,
          crossfit: 1,
        },
      },
      {
        id: "full_gym",
        label: "A full gym with barbells and a rack",
        scores: { powerlifting: 2, bodybuilding: 1, general_fitness: 1, powerbuilding: 2, power_speed: 1, crossfit: 1 },
      },
      {
        id: "full_gym_conditioning",
        label: "A full gym plus conditioning equipment (kettlebells, rower, sled, pull-up rig, etc.)",
        scores: { hybrid: 2, crossfit: 3, powerlifting: 1, bodybuilding: 1, power_speed: 2, powerbuilding: 1 },
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
        scores: { hybrid: 2, crossfit: 1 },
      },
      {
        id: "consistent",
        label: "Doesn't matter much — just keep me consistent",
        scores: { general_fitness: 2 },
      },
      {
        id: "explosive",
        label: "Short, explosive efforts — sprints, jumps, throws",
        scores: { power_speed: 3 },
      },
      {
        id: "heavy_and_pump",
        label: "Heavy lifting days mixed with dedicated muscle-building days",
        scores: { powerbuilding: 3 },
      },
      {
        id: "scored",
        label: "Timed or scored workouts I can measure myself against",
        scores: { crossfit: 3 },
      },
    ],
  },
  {
    id: "progress",
    question: "What kind of progress motivates you most?",
    options: [
      {
        id: "numbers",
        label: "Chasing specific numbers — 1-rep maxes, timed workouts, PRs",
        scores: { powerlifting: 1, powerbuilding: 1, crossfit: 2 },
      },
      {
        id: "general_progress",
        label: "Progress matters, but I don't need to track everything precisely",
        scores: { general_fitness: 2, hybrid: 1 },
      },
      {
        id: "mirror",
        label: "How my body looks in the mirror",
        scores: { bodybuilding: 2 },
      },
      {
        id: "movement_skill",
        label: "Mastering new movements and skills",
        scores: { calisthenics: 2 },
      },
      {
        id: "performance",
        label: "Performance — getting faster, jumping higher, hitting harder",
        scores: { power_speed: 3 },
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
    power_speed: 0,
    powerbuilding: 0,
    crossfit: 0,
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
