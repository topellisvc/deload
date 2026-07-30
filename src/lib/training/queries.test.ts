import { describe, expect, it } from "vitest";
import { getPreviousJointCheckAnswer } from "./queries";

/** Minimal stand-in for Supabase's chainable, thenable query builder —
 * same convention as lib/profile/queries.test.ts's makeBuilder. */
function makeBuilder(result: { data: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit"]) {
    builder[method] = () => builder;
  }
  builder.maybeSingle = async () => result;
  return builder;
}

describe("getPreviousJointCheckAnswer", () => {
  it("returns the most recent answer for this athlete and joint", async () => {
    const supabase = { from: () => makeBuilder({ data: { answer: "worse" } }) };

    const answer = await getPreviousJointCheckAnswer(supabase as never, { athleteId: "athlete-1", joint: "shoulder" });

    expect(answer).toBe("worse");
  });

  it("returns null when nothing has ever been answered for this joint", async () => {
    const supabase = { from: () => makeBuilder({ data: null }) };

    const answer = await getPreviousJointCheckAnswer(supabase as never, { athleteId: "athlete-1", joint: "knee" });

    expect(answer).toBeNull();
  });
});
