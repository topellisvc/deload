"use client";

import { Trash2 } from "lucide-react";
import type { PerformanceField } from "@/lib/programs/prescription-types";
import type { LoggedSet } from "@/lib/programs/types";
import { formatDuration } from "@/lib/programs/duration";
import { InlineNumberField, InlineDurationField, InlineDistanceField, InlineTextField } from "@/components/programs/inline-fields";

interface PerformanceRowEditorProps {
  /** Which fields to show — from getPrescriptionTypeDef(category, prescriptionType).performanceFields,
   * so a logged set only ever asks for what makes sense to record against
   * its own prescription (e.g. no pace field for a plain strength set). */
  fields: PerformanceField[];
  loggedSet: LoggedSet;
  onChange: (patch: Partial<LoggedSet>) => void;
  onDelete: () => void;
  /** True in Coach Review (task: Planned vs Performed) — same row shape,
   * just rendered as plain text instead of editable inputs, since only the
   * athlete who logged it can edit it (RLS enforces this regardless; this
   * just keeps the coach's view from showing dead-looking inputs). */
  readOnly?: boolean;
}

/**
 * One logged set/segment — the Performance half of a workout log, editable
 * only by the athlete who owns the session. Fields are entirely driven by
 * lib/programs/prescription-types.ts's performanceFields list, mirroring
 * how PrescriptionRowEditor is driven by prescriptionFields — the same
 * "one config, no hardcoded per-type UI" principle applied to logging.
 */
export function PerformanceRowEditor({ fields, loggedSet, onChange, onDelete, readOnly }: PerformanceRowEditorProps) {
  const set = new Set(fields);

  if (readOnly) {
    return <PerformanceRowReadOnly fields={fields} loggedSet={loggedSet} />;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {set.has("weight") && (
        <InlineNumberField label="Weight" unit="kg" value={loggedSet.performed_weight} onCommit={(v) => onChange({ performed_weight: v })} width="w-16" />
      )}
      {set.has("reps") && <InlineNumberField label="Reps" value={loggedSet.performed_reps} onCommit={(v) => onChange({ performed_reps: v })} width="w-14" />}
      {set.has("rpe") && <InlineNumberField label="RPE" value={loggedSet.performed_rpe} onCommit={(v) => onChange({ performed_rpe: v })} width="w-14" />}
      {set.has("distance") && (
        <InlineDistanceField value={loggedSet.performed_distance_meters} onCommit={(v) => onChange({ performed_distance_meters: v })} />
      )}
      {set.has("duration") && (
        <InlineDurationField label="Time" value={loggedSet.performed_duration_seconds} onCommit={(v) => onChange({ performed_duration_seconds: v })} />
      )}
      {set.has("pace") && (
        <InlineDurationField label="Pace /km" value={loggedSet.performed_pace_seconds_per_km} onCommit={(v) => onChange({ performed_pace_seconds_per_km: v })} />
      )}
      {set.has("heart_rate") && (
        <InlineNumberField label="Avg HR" unit="bpm" value={loggedSet.performed_heart_rate} onCommit={(v) => onChange({ performed_heart_rate: v })} width="w-16" />
      )}
      {set.has("calories") && (
        <InlineNumberField label="Calories" value={loggedSet.performed_calories} onCommit={(v) => onChange({ performed_calories: v })} width="w-16" />
      )}
      {set.has("notes") && (
        <InlineTextField label="Notes" value={loggedSet.notes} onCommit={(v) => onChange({ notes: v })} placeholder="Notes (optional)" />
      )}

      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete logged set"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

const READ_ONLY_LABEL: Record<PerformanceField, string> = {
  weight: "kg",
  reps: "reps",
  rpe: "RPE",
  distance: "km",
  duration: "",
  pace: "/km",
  heart_rate: "bpm avg",
  calories: "cal",
  notes: "",
};

function readOnlyValue(field: PerformanceField, loggedSet: LoggedSet): string | null {
  switch (field) {
    case "weight":
      return loggedSet.performed_weight != null ? String(loggedSet.performed_weight) : null;
    case "reps":
      return loggedSet.performed_reps != null ? String(loggedSet.performed_reps) : null;
    case "rpe":
      return loggedSet.performed_rpe != null ? String(loggedSet.performed_rpe) : null;
    case "distance":
      return loggedSet.performed_distance_meters != null ? String(loggedSet.performed_distance_meters / 1000) : null;
    case "duration":
      return loggedSet.performed_duration_seconds != null ? formatDuration(loggedSet.performed_duration_seconds) : null;
    case "pace":
      return loggedSet.performed_pace_seconds_per_km != null ? formatDuration(loggedSet.performed_pace_seconds_per_km) : null;
    case "heart_rate":
      return loggedSet.performed_heart_rate != null ? String(loggedSet.performed_heart_rate) : null;
    case "calories":
      return loggedSet.performed_calories != null ? String(loggedSet.performed_calories) : null;
    case "notes":
      return loggedSet.notes;
  }
}

function PerformanceRowReadOnly({ fields, loggedSet }: { fields: PerformanceField[]; loggedSet: LoggedSet }) {
  const parts = fields
    .filter((f) => f !== "notes")
    .map((f) => ({ field: f, value: readOnlyValue(f, loggedSet) }))
    .filter((p) => p.value !== null);
  const notes = fields.includes("notes") ? loggedSet.notes : null;

  if (parts.length === 0 && !notes) {
    return <span className="text-xs italic text-muted-foreground">Not logged</span>;
  }

  return (
    <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      {parts.map(({ field, value }) => (
        <span key={field} className="text-sm font-semibold tabular-nums text-foreground">
          {value}
          <span className="ml-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{READ_ONLY_LABEL[field]}</span>
        </span>
      ))}
      {notes && <span className="text-[11px] italic text-muted-foreground">{notes}</span>}
    </span>
  );
}
