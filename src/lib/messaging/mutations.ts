import type { SupabaseClient } from "@supabase/supabase-js";
import type { Message } from "@/lib/supabase/types";

export async function sendMessage(
  supabase: SupabaseClient,
  params: { coachClientId: string; senderId: string; recipientId: string; body: string }
): Promise<{ message: Message | null; error: string | null }> {
  const body = params.body.trim();
  if (!body) return { message: null, error: "Message can't be empty." };

  const { data, error } = await supabase
    .from("messages")
    .insert({
      coach_client_id: params.coachClientId,
      sender_id: params.senderId,
      recipient_id: params.recipientId,
      body,
    })
    .select()
    .single<Message>();

  if (error) return { message: null, error: "Couldn't send that message. Try again." };
  return { message: data, error: null };
}

/** Marks every unread message in this conversation addressed to `userId`
 * as read — one bulk update rather than one per message. The
 * `enforce_message_read_only_update` trigger (migration 0011) guarantees
 * this can only ever touch read_at, even though the update itself doesn't
 * name specific message ids. */
export async function markConversationRead(
  supabase: SupabaseClient,
  params: { coachClientId: string; userId: string }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("coach_client_id", params.coachClientId)
    .eq("recipient_id", params.userId)
    .is("read_at", null);

  if (error) return { error: "Couldn't update read status." };
  return { error: null };
}
