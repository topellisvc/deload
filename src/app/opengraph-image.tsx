import { ImageResponse } from "next/og";
import { OgCard, OG_IMAGE_SIZE } from "@/lib/og-image";

export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <OgCard
        title="Evidence-based tools for better training decisions"
        description="No fluff, no fake precision. Every tool tells you how confident to be in the result."
      />
    ),
    size
  );
}
