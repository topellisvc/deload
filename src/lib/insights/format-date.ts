/** "Published {date}" formatting for Insights articles — a real
 * timestamptz (unlike the app's date-only log columns that
 * src/lib/dates.ts's formatLogDate handles), so this renders in the
 * viewer's own timezone rather than being UTC-pinned. Kept separate from
 * dates.ts since Insights' publish/update dates are a genuinely different
 * kind of date (long-lived editorial content, not a daily workout log). */
export function formatArticleDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** True if updatedAt is meaningfully later than publishedAt — used to
 * decide whether an article page should show a separate "Updated" date
 * at all, rather than always showing two identical dates. */
export function wasUpdatedAfterPublishing(publishedAt: string, updatedAt: string): boolean {
  return new Date(updatedAt).getTime() - new Date(publishedAt).getTime() > 60_000;
}
