import { ImageResponse } from "next/og";
import { OgCard, OG_IMAGE_SIZE } from "@/lib/og-image";

export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <OgCard
        eyebrow="Tool"
        title="Body Fat Percentage Calculator"
        description="Estimate your body fat % from a tape measure, with an honest accuracy margin."
      />
    ),
    size
  );
}
