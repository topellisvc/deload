import { ImageResponse } from "next/og";
import { OgCard, OG_IMAGE_SIZE } from "@/lib/og-image";

export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <OgCard
        eyebrow="Tool"
        title="Running Pace Calculator"
        description="Pace, time, distance, splits, and race predictions in one place."
      />
    ),
    size
  );
}
