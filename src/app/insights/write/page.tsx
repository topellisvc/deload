import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyArticles, getMyContributorProfile } from "@/lib/insights/queries";
import { MyArticlesList } from "@/components/insights/my-articles-list";

export const metadata: Metadata = {
  title: "My Articles",
  robots: { index: false, follow: false },
};

/**
 * A contributor's own article dashboard — gated on being an *approved*
 * contributor (not just signed in), same rule the write-side RLS
 * (migration 0025) enforces at the database level. Anyone signed in but
 * not yet approved gets sent to /insights/contribute instead, whether
 * they've never applied, are still pending, or were rejected — that page
 * already handles all three of those states.
 */
export default async function MyArticlesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?redirect_to=/insights/write");
  }

  const contributor = await getMyContributorProfile(supabase, user.id);
  if (!contributor || contributor.status !== "approved") {
    redirect("/insights/contribute");
  }

  const articles = await getMyArticles(supabase, contributor.id);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Articles</h1>
        <p className="text-sm text-muted-foreground">Write, edit, and submit articles for review.</p>
      </div>
      <MyArticlesList contributorId={contributor.id} initial={articles} />
    </div>
  );
}
