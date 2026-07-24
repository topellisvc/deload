/** Persistent header shown throughout the exercise/rest phases — "X of Y
 * exercises" plus a fill bar for how far through the sequence the athlete
 * currently is (spec: "Workout Progress... 5 of 8 Exercises"). */
export function WorkoutProgressBar({ currentIndex, total }: { currentIndex: number; total: number }) {
  const currentNumber = Math.min(currentIndex + 1, Math.max(total, 1));
  const pct = total > 0 ? Math.round((Math.min(currentIndex, total) / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span className="uppercase tracking-wide">Workout Progress</span>
        <span>
          {currentNumber} of {total} {total === 1 ? "Exercise" : "Exercises"}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
