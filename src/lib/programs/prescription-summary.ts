import { formatDistance } from "@/lib/programs/distance";
import { formatDuration } from "@/lib/programs/duration";
import type { ExerciseCategory, SetRow } from "@/lib/programs/types";

/**
 * A single scannable line for a collapsed ExerciseCard — "4 × 6 @ 80%",
 * "20 min · Zone 2", "5km" — the same information SetDetails (set-details.tsx)
 * renders as rich multi-span JSX for the full read-only view, but as one
 * plain string sized for a compact card a coach is scanning down a whole
 * day's workout at speed rather than reading closely.
 *
 * Deliberately a second implementation of the category/prescription_type
 * branching rather than reusing SetDetails directly — same precedent as
 * PreviousPerformanceCard's own formatter (training/previous-performance-card.tsx):
 * the two outputs genuinely differ in shape (one line of plain text vs.
 * several separately-styled spans), not just in styling, so collapsing them
 * into one function would mean the text-summary caller picking apart JSX or
 * the JSX caller losing its per-field styling. If a third prescription-type
 * consumer shows up wanting yet another shape, that's the signal to extract
 * a shared structured-parts representation both can render from — not
 * before.
 */
export function summarizePrescriptionPrimary(set: SetRow, category: ExerciseCategory): string {
  if (set.prescription_type === "coach_notes_only" || set.prescription_type === "coach_notes") {
    return set.notes ? `“${set.notes}”` : "No guidance added yet";
  }

  if (category === "strength") {
    switch (set.prescription_type) {
      case "fixed_weight":
        return joinParts([setsReps(set), set.weight_value != null ? `@ ${set.weight_value}kg` : null]);
      case "percent_1rm":
        return joinParts([setsReps(set), set.percent_1rm_value != null ? `@ ${set.percent_1rm_value}%` : null]);
      case "rpe":
        return joinParts([setsReps(set), set.rpe_value != null ? `@ RPE ${set.rpe_value}` : null]);
      case "rir":
        return joinParts([setsReps(set), set.rir_value != null ? `@ ${set.rir_value} RIR` : null]);
      case "rep_range":
        return joinParts([`${set.sets} ×`, set.min_reps != null && set.max_reps != null ? `${set.min_reps}–${set.max_reps} reps` : "? reps"]);
      case "athlete_chooses_weight":
        return joinParts([setsReps(set), "athlete's choice"]);
      default:
        return "—";
    }
  }

  // running + cardio share the same shape for every type they hold in common
  switch (set.prescription_type) {
    case "distance":
      return set.distance_meters != null ? formatDistance(set.distance_meters) : "—";
    case "time":
      return set.duration_seconds != null ? formatDuration(set.duration_seconds) : "—";
    case "distance_time":
      return joinParts([
        set.distance_meters != null ? formatDistance(set.distance_meters) : null,
        set.duration_seconds != null ? `in ${formatDuration(set.duration_seconds)}` : null,
      ]);
    case "pace":
      return set.pace_seconds_per_km != null ? `${formatDuration(set.pace_seconds_per_km)}/km` : "—";
    case "heart_rate_zone":
      return joinParts([
        set.duration_seconds != null ? formatDuration(set.duration_seconds) : null,
        set.heart_rate_zone != null ? `Zone ${set.heart_rate_zone}` : null,
      ]);
    case "rpe":
      return joinParts([
        set.duration_seconds != null ? formatDuration(set.duration_seconds) : null,
        set.rpe_value != null ? `RPE ${set.rpe_value}` : null,
      ]);
    case "intervals":
      return joinParts([
        `${set.sets} ×`,
        set.distance_meters != null ? formatDistance(set.distance_meters) : null,
        set.duration_seconds != null ? formatDuration(set.duration_seconds) : null,
      ]);
    case "calories":
      return set.calories != null ? `${set.calories} cal` : "—";
    case "reps":
      return setsReps(set);
    default:
      return "—";
  }
}

function setsReps(set: SetRow): string {
  return `${set.sets} × ${set.reps || "?"}`;
}

function joinParts(parts: (string | null)[]): string {
  const filtered = parts.filter((p): p is string => p != null && p !== "");
  return filtered.length > 0 ? filtered.join(" ") : "—";
}

/** "Rest 2:00" — omitted entirely by the caller when rest_seconds is null,
 * matching the collapsed-card spec's "Rest Summary" example exactly. */
export function summarizeRest(set: SetRow): string | null {
  return set.rest_seconds != null ? `Rest ${formatDuration(set.rest_seconds)}` : null;
}
