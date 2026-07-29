import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedbackStatus } from "./types";

/**
 * Submits one feedback message under the caller's own id — RLS (migration
 * 0037) rejects anything else, so there's no need to trust userId from the
 * caller beyond passing it through. pageUrl is just triage context for
 * admins (see SendFeedbackDialog, which passes window.location.pathname);
 * always optional since this can in principle be called from anywhere.
 */
export async function submitFeedback(
  supabase: SupabaseClient,
  userId: string,
  message: string,
  pageUrl: string | null
): Promise<{ error: string | null }> {
  const trimmed = message.trim();
  if (!trimmed) return { error: "Feedback can't be empty." };

  const { error } = await supabase.from("feedback").insert({ user_id: userId, message: trimmed, page_url: pageUrl });
  return { error: error ? "Couldn't send your feedback. Please try again." : null };
}

/**
 * Admin-only toggle (RLS enforces this) between the two states — no
 * "archive"/delete, feedback stays visible either way, this just changes
 * whether it's still counted as pending in the /admin queue's header.
 */
export async function setFeedbackStatus(supabase: SupabaseClient, id: string, status: FeedbackStatus): Promise<{ error: string | null }> {
  const { error } = await supabase.from("feedback").update({ status }).eq("id", id);
  return { error: error ? "Couldn't update that." : null };
}
