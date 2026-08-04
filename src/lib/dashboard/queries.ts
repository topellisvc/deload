import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveProgram } from "@/lib/programs/queries";
import { getMyStats } from "@/lib/profile/queries";
import { getDraftSessionDayIds } from "@/lib/training/queries";
import type { UserRole } from "@/lib/supabase/types";
import { flattenProgramDays, resolveDisplayedDay, resolveDayIndex, type DayStatus } from "@/lib/dashboard/day-view";
import type {
  ActiveProgramContext,
  ActivityEvent,
  DashboardStats,
  UpcomingSession,
  WeeklyTrainingSummary,
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
  userId: string,
  /** A specific training day to display instead of the auto-resolved
   * "today" — set when the athlete uses the dashboard's prev/next browse
   * arrows (see resolveViewedDay/ProgramNavArrows). Ignored if it doesn't
   * belong to the active program. completionPercent/consistencyPercent/
   * upcoming are always computed from the real today, never the browsed
   * day, so browsing never skews stats. */
  viewedDayId?: string | null
): Promise<ActiveProgramContext | null> {
  const program = await getActiveProgram(supabase, userId);
  if (!program) return null;

  const flat = flattenProgramDays(program.weeks);
  if (flat.length === 0) {
    return { program, today: null, completionPercent: null, consistencyPercent: null, upcoming: [], todayIndex: 0, dayStatusById: {} };
  }

  const dayIds = flat.map((f) => f.day.id);
  const { data: logsData } = await supabase
    .from("session_logs")
    .select("training_day_id, performed_on, created_at, completed_at, skipped")
    .in("training_day_id", dayIds)
    .order("performed_on", { ascending: false })
    .order("created_at", { ascending: false });
  const logs = (logsData ?? []) as {
    training_day_id: string;
    performed_on: string;
    created_at: string;
    completed_at: string | null;
    skipped: boolean;
  }[];

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
  if (mostRecentLog && mostRecentLog.performed_on === today && !mostRecentLog.skipped) {
    todayIndex = mostRecentIndex;
  } else if (mostRecentIndex >= 0) {
    todayIndex = Math.min(mostRecentIndex + 1, flat.length - 1);
  } else {
    todayIndex = 0;
  }

  // The day actually being DISPLAYED on this initial load — either the
  // auto-resolved pointer above, or a day the athlete had browsed to before
  // a full page reload (deep link/refresh). Falls back to the auto pointer
  // if the requested id isn't in this program (e.g. stale link after
  // switching programs). Browsing after this point happens entirely
  // client-side — see day-view.ts's own doc comment.
  const displayIndex = resolveDayIndex(flat, viewedDayId, todayIndex);

  const draftDayIds = await getDraftSessionDayIds(supabase, dayIds, userId);

  // Every day's completed/draft status, not just the displayed one — this
  // is what makes client-side day-browsing possible with zero further
  // queries (see ActiveProgramContext.dayStatusById's own doc comment).
  // logs is already ordered performed_on desc, created_at desc, so the
  // FIRST log seen per training_day_id is that day's most recent one.
  const mostRecentLogByDay = new Map<string, (typeof logs)[number]>();
  for (const log of logs) {
    if (!mostRecentLogByDay.has(log.training_day_id)) mostRecentLogByDay.set(log.training_day_id, log);
  }
  const dayStatusById: Record<string, DayStatus> = {};
  for (const { day } of flat) {
    const mostRecentForDay = mostRecentLogByDay.get(day.id) ?? null;
    dayStatusById[day.id] = {
      completedAt: mostRecentForDay && !mostRecentForDay.skipped ? (mostRecentForDay.completed_at ?? mostRecentForDay.created_at) : null,
      hasDraft: draftDayIds.has(day.id),
    };
  }

  const todayWorkout = resolveDisplayedDay({ flat, totalWeeks: program.weeks.length, displayIndex, todayIndex, dayStatusById });

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

  return { program, today: todayWorkout, completionPercent, consistencyPercent, upcoming, todayIndex, dayStatusById };
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
// This week's real training numbers (stat cluster + volume chart)
// ============================================================

/**
 * Powers the dashboard's "This Week" stat cards and Weekly Volume chart —
 * see WeeklyTrainingSummary's own doc comment for why every field uses the
 * same rolling-7-day window. Two queries: session_logs (which days, whether
 * skipped) and logged_sets (what was actually performed) for those logs —
 * same two tables getRecentActivity and getActiveProgramContext already
 * read, just scoped to the last 7 days and joined down to the set level,
 * which neither of those needed to do.
 */
export async function getWeeklyTrainingSummary(
  supabase: SupabaseClient,
  userId: string,
  activeContext: ActiveProgramContext | null
): Promise<WeeklyTrainingSummary> {
  const today = todayDateString();
  const windowStart = shiftDate(today, -6);

  let workoutsScheduledThisWeek: number | null = null;
  if (activeContext) {
    const nonRestDayCount = activeContext.program.weeks.reduce(
      (n, w) => n + w.days.filter((d) => !d.is_rest_day).length,
      0
    );
    if (nonRestDayCount > 0) {
      const avgNonRestPerWeek = nonRestDayCount / (activeContext.program.weeks.length || 1);
      workoutsScheduledThisWeek = Math.round(avgNonRestPerWeek);
    }
  }

  const { data: logsData } = await supabase
    .from("session_logs")
    .select("id, training_day_id, performed_on, skipped")
    .eq("athlete_id", userId)
    .gte("performed_on", windowStart)
    .order("performed_on", { ascending: true });
  const logs = (logsData ?? []) as { id: string; training_day_id: string; performed_on: string; skipped: boolean }[];
  const trainedLogs = logs.filter((l) => !l.skipped);

  const dailyVolume = new Map<string, number>();
  for (let i = 0; i < 7; i++) dailyVolume.set(shiftDate(windowStart, i), 0);

  const workoutsThisWeek = new Set(trainedLogs.map((l) => l.training_day_id)).size;

  if (trainedLogs.length === 0) {
    return {
      workoutsThisWeek: 0,
      workoutsScheduledThisWeek,
      volumeThisWeekKg: 0,
      avgRpeThisWeek: null,
      dailyVolumeKg: Array.from(dailyVolume.entries()).map(([date, volumeKg]) => ({ date, volumeKg })),
    };
  }

  const sessionLogIds = trainedLogs.map((l) => l.id);
  const performedOnByLogId = new Map(trainedLogs.map((l) => [l.id, l.performed_on]));

  const { data: setsData } = await supabase
    .from("logged_sets")
    .select("session_log_id, performed_weight, performed_reps, performed_rpe")
    .in("session_log_id", sessionLogIds);
  const sets = (setsData ?? []) as {
    session_log_id: string;
    performed_weight: number | null;
    performed_reps: number | null;
    performed_rpe: number | null;
  }[];

  let volumeThisWeekKg = 0;
  let rpeSum = 0;
  let rpeCount = 0;
  for (const set of sets) {
    if (set.performed_weight != null && set.performed_reps != null) {
      const vol = set.performed_weight * set.performed_reps;
      volumeThisWeekKg += vol;
      const date = performedOnByLogId.get(set.session_log_id);
      if (date && dailyVolume.has(date)) dailyVolume.set(date, (dailyVolume.get(date) ?? 0) + vol);
    }
    if (set.performed_rpe != null) {
      rpeSum += set.performed_rpe;
      rpeCount += 1;
    }
  }

  return {
    workoutsThisWeek,
    workoutsScheduledThisWeek,
    volumeThisWeekKg: Math.round(volumeThisWeekKg),
    avgRpeThisWeek: rpeCount > 0 ? Math.round((rpeSum / rpeCount) * 10) / 10 : null,
    dailyVolumeKg: Array.from(dailyVolume.entries()).map(([date, volumeKg]) => ({ date, volumeKg: Math.round(volumeKg) })),
  };
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

  // New 1RM events — straight from exercise_max_records (migration 0054),
  // the same append-only "library of maxes" table both a logged max-test
  // set and a coach's manually-entered known max write to (see
  // lib/programs/mutations.ts's saveKnownExerciseMax and
  // lib/training/mutations.ts's saveMaxTestRecords). Either source shows up
  // here identically — this is "a new max got recorded," not "a testing
  // week set got logged."
  const { data: maxTestsData } = await supabase
    .from("exercise_max_records")
    .select("id, exercise_id, estimated_1rm_kg, created_at")
    .eq("athlete_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);
  const maxTests = (maxTestsData ?? []) as { id: string; exercise_id: string; estimated_1rm_kg: number; created_at: string }[];
  if (maxTests.length > 0) {
    const exerciseIds = Array.from(new Set(maxTests.map((m) => m.exercise_id)));
    const { data: exercisesData } = await supabase.from("exercises").select("id, name").in("id", exerciseIds);
    const exerciseNameById = new Map(((exercisesData ?? []) as { id: string; name: string }[]).map((e) => [e.id, e.name]));
    for (const m of maxTests) {
      events.push({
        type: "max_test",
        id: m.id,
        occurredAt: m.created_at,
        exerciseName: exerciseNameById.get(m.exercise_id) ?? "an exercise",
        estimated1RMKg: m.estimated_1rm_kg,
      });
    }
  }

  events.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
  return events.slice(0, 8);
}
