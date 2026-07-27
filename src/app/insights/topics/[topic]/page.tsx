import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getArticlesByTopic, getTopicBySlug } from "@/lib/insights/queries";
import { ArticleFilters } from "@/components/insights/article-filters";

interface TopicPageProps {
  params: Promise<{ topic: string }>;
}

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const { topic: slug } = await params;
  const supabase = await createClient();
  const topic = await getTopicBySlug(supabase, slug);
  if (!topic) return { title: "Topic not found" };

  const description = topic.description || `Evidence-based ${topic.name.toLowerCase()} articles from verified professionals.`;
  return {
    title: topic.name,
    description,
    alternates: { canonical: `/insights/topics/${topic.slug}` },
    openGraph: { title: `${topic.name} | Insights | Deload`, description, url: `/insights/topics/${topic.slug}` },
  };
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { topic: slug } = await params;
  const supabase = await createClient();
  const topic = await getTopicBySlug(supabase, slug);
  if (!topic) notFound();

  const articles = await getArticlesByTopic(supabase, slug);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-10 flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">Topic</span>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{topic.name}</h1>
        {topic.description && <p className="text-muted-foreground">{topic.description}</p>}
      </div>

      {articles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No articles have been published on this topic yet.</p>
      ) : (
        <ArticleFilters articles={articles} />
      )}
    </div>
  );
}
