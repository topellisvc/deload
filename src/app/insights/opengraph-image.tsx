import { ImageResponse } from "next/og";
import { OgCard, OG_IMAGE_SIZE } from "@/lib/og-image";

export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

// Falls back to this for every Insights sub-route that doesn't define its
// own opengraph-image (topics, contributors, search) via Next's file-
// convention cascade — individual articles override it with their own
// featured photo instead (see [slug]/page.tsx's openGraph.images).
export default function InsightsOpengraphImage() {
  return new ImageResponse(
    (
      <OgCard
        eyebrow="Insights"
        title="Evidence-based training and sports science, from verified professionals"
        description="Articles, coaching advice, and research-backed guidance you can actually trust."
      />
    ),
    size
  );
}
