import { describe, it, expect, vi, beforeEach } from "vitest";
import { notify, notifyInviteAccepted, notifyProgramAssigned } from "./mutations";

vi.mock("./email", () => ({
  sendNotificationEmail: vi.fn(),
  siteOrigin: () => "https://www.deloadhq.com",
}));

import { sendNotificationEmail } from "./email";

/** Captures notification inserts, and stubs coach_clients's
 * select().eq().eq().eq().maybeSingle() chain used to look up the
 * athlete's email for notifyProgramAssigned. */
function makeSupabaseMock(relationship: { client_email: string } | null = null) {
  const inserted: Record<string, unknown>[] = [];
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "coach_clients") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: relationship }),
                }),
              }),
            }),
          }),
        };
      }
      return {
        insert: vi.fn((row: Record<string, unknown>) => {
          inserted.push(row);
          return Promise.resolve({ error: null });
        }),
      };
    }),
  };
  return { supabase, inserted };
}

describe("notify", () => {
  beforeEach(() => {
    vi.mocked(sendNotificationEmail).mockReset();
  });

  it("writes a notifications row with the given fields", async () => {
    const { supabase, inserted } = makeSupabaseMock();

    await notify(supabase as never, {
      recipientId: "user-2",
      actorId: "user-1",
      type: "program_assigned",
      title: "New program from your coach",
      body: "Details",
      link: "/programs/abc",
    });

    expect(inserted).toEqual([
      {
        recipient_id: "user-2",
        actor_id: "user-1",
        type: "program_assigned",
        title: "New program from your coach",
        body: "Details",
        link: "/programs/abc",
      },
    ]);
    expect(sendNotificationEmail).not.toHaveBeenCalled();
  });

  it("also sends an email when an email payload is given", async () => {
    const { supabase } = makeSupabaseMock();

    await notify(supabase as never, {
      recipientId: "user-2",
      actorId: "user-1",
      type: "invite_accepted",
      title: "Invite accepted",
      email: { to: "client@example.com", subject: "Subject", heading: "Heading", message: "Message" },
    });

    expect(sendNotificationEmail).toHaveBeenCalledWith({
      to: "client@example.com",
      subject: "Subject",
      heading: "Heading",
      message: "Message",
    });
  });
});

describe("notifyProgramAssigned", () => {
  beforeEach(() => {
    vi.mocked(sendNotificationEmail).mockReset();
  });

  it("notifies the athlete and emails them when the coach_clients relationship resolves an email", async () => {
    const { supabase, inserted } = makeSupabaseMock({ client_email: "athlete@example.com" });

    await notifyProgramAssigned(supabase as never, {
      coachId: "coach-1",
      athleteId: "athlete-1",
      programId: "prog-1",
      programName: "5K Base Builder",
    });

    expect(inserted).toEqual([
      {
        recipient_id: "athlete-1",
        actor_id: "coach-1",
        type: "program_assigned",
        title: "New program from your coach",
        body: '"5K Base Builder" was just added to your programs.',
        link: "/programs/prog-1",
      },
    ]);
    expect(sendNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "athlete@example.com", ctaHref: "https://www.deloadhq.com/programs/prog-1" })
    );
  });

  it("still writes the in-app notification, but skips email, when no active relationship row is found", async () => {
    const { supabase, inserted } = makeSupabaseMock(null);

    await notifyProgramAssigned(supabase as never, {
      coachId: "coach-1",
      athleteId: "athlete-1",
      programId: "prog-1",
      programName: "5K Base Builder",
    });

    expect(inserted).toHaveLength(1);
    expect(sendNotificationEmail).not.toHaveBeenCalled();
  });
});

describe("notifyInviteAccepted", () => {
  beforeEach(() => {
    vi.mocked(sendNotificationEmail).mockReset();
  });

  it("notifies the coach and emails them at coach_email", async () => {
    const { supabase, inserted } = makeSupabaseMock();

    await notifyInviteAccepted(supabase as never, {
      coachId: "coach-1",
      coachEmail: "coach@example.com",
      clientId: "client-1",
      clientEmail: "client@example.com",
    });

    expect(inserted).toEqual([
      {
        recipient_id: "coach-1",
        actor_id: "client-1",
        type: "invite_accepted",
        title: "Invite accepted",
        body: "client@example.com accepted your coaching invite.",
        link: "/coaching",
      },
    ]);
    expect(sendNotificationEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "coach@example.com", ctaHref: "https://www.deloadhq.com/coaching" }));
  });
});
