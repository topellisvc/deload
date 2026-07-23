/**
 * Shared by every place that reads or writes a duration_seconds value —
 * the prescription editor, the read-only prescription display, and the
 * performance logger. Previously duplicated between run-set-row-editor.tsx
 * and set-details.tsx; consolidated here so there's exactly one parser and
 * one formatter instead of two that could quietly drift apart.
 */
export function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds == null) return "";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Accepts "25:00", "25" (bare number = minutes), or "1:05:00" — returns total seconds, or null if unparsable. */
export function parseDuration(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return null;
  const [a, b, c] = parts;
  if (parts.length === 1 && a !== undefined) return Math.round(a * 60);
  if (parts.length === 2 && a !== undefined && b !== undefined) return a * 60 + b;
  if (parts.length === 3 && a !== undefined && b !== undefined && c !== undefined) return a * 3600 + b * 60 + c;
  return null;
}
