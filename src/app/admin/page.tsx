import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfileDetails } from "@/lib/profile/queries";
import { getAdminRoster } from "@/lib/admin/queries";
import { getArticlesByStatusForAdmin, getPendingContributorApplications } from "@/lib/insights/queries";
import { listFeedbackForAdmin } from "@/lib/feedback/queries";
import { AdminRosterTable } from "@/components/admin/admin-roster-table";
import { ContributorApplicationQueue } from "@/components/admin/contributor-application-queue";
import { ArticleReviewQueue } from "@/components/admin/article-review-queue";
import { FeedbackQueue } from "@/components/admin/feedback-queue";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/**
 * Every signed-up account, view-only (migration 0021). Not linked from
 * the site header on purpose — this is a single-admin feature for now
 * (see migration 0021's comment on why is_admin is a column rather than
 * a hardcoded email check), so there's no nav item to build/gate for an
 * audience of one. Visit /admin directly.
 *
 * Redirecting non-admins to /dashboard rather than showing a 403/404 is
 * an app-level nicety, not the actual security boundary — RLS already
 * makes getAdminRoster return only the caller's own row for anyone
 * without is_admin = true, so there's nothing sensitive to leak even if
 * this check were somehow bypassed.
 */
export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?redirect_to=/admin");
  }

  const profile = await getMyProfileDetails(supabase, user.id);
  if (!profile.is_admin) {
    redirect("/dashboard");
  }

  const [roster, pendingApplications, inReview, approved, published, feedback] = await Promise.all([
    getAdminRoster(supabase),
    getPendingContributorApplications(supabase),
    getArticlesByStatusForAdmin(supabase, "in_review"),
    getArticlesByStatusForAdmin(supabase, "approved"),
    getArticlesByStatusForAdmin(supabase, "published"),
    listFeedbackForAdmin(supabase),
  ]);
  const pendingFeedbackCount = feedback.filter((f) => f.status === "new").length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">All accounts</h1>
          <p className="text-sm text-muted-foreground">
            {roster.length} {roster.length === 1 ? "account" : "accounts"} signed up.
          </p>
        </div>
        <AdminRosterTable roster={roster} currentUserId={user.id} />
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Insights: Contributor Applications</h2>
          <p className="text-sm text-muted-foreground">
            {pendingApplications.length} pending {pendingApplications.length === 1 ? "application" : "applications"}.
          </p>
        </div>
        <ContributorApplicationQueue initial={pendingApplications} />
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Insights: Article Review</h2>
          <p className="text-sm text-muted-foreground">Awaiting review, approved, and published articles.</p>
        </div>
        <ArticleReviewQueue inReview={inReview} approved={approved} published={published} />
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Feedback</h2>
          <p className="text-sm text-muted-foreground">
            {feedback.length} total, {pendingFeedbackCount} unreviewed.
          </p>
        </div>
        <FeedbackQueue initial={feedback} />
      </div>
    </div>
  );
}
