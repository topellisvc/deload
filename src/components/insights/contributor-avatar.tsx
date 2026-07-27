import Image from "next/image";
import { getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * No contributor in the Phase 1 seed data has a photo_url yet (see
 * 0024_insights_seed.sql) — every contributor card/byline falls back to an
 * initials avatar today, the same fallback ProfileHeader already uses for
 * app users, so a headshot can be added later purely by setting a column,
 * with no component change required.
 */
export function ContributorAvatar({ name, photoUrl, size = "md" }: { name: string; photoUrl: string | null; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-16 text-lg" }[size];

  if (photoUrl) {
    const pixelSize = { sm: 32, md: 40, lg: 64 }[size];
    return (
      <Image
        src={photoUrl}
        alt={name}
        width={pixelSize}
        height={pixelSize}
        className={cn("shrink-0 rounded-full object-cover", sizeClasses)}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary",
        sizeClasses
      )}
      aria-hidden
    >
      {getInitials(name, "")}
    </span>
  );
}
