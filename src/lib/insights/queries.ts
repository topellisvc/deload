import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateReadingTimeMinutes } from "@/lib/insights/reading-time";
import type {
  InsightsArticleDetail,
  InsightsArticleSummary,
  InsightsContributor,
  InsightsContributorProfile,
  InsightsReference,
  InsightsTopic,
} from "@/lib/insights/types";

/**
 * Insights' data-access layer. Every function here only ever returns
 * `published` articles (Phase 1 has no contributor/admin UI to read
 * drafts through) — RLS (migration 0023) is the real security boundary,
 * this is just matching what a signed-out visitor should ever see.
 *
 * Raw row shapes below mirror the DB columns exactly (snake_case); each
 * function maps them into the camelCase types in types.ts before
 * returning, the same shape-at-the-boundary convention getAdminRoster
 * uses in src/lib/admin/queries.ts.
 */

const ARTICLE_SUMMARY_COLUMNS = `
  id, slug, title, excerpt, featured_image_url, body, published_at, updated_at, view_count,
  contributor:insights_contributors!insights_articles_contributor_id_fkey (
    id, profile_id, name, title, organisation, qualifications, bio, photo_url, expertise
  ),
  topics:insights_article_topics (
    topic:insights_topics ( id, slug, name, description, position )
  )
`;

interface ArticleSummaryRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  featured_image_url: string | null;
  body: string;
  published_at: string | null;
  updated_at: string;
  view_count: number;
  contributor: ContributorRow | ContributorRow[] | null;
  topics: { topic: TopicRow | TopicRow[] | null }[] | null;
}

interface ContributorRow {
  id: string;
  profile_id: string | null;
  name: string;
  title: string;
  organisation: string | null;
  qualifications: string | null;
  bio: string;
  photo_url: string | null;
  expertise: string[];
}

interface TopicRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  position: number;
}

interface ReferenceRow {
  id: string;
  journal_title: string;
  authors: string;
  year: number | null;
  url: string | null;
  position: number;
}

/** Supabase's generated types describe a to-one FK join as an array in
 * some client versions and a single object in others depending on how
 * the relationship is inferred — normalizing here means the mapping
 * functions below never have to special-case it twice. */
function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function mapContributor(row: ContributorRow): InsightsContributor {
  return {
    id: row.id,
    profileId: row.profile_id,
    name: row.name,
    title: row.title,
    organisation: row.organisation,
    qualifications: row.qualifications,
    bio: row.bio,
    photoUrl: row.photo_url,
    expertise: row.expertise,
  };
}

function mapTopic(row: TopicRow): InsightsTopic {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    position: row.position,
  };
}

function mapReference(row: ReferenceRow): InsightsReference {
  return {
    id: row.id,
    journalTitle: row.journal_title,
    authors: row.authors,
    year: row.year,
    url: row.url,
    position: row.position,
  };
}

function mapArticleSummary(row: ArticleSummaryRow): InsightsArticleSummary | null {
  const contributor = one(row.contributor);
  if (!contributor || !row.published_at) return null;

  const topics = (row.topics ?? [])
    .map((t) => one(t.topic))
    .filter((t): t is TopicRow => t !== null)
    .map(mapTopic)
    .sort((a, b) => a.position - b.position);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    featuredImageUrl: row.featured_image_url,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    viewCount: row.view_count,
    contributor: mapContributor(contributor),
    topics,
    readingTimeMinutes: calculateReadingTimeMinutes(row.body),
  };
}

/** Homepage hero + "Latest Articles" + topic/contributor pages all need
 * the same published-articles-newest-first list, just with different
 * filters and limits — one shared query function parameterized by an
 * optional filter, rather than a near-duplicate per page. */
