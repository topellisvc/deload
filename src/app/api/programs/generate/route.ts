import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listExercises } from "@/lib/exercises/queries";
import { assembleWeeks } from "@/lib/programs/generate/assemble";
import { buildCardioTemplate, isCardioGoal } from "@/lib/programs/generate/cardio-templates";
import { buildHybridTemplate, isHybridGoal } from "@/lib/programs/generate/hybrid-templates";
import { buildPowerliftingTemplate, isPowerliftingGoal } from "@/lib/programs/generate/powerlifting-templates";
import { buildResistanceTemplate, isResistanceGoal } from "@/lib/programs/generate/resistance-templates";
import { buildRunningTemplate, isRunGoal } from "@/lib/programs/generate/running-templates";
import type { ProgramGenerationInput, TemplateResult, TrainingGoal } from "@/lib/programs/generate/types";

/**
 * "Build my program" — the one server-side step of the questionnaire-driven
 * generator. Everything this route does is deterministic (see
 * lib/programs/generate's own header comments for why: real programming
 * science as testable code, not an LLM freehanding numbers), so unlike
 * parse-text/route.ts this needs no external API key and produces the same
 * output for the same input every time. It's a route rather than a client-
 * side call for one reason only — exercise selection needs the live
 * Exercise Library (listExercises), which needs a Supabase session this
 * request can authenticate but shouldn't hand raw table access to the
 * browser bundle for.
 *
 * Three response shapes, matching TemplateResult's three variants exactly:
 * - { needsHumanReason } — nothing should be auto-generated for this input
 *   at all (a red flag, a global refusal). The client must not suggest
 *   retrying with different answers; see TemplateResult's own doc comment.
 * - { error } — this specific combination can't produce a sound plan, but a
 *   different one (a different goal, more days) would. The client can let
 *   the person adjust the form and resubmit.
 * - { name, discipline, weeks, warnings, recommendConsultation } — a real
 *   plan, ready for createProgramFromParsedProgram (mutations.ts) to
 *   persist exactly the way it already persists an AI-parsed program: that
 *   function only needs { name, discipline, weeks: WeekRow[] }, and
 *   assembleWeeks already produces exactly that shape, so no new insert
 *   path was needed for this feature at all.
 */

function isTrainingGoal(value: unknown): value is TrainingGoal {
  if (typeof value !== "string") return false;
  const goal = value as TrainingGoal;
  return (
    isResistanceGoal(goal) ||
    isRunGoal(goal) ||
    isCardioGoal(goal) ||
    isHybridGoal(goal) ||
    isPowerliftingGoal(goal) ||
    goal === "power_athletic" ||
    goal === "sport_specific"
  );
}

function isValidBody(body: unknown): body is ProgramGenerationInput {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    isTrainingGoal(b.goal) &&
    typeof b.experienceLevel === "string" &&
    typeof b.daysPerWeek === "number" &&
    typeof b.sessionLengthMinutes === "number" &&
    typeof b.equipmentAccess === "string" &&
    typeof b.programLengthWeeks === "number" &&
    !!b.athlete &&
    !!b.injuries &&
    !!b.redFlags &&
    !!b.globalRefusals
  );
}

function buildTemplate(input: ProgramGenerationInput): TemplateResult {
  if (isResistanceGoal(input.goal)) return buildResistanceTemplate(input);
  if (isRunGoal(input.goal)) return buildRunningTemplate(input);
  if (isCardioGoal(input.goal)) return buildCardioTemplate(input);
  if (isHybridGoal(input.goal)) return buildHybridTemplate(input);
  if (isPowerliftingGoal(input.goal)) return buildPowerliftingTemplate(input);
  // power_athletic / sport_specific: accepted by the questionnaire's type
  // but no template family has been built for them yet (tasks #22-23) — an
  // honest error, not a silently wrong plan.
  return { error: `"${input.goal}" isn't supported by the program generator yet — this template family hasn't been built.` };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isValidBody(body)) {
    return NextResponse.json({ error: "Missing or malformed questionnaire answers." }, { status: 400 });
  }
  const input = body;

  if (input.programLengthWeeks < 1 || input.programLengthWeeks > 52) {
    return NextResponse.json({ error: "Program length must be between 1 and 52 weeks." }, { status: 400 });
  }

  let result: TemplateResult;
  try {
    result = buildTemplate(input);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Something went wrong building this template." }, { status: 500 });
  }

  if ("needsHumanReason" in result) {
    return NextResponse.json({ needsHumanReason: result.needsHumanReason });
  }
  if ("error" in result) {
    return NextResponse.json({ error: result.error });
  }

  const exercises = await listExercises(supabase);
  // Every template builder sizes phaseByWeek to exactly the program's real
  // length — programLengthWeeks itself for resistance/running/cardio/
  // hybrid, but the meet-date-derived length for powerlifting (which
  // ignores programLengthWeeks entirely; see powerlifting-templates.ts).
  // Reading it back off the template rather than trusting the raw
  // questionnaire field keeps this correct for both cases without a
  // goal-specific branch here.
  const totalWeeks = result.template.phaseByWeek.size;
  const assembled = assembleWeeks({
    template: result.template,
    totalWeeks,
    exercises,
    selection: {
      equipmentAccess: input.equipmentAccess,
      experienceLevel: input.experienceLevel,
      injuries: input.injuries,
      coachedOnOlympicLifts: input.coachedOnOlympicLifts,
    },
  });

  return NextResponse.json({
    name: result.template.name,
    discipline: result.template.discipline,
    weeks: assembled.weeks,
    warnings: [...result.warnings, ...assembled.warnings],
    recommendConsultation: result.recommendConsultation,
  });
}
