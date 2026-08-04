import type { DayRow, ProgramTree } from "@/lib/programs/types";
import type { DayStatus } from "@/lib/dashboard/day-view";

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
  /** This day's position among the *non-rest* training sessions in its
   * week (1-based) and how many such sessions that week has in total —
   * e.g. "Session 2 of 3" for the second day of a push/pull/legs week.
   * sessionPosition is null when the displayed day is itself a rest day
   * (there's nothing to number) or the week has no non-rest days. */
  sessionPosition: number | null;
  sessionsInWeek: number | null;
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
  /** The auto-resolved "today" pointer's index into the program's flattened
   * (week, day) list (see day-view.ts's flattenProgramDays) — exposed so
   * the dashboard's day-browsing can tell "is this the real today" and
   * clamp prev/next locally, without a server round trip per click. */
  todayIndex: number;
  /** Every day in the program's completed/draft status, keyed by day id —
   * built once from data this function already fetches (session_logs,
   * training_mode_sessions), not a new query. Combined with `program` and
   * `todayIndex`, this is everything day-view.ts's resolveDisplayedDay
   * needs to build a TodayWorkout for ANY day in the program — which is
   * what lets DashboardContent (the dashboard page's client component)
   * browse days entirely client-side, instantly, instead of the old
   * `?day=<id>` navigation that re-ran this whole function on every click. */
  dayStatusById: Record<string, DayStatus>;
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
 * already handle — `session_log`, `coach_interaction`, and `max_test` are
 * emitted today, all backed by real data (max_test straight from
 * exercise_max_records, migration 0054 — see getRecentActivity).
 */
export type ActivityEvent =
  | { type: "session_log"; id: string; occurredAt: string; dayLabel: string; programName: string; skipped: boolean }
  | { type: "coach_interaction"; id: string; occurredAt: string; detail: string }
  | { type: "max_test"; id: string; occurredAt: string; exerciseName: string; estimated1RMKg: number };

/**
 * Real "this week" training numbers for the dashboard's stat cluster and
 * volume chart — see getWeeklyTrainingSummary. Deliberately a rolling last
 * 7 calendar days for every field (workouts, volume, avg RPE, the daily
 * chart) rather than mixing that with the app's other "current program
 * week" concept (completionPercent/consistencyPercent's week) — a program
 * week isn't calendar-anchored, so a single consistent 7-day window is
 * easier to reason about than two different "week"s on the same card.
 */
export interface WeeklyTrainingSummary {
  /** Distinct non-rest training days logged (not skipped), last 7 days. */
  workoutsThisWeek: number;
  /** The active program's own average non-rest days per week, rounded —
   * same cadence math consistencyPercent already derives (avgNonRestPerWeek
   * in getActiveProgramContext), just read as "sessions a typical week
   * calls for" instead of folded into a ratio. Null with no active program. */
  workoutsScheduledThisWeek: number | null;
  /** Sum of performed_weight * performed_reps across every logged set, last
   * 7 days — the athlete's own reported performance (logged_sets, migration
   * 0012), not an estimate. */
  volumeThisWeekKg: number;
  /** Average performed_rpe across sets that reported one, last 7 days. Null
   * if nothing in the window reported an RPE (e.g. an all-RIR program). */
  avgRpeThisWeek: number | null;
  /** One entry per of the last 7 calendar days, oldest first. */
  dailyVolumeKg: { date: string; volumeKg: number }[];
}
