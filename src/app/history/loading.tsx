import { Skeleton } from "@/components/ui/skeleton";

/**
 * Rough outline of the history page's list of session rows instead of a
 * bare spinner — see components/ui/skeleton.tsx for why.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Skeleton className="mb-2 h-9 w-48" />
      <Skeleton className="mb-8 h-5 w-64" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
