import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { searchArticles } from "@/lib/insights/queries";
import { SearchBar } from "@/components/insights/search-bar";
import { ArticleFilters } from "@/components/insights/article-filters";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

// Not indexed — a query-string-driven results page has no single stable
// canonical URL worth ranking, same reasoning as most site search pages
// (Google's own guidance recommends noindex for internal search results).
export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

export default async function InsightsSearchPage({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();
  const results = q.trim() ? await searchArticles(supabase, q) : [];

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-10 flex flex-col gap-5">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Search Insights</h1>
        <div className="max-w-md">
          <SearchBar defaultValue={q} />
        </div>
      </div>

      {!q.trim() ? (
        <p className="text-sm text-muted-foreground">Enter a search term to find articles by title, content, topic, or author.</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No articles matched &ldquo;{q}&rdquo;. Try a different search term, or{" "}
          <Link href="/insights/topics" className="font-medium text-primary underline underline-offset-2">
            browse by topic
          </Link>{" "}
          instead.
        </p>
      ) : (
        <>
          <p className="mb-5 text-sm text-muted-foreground">
            {results.length} result{results.length === 1 ? "" : "s"} for &ldquo;{q}&rdquo;
          </p>
          <ArticleFilters articles={results} />
        </>
      )}
    </div>
  );
}
