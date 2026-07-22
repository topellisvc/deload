import { cn } from "@/lib/utils";

interface AcwrBarChartProps {
  weeklyLoads: number[];
  labels: string[];
}

/**
 * A minimal 4-bar visualization of the weekly loads feeding the ratio.
 * The most recent week (acute load) is visually distinguished so it's
 * obvious at a glance which bar the ratio is being measured against.
 */
export function AcwrBarChart({ weeklyLoads, labels }: AcwrBarChartProps) {
  const max = Math.max(...weeklyLoads, 1);

  return (
    <div className="flex items-end gap-3 h-32">
      {weeklyLoads.map((load, index) => {
        const isAcute = index === weeklyLoads.length - 1;
        const heightPct = Math.max((load / max) * 100, 3);
        return (
          <div key={index} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex w-full flex-1 items-end">
              <div
                className={cn(
                  "w-full rounded-t-md transition-all",
                  isAcute ? "bg-primary" : "bg-muted"
                )}
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span
              className={cn(
                "text-xs",
                isAcute ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              {labels[index]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
