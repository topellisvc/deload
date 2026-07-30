/**
 * Shared by every place that displays a distance_meters value — the
 * prescription summary line and the read-only prescription display.
 * Previously each duplicated `${distance_meters / 1000}km` inline, which
 * reads fine for a 5km run but produces nonsense like "0.04km" for a 40m
 * sprint rep. Sub-1000m distances (sprints, short intervals) display in
 * meters; 1000m and up display in km, trimmed to at most 2 decimal places
 * so "1000m" reads as "1km" and "1050m" reads as "1.05km" rather than
 * "1.0500000000000002km" from float division. Same precedent as
 * duration.ts's formatDuration — one formatter instead of N drifting
 * copies.
 */
export function formatDistance(meters: number | null): string {
  if (meters == null) return "";
  if (meters < 1000) return `${Math.round(meters)}m`;
  const km = Math.round((meters / 1000) * 100) / 100;
  return `${km}km`;
}
