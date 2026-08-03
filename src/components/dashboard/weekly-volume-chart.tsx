/**
 * A plain CSS bar chart — no charting library. The whole app has zero chart
 * dependencies today (grepped package.json before starting this), and a
 * 7-bar "how tall relative to the week's max" chart doesn't need one: each
 * bar's height is just `volumeKg / weekMax` as a percentage inside a fixed-
 * height track, todays's bar picked out with the primary color so it reads
 * as "this is where we are in the week" the way the mockup's own chart did.
 *
 * date strings are plain "YYYY-MM-DD" (see getWeeklyTrainingSummary) —
 * parsed via Date.UTC + a UTC-anchored weekday label, same pattern
 * lib/dashboard/queries.ts's own shiftDate/daysBetween already use for
 * date-only strings, so the weekday label can't drift a day off depending
 * on the viewer's own timezone offset.
 */
function weekdayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  return date.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });
}

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function WeeklyVolumeChart({ data }: { data: { date: string; volumeKg: number }[] }) {
  const today = todayDateString();
  const maxVolume = Math.max(1, ...data.map((d) => d.volumeKg));
  const totalVolume = data.reduce((sum, d) => sum + d.volumeKg, 0);

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Weekly volume</h2>
        <span className="text-xs text-muted-foreground">{totalVolume.toLocaleString()} kg total</span>
      </div>

      {totalVolume === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No strength sets logged in the last 7 days yet.</p>
      ) : (
        <div className="flex h-32 items-end justify-between gap-2">
          {data.map((point) => {
            const isToday = point.date === today;
            const heightPercent = Math.max(4, Math.round((point.volumeKg / maxVolume) * 100));
            return (
              <div key={point.date} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-24 w-full items-end">
                  <div
                    className={isToday ? "w-full rounded-t-sm bg-primary" : "w-full rounded-t-sm bg-primary/30"}
                    style={{ height: `${heightPercent}%` }}
                    title={`${weekdayLabel(point.date)}: ${point.volumeKg.toLocaleString()} kg`}
                  />
                </div>
                <span className={isToday ? "text-xs font-medium text-primary" : "text-xs text-muted-foreground"}>
                  {weekdayLabel(point.date)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
