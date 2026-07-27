import { describe, it, expect } from "vitest";
import {
  getArticleBySlug,
  getArticlesByTopic,
  getFeaturedArticle,
  getFeaturedContributors,
  getLatestArticles,
  searchArticles,
} from "./queries";

const CONTRIBUTOR_SARAH = {
  id: "contrib-sarah",
  profile_id: null,
  name: "Sarah Chen",
  title: "Strength & Conditioning Coach",
  organisation: "Meridian Performance Lab",
  qualifications: "MSc, CSCS",
  bio: "Bio text.",
  photo_url: null,
  expertise: ["Strength"],
};

const CONTRIBUTOR_JAMES = {
  ...CONTRIBUTOR_SARAH,
  id: "contrib-james",
  name: "James Whitfield",
  title: "Sports Scientist",
};

const TOPIC_STRENGTH = { id: "topic-strength", slug: "strength", name: "Strength", description: null, position: 1 };
const TOPIC_RUNNING = { id: "topic-running", slug: "running", name: "Running", description: null, position: 3 };

function makeArticleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "article-1",
    slug: "some-article",
    title: "Some Article",
    excerpt: "An excerpt.",
    featured_image_url: null,
    body: "word ".repeat(10),
    published_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    view_count: 0,
    contributor: CONTRIBUTOR_SARAH,
    topics: [{ topic: TOPIC_STRENGTH }],
    status: "published",
    ...overrides,
  };
}

/**
 * A generic thenable query builder shared across every table in these
 * tests — applies `.eq()` filters and `.order()`/`.limit()` to an
 * in-memory array, resolving whatever's left whenever the chain is
 * awaited or `.maybeSingle()` is called. `.textSearch()` does a naive
 * substring match rather than real Postgres tsquery parsing, which is
 * good enough to prove searchArticles wires the call through and maps
 * results correctly without re-implementing full-text search here.
 *
 * Good enough for this data-access layer's row-shaping/filtering logic —
 * real join behavior (nesting contributor/topics onto an article row) is
 * simulated by pre-shaping the fixture rows above rather than by this
 * builder, since that's Postgres/PostgREST's job, not queries.ts's.
 */
function makeQueryBuilder(initialRows: Record<string, unknown>[]) {
  let rows = initialRows;
  const builder = {
    select: () => builder,
    eq(field: string, value: unknown) {
      rows = rows.filter((row) => row[field] === value);
      return builder;
    },
    order(field: string, opts?: { ascending?: boolean }) {
      const ascending = opts?.ascending !== false;
      rows = [...rows].sort((a, b) => {
        const av = a[field] as string | number;
        const bv = b[field] as string | number;
        if (av === bv) return 0;
        return (av > bv ? 1 : -1) * (ascending ? 1 : -1);
      });
      return builder;
    },
    limit(n: number) {
      rows = rows.slice(0, n);
      return builder;
    },
    textSearch(_column: string, query: string) {
      const needle = query.toLowerCase();
      rows = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(needle));
      return builder;
    },
    maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
    then(resolve: (v: { data: unknown[]; error: null }) => void) {
      resolve({ data: rows, error: null });
    },
  };
  return builder;
}

function makeSupabaseMock(tables: Record<string, Record<string, unknown>[]>) {
  return {
    from: (table: string) => {
      if (!(table in tables)) throw new Error(`Unexpected table in test: ${table}`);
      return makeQueryBuilder(tables[table]!);
    },
  };
}

