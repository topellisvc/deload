import { cn } from "@/lib/utils";

/**
 * A single pulsing placeholder block — the building piece each route's
 * loading.tsx composes into a rough outline of its actual layout (a
 * couple of stat cards, a list of rows, whatever that page's real content
 * looks like), instead of a single centered spinner that blanks the whole
 * page. Same idea either way — "something is loading" — but a shape that
 * already resembles the destination reads as faster and is far less
 * jarring once the real content pops in over it.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted", className)} />;
}
