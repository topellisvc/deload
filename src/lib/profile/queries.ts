import type { SupabaseClient } from "@supabase/supabase-js";
import { getMyClients, getMyCoaches, getLinkedProfile } from "@/lib/coaching/queries";
import type { PersonalRecord, Profile } from "@/lib/supabase/types";

/** The signed-in user's full profile row, including the personal details
 * shown/edited on /profile. Falls back to a minimal default rather than
 * throwing if the row is somehow missing — the on_auth_user_created
 * trigger always creates one, so this should never actually happen. */
export async function getMyProfileDetails(supabase: SupabaseClient, userId: string): Promise<Profile> {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle<Profile>();
  return (
    data ?? {
      id: userId,
      role: "athlete",
      role_selected: false,
      display_name: null,
      height_value: null,
      height_unit: null,
      weight_value: null,
      weight_unit: null,
      goal: null,
      bio: null,
      date_of_birth: null,
      sex: null,
      experience_level: null,
      training_style: null,
      created_at: new Date().toISOString(),
    }
  );
}

export interface ProfileStats {
  programsCreated: number;
  sessionCount: number;
  currentStreak: number;
  totalWeeksActive: number;
  /** Only meaningful for coaches — null for athletes. */
  activeClientCount: number | null;
}

/** Local calendar date (not UTC), matching the same "today" convention
 * used throughout the app (see DayLogControl, ProgramViewer). */
function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDate(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + deltaDays));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/** Consecutive-day streak ending today or yesterday (so it doesn't reset
 * to zero the instant midnight passes before someone's logged today's
 * session yet) — broken entirely if the most recent log is older than
 * yesterday. */
