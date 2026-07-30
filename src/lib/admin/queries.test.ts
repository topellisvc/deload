import { describe, it, expect, vi } from "vitest";
import { getAdminRoster } from "./queries";

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: "athlete" | "coach";
  is_admin: boolean;
  beta_build_for_me: boolean;
  created_at: string;
};
type ProgramRow = { owner_id: string };
type LogRow = { athlete_id: string; performed_on: string; skipped: boolean };

/**
 * A minimal thenable builder per table — getAdminRoster only ever calls
 * .select() (optionally .order()) before awaiting, never .eq()/.in(),
 * since RLS (not client-side filtering) is what scopes rows to what an
 * admin caller is actually allowed to see (migration 0021). Mirrors the
 * thenable-builder pattern already used in coaching/queries.test.ts.
 */
function makeSupabaseMock(opts: { profiles: ProfileRow[]; programs: ProgramRow[]; logs: LogRow[] }) {
  function builder(data: unknown[]) {
    return {
      select: () => builder(data),
      order: () => builder(data),
      then(resolve: (v: { data: unknown[] }) => void) {
        resolve({ data });
      },
    };
  }

  return {
    from: vi.fn((table: string) => {
      if (table === "profiles") return builder(opts.profiles);
      if (table === "programs") return builder(opts.programs);
      if (table === "session_logs") return builder(opts.logs);
      throw new Error(`Unexpected table in test: ${table}`);
    }),
  };
}

function makeProfile(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: "user-1",
    email: "user1@example.com",
    display_name: null,
    role: "athlete",
    is_admin: false,
    beta_build_for_me: false,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("getAdminRoster", () => {
  it("returns every profile with zero counts and no last-active when there's no activity", async () => {
    const supabase = makeSupabaseMock({ profiles: [makeProfile()], programs: [], logs: [] });

    const roster = await getAdminRoster(supabase as never);

    expect(roster).toEqual([
      {
        id: "user-1",
        email: "user1@example.com",
        displayName: null,
        role: "athlete",
        isAdmin: false,
        betaBuildForMe: false,
        signedUpAt: "2026-01-01T00:00:00.000Z",
        lastActiveOn: null,
        programsCreated: 0,
        sessionCount: 0,
      },
    ]);
  });

  it("tallies program counts per owner and session counts/last-active per athlete", async () => {
    const supabase = makeSupabaseMock({
      profiles: [makeProfile({ id: "coach-1", role: "coach" }), makeProfile({ id: "athlete-1" })],
      programs: [{ owner_id: "coach-1" }, { owner_id: "coach-1" }, { owner_id: "athlete-1" }],
      logs: [
        { athlete_id: "athlete-1", performed_on: "2026-07-01", skipped: false },
        { athlete_id: "athlete-1", performed_on: "2026-07-20", skipped: false },
        { athlete_id: "athlete-1", performed_on: "2026-07-25", skipped: true },
      ],
    });

    const roster = await getAdminRoster(supabase as never);

    const coach = roster.find((r) => r.id === "coach-1")!;
    const athlete = roster.find((r) => r.id === "athlete-1")!;
    expect(coach.programsCreated).toBe(2);
    expect(coach.sessionCount).toBe(0);
    expect(athlete.programsCreated).toBe(1);
    expect(athlete.sessionCount).toBe(2);
    expect(athlete.lastActiveOn).toBe("2026-07-20");
  });

  it("excludes skipped sessions from both the count and the last-active date", async () => {
    const supabase = makeSupabaseMock({
      profiles: [makeProfile({ id: "athlete-1" })],
      programs: [],
      logs: [
        { athlete_id: "athlete-1", performed_on: "2026-07-01", skipped: false },
        { athlete_id: "athlete-1", performed_on: "2026-07-26", skipped: true },
      ],
    });

    const roster = await getAdminRoster(supabase as never);

    expect(roster[0]!.sessionCount).toBe(1);
    expect(roster[0]!.lastActiveOn).toBe("2026-07-01");
  });

  it("surfaces the is_admin flag as isAdmin", async () => {
    const supabase = makeSupabaseMock({
      profiles: [makeProfile({ id: "admin-1", is_admin: true })],
      programs: [],
      logs: [],
    });

    const roster = await getAdminRoster(supabase as never);

    expect(roster[0]!.isAdmin).toBe(true);
  });

  it("surfaces the beta_build_for_me flag as betaBuildForMe", async () => {
    const supabase = makeSupabaseMock({
      profiles: [makeProfile({ id: "beta-1", beta_build_for_me: true })],
      programs: [],
      logs: [],
    });

    const roster = await getAdminRoster(supabase as never);

    expect(roster[0]!.betaBuildForMe).toBe(true);
  });
});
