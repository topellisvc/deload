import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppNotification } from "@/lib/supabase/types";

/** Most recent notifications for the bell dropdown — newest first, capped
 * since this is a glance-and-dismiss inbox, not something anyone pages
 * through (see messaging/queries.ts's getConversationMessages for the same
 * "no real pagination needed at this volume" call). */
export async function getRecentNotifications(
  supabase: SupabaseClient,
  userId: string,
  limit = 20
): Promise<AppNotification[]> {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AppNotification[];
}

/** Bell badge count — a head-only count query rather than fetching rows. */
export async function getUnreadNotificationCount(supabase: SupabaseClient, userId: string): Promise<number> {
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .is("read_at", null);
  return count ?? 0;
}
