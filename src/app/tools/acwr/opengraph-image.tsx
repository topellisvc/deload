import { ImageResponse } from "next/og";
import { OgCard, OG_IMAGE_SIZE } from "@/lib/og-image";

export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <OgCard
        eyebrow="Tool"
        title="Training Load Ratio (ACWR) Calculator"
        description="Check whether your recent training load has spiked relative to your 4-week baseline."
      />
    ),
    size
  );
}