describe("getFeaturedArticle / getLatestArticles", () => {
  it("returns the newest published article as featured, and excludes it from latest", async () => {
    const supabase = makeSupabaseMock({
      insights_articles: [
        makeArticleRow({ id: "a1", slug: "a1", published_at: "2026-07-01T00:00:00.000Z" }),
        makeArticleRow({ id: "a2", slug: "a2", published_at: "2026-07-10T00:00:00.000Z" }),
        makeArticleRow({ id: "a3", slug: "a3", published_at: "2026-07-05T00:00:00.000Z" }),
        makeArticleRow({ id: "a4-draft", slug: "a4-draft", status: "draft", published_at: "2026-07-20T00:00:00.000Z" }),
      ],
    });

    const featured = await getFeaturedArticle(supabase as never);
    expect(featured?.id).toBe("a2");

    const latest = await getLatestArticles(supabase as never, 5);
    expect(latest.map((a) => a.id)).toEqual(["a3", "a1"]);
  });

  it("maps contributor and topics onto the article summary", async () => {
    const supabase = makeSupabaseMock({
      insights_articles: [makeArticleRow({ topics: [{ topic: TOPIC_STRENGTH }, { topic: TOPIC_RUNNING }] })],
    });

    const featured = await getFeaturedArticle(supabase as never);
    expect(featured?.contributor.name).toBe("Sarah Chen");
    expect(featured?.topics.map((t) => t.slug)).toEqual(["strength", "running"]);
  });
});

describe("getArticlesByTopic", () => {
  it("only returns published articles tagged with the given topic", async () => {
    const supabase = makeSupabaseMock({
      insights_articles: [
        makeArticleRow({ id: "strength-article", slug: "strength-article", topics: [{ topic: TOPIC_STRENGTH }] }),
        makeArticleRow({ id: "running-article", slug: "running-article", topics: [{ topic: TOPIC_RUNNING }] }),
        makeArticleRow({ id: "untagged-article", slug: "untagged-article", topics: [] }),
      ],
    });

    const articles = await getArticlesByTopic(supabase as never, "strength");
    expect(articles.map((a) => a.id)).toEqual(["strength-article"]);
  });
});

describe("getArticleBySlug", () => {
  it("returns null for a missing or unpublished slug", async () => {
    const supabase = makeSupabaseMock({ insights_articles: [makeArticleRow({ status: "draft" })] });
    expect(await getArticleBySlug(supabase as never, "some-article")).toBeNull();
  });

  it("returns the full article detail with its references, ordered by position", async () => {
    const supabase = makeSupabaseMock({
      insights_articles: [makeArticleRow({ seo_title: "Custom SEO Title", seo_description: null })],
      insights_references: [
        { id: "ref-2", article_id: "article-1", journal_title: "Journal B", authors: "B et al.", year: 2020, url: null, position: 2 },
        { id: "ref-1", article_id: "article-1", journal_title: "Journal A", authors: "A et al.", year: 2019, url: null, position: 1 },
      ],
    });

    const article = await getArticleBySlug(supabase as never, "some-article");
    expect(article).not.toBeNull();
    expect(article!.seoTitle).toBe("Custom SEO Title");
    expect(article!.references.map((r) => r.id)).toEqual(["ref-1", "ref-2"]);
  });
});

describe("getFeaturedContributors", () => {
  it("de-duplicates contributors and excludes anyone with zero published articles", async () => {
    const supabase = makeSupabaseMock({
      insights_articles: [
        makeArticleRow({ id: "a1", published_at: "2026-07-01T00:00:00.000Z", contributor: CONTRIBUTOR_SARAH }),
        makeArticleRow({ id: "a2", published_at: "2026-07-05T00:00:00.000Z", contributor: CONTRIBUTOR_SARAH }),
        makeArticleRow({ id: "a3", published_at: "2026-07-10T00:00:00.000Z", contributor: CONTRIBUTOR_JAMES }),
      ],
    });

    const contributors = await getFeaturedContributors(supabase as never, 4);
    expect(contributors.map((c) => c.id)).toEqual(["contrib-james", "contrib-sarah"]);
  });
});

describe("searchArticles", () => {
  it("returns an empty array for a blank query without hitting the database", async () => {
    const supabase = makeSupabaseMock({ insights_articles: [makeArticleRow()] });
    expect(await searchArticles(supabase as never, "   ")).toEqual([]);
  });

  it("maps matching rows back into article summaries", async () => {
    const supabase = makeSupabaseMock({
      insights_articles: [
        makeArticleRow({ id: "match", slug: "match", title: "Progressive Overload Explained" }),
        makeArticleRow({ id: "no-match", slug: "no-match", title: "Sleep and Recovery" }),
      ],
    });

    const results = await searchArticles(supabase as never, "progressive overload");
    expect(results.map((a) => a.id)).toEqual(["match"]);
  });
});