async function queryPublishedArticles(
  supabase: SupabaseClient,
  options: { topicSlug?: string; contributorId?: string; limit?: number; orderBy?: "newest" | "popular" } = {}
): Promise<InsightsArticleSummary[]> {
  let query = supabase
    .from("insights_articles")
    .select(ARTICLE_SUMMARY_COLUMNS)
    .eq("status", "published")
    .order(options.orderBy === "popular" ? "view_count" : "published_at", { ascending: false });

  if (options.contributorId) {
    query = query.eq("contributor_id", options.contributorId);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;

  let rows = (data ?? []) as unknown as ArticleSummaryRow[];

  // Topic filtering happens client-side rather than via an inner join in
  // the select, since Supabase's PostgREST filter syntax for "has a tag
  // matching X" through a many-to-many join table is awkward to express
  // reliably across client versions — at this content volume (dozens to
  // low hundreds of articles), filtering the already-fetched page in JS
  // is simpler and every bit as fast as a more clever query.
  if (options.topicSlug) {
    rows = rows.filter((row) =>
      (row.topics ?? []).some((t) => {
        const topic = one(t.topic);
        return topic?.slug === options.topicSlug;
      })
    );
  }

  return rows.map(mapArticleSummary).filter((a): a is InsightsArticleSummary => a !== null);
}

export async function getFeaturedArticle(supabase: SupabaseClient): Promise<InsightsArticleSummary | null> {
  const [article] = await queryPublishedArticles(supabase, { limit: 1, orderBy: "newest" });
  return article ?? null;
}

export async function getLatestArticles(supabase: SupabaseClient, limit = 6): Promise<InsightsArticleSummary[]> {
  const articles = await queryPublishedArticles(supabase, { limit: limit + 1, orderBy: "newest" });
  // +1/slice(1) so the homepage's "Latest Articles" list can exclude
  // whatever getFeaturedArticle already showed above it, without a
  // second round trip to check for the overlap.
  return articles.slice(1, limit + 1);
}

export async function getPopularArticles(supabase: SupabaseClient, limit = 4): Promise<InsightsArticleSummary[]> {
  return queryPublishedArticles(supabase, { limit, orderBy: "popular" });
}

export async function getArticlesByTopic(supabase: SupabaseClient, topicSlug: string): Promise<InsightsArticleSummary[]> {
  return queryPublishedArticles(supabase, { topicSlug, orderBy: "newest" });
}

export async function getArticlesByContributor(supabase: SupabaseClient, contributorId: string): Promise<InsightsArticleSummary[]> {
  return queryPublishedArticles(supabase, { contributorId, orderBy: "newest" });
}

export async function getAllTopics(supabase: SupabaseClient): Promise<InsightsTopic[]> {
  const { data, error } = await supabase.from("insights_topics").select("id, slug, name, description, position").order("position");
  if (error) throw error;
  return (data ?? []).map(mapTopic);
}

export async function getTopicBySlug(supabase: SupabaseClient, slug: string): Promise<InsightsTopic | null> {
  const { data, error } = await supabase
    .from("insights_topics")
    .select("id, slug, name, description, position")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ? mapTopic(data) : null;
}

/** "Featured Contributors" on the homepage — every contributor with at
 * least one published article, most-recently-published first. A
 * contributor with zero published articles is naturally excluded here
 * (rather than needing a special case), since a card with no article
 * links to show would be a dead end for a reader — they'll appear once
 * their first article is published. */
export async function getFeaturedContributors(supabase: SupabaseClient, limit = 4): Promise<InsightsContributor[]> {
  const { data, error } = await supabase
    .from("insights_articles")
    .select("published_at, contributor:insights_contributors!insights_articles_contributor_id_fkey ( id, profile_id, name, title, organisation, qualifications, bio, photo_url, expertise )")
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as { contributor: ContributorRow | ContributorRow[] | null }[];
  const seen = new Set<string>();
  const contributors: InsightsContributor[] = [];
  for (const row of rows) {
    const contributor = one(row.contributor);
    if (!contributor || seen.has(contributor.id)) continue;
    seen.add(contributor.id);
    contributors.push(mapContributor(contributor));
    if (contributors.length >= limit) break;
  }
  return contributors;
}

export async function getAllContributors(supabase: SupabaseClient): Promise<InsightsContributor[]> {
  const { data, error } = await supabase
    .from("insights_contributors")
    .select("id, profile_id, name, title, organisation, qualifications, bio, photo_url, expertise")
    .order("name");
  if (error) throw error;
  return (data ?? []).map(mapContributor);
}

export async function getContributorProfile(supabase: SupabaseClient, contributorId: string): Promise<InsightsContributorProfile | null> {
  const { data, error } = await supabase
    .from("insights_contributors")
    .select("id, profile_id, name, title, organisation, qualifications, bio, photo_url, expertise")
    .eq("id", contributorId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const articles = await getArticlesByContributor(supabase, contributorId);
  return { ...mapContributor(data), articles };
}

/** Full article page: body + references + related articles, on top of
 * everything the summary already has. Related articles are simply "other
 * published articles sharing at least one topic" — good enough at this
 * content volume, and a reasonable place to plug in the "relevant
 * tools/programs" future-ready slot the spec calls for without needing a
 * schema change first. */
export async function getArticleBySlug(supabase: SupabaseClient, slug: string): Promise<InsightsArticleDetail | null> {
  const { data, error } = await supabase
    .from("insights_articles")
    .select(`${ARTICLE_SUMMARY_COLUMNS}, seo_title, seo_description`)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as ArticleSummaryRow & { seo_title: string | null; seo_description: string | null };
  const summary = mapArticleSummary(row);
  if (!summary) return null;

  const { data: referenceRows, error: referencesError } = await supabase
    .from("insights_references")
    .select("id, journal_title, authors, year, url, position")
    .eq("article_id", row.id)
    .order("position");
  if (referencesError) throw referencesError;

  return {
    ...summary,
    body: row.body,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    references: (referenceRows ?? []).map(mapReference),
  };
}

export async function getRelatedArticles(supabase: SupabaseClient, article: InsightsArticleDetail, limit = 3): Promise<InsightsArticleSummary[]> {
  if (article.topics.length === 0) return [];

  const candidates = await queryPublishedArticles(supabase, { limit: limit * 4 + 1, orderBy: "newest" });
  const topicSlugs = new Set(article.topics.map((t) => t.slug));

  return candidates
    .filter((candidate) => candidate.id !== article.id && candidate.topics.some((t) => topicSlugs.has(t.slug)))
    .slice(0, limit);
}

/**
 * Full-text search over title/excerpt/body via the generated
 * `search_vector` tsvector column (migration 0023) — Postgres's own
 * search rather than a separate search service, appropriate at this
 * content volume. `websearch_to_tsquery` accepts plain search-engine-
 * style query syntax (quotes, `-exclude`) directly from a search box
 * without the caller needing to build tsquery syntax by hand.
 */
export async function searchArticles(supabase: SupabaseClient, query: string): Promise<InsightsArticleSummary[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from("insights_articles")
    .select(ARTICLE_SUMMARY_COLUMNS)
    .eq("status", "published")
    .textSearch("search_vector", trimmed, { type: "websearch", config: "english" })
    .order("published_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as ArticleSummaryRow[]).map(mapArticleSummary).filter((a): a is InsightsArticleSummary => a !== null);
}
