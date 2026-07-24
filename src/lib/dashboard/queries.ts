import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveProgram } from "@/lib/programs/queries";
import type { DayRow, WeekRow } from "@/lib/programs/types";
import { getMyStats } from "@/lib/profile/queries";
import type { UserRole } from "@/lib/supabase/types";
import type {
  ActiveProgramContext,
  ActivityEvent,
  DashboardStats,
  TodayWorkout,
  UpcomingSession,
} from "@/lib/dashboard/types";

// getCoachingDashboard moved to @/lib/coaching/queries — it's coaching
// domain data (a coach's client roster), re-exported here only so
// existing imports of it from this file don't need to change.
export { getCoachingDashboard } from "@/lib/coaching/queries";

// ============================================================
// Small local date helpers — same convention as profile/queries.ts and
// ProgramViewer (each file that needs "today" keeps its own tiny copy
// rather than importing a shared util module for a two-line calculation).
// ============================================================

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDate(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + deltaDays));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function daysBetween(earlierIsoDate: string, laterIsoDate: string): number {
  const [y1, m1, d1] = earlierIsoDate.split("-").map(Number);
  const [y2, m2, d2] = laterIsoDate.split("-").map(Number);
  const a = Date.UTC(y1 ?? 1970, (m1 ?? 1) - 1, d1 ?? 1);
  const b = Date.UTC(y2 ?? 1970, (m2 ?? 1) - 1, d2 ?? 1);
  return Math.round((b - a) / 86400000);
}

function flattenProgramDays(weeks: WeekRow[]): { week: WeekRow; day: DayRow }[] {
  const flat: { week: WeekRow; day: DayRow }[] = [];
  for (const week of weeks) {
    for (const day of week.days) {
      flat.push({ week, day });
    }
  }
  return flat;
}

// ============================================================
// Active program context (Hero, Today's Workout, Progress, Upcoming)
// ============================================================

/**
 * Everything the dashboard needs from the Active Program in one place, so
 * "today's workout," completion %, consistency %, and "upcoming" all agree
 * with each other about where the athlete currently is in the program —
 * computing each separately from its own query risked them drifting apart
 * on an edge case (e.g. a log landing exactly on the boundary).
 *
 * Reuses getActiveProgram (programs/queries.ts, itself built on the
 * existing getProgramTree) rather than a second "dashboard program" query.
 */
