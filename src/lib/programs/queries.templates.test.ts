import { describe, it, expect, vi } from "vitest";
import { getMyProgramTemplates } from "./queries";
import type { ProgramTemplateRow } from "./types";

/**
 * Separate file from queries.test.ts (which doesn't exist yet — this is
 * the first test coverage for queries.ts) so a future getProgramTree suite
 * doesn't have to share this file's narrow single-purpose mock builder.
 */
describe("getMyProgramTemplates", () => {
  it("queries program_templates scoped to the given owner, newest first", async () => {
    const rows: ProgramTemplateRow[] = [
      { id: "t-1", owner_id: "coach-1", name: "A", discipline: "resistance", template_data: { weeks: [] }, created_at: "2026-01-01T00:00:00.000Z" },
    ];
    const order = vi.fn(() => Promise.resolve({ data: rows }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const supabase = { from: vi.fn(() => ({ select })) };

    const result = await getMyProgramTemplates(supabase as never, "coach-1");

    expect(supabase.from).toHaveBeenCalledWith("program_templates");
    expect(eq).toHaveBeenCalledWith("owner_id", "coach-1");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result).toEqual(rows);
  });

  it("returns an empty array rather than throwing when there's no data", async () => {
    const supabase = { from: vi.fn(() => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: null }) }) }) })) };

    const result = await getMyProgramTemplates(supabase as never, "coach-1");

    expect(result).toEqual([]);
  });
});
