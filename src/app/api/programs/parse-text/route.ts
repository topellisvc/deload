import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ParsedProgramSchema, PARSED_PROGRAM_JSON_SCHEMA } from "@/lib/programs/text-parse";

const MAX_INPUT_LENGTH = 6000;
const TOOL_NAME = "submit_program";

const SYSTEM_PROMPT = `You convert a coach's plain-English description of a training program into structured data by calling the ${TOOL_NAME} tool. You never reply with prose — always call the tool.

Rules:
- If the coach doesn't say how many weeks, produce 1 week.
- If a day is explicitly a rest/off day, set is_rest_day true and leave exercises empty. Otherwise is_rest_day is false.
- Every exercise needs a category: "strength" (weights/bodyweight resistance work), "running", or "cardio" (bike, rower, swim, elliptical, etc.).
- Pick the prescription_type that best matches how the coach described the exercise:
  strength: fixed_weight (a specific weight was given), percent_1rm (a %1RM was given), rpe, rir, rep_range (a range like "8-10" with no weight/RPE/RIR), athlete_chooses_weight ("their choice of weight"), coach_notes_only (no sets/reps/weight at all, just an instruction).
  running: distance, time, distance_time (both a distance and a time goal), pace, heart_rate_zone, rpe, intervals (repeated reps like "6x400m"), coach_notes.
  cardio: time, distance, calories, heart_rate_zone, rpe, intervals, coach_notes.
- Convert every unit to the app's canonical units: distance_meters is always meters (5k -> 5000, 2 miles -> ~3219), duration_seconds and rest_seconds are always seconds (20 minutes -> 1200), pace_seconds_per_km is always seconds per kilometer (convert from /mile if needed).
- "sets" on a set-group is how many sets/rounds that prescription repeats (e.g. "3x8" -> sets: 3, reps: "8"; a single 20-minute run -> sets: 1).
- Give the whole program a short, sensible name if the coach didn't state one, and pick the discipline ("resistance", "running", "hybrid", or "cardio") that best fits the overall content.
- Never invent exercises, sets, or numbers the coach didn't imply. If something is genuinely unspecified, leave the field null rather than guessing a number.`;

interface ParseTextBody {
  text: string;
}

function isValidBody(body: unknown): body is ParseTextBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return typeof b.text === "string" && b.text.trim().length > 0;
}

interface AnthropicToolUseBlock {
  type: "tool_use";
  name: string;
  input: unknown;
}

interface AnthropicMessageResponse {
  content: (AnthropicToolUseBlock | { type: string })[];
  stop_reason?: string;
}

/**
 * The one server-side piece of the "Describe a program" feature — parsing
 * needs a secret Anthropic API key that can never live in browser code.
 * Everything after this (actually inserting the program) stays a normal
 * client-side Supabase mutation (createProgramFromParsedProgram,
 * lib/programs/mutations.ts), same split as
 * app/api/notifications/email/route.ts's Resend call.
 *
 * Safe no-op (200, { skipped: true }) until ANTHROPIC_API_KEY is set — see
 * .env.local.example. Requires a signed-in session so this can't be used
 * as a free-standing LLM proxy by an unauthenticated caller who finds the
 * endpoint.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ skipped: true });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isValidBody(body)) {
    return NextResponse.json({ error: "Missing program description" }, { status: 400 });
  }
  if (body.text.length > MAX_INPUT_LENGTH) {
    return NextResponse.json({ error: `Keep the description under ${MAX_INPUT_LENGTH} characters.` }, { status: 400 });
  }

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: body.text }],
      tools: [{ name: TOOL_NAME, description: "Submit the structured program.", input_schema: PARSED_PROGRAM_JSON_SCHEMA }],
      tool_choice: { type: "tool", name: TOOL_NAME },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Claude API error: ${text.slice(0, 300)}` }, { status: 502 });
  }

  const data = (await res.json()) as AnthropicMessageResponse;
  const toolUse = data.content.find((block): block is AnthropicToolUseBlock => block.type === "tool_use" && "name" in block && block.name === TOOL_NAME);
  if (!toolUse) {
    return NextResponse.json({ error: "Claude didn't return a structured program. Try rephrasing the description." }, { status: 502 });
  }

  const result = ParsedProgramSchema.safeParse(toolUse.input);
  if (!result.success) {
    return NextResponse.json({ error: "Claude's response didn't match the expected program shape. Try again or simplify the description." }, { status: 502 });
  }

  return NextResponse.json({ parsed: result.data });
}
