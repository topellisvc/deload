import { describe, it, expect } from "vitest";
import { getWeeklyTrainingSummary } from "./queries";
import type { ActiveProgramContext } from "./types";

/** Minimal stand-in for Supabase's chainable, thenable query builder — same
 * shape lib/profile/queries.test.ts's own makeBuilder uses, extended with
 * `gte` since getWeeklyTrainingSummary's session_logs query needs it. */
function makeBuilder(result: { data: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "in", "order"]) {
    builder[method] = () => builder;
  }
  builder.then = (resolve: (v: typeof result) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDate(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + deltaDays));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/** Only the fields getWeeklyTrainingSummary actually reads (weeks/days'
 * is_rest_day, weeks.length) — ActiveProgramContext/ProgramTree pull in a
 * lot of unrelated required DB-row fields that don't matter here. */
function makeActiveContext(weeks: { dayCount: number; restDayCount: number }[]): ActiveProgramContext {
  return {
    program: {
      weeks: weeks.map((w, i) => ({
        id: `week-${i}`,
        days: Array.from({ length: w.dayCount }, (_, d) => ({
          id: `week-${i}-day-${d}`,
          is_rest_day: d < w.restDayCount,
        })),
      })),
    },
  } as unknown as ActiveProgramContext;
}

describe("getWeeklyTrainingSummary", () => {
  it("returns a zeroed 7-day window with no scheduled cadence when there's no active program and nothing logged", async () => {
    const supabase = { from: () => makeBuilder({ data: [] }) };

    const summary = await getWeeklyTrainingSummary(supabase as never, "athlete-1", null);

    expect(summary.workoutsThisWeek).toBe(0);
    expect(summary.workoutsScheduledThisWeek).toBeNull();
    expect(summary.volumeThisWeekKg).toBe(0);
    expect(summary.avgRpeThisWeek).toBeNull();
    expect(summary.dailyVolumeKg).toHaveLength(7);
    expect(summary.dailyVolumeKg.every((d) => d.volumeKg === 0)).toBe(true);
    // Oldest first, ending on today — not some arbitrary order.
    expect(summary.dailyVolumeKg[6]!.date).toBe(todayDateString());
    expect(summary.dailyVolumeKg[0]!.date).toBe(shiftDate(todayDateString(), -6));
  });

  it("derives workoutsScheduledThisWeek from the active program's own average non-rest days per week", async () => {
    // 2 weeks, 5 non-rest days each (out of 7) -> average 5/week.
    const activeContext = makeActiveContext([
      { dayCount: 7, restDayCount: 2 },
      { dayCount: 7, restDayCount: 2 },
    ]);
    const supabase = { from: () => makeBuilder({ data: [] }) };

    const summary = await getWeeklyTrainingSummary(supabase as never, "athlete-1", activeContext);

    expect(summary.workoutsScheduledThisWeek).toBe(5);
  });

  it("sums volume onto the right day and only averages RPE across sets that reported one", async () => {
    const today = todayDateString();
    const yesterday = shiftDate(today, -1);

    const logs = [
      { id: "log-1", training_day_id: "day-a", performed_on: yesterday, skipped: false },
      { id: "log-2", training_day_id: "day-b", performed_on: today, skipped: false },
      // Skipped days don't count toward workoutsThisWeek or contribute sets.
      { id: "log-skipped", training_day_id: "day-c", performed_on: today, skipped: true },
    ];
    const sets = [
      // log-1 (yesterday): 100kg x 5 = 500kg, RPE 8
      { session_log_id: "log-1", performed_weight: 100, performed_reps: 5, performed_rpe: 8 },
      // log-2 (today): 50kg x 10 = 500kg, no RPE reported
      { session_log_id: "log-2", performed_weight: 50, performed_reps: 10, performed_rpe: null },
      // A bodyweight/cardio-style row with no weight — shouldn't blow up or
      // silently count as 0 volume with a false weight of 0; just skipped.
      { session_log_id: "log-2", performed_weight: null, performed_reps: 12, performed_rpe: 6 },
    ];

    const supabase = {
      from: (table: string) => {
        if (table === "session_logs") return makeBuilder({ data: logs });
        if (table === "logged_sets") return makeBuilder({ data: sets });
        throw new Error(`unexpected table: ${table}`);
      },
    };

    const summary = await getWeeklyTrainingSummary(supabase as never, "athlete-1", null);

    expect(summary.workoutsThisWeek).toBe(2); // day-a + day-b, day-c excluded (skipped)
    expect(summary.volumeThisWeekKg).toBe(1000); // 500 + 500, the null-weight row contributes 0
    // Only the RPE-8 and RPE-6 sets count: (8 + 6) / 2 = 7.
    expect(summary.avgRpeThisWeek).toBe(7);

    const byDate = new Map(summary.dailyVolumeKg.map((d) => [d.date, d.volumeKg]));
    expect(byDate.get(yesterday)).toBe(500);
    expect(byDate.get(today)).toBe(500);
  });
});
