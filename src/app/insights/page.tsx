import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getAllTopics,
  getFeaturedArticle,
  getFeaturedContributors,
  getLatestArticles,
  getPopularArticles,
} from "@/lib/insights/queries";
import { ArticleCard } from "@/components/insights/article-card";
import { TopicCard } from "@/components/insights/topic-card";
import { ContributorCard } from "@/components/insights/contributor-card";
import { SearchBar } from "@/components/insights/search-bar";

const DESCRIPTION = "Evidence-based articles, practical coaching advice and sports science insights from verified professionals.";

export const metadata: Metadata = {
  title: "Insights",
  description: DESCRIPTION,
  alternates: {
    canonical: "/insights",
  },
  openGraph: {
    title: "Insights | Deload",
    description: DESCRIPTION,
    url: "/insights",
  },
};

const collectionPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Insights",
  description: DESCRIPTION,
  url: "https://deloadhq.com/insights",
};

/**
 * Insights' homepage — the spec's whole discovery funnel starts here:
 * featured article, latest articles, browse-by-topic, featured
 * contributors, most popular. Every section degrades gracefully to
 * "nothing rendered" if its query comes back empty, so this page never
 * throws or shows a broken half-section as more content gets added later
 * (e.g. a 10th topic with zero published articles yet is simply omitted
 * from "Browse by Topic" rather than shown as a dead end).
 */
export default async function InsightsHomePage() {
  const supabase = await createClient();
  const [featured, latest, popular, topics, contributors] = await Promise.all([
    getFeaturedArticle(supabase),
    getLatestArticles(supabase, 6),
    getPopularArticles(supabase, 4),
    getAllTopics(supabase),
    getFeaturedContributors(supabase, 4),
  ]);

  return (
    <div className="flex flex-col gap-16 px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageJsonLd) }} />

      <section className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Insights</h1>
        <p className="text-lg text-muted-foreground">{DESCRIPTION}</p>
        <div className="w-full max-w-md">
          <SearchBar />
        </div>
      </section>

      {featured && (
        <section className="mx-auto w-full max-w-5xl">
          <ArticleCard article={featured} featured />
        </section>
      )}

      {latest.length > 0 && (
        <section className="mx-auto w-full max-w-6xl">
          <SectionHeader title="Latest Articles" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </section>
      )}

      {topics.length > 0 && (
        <section className="mx-auto w-full max-w-6xl">
          <SectionHeader title="Browse by Topic" href="/insights/topics" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {topics.map((topic) => (
              <TopicCard key={topic.id} topic={topic} />
            ))}
          </div>
        </section>
      )}

      {contributors.length > 0 && (
        <section className="mx-auto w-full max-w-6xl">
          <SectionHeader title="Featured Contributors" href="/insights/contributors" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {contributors.map((contributor) => (
              <ContributorCard key={contributor.id} contributor={contributor} />
            ))}
          </div>
        </section>
      )}

      {popular.length > 0 && (
        <section className="mx-auto w-full max-w-6xl">
          <SectionHeader title="Popular Articles" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {popular.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      {href && (
        <Link href={href} className="group flex items-center gap-1 text-sm font-medium text-primary">
          View all
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
