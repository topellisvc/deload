import { ImageResponse } from "next/og";
import { OgCard, OG_IMAGE_SIZE } from "@/lib/og-image";

export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <OgCard
        eyebrow="Tools"
        title="Evidence-based training tools"
        description="Every tool here is fully built, evidence-based, and free to use."
      />
    ),
    size
  );
}
