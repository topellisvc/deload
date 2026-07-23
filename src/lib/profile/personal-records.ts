/**
 * The suggested PR types shown on /profile. Deliberately just a list the
 * UI iterates over — adding a new lift or distance later is one more
 * entry here, not a schema change (see migration 0009: personal_records
 * stores record_type as free text, not an enum column per lift).
 */
export type RecordCategory = "strength" | "running";

export interface RecordTypeDef {
  type: string;
  label: string;
  category: RecordCategory;
}

export const RECORD_TYPES: RecordTypeDef[] = [
  { type: "bench_press", label: "Bench Press", category: "strength" },
  { type: "squat", label: "Squat", category: "strength" },
  { type: "deadlift", label: "Deadlift", category: "strength" },
  { type: "overhead_press", label: "Overhead Press", category: "strength" },
  { type: "run_5k", label: "5K", category: "running" },
  { type: "run_10k", label: "10K", category: "running" },
  { type: "run_half_marathon", label: "Half Marathon", category: "running" },
  { type: "run_marathon", label: "Marathon", category: "running" },
];

/** "125" or "1:05:30" -> total seconds, or null if unparsable. Mirrors
 * the same accepted formats as the program builder's run set editor. */
export function parseDurationToSeconds(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return null;

  if (parts.length === 1) {
    const [minutes] = parts;
    return minutes !== undefined ? Math.round(minutes * 60) : null;
  }
  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes !== undefined && seconds !== undefined ? minutes * 60 + seconds : null;
  }
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours !== undefined && minutes !== undefined && seconds !== undefined
      ? hours * 3600 + minutes * 60 + seconds
      : null;
  }
  return null;
}

export function formatSecondsToDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
