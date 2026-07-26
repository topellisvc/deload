import type { MetadataRoute } from "next";
import { TOOLS } from "@/lib/tools-registry";

const SITE_URL = "https://deloadhq.com";

export default function sitemap(): MetadataRoute.Sitemap {
  // lastModified is a build-time snapshot rather than a per-page tracked
  // edit date (nothing in the schema records that yet) — still a real
  // freshness signal to crawlers, since it updates every time the site is
  // actually redeployed.
  const lastModified = new Date();
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1, lastModified },
    { url: `${SITE_URL}/tools`, changeFrequency: "weekly", priority: 0.8, lastModified },
    ...TOOLS.map((tool) => ({
      url: `${SITE_URL}/tools/${tool.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.9,
      lastModified,
    })),
  ];
}
