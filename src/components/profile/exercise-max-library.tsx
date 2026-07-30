import type { ExerciseMaxHistoryEntry } from "@/lib/profile/queries";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

interface ExerciseMaxLibraryProps {
  history: Map<string, ExerciseMaxHistoryEntry[]>;
}

/**
 * "A library of an athlete's max weights" — every exercise ever tested via
 * a program's testing week (either the generator's own 4-main-lift flow or
 * the manual builder's per-exercise "Test max before" checkbox, migration
 * 0054), with the full history of tests for each one, not just the latest.
 * Read-only: unlike PersonalRecords' running times, there's no manual-entry
 * path here at all — every row here was computed from a logged set, never
 * hand-typed, so there's nothing to edit.
 *
 * Doesn't render at all when the athlete has never logged a testing-week
 * set — same "don't show an empty shell" convention as
 * CoachingSummaryCard/AthleteSummaryCard being conditionally rendered by
 * their callers, just enforced here instead since this component always
 * gets the same history prop shape either way.
 */
export function ExerciseMaxLibrary({ history }: ExerciseMaxLibraryProps) {
  if (history.size === 0) return null;

  const exercises = [...history.entries()].sort((a, b) => a[1][0]!.exerciseName.localeCompare(b[1][0]!.exerciseName));

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">Library of maxes</h2>
      <p className="mb-5 text-sm text-muted-foreground">
        Every exercise you&apos;ve tested in a program&apos;s testing week, calculated automatically from what you logged — track progress over time.
      </p>
      <div className="flex flex-col gap-4">
        {exercises.map(([exerciseId, entries]) => {
          const [latest, ...earlier] = entries;
          if (!latest) return null;
          return (
            <div key={exerciseId} className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{latest.exerciseName}</span>
                <span className="text-xs text-muted-foreground">{formatDate(latest.performedOn)}</span>
              </div>
              <span className="text-lg font-semibold tabular-nums text-foreground">{latest.estimated1RMKg}kg</span>
              {earlier.length > 0 && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none hover:text-foreground">
                    {earlier.length} earlier {earlier.length === 1 ? "test" : "tests"}
                  </summary>
                  <ul className="mt-2 flex flex-col gap-1">
                    {earlier.map((entry, i) => (
                      <li key={i} className="flex items-center justify-between tabular-nums">
                        <span>{formatDate(entry.performedOn)}</span>
                        <span>{entry.estimated1RMKg}kg</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
