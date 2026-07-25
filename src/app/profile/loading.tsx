import { Skeleton } from "@/components/ui/skeleton";

/**
 * Rough outline of the profile page (summary card, training-profile form,
 * activity stats row) instead of a bare spinner — see
 * components/ui/skeleton.tsx for why.
 */
export default function Loading() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
