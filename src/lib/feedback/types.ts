/** Hand-written to match migration 0037 — see that file for the schema
 * and RLS rules (own-row insert, own-or-admin select, admin-only update). */

export type FeedbackStatus = "new" | "reviewed";

export interface Feedback {
  id: string;
  user_id: string;
  message: string;
  page_url: string | null;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
}

/** Feedback plus enough of the submitter's profile to show who sent it —
 * assembled in listFeedbackForAdmin from a separate profiles query rather
 * than a Postgres join, matching getAdminRoster's pattern (see
 * lib/admin/queries.ts) since feedback.user_id references auth.users, not
 * public.profiles, so PostgREST can't embed it directly. */
export interface FeedbackWithAuthor extends Feedback {
  authorEmail: string | null;
  authorDisplayName: string | null;
}
