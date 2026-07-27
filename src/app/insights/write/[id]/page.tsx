import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAllTopics, getArticleForEditing } from "@/lib/insights/queries";
import { ArticleEditor } from "@/components/insights/article-editor";

export const metadata: Metadata = {
  title: "Edit Article",
  robots: { index: false, follow: false },
};

interface EditArticlePageProps {
  params: Promise<{ id: string }>;
}

/**
 * The article editor for one specific article, any status. RLS (0023's
 * read policies: owner via contributor_id, or admin) is what actually
 * decides whether getArticleForEditing returns anything for this caller
 * — a `null` here covers both "doesn't exist" and "exists but isn't
 * yours," which should look identical from the outside, same reasoning
 * as the public article page's notFound().
 */
export default async function EditArticlePage({ params }: EditArticlePageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?redirect_to=/insights/write/${id}`);
  }

  const [article, topics] = await Promise.all([getArticleForEditing(supabase, id), getAllTopics(supabase)]);
  if (!article) notFound();

  return <ArticleEditor initial={article} topics={topics} />;
}
