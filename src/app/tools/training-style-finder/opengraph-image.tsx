import { ImageResponse } from "next/og";
import { OgCard, OG_IMAGE_SIZE } from "@/lib/og-image";

export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <OgCard
        eyebrow="Tool"
        title="Training Style Finder"
        description="4 questions, 8 disciplines — find the training style that actually fits you."
      />
    ),
    size
  );
}
