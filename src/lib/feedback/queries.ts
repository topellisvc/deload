import type { SupabaseClient } from "@supabase/supabase-js";
import type { Feedback, FeedbackWithAuthor } from "./types";

/**
 * Every submitted feedback row plus the submitter's email/display name,
 * newest first — the /admin Feedback queue's whole data source. Two flat
 * queries + a client-side merge rather than a Postgres join, same tradeoff
 * getAdminRoster makes (see lib/admin/queries.ts): feedback.user_id
 * references auth.users directly, not public.profiles, so PostgREST has no
 * FK to embed across, and this app's feedback volume is nowhere near large
 * enough to need anything fancier.
 *
 * RLS (migration 0037) already limits a non-admin caller to just their own
 * rows, so this is safe to call generically — the /admin page's own
 * profile.is_admin check is what actually gates the page, same reasoning
 * as every other admin query in this app.
 */
export async function listFeedbackForAdmin(supabase: SupabaseClient): Promise<FeedbackWithAuthor[]> {
  const feedbackResult = await supabase.from("feedback").select("*").order("created_at", { ascending: false });

  const feedback = (feedbackResult.data ?? []) as Feedback[];
  if (feedback.length === 0) return [];

  const userIds = [...new Set(feedback.map((f) => f.user_id))];
  const profilesResult = await supabase.from("profiles").select("id, email, display_name").in("id", userIds);
  const profiles = (profilesResult.data ?? []) as { id: string; email: string | null; display_name: string | null }[];
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  return feedback.map((f) => ({
    ...f,
    authorEmail: profileById.get(f.user_id)?.email ?? null,
    authorDisplayName: profileById.get(f.user_id)?.display_name ?? null,
  }));
}