function computeStreak(distinctDatesDesc: string[]): number {
  if (distinctDatesDesc.length === 0) return 0;
  const today = todayDateString();
  const mostRecent = distinctDatesDesc[0];
  if (mostRecent !== today && mostRecent !== shiftDate(today, -1)) return 0;

  const dateSet = new Set(distinctDatesDesc);
  let streak = 0;
  let cursor = mostRecent;
  while (dateSet.has(cursor)) {
    streak++;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

/** Buckets a date into a 7-day period since the Unix epoch — not aligned
 * to calendar weeks (Mon-Sun), just a cheap, consistent way to count
 * "how many distinct weeks had at least one logged session" without
 * pulling in ISO-week edge cases for a lightweight stat. */
function weekBucket(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Math.floor(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / (7 * 86400000));
}

/**
 * Read-only activity counts shown on the profile dashboard. Streak and
 * weeks-active are both derived from the same capped fetch of this
 * user's logged dates (most recent 400 — well over a year of daily
 * training) rather than two separate queries, since both are just
 * different ways of looking at the same date list.
 */
export async function getMyStats(
  supabase: SupabaseClient,
  userId: string,
  role: "athlete" | "coach"
): Promise<ProfileStats> {
  const [programsResult, logsResult, clientsResult] = await Promise.all([
    supabase.from("programs").select("id", { count: "exact", head: true }).eq("owner_id", userId),
    supabase
      .from("session_logs")
      .select("performed_on, skipped")
      .eq("athlete_id", userId)
      .order("performed_on", { ascending: false })
      .limit(400),
    role === "coach"
      ? supabase
          .from("coach_clients")
          .select("id", { count: "exact", head: true })
          .eq("coach_id", userId)
          .eq("status", "active")
      : Promise.resolve({ count: null }),
  ]);

  // Skipped days aren't training — excluded here so streak, session count,
  // and weeks-active all only ever reflect what was actually done.
  const logDates = ((logsResult.data ?? []) as { performed_on: string; skipped: boolean }[])
    .filter((l) => !l.skipped)
    .map((l) => l.performed_on);
  const distinctDatesDesc = Array.from(new Set(logDates)).sort().reverse();
  const totalWeeksActive = new Set(distinctDatesDesc.map(weekBucket)).size;

  return {
    programsCreated: programsResult.count ?? 0,
    sessionCount: logDates.length,
    currentStreak: computeStreak(distinctDatesDesc),
    totalWeeksActive,
    activeClientCount: role === "coach" ? (clientsResult.count ?? 0) : null,
  };
}

/** The program someone's most recently active on, as the athlete —
 * covers both self-programmed and coach-assigned programs. Used for the
 * Training Snapshot's "Current Program" row. */
export async function getCurrentProgram(
  supabase: SupabaseClient,
  userId: string
): Promise<{ id: string; name: string } | null> {
  const { data } = await supabase
    .from("programs")
    .select("id, name")
    .eq("athlete_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; name: string }>();
  return data ?? null;
}

export interface CoachingSummary {
  activeClients: number;
  pendingInvites: number;
  programsShared: number;
  lastClientActivity: { performedOn: string; clientEmail: string } | null;
}

/**
 * Summary shown on /profile when the signed-in user is a coach. Reuses
 * getMyClients (already fetches every coach_clients row this coach owns)
 * instead of running separate count queries for active/pending, since
 * it's the same underlying data. The "last activity" lookup relies on
 * session_logs RLS to naturally scope results to programs this coach
 * actually owns — querying by client id alone would otherwise return
 * nothing for a client's unrelated self-programmed logs, which is exactly
 * the behavior wanted here.
 */
export async function getCoachingSummary(supabase: SupabaseClient, coachId: string): Promise<CoachingSummary> {
  const clients = await getMyClients(supabase, coachId);
  const activeClients = clients.filter((c) => c.status === "active");
  const pendingInvites = clients.filter((c) => c.status === "pending").length;

  const { count: programsShared } = await supabase
    .from("programs")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", coachId)
    .neq("athlete_id", coachId);

  let lastClientActivity: CoachingSummary["lastClientActivity"] = null;
  const clientIds = activeClients.map((c) => c.client_id).filter((id): id is string => id !== null);
  if (clientIds.length > 0) {
    const { data: recentLog } = await supabase
      .from("session_logs")
      .select("performed_on, athlete_id")
      .in("athlete_id", clientIds)
      .order("performed_on", { ascending: false })
      .limit(1)
      .maybeSingle<{ performed_on: string; athlete_id: string }>();

    if (recentLog) {
      const client = activeClients.find((c) => c.client_id === recentLog.athlete_id);
      lastClientActivity = { performedOn: recentLog.performed_on, clientEmail: client?.client_email ?? "a client" };
    }
  }

  return {
    activeClients: activeClients.length,
    pendingInvites,
    programsShared: programsShared ?? 0,
    lastClientActivity,
  };
}

export interface AthleteSummary {
  coachName: string;
  currentProgram: { id: string; name: string } | null;
  currentWeekLabel: string | null;
  lastWorkoutLoggedOn: string | null;
  /** 0-100, rounded — share of non-rest training days in the current
   * program that have at least one log. Null until there's a current
   * program to measure against. */
  completionPercent: number | null;
}

/**
 * Summary shown on /profile when the signed-in user has an accepted
 * coach relationship. If someone has more than one coach, this uses the
 * most recently formed relationship (getMyCoaches is already ordered
 * newest-first) — a real multi-coach dashboard would need its own
 * picker, out of scope for this page.
 */
export async function getAthleteSummary(supabase: SupabaseClient, userId: string): Promise<AthleteSummary | null> {
  const coaches = await getMyCoaches(supabase, userId);
  const coach = coaches[0];
  if (!coach || !coach.client_id) return null;

  const linkedProfile = await getLinkedProfile(supabase, coach.coach_id);
  const coachName = linkedProfile?.display_name || coach.coach_email;

  const { data: program } = await supabase
    .from("programs")
    .select("id, name")
    .eq("athlete_id", userId)
    .eq("owner_id", coach.coach_id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; name: string }>();

  let currentWeekLabel: string | null = null;
  let lastWorkoutLoggedOn: string | null = null;
  let completionPercent: number | null = null;

  if (program) {
    const { data: weeksData } = await supabase
      .from("program_weeks")
      .select("id, position")
      .eq("program_id", program.id)
      .order("position", { ascending: true });
    const weeks = (weeksData ?? []) as { id: string; position: number }[];
    const weekIds = weeks.map((w) => w.id);

    const { data: daysData } = weekIds.length
      ? await supabase.from("training_days").select("id, week_id, is_rest_day").in("week_id", weekIds)
      : { data: [] };
    const days = (daysData ?? []) as { id: string; week_id: string; is_rest_day: boolean }[];
    const trainingDayIds = days.filter((d) => !d.is_rest_day).map((d) => d.id);

    if (trainingDayIds.length > 0) {
      const { data: logsData } = await supabase
        .from("session_logs")
        .select("training_day_id, performed_on")
        .in("training_day_id", trainingDayIds)
        .order("performed_on", { ascending: false });
      const logs = (logsData ?? []) as { training_day_id: string; performed_on: string }[];

      if (logs.length > 0) {
        const mostRecent = logs[0];
        if (mostRecent) {
          lastWorkoutLoggedOn = mostRecent.performed_on;
          const dayToWeek = new Map(days.map((d) => [d.id, d.week_id]));
          const weekId = dayToWeek.get(mostRecent.training_day_id);
          const week = weeks.find((w) => w.id === weekId);
          if (week) currentWeekLabel = `Week ${week.position} of ${weeks.length}`;
        }

        const distinctLoggedDays = new Set(logs.map((l) => l.training_day_id));
        completionPercent = Math.round((distinctLoggedDays.size / trainingDayIds.length) * 100);
      }
    }
  }

  return {
    coachName,
    currentProgram: program ? { id: program.id, name: program.name } : null,
    currentWeekLabel,
    lastWorkoutLoggedOn,
    completionPercent,
  };
}

export async function getPersonalRecords(supabase: SupabaseClient, userId: string): Promise<PersonalRecord[]> {
  const { data } = await supabase.from("personal_records").select("*").eq("user_id", userId);
  return (data ?? []) as PersonalRecord[];
}
