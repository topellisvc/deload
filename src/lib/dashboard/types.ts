import type { DayRow, ProgramTree } from "@/lib/programs/types";

/**
 * "Today's" slot in a program isn't calendar-mapped (Day 1/Day 2/Day 3...,
 * not Monday/Tuesday), so it's derived rather than stored: the next
 * training day after whichever one was most recently logged, or day 1 of
 * week 1 if nothing's been logged yet. If that computed day was already
 * logged earlier today, it stays "today's" day (just marked complete)
 * instead of immediately jumping to the next one — see
 * resolveTodayWorkout in queries.ts.
 */
export interface TodayWorkout {
  weekId: string;
  weekLabel: string;
  weekPosition: number;
  totalWeeks: number;
  day: DayRow;
  completedToday: boolean;
  completedAt: string | null;
  /** True if the athlete has an in-progress Training Mode draft for this
   * exact day — the Hero/day buttons read "Continue training" instead of
   * "Start workout" when this is set. */
  hasDraft: boolean;
  /** False when this object represents a day the athlete has browsed to via
   * the dashboard's prev/next arrows rather than the auto-resolved "today"
   * pointer (see resolveTodayWorkout in queries.ts). completionPercent,
   * consistencyPercent, and upcoming are always anchored to the real today
   * regardless of what's being browsed. */
  isRealToday: boolean;
  /** Adjacent scheduled days for the dashboard's browse arrows — null at
   * either end of the program. */
  prevDayId: string | null;
  nextDayId: string | null;
}

export interface UpcomingSession {
  dayId: string;
  dayLabel: string;
  weekLabel: string;
}

/**
 * Everything the dashboard derives from a single Active Program + its
 * session logs, fetched together so today's workout, completion %,
 * consistency %, and upcoming sessions never disagree with each other
 * about what "today" means. `today` is null only when the program has no
 * days at all (e.g. mid-setup).
 */
export interface ActiveProgramContext {
  program: ProgramTree;
  today: TodayWorkout | null;
  /** Distinct logged non-rest days / total non-rest days, whole program. Null if the program has no non-rest days. */
  completionPercent: number | null;
  /** Sessions logged in the last 28 days vs. the program's own non-rest-day cadence, capped at 100. Null if the program has no non-rest days. */
  consistencyPercent: number | null;
  upcoming: UpcomingSession[];
}

export interface DashboardStats {
  currentStreak: number;
  sessionCount: number;
  programsCreated: number;
  completionPercent: number | null;
  consistencyPercent: number | null;
}

/**
 * Discriminated union so Recent Activity can grow new event types (program
 * edits, coach messages, PR hits) without changing the shape callers
 * already handle — only `session_log` and `coach_interaction` are actually
 * emitted today, since those are the only ones backed by real data.
 */
export type ActivityEvent =
  | { type: "session_log"; id: string; occurredAt: string; dayLabel: string; programName: string; skipped: boolean }
  | { type: "coach_interaction"; id: string; occurredAt: string; detail: string };
