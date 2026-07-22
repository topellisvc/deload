/**
 * Shared building blocks for the file-convention icon/OG image routes
 * (app/icon.tsx, app/opengraph-image.tsx, etc). These render via Satori
 * (through next/og's ImageResponse), which only understands a constrained
 * subset of flexbox CSS and plain color values — no CSS variables, no
 * oklch(). These hex values are hand-matched to the dark theme tokens in
 * globals.css so the generated images stay visually consistent with the
 * live site without the two ever being able to drift silently out of sync
 * in a way that's hard to notice (a mismatch here is easy to eyeball).
 */
export const OG_COLORS = {
  background: "#121215",
  surface: "#1c1c21",
  border: "#2c2c33",
  foreground: "#f5f5f7",
  mutedForeground: "#a3a3ad",
  primary: "#7c8cf5",
};

interface MarkProps {
  size: number;
}

/** The square brand mark used for icon.tsx and apple-icon.tsx. */
export function BrandMark({ size }: MarkProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: OG_COLORS.background,
        borderRadius: size * 0.22,
      }}
    >
      <div
        style={{
          width: size * 0.74,
          height: size * 0.74,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: OG_COLORS.primary,
          borderRadius: size * 0.16,
          color: OG_COLORS.background,
          fontSize: size * 0.46,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        D
      </div>
    </div>
  );
}

interface OgCardProps {
  eyebrow?: string;
  title: string;
  description: string;
}

/** The 1200x630 social-preview card used across opengraph-image.tsx routes. */
export function OgCard({ eyebrow, title, description }: OgCardProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: OG_COLORS.background,
        padding: 80,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 48,
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: OG_COLORS.primary,
            borderRadius: 12,
            color: OG_COLORS.background,
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          D
        </div>
        <div style={{ color: OG_COLORS.foreground, fontSize: 28, fontWeight: 600 }}>
          Deload
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {eyebrow && (
          <div
            style={{
              color: OG_COLORS.primary,
              fontSize: 24,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            {eyebrow}
          </div>
        )}
        <div
          style={{
            color: OG_COLORS.foreground,
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.1,
            maxWidth: 900,
          }}
        >
          {title}
        </div>
        <div style={{ color: OG_COLORS.mutedForeground, fontSize: 28, maxWidth: 820 }}>
          {description}
        </div>
      </div>
    </div>
  );
}

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };
