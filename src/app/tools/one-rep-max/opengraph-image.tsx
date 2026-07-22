import { ImageResponse } from "next/og";
import { OgCard, OG_IMAGE_SIZE } from "@/lib/og-image";

export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <OgCard
        eyebrow="Tool"
        title="One-Rep Max Calculator"
        description="Estimate your true one-rep max with a confidence range across five research formulas, plus a full training percentage table."
      />
    ),
    size
  );
}
