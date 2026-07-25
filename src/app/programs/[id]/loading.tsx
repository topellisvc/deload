import { Skeleton } from "@/components/ui/skeleton";

/**
 * Rough outline of a program's header + week tabs + day-columns row
 * instead of a bare spinner — see components/ui/skeleton.tsx for why.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[100rem] px-6 py-12">
      <div className="mb-6 flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 shrink-0" />
        ))}
      </div>
      <div className="flex flex-col gap-4 lg:flex-row">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-96 w-full shrink-0 lg:w-96" />
        ))}
      </div>
    </div>
  );
}
