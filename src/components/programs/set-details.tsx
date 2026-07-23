import { Clock3 } from "lucide-react";
import { formatDuration } from "@/lib/programs/duration";
import type { ExerciseCategory, SetRow } from "@/lib/programs/types";

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-sm font-semibold tabular-nums text-foreground">{value}</span>
      {label && <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>}
    </span>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-foreground/80">{children}</span>
  );
}

/** The bold "what this row actually prescribes" phrase — the one thing
 * every prescription_type formats differently, since "4 x 6 @ 100kg" and
 * "20 minutes, Zone 2" and "1000m" genuinely don't share a shape. Every
 * *_notes(_only) type has no numeric primary at all — its notes field IS
 * the prescription, handled by SetDetails itself rather than here. */
function Primary({ set, category }: { set: SetRow; category: ExerciseCategory }) {
  const dash = <span className="text-muted-foreground">—</span>;

  if (category === "strength") {
    switch (set.prescription_type) {
      case "fixed_weight":
        return (
          <span className="flex items-baseline gap-2.5">
            <Stat value={set.sets} label="sets" />
            <Stat value={set.reps || "?"} label="reps" />
            {set.weight_value != null && <Pill>{set.weight_value}kg</Pill>}
          </span>
        );
      case "percent_1rm":
        return (
          <span className="flex items-baseline gap-2.5">
            <Stat value={set.sets} label="sets" />
            <Stat value={set.reps || "?"} label="reps" />
            {set.percent_1rm_value != null && <Pill>{set.percent_1rm_value}% 1RM</Pill>}
          </span>
        );
      case "rpe":
        return (
          <span className="flex items-baseline gap-2.5">
            <Stat value={set.sets} label="sets" />
            <Stat value={set.reps || "?"} label="reps" />
            {set.rpe_value != null && <Pill>RPE {set.rpe_value}</Pill>}
          </span>
        );
      case "rir":
        return (
          <span className="flex items-baseline gap-2.5">
            <Stat value={set.sets} label="sets" />
            <Stat value={set.reps || "?"} label="reps" />
            {set.rir_value != null && <Pill>{set.rir_value} RIR</Pill>}
          </span>
        );
      case "rep_range":
        return (
          <span className="flex items-baseline gap-2.5">
            <Stat value={set.sets} label="sets" />
            <Stat value={set.min_reps != null && set.max_reps != null ? `${set.min_reps}–${set.max_reps}` : "?"} label="reps" />
          </span>
        );
      case "athlete_chooses_weight":
        return (
          <span className="flex items-baseline gap-2.5">
            <Stat value={set.sets} label="sets" />
            <Stat value={set.reps || "?"} label="reps" />
            <Pill>Athlete&apos;s choice</Pill>
          </span>
        );
      case "coach_notes_only":
        return dash;
    }
  }

  // running + cardio share the same shape for every type they hold in common
  switch (set.prescription_type) {
    case "distance":
      return set.distance_meters != null ? <Stat value={`${set.distance_meters / 1000}km`} label="" /> : dash;
    case "time":
      return set.duration_seconds != null ? <Stat value={formatDuration(set.duration_seconds)} label="" /> : dash;
    case "distance_time":
      return (
        <span className="flex items-baseline gap-1.5">
          {set.distance_meters != null && <Stat value={`${set.distance_meters / 1000}km`} label="" />}
          {set.distance_meters != null && set.duration_seconds != null && (
            <span className="text-[11px] text-muted-foreground">in</span>
          )}
          {set.duration_seconds != null && <Stat value={formatDuration(set.duration_seconds)} label="" />}
        </span>
      );
    case "pace":
      return set.pace_seconds_per_km != null ? <Stat value={`${formatDuration(set.pace_seconds_per_km)}/km`} label="" /> : dash;
    case "heart_rate_zone":
      return (
        <span className="flex items-baseline gap-2.5">
          {set.duration_seconds != null && <Stat value={formatDuration(set.duration_seconds)} label="" />}
          {set.heart_rate_zone != null && <Pill>Zone {set.heart_rate_zone}</Pill>}
        </span>
      );
    case "rpe":
      return (
        <span className="flex items-baseline gap-2.5">
          {set.duration_seconds != null && <Stat value={formatDuration(set.duration_seconds)} label="" />}
          {set.rpe_value != null && <Pill>RPE {set.rpe_value}</Pill>}
        </span>
      );
    case "intervals":
      return (
        <span className="flex items-baseline gap-2.5">
          <Stat value={set.sets} label="×" />
          {set.distance_meters != null && <Stat value={`${set.distance_meters / 1000}km`} label="" />}
          {set.duration_seconds != null && <Stat value={formatDuration(set.duration_seconds)} label="" />}
        </span>
      );
    case "calories":
      return set.calories != null ? <Stat value={set.calories} label="cal" /> : dash;
    case "coach_notes":
      return dash;
    default:
      return dash;
  }
}

/**
 * One prescription row, rendered as a scannable strip — the bold primary
 * value (Primary, above) with rest/notes as secondary pills alongside it.
 * Fully driven by prescription_type + category rather than a strength/run
 * boolean (migration 0012's flexible model), so it renders correctly for
 * all 19 prescription types across strength/running/cardio, not just the
 * two shapes the old load_type/isRun version understood.
 *
 * Extracted out of ProgramViewer so the dashboard's Today's Workout card
 * renders the exact same formatting instead of a second, drifting copy.
 */
export function SetDetails({ set, category }: { set: SetRow; category: ExerciseCategory }) {
  const isNotesOnly = set.prescription_type === "coach_notes_only" || set.prescription_type === "coach_notes";

  if (isNotesOnly) {
    return (
      <p className="text-sm italic text-foreground">
        {set.notes ? `“${set.notes}”` : <span className="text-muted-foreground">No guidance added yet.</span>}
      </p>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <Primary set={set} category={category} />
      {set.rest_seconds != null && (
        <span className="flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
          <Clock3 className="size-3" />
          {set.rest_seconds}s
        </span>
      )}
      {set.notes && <span className="text-[11px] italic text-muted-foreground">{set.notes}</span>}
    </span>
  );
}
