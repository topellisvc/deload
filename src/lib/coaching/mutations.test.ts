import { describe, it, expect, vi, beforeEach } from "vitest";
import { acceptInvite } from "./mutations";

vi.mock("@/lib/notifications/mutations", () => ({
  notifyInviteAccepted: vi.fn(),
}));

import { notifyInviteAccepted } from "@/lib/notifications/mutations";

/** Chainable stub for the update().eq().is().select().maybeSingle() shape
 * acceptInvite calls — every link returns the same object except the
 * terminal maybeSingle(), which resolves to whatever this test configures. */
function makeSupabaseMock(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    select: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  const supabase = { from: vi.fn(() => builder) };
  return { supabase, builder };
}

describe("acceptInvite", () => {
  beforeEach(() => {
    vi.mocked(notifyInviteAccepted).mockReset();
  });

  it("notifies the coach with the row's own coach/client identifiers on success", async () => {
    const { supabase } = makeSupabaseMock({
      data: { coach_id: "coach-1", coach_email: "coach@example.com", client_email: "client@example.com" },
      error: null,
    });

    const result = await acceptInvite(supabase as never, { coachClientId: "cc-1", userId: "client-1" });

    expect(result.error).toBeNull();
    expect(notifyInviteAccepted).toHaveBeenCalledWith(supabase, {
      coachId: "coach-1",
      coachEmail: "coach@example.com",
      clientId: "client-1",
      clientEmail: "client@example.com",
    });
  });

  it("returns a friendly error and never notifies anyone when the update fails", async () => {
    const { supabase } = makeSupabaseMock({ data: null, error: { message: "boom" } });

    const result = await acceptInvite(supabase as never, { coachClientId: "cc-1", userId: "client-1" });

    expect(result.error).toBe("Couldn't accept this invite. Try again.");
    expect(notifyInviteAccepted).not.toHaveBeenCalled();
  });

  it("skips notifying if the invite was already resolved (no row matched, data null)", async () => {
    const { supabase } = makeSupabaseMock({ data: null, error: null });

    const result = await acceptInvite(supabase as never, { coachClientId: "cc-1", userId: "client-1" });

    expect(result.error).toBeNull();
    expect(notifyInviteAccepted).not.toHaveBeenCalled();
  });
});
