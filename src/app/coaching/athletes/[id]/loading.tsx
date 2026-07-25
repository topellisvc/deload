import { Skeleton } from "@/components/ui/skeleton";

/**
 * Rough outline of the athlete detail page (programs grid, history
 * section, message thread, notes) instead of a bare spinner — see
 * components/ui/skeleton.tsx for why.
 */
export default function Loading() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12">
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}
