import type { DayRow, WeekRow } from "@/lib/programs/types";
import type { TodayWorkout } from "@/lib/dashboard/types";

/**
 * Pure, DB-free day-resolution logic — deliberately split out of
 * queries.ts's getActiveProgramContext so the exact same code can run
 * client-side too. Browsing to the next/previous day used to mean a full
 * `?day=<id>` server navigation, which reran getActiveProgramContext's
 * whole ~10-round-trip chain (most of it — the program tree, every stat on
 * the page — completely unrelated to which day is displayed) just to swap
 * one day for an adjacent one. Every input these functions need
 * (the program tree, and a per-day completed/draft status map) is already
 * fetched once on the initial page load; DashboardContent (dashboard
 * page's client component) calls resolveDisplayedDay directly on click
 * instead of re-navigating, so browsing days is now instant with zero
 * network round trips. See getActiveProgramContext for the one server-side
 * call site that still builds the *initial* view this way, so both paths
 * share one implementation rather than two that could drift apart.
 */

export interface DayStatus {
  /** This day's own most recent NON-skipped log's completed_at (or
   * created_at if completed_at is null) — null if it's never been logged,
   * or every log for it was skipped. */
  completedAt: string | null;
  /** Whether there's an in-progress Training Mode draft for this day. */
  hasDraft: boolean;
}

export function flattenProgramDays(weeks: WeekRow[]): { week: WeekRow; day: DayRow }[] {
  const flat: { week: WeekRow; day: DayRow }[] = [];
  for (const week of weeks) {
    for (const day of week.days) {
      flat.push({ week, day });
    }
  }
  return flat;
}

/**
 * Builds the TodayWorkout for whichever day is being displayed — the
 * auto-resolved "today" pointer, or a day the athlete has browsed to.
 * `todayIndex` (needed for isRealToday) and `dayStatusById` are computed
 * once by getActiveProgramContext from data it already fetched; this
 * function does no fetching of its own; it's the same object-building logic
 * that used to live inline in that function (see git history), extracted
 * so it can be reused client-side for instant browsing.
 */
export function resolveDisplayedDay(params: {
  flat: { week: WeekRow; day: DayRow }[];
  totalWeeks: number;
  displayIndex: number;
  todayIndex: number;
  dayStatusById: Record<string, DayStatus>;
}): TodayWorkout | null {
  const { flat, totalWeeks, displayIndex, todayIndex, dayStatusById } = params;
  const displayEntry = flat[displayIndex];
  if (!displayEntry) return null;

  const status = dayStatusById[displayEntry.day.id];

  // "Session X of Y" — this day's position among the non-rest training
  // days in its own week, e.g. the 2nd of 3 for the middle day of a
  // push/pull/legs week. Rest days aren't numbered (nothing to train), and
  // a week made up entirely of rest days has no sessions to count either.
  let sessionPosition: number | null = null;
  const weekSessionDays = displayEntry.week.days.filter((d) => !d.is_rest_day);
  const sessionsInWeek = weekSessionDays.length > 0 ? weekSessionDays.length : null;
  if (!displayEntry.day.is_rest_day && sessionsInWeek) {
    const idx = weekSessionDays.findIndex((d) => d.id === displayEntry.day.id);
    sessionPosition = idx >= 0 ? idx + 1 : null;
  }

  return {
    weekId: displayEntry.week.id,
    weekLabel: displayEntry.week.label || `Week ${displayEntry.week.position}`,
    weekPosition: displayEntry.week.position,
    totalWeeks,
    day: displayEntry.day,
    completedToday: status?.completedAt != null,
    completedAt: status?.completedAt ?? null,
    hasDraft: status?.hasDraft ?? false,
    isRealToday: displayIndex === todayIndex,
    prevDayId: flat[displayIndex - 1]?.day.id ?? null,
    nextDayId: flat[displayIndex + 1]?.day.id ?? null,
    sessionPosition,
    sessionsInWeek,
  };
}

/** flat.findIndex for a given day id, or the fallback index if it's not
 * found (e.g. a stale id after switching programs) or not provided at all. */
export function resolveDayIndex(flat: { day: { id: string } }[], dayId: string | null | undefined, fallbackIndex: number): number {
  if (!dayId) return fallbackIndex;
  const index = flat.findIndex((f) => f.day.id === dayId);
  return index >= 0 ? index : fallbackIndex;
}
