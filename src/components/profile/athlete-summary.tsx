import type { ReactNode } from "react";
import Link from "next/link";
import type { AthleteSummary as AthleteSummaryData } from "@/lib/profile/queries";

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) return isoDate;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

interface AthleteSummaryProps {
  summary: AthleteSummaryData;
}

/** Only rendered by the page when the signed-in user has an accepted
 * coach relationship — see /profile/page.tsx. Rows for current program,
 * week, last workout, and completion only appear once there's actually a
 * program assigned by this coach to measure them from. */
export function AthleteSummaryCard({ summary }: AthleteSummaryProps) {
  const rows: { label: string; value: ReactNode }[] = [{ label: "Coach", value: summary.coachName }];

  if (summary.currentProgram) {
    rows.push({
      label: "Current program",
      value: (
        <Link href={`/programs/${summary.currentProgram.id}`} className="text-primary hover:underline">
          {summary.currentProgram.name}
        </Link>
      ),
    });
  }
  if (summary.currentWeekLabel) rows.push({ label: "Current week", value: summary.currentWeekLabel });
  if (summary.lastWorkoutLoggedOn) {
    rows.push({ label: "Last workout logged", value: formatDate(summary.lastWorkoutLoggedOn) });
  }
  if (summary.completionPercent !== null) {
    rows.push({ label: "Program completion", value: `${summary.completionPercent}%` });
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Your coaching</h2>
      <dl className="flex flex-col divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className="text-right text-sm font-medium text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
