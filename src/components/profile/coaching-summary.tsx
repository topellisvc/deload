import type { CoachingSummary as CoachingSummaryData } from "@/lib/profile/queries";

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) return isoDate;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

interface CoachingSummaryProps {
  summary: CoachingSummaryData;
}

/** Only rendered by the page when the signed-in user is a coach — see
 * /profile/page.tsx. */
export function CoachingSummaryCard({ summary }: CoachingSummaryProps) {
  const rows = [
    { label: "Active clients", value: summary.activeClients },
    { label: "Pending invitations", value: summary.pendingInvites },
    { label: "Programs shared", value: summary.programsShared },
    ...(summary.lastClientActivity
      ? [
          {
            label: "Last client activity",
            value: `${summary.lastClientActivity.clientEmail} · ${formatDate(summary.lastClientActivity.performedOn)}`,
          },
        ]
      : []),
  ];

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Coaching</h2>
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
