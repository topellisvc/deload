import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAthleteSummary } from "./queries";
import { getMyCoaches, getLinkedProfile } from "@/lib/coaching/queries";
import type { CoachClient } from "@/lib/supabase/types";

vi.mock("@/lib/coaching/queries", () => ({
  getMyCoaches: vi.fn(),
  getLinkedProfile: vi.fn(),
}));

/** Minimal stand-in for Supabase's chainable, thenable query builder: every
 * chain method (select/eq/order/limit/...) returns the same object, and
 * `then` resolves it directly, so both `await ...builder` and
 * `await ...builder.maybeSingle()` work depending on which the code under
 * test actually calls. */
function makeBuilder(result: { data: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "in", "order", "limit"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (resolve: (v: typeof result) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder as Record<string, ReturnType<typeof vi.fn>> & { then: unknown };
}

function makeCoach(overrides: Partial<CoachClient> = {}): CoachClient {
  return {
    id: "rel-1",
    coach_id: "coach-1",
    client_id: "athlete-1",
    client_email: "athlete@example.com",
    coach_email: "coach@example.com",
    status: "active",
    invite_message: null,
    accepted_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("getAthleteSummary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("selects the athlete's is_active program rather than the most recently updated one", async () => {
    vi.mocked(getMyCoaches).mockResolvedValue([makeCoach()]);
    vi.mocked(getLinkedProfile).mockResolvedValue({ display_name: "Coach Jamie", bio: null });

    const programBuilder = makeBuilder({ data: { id: "program-active", name: "Active Program" } });
    const weeksBuilder = makeBuilder({ data: [] });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "programs") return programBuilder;
        if (table === "program_weeks") return weeksBuilder;
        return makeBuilder({ data: [] });
      }),
    };

    const summary = await getAthleteSummary(supabase as never, "athlete-1");

    expect(summary?.currentProgram).toEqual({ id: "program-active", name: "Active Program" });
    // This is the actual bug: the old query ordered programs by
    // updated_at and took the first result, which surfaces whichever
    // program the coach last *edited* — not the one flagged is_active,
    // i.e. the one the athlete is actually training on. Pinning the
    // filter here keeps that regression from creeping back in.
    expect(programBuilder.eq).toHaveBeenCalledWith("is_active", true);
    expect(programBuilder.order).not.toHaveBeenCalled();
    expect(programBuilder.limit).not.toHaveBeenCalled();
  });

  it("returns null when the athlete has no accepted coach relationship", async () => {
    vi.mocked(getMyCoaches).mockResolvedValue([]);
    const supabase = { from: vi.fn(() => makeBuilder({ data: null })) };

    const summary = await getAthleteSummary(supabase as never, "athlete-1");

    expect(summary).toBeNull();
  });

  it("returns null currentProgram when the coach has no active program for this athlete", async () => {
    vi.mocked(getMyCoaches).mockResolvedValue([makeCoach()]);
    vi.mocked(getLinkedProfile).mockResolvedValue({ display_name: "Coach Jamie", bio: null });

    const programBuilder = makeBuilder({ data: null });
    const supabase = { from: vi.fn(() => programBuilder) };

    const summary = await getAthleteSummary(supabase as never, "athlete-1");

    expect(summary?.currentProgram).toBeNull();
    expect(summary?.completionPercent).toBeNull();
  });
});
