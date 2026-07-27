import type { MetadataRoute } from "next";
import { TOOLS } from "@/lib/tools-registry";
import { createClient } from "@/lib/supabase/server";
import { getAllContributors, getAllTopics } from "@/lib/insights/queries";

const SITE_URL = "https://deloadhq.com";

/**
 * Every published article's URL comes straight from the DB rather than a
 * static list (unlike TOOLS, a small hand-maintained registry) — Insights
 * content grows independently of a code deploy once Phase 2's contributor
 * workflow ships, so the sitemap has to read current published rows to
 * stay accurate rather than needing a code change per new article.
 */
async function getPublishedArticleUrls(): Promise<{ slug: string; lastModified: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("insights_articles")
    .select("slug, updated_at")
    .eq("status", "published");
  if (error) return [];
  return (data ?? []).map((row) => ({ slug: row.slug as string, lastModified: row.updated_at as string }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // lastModified is a build-time snapshot rather than a per-page tracked
  // edit date (nothing in the schema records that yet) — still a real
  // freshness signal to crawlers, since it updates every time the site is
  // actually redeployed. Articles are the one exception: they do carry a
  // real updated_at, so those entries use it directly instead.
  const lastModified = new Date();

  const supabase = await createClient();
  const [articles, topics, contributors] = await Promise.all([
    getPublishedArticleUrls(),
    getAllTopics(supabase),
    getAllContributors(supabase),
  ]);

  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1, lastModified },
    { url: `${SITE_URL}/tools`, changeFrequency: "weekly", priority: 0.8, lastModified },
    ...TOOLS.map((tool) => ({
      url: `${SITE_URL}/tools/${tool.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.9,
      lastModified,
    })),
    { url: `${SITE_URL}/insights`, changeFrequency: "daily" as const, priority: 0.9, lastModified },
    { url: `${SITE_URL}/insights/topics`, changeFrequency: "weekly" as const, priority: 0.7, lastModified },
    { url: `${SITE_URL}/insights/contributors`, changeFrequency: "weekly" as const, priority: 0.6, lastModified },
    ...articles.map((article) => ({
      url: `${SITE_URL}/insights/${article.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
      lastModified: new Date(article.lastModified),
    })),
    ...topics.map((topic) => ({
      url: `${SITE_URL}/insights/topics/${topic.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
      lastModified,
    })),
    ...contributors.map((contributor) => ({
      url: `${SITE_URL}/insights/contributors/${contributor.id}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
      lastModified,
    })),
  ];
}
