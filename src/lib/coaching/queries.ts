import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoachClient, UserRole } from "@/lib/supabase/types";
import type { CoachingDashboardData } from "@/lib/coaching/types";

/** Local calendar date (not UTC) — same convention as every other file
 * that needs "today" (profile/queries.ts, dashboard/queries.ts, etc). */
function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDate(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + deltaDays));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/**
 * The signed-in user's own role — gates whether they can see/use the
 * Clients page (coaching is the paid tier; self-programming is free for
 * everyone). Falls back to 'athlete' (the safe default) if the profile
 * row is somehow missing, rather than throwing — the on_auth_user_created
 * trigger always creates one, so this should never actually happen.
 */
export async function getMyRole(supabase: SupabaseClient, userId: string): Promise<UserRole> {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle<{ role: UserRole }>();
  return data?.role ?? "athlete";
}

/**
 * Role plus whether they've actually been asked yet — used by the
 * client-side onboarding/nav islands (RoleOnboarding, CoachNavLink) that
 * can't check this server-side without forcing every static page into
 * dynamic rendering (see AuthStatus's comment for why auth state is
 * checked client-side in the header).
 */
export async function getMyProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<{ role: UserRole; roleSelected: boolean }> {
  const { data } = await supabase
    .from("profiles")
    .select("role, role_selected")
    .eq("id", userId)
    .maybeSingle<{ role: UserRole; role_selected: boolean }>();
  return { role: data?.role ?? "athlete", roleSelected: data?.role_selected ?? false };
}

/** Everyone this user has invited as a client (pending + active), newest first. */
export async function getMyClients(supabase: SupabaseClient, coachId: string): Promise<CoachClient[]> {
  const { data } = await supabase
    .from("coach_clients")
    .select("*")
    .eq("coach_id", coachId)
    .order("created_at", { ascending: false });
  return (data ?? []) as CoachClient[];
}

/** Coaches this user has an accepted relationship with, newest first. */
export async function getMyCoaches(supabase: SupabaseClient, clientId: string): Promise<CoachClient[]> {
  const { data } = await supabase
    .from("coach_clients")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  return (data ?? []) as CoachClient[];
}

/**
 * Pending invites addressed to this user's email, awaiting their explicit
 * accept/decline — never auto-linked just because they signed in. A coach
 * only knows a client's email at invite time, so this can't be looked up
 * by client_id until accepted; RLS ("clients can see relationships naming
 * them") already restricts the result to rows actually naming this user
 * (by id or by email match), so no extra filtering is needed here beyond
 * status.
 */
export async function getPendingInvitesForMe(supabase: SupabaseClient): Promise<CoachClient[]> {
  const { data } = await supabase
    .from("coach_clients")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data ?? []) as CoachClient[];
}

/** The coach's email for one specific coach->client relationship, if it exists. */
export async function getCoachEmail(
  supabase: SupabaseClient,
  params: { coachId: string; clientId: string }
): Promise<string | null> {
  const { data } = await supabase
    .from("coach_clients")
    .select("coach_email")
    .eq("coach_id", params.coachId)
    .eq("client_id", params.clientId)
    .maybeSingle<{ coach_email: string }>();
  return data?.coach_email ?? null;
}

/**
 * Most recent date this client trained, for the /clients/[id] detail page.
 * No coachId filter needed: the session_logs read policy ("readable by the
 * program's owner or athlete") already limits what comes back to logs on
 * programs the calling coach actually owns, so a self-programmed or
 * other-coach's log for this same client simply won't be visible here.
 */
export async function getClientLastActivity(supabase: SupabaseClient, clientId: string): Promise<string | null> {
  const { data } = await supabase
    .from("session_logs")
    .select("performed_on")
    .eq("athlete_id", clientId)
    .order("performed_on", { ascending: false })
    .limit(1)
    .maybeSingle<{ performed_on: string }>();
  return data?.performed_on ?? null;
}

/**
 * Display info for a linked coach/client — display_name + bio, enough for
 * the /coaching "Your Coach" card without pulling in unrelated personal
 * fields (height/weight/goal) that a client has no reason to see. Relies
 * on the profiles RLS exception (0003_coach_clients.sql) that only opens a
 * profile up to someone with an existing coach_clients row naming both of
 * them — so this silently returns null for anyone you're not actually
 * linked with, rather than throwing. That exception only fires once
 * client_id is set (i.e. the invite's been accepted), so this returns null
 * for a still-pending invite too — coach name/bio intentionally isn't
 * shown pre-acceptance; see the Coaching page's invite card, which uses
 * coach_email instead.
 */
export async function getLinkedProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<{ display_name: string | null; bio: string | null } | null> {
  const { data } = await supabase.from("profiles").select("display_name, bio").eq("id", userId).maybeSingle();
  return data ?? null;
}

/**
 * The full coach-side overview: client counts, per-client last activity +
 * "needs attention" + active program name, and a recent-activity feed —
 * everything both /coaching's Client Overview/Client List sections and
 * /dashboard's CoachingDashboardSection need, from one set of queries.
 * Reuses getMyClients rather than a separate roster query.
 */
export async function getCoachingDashboard(supabase: SupabaseClient, coachId: string): Promise<CoachingDashboardData> {
  const clients = await getMyClients(supabase, coachId);
  const activeClients = clients.filter((c) => c.status === "active" && c.client_id);
  const pendingInvites = clients.filter((c) => c.status === "pending");

  const clientIds = activeClients.map((c) => c.client_id).filter((id): id is string => id !== null);

  const [logsResult, programsResult] = await Promise.all([
    clientIds.length > 0
      ? supabase
          .from("session_logs")
          .select("athlete_id, performed_on")
          .in("athlete_id", clientIds)
          .order("performed_on", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] }),
    // Only programs this coach owns — RLS wouldn't return anyone else's
    // anyway, but being explicit keeps the "active program name" honest:
    // a client's self-programmed or another-coach's active program is
    // never attributed to this coach.
    clientIds.length > 0
      ? supabase.from("programs").select("athlete_id, name").eq("owner_id", coachId).eq("is_active", true).in("athlete_id", clientIds)
      : Promise.resolve({ data: [] }),
  ]);

  const lastActivityByClient = new Map<string, string>();
  for (const row of (logsResult.data ?? []) as { athlete_id: string; performed_on: string }[]) {
    if (!lastActivityByClient.has(row.athlete_id)) lastActivityByClient.set(row.athlete_id, row.performed_on);
  }

  const activeProgramByClient = new Map<string, string>();
  for (const row of (programsResult.data ?? []) as { athlete_id: string; name: string }[]) {
    activeProgramByClient.set(row.athlete_id, row.name);
  }

  const attentionCutoff = shiftDate(todayDateString(), -14);
  const clientSummaries = activeClients.map((c) => {
    const clientId = c.client_id as string;
    const lastActivityOn = lastActivityByClient.get(clientId) ?? null;
    return {
      id: c.id,
      clientId,
      email: c.client_email,
      lastActivityOn,
      needsAttention: !lastActivityOn || lastActivityOn < attentionCutoff,
      activeProgramName: activeProgramByClient.get(clientId) ?? null,
    };
  });

  const recentActivity = Array.from(lastActivityByClient.entries())
    .sort((a, b) => (a[1] < b[1] ? 1 : -1))
    .slice(0, 5)
    .map(([clientId, performedOn]) => ({
      clientEmail: activeClients.find((c) => c.client_id === clientId)?.client_email ?? "a client",
      performedOn,
    }));

  return {
    activeClientCount: activeClients.length,
    pendingInviteCount: pendingInvites.length,
    clients: clientSummaries,
    recentActivity,
  };
}
