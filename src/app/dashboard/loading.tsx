import { Skeleton } from "@/components/ui/skeleton";

/**
 * Rough outline of the real dashboard (hero card, the stat row, then a
 * stack of section cards) instead of a bare spinner — see
 * components/ui/skeleton.tsx for why.
 */
export default function Loading() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
      <Skeleton className="h-40 w-full" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
