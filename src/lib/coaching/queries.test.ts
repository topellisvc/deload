import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCoachingDashboard } from "./queries";
import { getActiveProgram } from "@/lib/programs/queries";
import type { ProgramTree } from "@/lib/programs/types";
import type { CoachClient } from "@/lib/supabase/types";

vi.mock("@/lib/programs/queries", () => ({ getActiveProgram: vi.fn() }));

function makeClient(overrides: Partial<CoachClient> = {}): CoachClient {
  return {
    id: `cc-${overrides.client_id ?? "x"}`,
    coach_id: "coach-1",
    client_id: "client-1",
    client_email: "client@example.com",
    coach_email: "coach@example.com",
    status: "active",
    invite_message: null,
    accepted_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** A single training day with a given id, wrapped in a minimal one-week
 * ProgramTree — just enough shape for computeAdherence to run against. */
function makeOneDayProgram(dayId: string, isRestDay = false): ProgramTree {
  return {
    id: `prog-${dayId}`,
    owner_id: "coach-1",
    athlete_id: "whoever",
    name: "Some Program",
    discipline: "resistance",
    is_active: true,
    removed_by_athlete_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    weeks: [
      {
        id: "week-1",
        program_id: `prog-${dayId}`,
        position: 1,
        label: "Week 1",
        based_on_week_id: null,
        created_at: "2026-01-01T00:00:00.000Z",
        days: [{ id: dayId, week_id: "week-1", position: 1, label: "Day 1", is_rest_day: isRestDay, blocks: [] }],
      },
    ],
  };
}

/**
 * Combined mock: coach_clients (the roster), a bulk session_logs query
 * keyed by athlete_id (lastActivityByClient), a bulk programs query keyed
 * by athlete_id (activeProgramByClient), and a second, differently-keyed
 * session_logs query (by training_day_id) that getClientAdherence issues
 * per client — distinguished by which field name `.in()` was called with,
 * since both share the same `session_logs` table.
 */
function makeSupabaseMock(opts: {
  clients: CoachClient[];
  logsByAthlete: { athlete_id: string; performed_on: string }[];
  activePrograms: { athlete_id: string; name: string }[];
  logsByTrainingDay: { training_day_id: string; performed_on: string; skipped: boolean }[];
}) {
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "coach_clients") {
        return { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: opts.clients }) }) }) };
      }
      if (table === "programs") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: (_field: string, ids: string[]) =>
                  Promise.resolve({ data: opts.activePrograms.filter((p) => ids.includes(p.athlete_id)) }),
              }),
            }),
          }),
        };
      }
      if (table === "session_logs") {
        // Thenable builder: resolves whichever dataset matches the field
        // name most recently passed to `.in()`, regardless of how many
        // more chain calls (.order/.limit) follow.
        let filtered: unknown[] = [];
        const builder = {
          select: () => builder,
          order: () => builder,
          limit: () => builder,
          in(field: string, ids: string[]) {
            if (field === "athlete_id") {
              filtered = opts.logsByAthlete.filter((l) => ids.includes(l.athlete_id));
            } else {
              filtered = opts.logsByTrainingDay.filter((l) => ids.includes(l.training_day_id));
            }
            return builder;
          },
          then(resolve: (v: { data: unknown[] }) => void) {
            resolve({ data: filtered });
          },
        };
        return builder;
      }
      throw new Error(`Unexpected table in test: ${table}`);
    }),
  };
  return supabase;
}

describe("getCoachingDashboard", () => {
  beforeEach(() => {
    vi.mocked(getActiveProgram).mockReset();
  });

  it("computes completion/consistency % for a client whose active program this coach owns", async () => {
    vi.mocked(getActiveProgram).mockResolvedValue(makeOneDayProgram("day-1"));
    const supabase = makeSupabaseMock({
      clients: [makeClient({ id: "cc-1", client_id: "client-1", client_email: "client1@example.com" })],
      logsByAthlete: [{ athlete_id: "client-1", performed_on: "2026-07-20" }],
      activePrograms: [{ athlete_id: "client-1", name: "5K Base Builder" }],
      // One completed (non-skipped) log against the program's one non-rest
      // day -> 100% completion; also within the last 28 days.
      logsByTrainingDay: [{ training_day_id: "day-1", performed_on: "2026-07-20", skipped: false }],
    });

    const result = await getCoachingDashboard(supabase as never, "coach-1");

    expect(result.clients).toHaveLength(1);
    expect(result.clients[0]).toMatchObject({
      clientId: "client-1",
      activeProgramName: "5K Base Builder",
      completionPercent: 100,
    });
    expect(result.clients[0]!.consistencyPercent).not.toBeNull();
  });

  it("leaves completion/consistency null when this coach has no visible active program for the client", async () => {
    vi.mocked(getActiveProgram).mockResolvedValue(null);
    const supabase = makeSupabaseMock({
      clients: [makeClient({ id: "cc-1", client_id: "client-1" })],
      logsByAthlete: [],
      activePrograms: [],
      logsByTrainingDay: [],
    });

    const result = await getCoachingDashboard(supabase as never, "coach-1");

    expect(result.clients[0]!.completionPercent).toBeNull();
    expect(result.clients[0]!.consistencyPercent).toBeNull();
    expect(result.clients[0]!.activeProgramName).toBeNull();
  });

  it("sorts clients most-overdue-first: never-trained, then oldest activity, then most recent", async () => {
    vi.mocked(getActiveProgram).mockResolvedValue(null);
    const supabase = makeSupabaseMock({
      clients: [
        makeClient({ id: "cc-recent", client_id: "client-recent", client_email: "recent@example.com" }),
        makeClient({ id: "cc-never", client_id: "client-never", client_email: "never@example.com" }),
        makeClient({ id: "cc-stale", client_id: "client-stale", client_email: "stale@example.com" }),
      ],
      logsByAthlete: [
        { athlete_id: "client-recent", performed_on: "2026-07-24" },
        { athlete_id: "client-stale", performed_on: "2026-06-01" },
        // client-never has no logs at all.
      ],
      activePrograms: [],
      logsByTrainingDay: [],
    });

    const result = await getCoachingDashboard(supabase as never, "coach-1");

    expect(result.clients.map((c) => c.clientId)).toEqual(["client-never", "client-stale", "client-recent"]);
  });

  it("still reports activeClientCount/pendingInviteCount correctly alongside the new per-client fields", async () => {
    vi.mocked(getActiveProgram).mockResolvedValue(null);
    const supabase = makeSupabaseMock({
      clients: [
        makeClient({ id: "cc-1", client_id: "client-1", status: "active" }),
        makeClient({ id: "cc-2", client_id: null, status: "pending", client_email: "invited@example.com" }),
      ],
      logsByAthlete: [],
      activePrograms: [],
      logsByTrainingDay: [],
    });

    const result = await getCoachingDashboard(supabase as never, "coach-1");

    expect(result.activeClientCount).toBe(1);
    expect(result.pendingInviteCount).toBe(1);
  });
});
