import type { SupabaseClient } from "@supabase/supabase-js";

export interface AdminRosterRow {
  id: string;
  email: string | null;
  displayName: string | null;
  role: "athlete" | "coach";
  isAdmin: boolean;
  /** profiles.beta_build_for_me (migration 0053) — whether this account can
   * currently see/use the questionnaire-driven "Build my program" generator
   * while it's in beta. Admin-toggleable from this same roster. */
  betaBuildForMe: boolean;
  signedUpAt: string;
  /** Most recent non-skipped session_logs.performed_on across every
   * program this person owns as an athlete — null if they've never
   * logged one. Skipped days are excluded everywhere else in this app
   * (see getMyStats/getCoachingDashboard), so this matches that. */
  lastActiveOn: string | null;
  programsCreated: number;
  sessionCount: number;
}

/**
 * Every signed-up user plus enough activity data to answer "who's here
 * and are they doing anything" at a glance — the read-only /admin
 * roster's whole data source. Only ever returns more than the caller's
 * own row if migration 0021's admin-read RLS policies actually match
 * (profiles.is_admin = true for the caller) — a non-admin calling this
 * would just get back their own profile, same as any other query
 * against these tables, since RLS (not this function) is the real
 * security boundary here. The /admin page itself still checks
 * profile.is_admin before rendering, for the ordinary "don't show a
 * confusing near-empty roster" UX reason, not as the security check.
 *
 * Three flat queries + client-side tally, rather than one query per
 * user — this app's whole userbase is small enough (single-digit to
 * low-hundreds accounts) that fetching every programs/session_logs row
 * once and grouping in JS is simpler and cheaper than N+1 count queries,
 * and it's the same tradeoff getCoachingDashboard's adherence lookup
 * already makes for a coach's client roster.
 */
export async function getAdminRoster(supabase: SupabaseClient): Promise<AdminRosterRow[]> {
  const [profilesResult, programsResult, logsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, display_name, role, is_admin, beta_build_for_me, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("programs").select("owner_id"),
    supabase.from("session_logs").select("athlete_id, performed_on, skipped"),
  ]);

  const profiles = (profilesResult.data ?? []) as {
    id: string;
    email: string | null;
    display_name: string | null;
    role: "athlete" | "coach";
    is_admin: boolean;
    beta_build_for_me: boolean;
    created_at: string;
  }[];
  const programs = (programsResult.data ?? []) as { owner_id: string }[];
  const logs = (logsResult.data ?? []) as { athlete_id: string; performed_on: string; skipped: boolean }[];

  const programCountByOwner = new Map<string, number>();
  for (const p of programs) {
    programCountByOwner.set(p.owner_id, (programCountByOwner.get(p.owner_id) ?? 0) + 1);
  }

  const sessionCountByAthlete = new Map<string, number>();
  const lastActiveByAthlete = new Map<string, string>();
  for (const l of logs) {
    if (l.skipped) continue;
    sessionCountByAthlete.set(l.athlete_id, (sessionCountByAthlete.get(l.athlete_id) ?? 0) + 1);
    const current = lastActiveByAthlete.get(l.athlete_id);
    if (!current || l.performed_on > current) lastActiveByAthlete.set(l.athlete_id, l.performed_on);
  }

  return profiles.map((p) => ({
    id: p.id,
    email: p.email,
    displayName: p.display_name,
    role: p.role,
    isAdmin: p.is_admin,
    betaBuildForMe: p.beta_build_for_me,
    signedUpAt: p.created_at,
    lastActiveOn: lastActiveByAthlete.get(p.id) ?? null,
    programsCreated: programCountByOwner.get(p.id) ?? 0,
    sessionCount: sessionCountByAthlete.get(p.id) ?? 0,
  }));
}
