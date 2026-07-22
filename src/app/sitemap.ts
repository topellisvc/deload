import type { MetadataRoute } from "next";
import { TOOLS } from "@/lib/tools-registry";

const SITE_URL = "https://example.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/tools`, changeFrequency: "weekly", priority: 0.8 },
    ...TOOLS.map((tool) => ({
      url: `${SITE_URL}/tools/${tool.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
  ];
}
