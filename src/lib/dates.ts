/** Local calendar date (not UTC) — "today" should follow the viewer's own
 * clock, not whatever timezone the server happens to be in. Used to decide
 * whether a logged date should read as "Today" instead of a formatted date. */
export function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Formats a `YYYY-MM-DD` date string for display, parsed and rendered as
 * UTC so the shown date always matches what was actually stored regardless
 * of the viewer's own timezone offset (a date-only column has no time
 * component to shift). Consolidated from what were three near-identical
 * copies (day-log-control.tsx, program-viewer.tsx, and the workout history
 * page) into one place.
 */
export function formatLogDate(isoDate: string, today: string, options?: { includeYear?: boolean; capitalize?: boolean }): string {
  if (isoDate === today) return options?.capitalize === false ? "today" : "Today";
  const [year, month, day] = isoDate.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return isoDate;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: options?.includeYear ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

/** Wall-clock time (viewer's own timezone, unlike formatLogDate's UTC —
 * this is a real timestamptz, not a date-only column) for a completed
 * session's completed_at. e.g. "6:42 PM". Consolidated from what used to
 * be an inline copy in hero-section.tsx. */
export function formatLogTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
