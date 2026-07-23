import type { SupabaseClient } from "@supabase/supabase-js";
import type { Message } from "@/lib/supabase/types";

/** Full conversation, oldest first — a coach_clients relationship is
 * always 1:1, so there's nothing to paginate/window for the message
 * volumes a coaching relationship realistically produces. */
export async function getConversationMessages(
  supabase: SupabaseClient,
  coachClientId: string
): Promise<Message[]> {
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("coach_client_id", coachClientId)
    .order("created_at", { ascending: true });
  return (data ?? []) as Message[];
}

/**
 * Unread count per conversation for this user, across every relationship
 * they're part of — feeds the coach's client-list badges and could badge
 * the athlete's own nav item later. One indexed query (the partial
 * `messages_unread_by_recipient_idx`) plus a client-side group-by, rather
 * than N per-conversation count queries.
 */
export async function getUnreadCountsByConversation(
  supabase: SupabaseClient,
  userId: string
): Promise<Map<string, number>> {
  const { data } = await supabase
    .from("messages")
    .select("coach_client_id")
    .eq("recipient_id", userId)
    .is("read_at", null);

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { coach_client_id: string }[]) {
    counts.set(row.coach_client_id, (counts.get(row.coach_client_id) ?? 0) + 1);
  }
  return counts;
}

/** Most recent message in a conversation — used for "Recent Feedback" and
 * list previews without fetching the full thread. */
export async function getLatestMessage(supabase: SupabaseClient, coachClientId: string): Promise<Message | null> {
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("coach_client_id", coachClientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Message>();
  return data ?? null;
}