export async function getActiveProgramContext(
  supabase: SupabaseClient,
  userId: string
): Promise<ActiveProgramContext | null> {
  const program = await getActiveProgram(supabase, userId);
  if (!program) return null;

  const flat = flattenProgramDays(program.weeks);
  if (flat.length === 0) {
    return { program, today: null, completionPercent: null, consistencyPercent: null, upcoming: [] };
  }

  const dayIds = flat.map((f) => f.day.id);
  const { data: logsData } = await supabase
    .from("session_logs")
    .select("training_day_id, performed_on, created_at, skipped")
    .in("training_day_id", dayIds)
    .order("performed_on", { ascending: false })
    .order("created_at", { ascending: false });
  const logs = (logsData ?? []) as { training_day_id: string; performed_on: string; created_at: string; skipped: boolean }[];

  const today = todayDateString();
  const mostRecentLog = logs[0] ?? null;
  const mostRecentIndex = mostRecentLog ? flat.findIndex((f) => f.day.id === mostRecentLog.training_day_id) : -1;

  // If the most recently logged day was logged today, that's still
  // "today's" workout (just completed) — don't advance the pointer until
  // the calendar date actually changes. Otherwise "today" is the day right
  // after whatever was last logged, or day 1 of week 1 if nothing has ever
  // been logged. Clamped to the last day once the program's fully worked
  // through, rather than pointing past the end.
  //
  // A *skipped* log never counts as "stay put, completed today" — the whole
  // point of skipping is to move on right now, not to wait for the
  // calendar date to change (migration 0015).
  let todayIndex: number;
  let completedToday = false;
  let completedAt: string | null = null;
  if (mostRecentLog && mostRecentLog.performed_on === today && !mostRecentLog.skipped) {
    todayIndex = mostRecentIndex;
    completedToday = true;
    completedAt = mostRecentLog.created_at;
  } else if (mostRecentIndex >= 0) {
    todayIndex = Math.min(mostRecentIndex + 1, flat.length - 1);
  } else {
    todayIndex = 0;
  }

  const todayEntry = flat[todayIndex];
  const todayWorkout: TodayWorkout | null = todayEntry
    ? {
        weekId: todayEntry.week.id,
        weekLabel: todayEntry.week.label || `Week ${todayEntry.week.position}`,
        weekPosition: todayEntry.week.position,
        totalWeeks: program.weeks.length,
        day: todayEntry.day,
        completedToday,
        completedAt,
      }
    : null;

  // Skipped days are deliberately excluded from both % figures below — a
  // skip means "didn't train," so it shouldn't inflate completion or
  // consistency the way an actual logged session does.
  const trainedLogs = logs.filter((l) => !l.skipped);

  const nonRestDayIds = new Set(flat.filter((f) => !f.day.is_rest_day).map((f) => f.day.id));
  const distinctLoggedNonRest = new Set(trainedLogs.map((l) => l.training_day_id).filter((id) => nonRestDayIds.has(id)));
  const completionPercent =
    nonRestDayIds.size > 0 ? Math.round((distinctLoggedNonRest.size / nonRestDayIds.size) * 100) : null;

  // Consistency %: sessions actually logged in the last 28 days against
  // what the program's own cadence would expect in that window (its
  // average non-rest days per week × 4) — a measure of recent adherence,
  // distinct from completionPercent's whole-program progress.
  let consistencyPercent: number | null = null;
  if (nonRestDayIds.size > 0) {
    const avgNonRestPerWeek = nonRestDayIds.size / (program.weeks.length || 1);
    const expectedLast28Days = avgNonRestPerWeek * 4;
    const cutoff28 = shiftDate(today, -28);
    const loggedLast28Days = new Set(
      trainedLogs.filter((l) => l.performed_on >= cutoff28 && nonRestDayIds.has(l.training_day_id)).map((l) => l.training_day_id)
    ).size;
    consistencyPercent = expectedLast28Days > 0 ? Math.min(100, Math.round((loggedLast28Days / expectedLast28Days) * 100)) : null;
  }

  const upcoming: UpcomingSession[] = flat
    .slice(todayIndex + 1)
    .filter((f) => !f.day.is_rest_day)
    .slice(0, 3)
    .map((f) => ({
      dayId: f.day.id,
      dayLabel: f.day.label || `Day ${f.day.position}`,
      weekLabel: f.week.label || `Week ${f.week.position}`,
    }));

  return { program, today: todayWorkout, completionPercent, consistencyPercent, upcoming };
}

// ============================================================
// Training snapshot stats
// ============================================================

/**
 * Merges the existing profile stats (streak/sessions/programs — already
 * built and used by /profile, not re-derived here) with the Active
 * Program's completion/consistency %, which only the dashboard's Active
 * Program context can compute.
 */
export async function getDashboardStats(
  supabase: SupabaseClient,
  userId: string,
  role: UserRole,
  activeContext: ActiveProgramContext | null
): Promise<DashboardStats> {
  const stats = await getMyStats(supabase, userId, role);
  return {
    currentStreak: stats.currentStreak,
    sessionCount: stats.sessionCount,
    programsCreated: stats.programsCreated,
    completionPercent: activeContext?.completionPercent ?? null,
    consistencyPercent: activeContext?.consistencyPercent ?? null,
  };
}

/** Sessions in the last 14 days vs. the 14 days before that, plus days
 * since the most recent session — feeds Evidence Insights. A dedicated
 * lightweight fetch (capped at 60 rows, well over 28 days of daily
 * training) rather than reusing getMyStats's capped-400 fetch, since that
 * function doesn't expose the raw date list. */
