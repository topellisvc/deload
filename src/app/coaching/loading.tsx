import { Skeleton } from "@/components/ui/skeleton";

/**
 * Rough outline of the coaching hub's stacked card sections instead of a
 * bare spinner — see components/ui/skeleton.tsx for why.
 */
export default function Loading() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
