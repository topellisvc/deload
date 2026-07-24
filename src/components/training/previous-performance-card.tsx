import { History } from "lucide-react";
import { formatDuration } from "@/lib/programs/duration";
import { formatLogDate, todayDateString } from "@/lib/dates";
import type { ExerciseCategory } from "@/lib/programs/types";
import type { LoggedSet } from "@/lib/supabase/types";
import type { PreviousPerformance } from "@/lib/training/types";

function hasRealValue(set: LoggedSet): boolean {
  return (
    set.performed_weight != null ||
    set.performed_reps != null ||
    set.performed_distance_meters != null ||
    set.performed_duration_seconds != null ||
    set.performed_calories != null
  );
}

function formatSet(set: LoggedSet, category: ExerciseCategory): string {
  if (category === "strength") {
    const parts: string[] = [];
    if (set.performed_weight != null) parts.push(`${set.performed_weight}kg`);
    if (set.performed_reps != null) parts.push(`× ${set.performed_reps}`);
    if (set.performed_rpe != null) parts.push(`@ RPE ${set.performed_rpe}`);
    return parts.join(" ") || "Logged";
  }
  const parts: string[] = [];
  if (set.performed_distance_meters != null) parts.push(`${(set.performed_distance_meters / 1000).toFixed(2)}km`);
  if (set.performed_duration_seconds != null) parts.push(formatDuration(set.performed_duration_seconds));
  if (set.performed_calories != null) parts.push(`${set.performed_calories} cal`);
  return parts.join(" · ") || "Logged";
}

/**
 * "Last Session" — what the athlete actually did the previous time they
 * trained this exercise, never the programmed target (spec: "Do not compare
 * against the programmed workout"). Helps decide whether to push weight up
 * or hold steady. Renders nothing when there's no prior occurrence.
 */
export function PreviousPerformanceCard({ previous, category }: { previous: PreviousPerformance; category: ExerciseCategory }) {
  const realSets = previous.sets.filter(hasRealValue);
  if (realSets.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-4">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <History className="size-3.5" />
        Last Session · {formatLogDate(previous.performedOn, todayDateString())}
      </span>
      <ul className="flex flex-col gap-1">
        {realSets.map((set) => (
          <li key={set.id} className="text-sm font-medium tabular-nums text-foreground">
            {formatSet(set, category)}
          </li>
        ))}
      </ul>
    </div>
  );
}