export async function getRecentSessionActivity(
  supabase: SupabaseClient,
  userId: string
): Promise<{ sessionsLast14Days: number; sessionsPrevious14Days: number; daysSinceLastSession: number | null }> {
  const { data } = await supabase
    .from("session_logs")
    .select("performed_on, skipped")
    .eq("athlete_id", userId)
    .order("performed_on", { ascending: false })
    .limit(60);
  // Skipped days shouldn't count as training activity for these insights.
  const dates = ((data ?? []) as { performed_on: string; skipped: boolean }[]).filter((d) => !d.skipped).map((d) => d.performed_on);
  if (dates.length === 0) {
    return { sessionsLast14Days: 0, sessionsPrevious14Days: 0, daysSinceLastSession: null };
  }

  const today = todayDateString();
  const cutoff14 = shiftDate(today, -14);
  const cutoff28 = shiftDate(today, -28);
  const sessionsLast14Days = dates.filter((d) => d >= cutoff14).length;
  const sessionsPrevious14Days = dates.filter((d) => d >= cutoff28 && d < cutoff14).length;
  const mostRecent = dates[0] as string;

  return { sessionsLast14Days, sessionsPrevious14Days, daysSinceLastSession: daysBetween(mostRecent, today) };
}

// ============================================================
// Recent activity (own logs + own coach relationships starting)
// ============================================================

/**
 * The signed-in user's own recent activity — not a client's, that's
 * getCoachingDashboard below. Two real event sources today (session logs,
 * coach relationships starting); program-change and richer coach
 * interaction events can slot into the same ActivityEvent union later
 * without touching this function's callers.
 */
export async function getRecentActivity(supabase: SupabaseClient, userId: string): Promise<ActivityEvent[]> {
  const { data: logsData } = await supabase
    .from("session_logs")
    .select("id, training_day_id, performed_on, created_at, skipped")
    .eq("athlete_id", userId)
    .order("performed_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(8);
  const logs = (logsData ?? []) as { id: string; training_day_id: string; performed_on: string; created_at: string; skipped: boolean }[];

  const events: ActivityEvent[] = [];

  if (logs.length > 0) {
    const dayIds = logs.map((l) => l.training_day_id);
    const { data: daysData } = await supabase.from("training_days").select("id, label, position, week_id").in("id", dayIds);
    const days = (daysData ?? []) as { id: string; label: string | null; position: number; week_id: string }[];
    const weekIds = Array.from(new Set(days.map((d) => d.week_id)));

    const { data: weeksData } = weekIds.length
      ? await supabase.from("program_weeks").select("id, program_id").in("id", weekIds)
      : { data: [] };
    const weeks = (weeksData ?? []) as { id: string; program_id: string }[];
    const programIds = Array.from(new Set(weeks.map((w) => w.program_id)));

    const { data: programsData } = programIds.length
      ? await supabase.from("programs").select("id, name").in("id", programIds)
      : { data: [] };
    const programs = (programsData ?? []) as { id: string; name: string }[];

    const dayById = new Map(days.map((d) => [d.id, d]));
    const weekById = new Map(weeks.map((w) => [w.id, w]));
    const programById = new Map(programs.map((p) => [p.id, p]));

    for (const log of logs) {
      const day = dayById.get(log.training_day_id);
      const week = day ? weekById.get(day.week_id) : undefined;
      const program = week ? programById.get(week.program_id) : undefined;
      events.push({
        type: "session_log",
        id: log.id,
        occurredAt: log.created_at,
        dayLabel: day?.label || `Day ${day?.position ?? "?"}`,
        programName: program?.name ?? "a program",
        skipped: log.skipped,
      });
    }
  }

  const { data: relationshipsData } = await supabase
    .from("coach_clients")
    .select("id, coach_email, created_at")
    .eq("client_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(3);
  const relationships = (relationshipsData ?? []) as { id: string; coach_email: string; created_at: string }[];
  for (const rel of relationships) {
    events.push({
      type: "coach_interaction",
      id: rel.id,
      occurredAt: rel.created_at,
      detail: `Started training with ${rel.coach_email}`,
    });
  }

  events.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
  return events.slice(0, 8);
}
