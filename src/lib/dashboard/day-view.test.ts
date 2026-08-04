import { describe, it, expect } from "vitest";
import { flattenProgramDays, resolveDayIndex, resolveDisplayedDay } from "./day-view";
import type { DayRow, WeekRow } from "@/lib/programs/types";

/** Minimal week/day fixtures — only the fields resolveDisplayedDay actually
 * reads (id, label, position, is_rest_day, and a week's own days list). */
function makeWeek(position: number, days: { id: string; isRestDay?: boolean }[]): WeekRow {
  return {
    id: `week-${position}`,
    label: null,
    position,
    days: days.map((d, i) => ({
      id: d.id,
      label: null,
      position: i + 1,
      is_rest_day: d.isRestDay ?? false,
      blocks: [],
    })) as unknown as DayRow[],
  } as unknown as WeekRow;
}

describe("flattenProgramDays", () => {
  it("preserves week and day order", () => {
    const weeks = [makeWeek(1, [{ id: "w1d1" }, { id: "w1d2" }]), makeWeek(2, [{ id: "w2d1" }])];
    const flat = flattenProgramDays(weeks);
    expect(flat.map((f) => f.day.id)).toEqual(["w1d1", "w1d2", "w2d1"]);
  });
});

describe("resolveDisplayedDay", () => {
  const weeks = [
    makeWeek(1, [{ id: "w1d1" }, { id: "w1d2", isRestDay: true }, { id: "w1d3" }]),
    makeWeek(2, [{ id: "w2d1" }]),
  ];
  const flat = flattenProgramDays(weeks);
  // index:            0        1(rest)  2        3

  it("returns null for an out-of-range index (e.g. an empty program)", () => {
    expect(resolveDisplayedDay({ flat: [], totalWeeks: 0, displayIndex: 0, todayIndex: 0, dayStatusById: {} })).toBeNull();
  });

  it("sets prevDayId/nextDayId to null at the start/end of the program, and to the neighbor otherwise", () => {
    const first = resolveDisplayedDay({ flat, totalWeeks: 2, displayIndex: 0, todayIndex: 0, dayStatusById: {} });
    expect(first?.prevDayId).toBeNull();
    expect(first?.nextDayId).toBe("w1d2");

    const middle = resolveDisplayedDay({ flat, totalWeeks: 2, displayIndex: 2, todayIndex: 0, dayStatusById: {} });
    expect(middle?.prevDayId).toBe("w1d2");
    expect(middle?.nextDayId).toBe("w2d1");

    const last = resolveDisplayedDay({ flat, totalWeeks: 2, displayIndex: 3, todayIndex: 0, dayStatusById: {} });
    expect(last?.prevDayId).toBe("w1d3");
    expect(last?.nextDayId).toBeNull();
  });

  it("marks isRealToday only when the displayed index matches todayIndex", () => {
    const browsing = resolveDisplayedDay({ flat, totalWeeks: 2, displayIndex: 2, todayIndex: 0, dayStatusById: {} });
    expect(browsing?.isRealToday).toBe(false);

    const real = resolveDisplayedDay({ flat, totalWeeks: 2, displayIndex: 0, todayIndex: 0, dayStatusById: {} });
    expect(real?.isRealToday).toBe(true);
  });

  it("numbers sessionPosition among non-rest days only, and leaves it null on a rest day", () => {
    // Week 1: w1d1 (session 1), w1d2 (rest, unnumbered), w1d3 (session 2).
    const restDay = resolveDisplayedDay({ flat, totalWeeks: 2, displayIndex: 1, todayIndex: 0, dayStatusById: {} });
    expect(restDay?.sessionPosition).toBeNull();
    expect(restDay?.sessionsInWeek).toBe(2);

    const secondSession = resolveDisplayedDay({ flat, totalWeeks: 2, displayIndex: 2, todayIndex: 0, dayStatusById: {} });
    expect(secondSession?.sessionPosition).toBe(2);
    expect(secondSession?.sessionsInWeek).toBe(2);
  });

  it("reads completedToday/completedAt/hasDraft straight from dayStatusById, per day", () => {
    const dayStatusById = {
      w1d1: { completedAt: "2026-08-01T12:00:00Z", hasDraft: false },
      w1d3: { completedAt: null, hasDraft: true },
    };

    const completed = resolveDisplayedDay({ flat, totalWeeks: 2, displayIndex: 0, todayIndex: 0, dayStatusById });
    expect(completed?.completedToday).toBe(true);
    expect(completed?.completedAt).toBe("2026-08-01T12:00:00Z");
    expect(completed?.hasDraft).toBe(false);

    const drafted = resolveDisplayedDay({ flat, totalWeeks: 2, displayIndex: 2, todayIndex: 0, dayStatusById });
    expect(drafted?.completedToday).toBe(false);
    expect(drafted?.hasDraft).toBe(true);

    // A day with no entry at all in dayStatusById (never logged, no draft).
    const untouched = resolveDisplayedDay({ flat, totalWeeks: 2, displayIndex: 3, todayIndex: 0, dayStatusById });
    expect(untouched?.completedToday).toBe(false);
    expect(untouched?.hasDraft).toBe(false);
  });
});

describe("resolveDayIndex", () => {
  const flat = [{ day: { id: "a" } }, { day: { id: "b" } }, { day: { id: "c" } }];

  it("finds the index of a given day id", () => {
    expect(resolveDayIndex(flat, "b", 0)).toBe(1);
  });

  it("falls back when the id is null, undefined, or not found in flat", () => {
    expect(resolveDayIndex(flat, null, 2)).toBe(2);
    expect(resolveDayIndex(flat, undefined, 2)).toBe(2);
    expect(resolveDayIndex(flat, "stale-id-from-another-program", 2)).toBe(2);
  });
});
