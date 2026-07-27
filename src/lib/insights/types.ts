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

/**
 * Phase 2: contributor applications, and the editor's own view of an
 * article — distinct from the public-facing types above (InsightsArticle
 * Summary/Detail only ever represent a `published` row; these represent
 * "whatever state it's actually in right now," which is exactly what an
 * applicant, contributor, or reviewing admin needs to see.
 */
export type InsightsContributorStatus = "pending" | "approved" | "rejected";

/** A contributor row plus its application/review metadata — used for "my
 * application" (self-view) and the admin review queue. Never returned
 * from the public queries in queries.ts (those only ever select fields
 * safe to show a stranger). */
export interface InsightsContributorApplication extends InsightsContributor {
  status: InsightsContributorStatus;
  appliedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
}

/** Everything the article editor needs — every field, regardless of
 * status, with topics as plain ids (the editor's topic picker is a
 * checkbox list, not a display component) rather than full InsightsTopic
 * objects. */
export interface InsightsEditableArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  featuredImageUrl: string | null;
  body: string;
  status: InsightsArticleStatus;
  seoTitle: string | null;
  seoDescription: string | null;
  /** Feedback left by an admin on "Request changes" — cleared whenever
   * the article re-enters review or gets approved. */
  editorNote: string | null;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
  contributorId: string;
  topicIds: string[];
  references: InsightsReference[];
}

/** One row in a contributor's own "My Articles" dashboard — status and a
 * timestamp is all that list needs per article, not the full editable
 * shape. */
export interface InsightsMyArticleSummary {
  id: string;
  slug: string;
  title: string;
  status: InsightsArticleStatus;
  updatedAt: string;
  editorNote: string | null;
}

/** One row in an admin's review queue (articles either awaiting a
 * decision or approved-and-ready-to-publish) — includes the contributor's
 * name since an admin reviewing several authors' work needs to see who
 * wrote what, unlike a contributor's own "My Articles" list. */
export interface InsightsReviewQueueArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  status: InsightsArticleStatus;
  updatedAt: string;
  contributorId: string;
  contributorName: string;
}
