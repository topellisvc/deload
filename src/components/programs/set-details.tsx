import { Clock3 } from "lucide-react";
import type { SetRow } from "@/lib/programs/types";

export function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds == null) return "";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * One prescription row, rendered as a scannable strip rather than a single
 * run-on sentence: the sets×reps (or run distance/duration) stands out in
 * bold, load and rest are secondary pills off to the side. Exercises with
 * more than one prescription row (e.g. a working set and a back-off set)
 * end up as a small aligned stack instead of two near-identical sentences.
 *
 * Extracted out of ProgramViewer so the dashboard's Today's Workout card
 * can render the exact same set formatting instead of a second, drifting
 * copy of this logic.
 */
export function SetDetails({ set, isRun }: { set: SetRow; isRun: boolean }) {
  if (isRun) {
    const distance = set.distance_meters != null ? `${set.distance_meters / 1000}km` : null;
    const duration = set.duration_seconds != null ? formatDuration(set.duration_seconds) : null;
    if (!distance && !duration) {
      return <span className="text-muted-foreground">—</span>;
    }
    return (
      <span className="flex items-baseline gap-1.5">
        {distance && <span className="text-sm font-semibold tabular-nums text-foreground">{distance}</span>}
        {distance && duration && <span className="text-[11px] text-muted-foreground">in</span>}
        {duration && <span className="text-sm font-semibold tabular-nums text-foreground">{duration}</span>}
      </span>
    );
  }

  const loadLabel =
    set.load_value != null
      ? `${set.load_value}${set.load_type === "percent_1rm" ? "%" : set.load_type === "weight" ? "kg" : ""}`
      : set.load_type !== "weight"
        ? set.load_type.replace("_", " ")
        : null;

  return (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <span className="flex items-baseline gap-2.5">
        <span className="flex items-baseline gap-1">
          <span className="text-sm font-semibold tabular-nums text-foreground">{set.sets}</span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">sets</span>
        </span>
        <span className="flex items-baseline gap-1">
          <span className="text-sm font-semibold tabular-nums text-foreground">{set.reps || "?"}</span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">reps</span>
        </span>
      </span>
      {loadLabel && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-foreground/80">
          {loadLabel}
        </span>
      )}
      {set.rest_seconds != null && (
        <span className="flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
          <Clock3 className="size-3" />
          {set.rest_seconds}s
        </span>
      )}
    </span>
  );
}
