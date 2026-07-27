"use client";

import { useMemo, useState } from "react";
import { Select } from "@/components/ui/select";
import { ArticleCard } from "@/components/insights/article-card";
import type { InsightsArticleSummary } from "@/lib/insights/types";

type SortOption = "newest" | "reading-time" | "most-popular";

/**
 * Self-contained filterable article grid — sort (newest / reading time /
 * most popular) plus an optional author filter, applied client-side to an
 * already-fetched list. Used on pages that show more than a small,
 * fixed set of articles (search results, topic pages), so each of those
 * pages doesn't reimplement its own filter state and grid.
 *
 * Filtering/sorting client-side rather than re-querying the server is the
 * same tradeoff queryPublishedArticles' topic filter already makes
 * (src/lib/insights/queries.ts) — at this content volume, refetching for
 * a sort change would be slower than just re-sorting an array already in
 * memory. "Most popular" sorts by view_count, which starts at 0 for every
 * seeded article (Phase 1 doesn't increment it yet) — included now so the
 * control isn't a dead end once view tracking ships.
 */
export function ArticleFilters({ articles }: { articles: InsightsArticleSummary[] }) {
  const [sort, setSort] = useState<SortOption>("newest");
  const [authorId, setAuthorId] = useState<string>("all");

  const authors = useMemo(() => {
    const byId = new Map(articles.map((a) => [a.contributor.id, a.contributor]));
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [articles]);

  const filtered = useMemo(() => {
    let result = articles;
    if (authorId !== "all") {
      result = result.filter((a) => a.contributor.id === authorId);
    }
    return [...result].sort((a, b) => {
      if (sort === "reading-time") return a.readingTimeMinutes - b.readingTimeMinutes;
      if (sort === "most-popular") return b.viewCount - a.viewCount;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
  }, [articles, sort, authorId]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        <div className="w-44">
          <Select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as SortOption)}>
            <option value="newest">Newest</option>
            <option value="reading-time">Quickest read</option>
            <option value="most-popular">Most popular</option>
          </Select>
        </div>
        {authors.length > 1 && (
          <div className="w-56">
            <Select aria-label="Filter by author" value={authorId} onChange={(e) => setAuthorId(e.target.value)}>
              <option value="all">All authors</option>
              {authors.map((author) => (
                <option key={author.id} value={author.id}>
                  {author.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No articles match that filter.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}
