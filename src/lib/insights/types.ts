/**
 * Insights: a public, SEO-focused editorial section (see
 * supabase/migrations/0023_insights.sql for the full schema/RLS design).
 * These types mirror that schema's columns directly — no denormalization
 * here, the query layer (queries.ts) is where rows get shaped into
 * whatever a specific page needs (e.g. joining topics onto an article).
 */

export type InsightsArticleStatus = "draft" | "in_review" | "changes_requested" | "approved" | "published";

export interface InsightsTopic {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  position: number;
}

export interface InsightsContributor {
  id: string;
  profileId: string | null;
  name: string;
  title: string;
  organisation: string | null;
  qualifications: string | null;
  bio: string;
  photoUrl: string | null;
  expertise: string[];
}

export interface InsightsReference {
  id: string;
  journalTitle: string;
  authors: string;
  year: number | null;
  url: string | null;
  position: number;
}

/** One article, as listed on the homepage/topic/contributor/search pages —
 * enough to render an ArticleCard, not the full body/references. */
export interface InsightsArticleSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  featuredImageUrl: string | null;
  publishedAt: string;
  updatedAt: string;
  viewCount: number;
  contributor: InsightsContributor;
  topics: InsightsTopic[];
  /** Minutes, computed from word count (see reading-time.ts) — not a
   * stored column, so it's always in sync with the current body text. */
  readingTimeMinutes: number;
}

/** A single article's full page content — everything InsightsArticleSummary
 * has, plus the body and its references. */
export interface InsightsArticleDetail extends InsightsArticleSummary {
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
  references: InsightsReference[];
}

export interface InsightsContributorProfile extends InsightsContributor {
  articles: InsightsArticleSummary[];
}
