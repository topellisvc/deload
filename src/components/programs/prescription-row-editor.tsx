"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { PrescriptionField } from "@/lib/programs/prescription-types";
import { getPrescriptionTypeDef } from "@/lib/programs/prescription-types";
import { RECORD_TYPES } from "@/lib/profile/personal-records";
import type { ExerciseCategory, SetRow } from "@/lib/programs/types";
import { InlineNumberField, InlineDurationField, InlineDistanceField } from "@/components/programs/inline-fields";
import { cn } from "@/lib/utils";

const STRENGTH_PR_TYPES = RECORD_TYPES.filter((r) => r.category === "strength");

const HEART_RATE_ZONES = [1, 2, 3, 4, 5];

interface PrescriptionRowEditorProps {
  category: ExerciseCategory;
  set: SetRow;
  onChange: (patch: Partial<SetRow>) => void;
  onDelete: () => void;
}

/**
 * One editable prescription row, its visible fields entirely driven by
 * lib/programs/prescription-types.ts's field list for
 * (category, set.prescription_type) — replaces the old SetRowEditor
 * (strength-only) and RunSetRowEditor (run-only), which each hardcoded
 * their own fixed field set and couldn't express e.g. RIR, rep ranges, or
 * anything cardio. Adding a new prescription type later is a config
 * change in prescription-types.ts, not a new editor component.
 */
export function PrescriptionRowEditor({ category, set, onChange, onDelete }: PrescriptionRowEditorProps) {
  const def = getPrescriptionTypeDef(category, set.prescription_type);
  const fields = new Set<PrescriptionField>(def?.prescriptionFields ?? []);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {fields.has("sets") && <SetsField set={set} onChange={onChange} />}
      {fields.has("reps") && <RepsField set={set} onChange={onChange} />}
      {fields.has("rep_range") && <RepRangeField set={set} onChange={onChange} />}
      {fields.has("weight") && <InlineNumberField label="Weight" unit="kg" value={set.weight_value} onCommit={(v) => onChange({ weight_value: v })} width="w-16" />}
      {fields.has("percent_1rm") && <Percent1RMFields set={set} onChange={onChange} />}
      {fields.has("rpe") && <InlineNumberField label="RPE" value={set.rpe_value} onCommit={(v) => onChange({ rpe_value: v })} width="w-14" />}
      {fields.has("rir") && <InlineNumberField label="RIR" value={set.rir_value} onCommit={(v) => onChange({ rir_value: v })} width="w-14" />}
      {fields.has("distance") && <DistanceField set={set} onChange={onChange} />}
      {fields.has("duration") && <InlineDurationField label="Time" value={set.duration_seconds} onCommit={(v) => onChange({ duration_seconds: v })} />}
      {fields.has("pace") && <InlineDurationField label="Pace /km" value={set.pace_seconds_per_km} onCommit={(v) => onChange({ pace_seconds_per_km: v })} />}
      {fields.has("heart_rate_zone") && <HeartRateZoneField set={set} onChange={onChange} />}
      {fields.has("calories") && <InlineNumberField label="Calories" value={set.calories} onCommit={(v) => onChange({ calories: v })} width="w-16" />}
      {fields.has("rest") && <InlineNumberField label="Rest" unit="sec" value={set.rest_seconds} onCommit={(v) => onChange({ rest_seconds: v })} width="w-16" />}
      {fields.has("notes") && <NotesField set={set} onChange={onChange} placeholder="Coach notes (optional)" />}
      {fields.has("notes_primary") && <NotesField set={set} onChange={onChange} placeholder="What should the athlete do?" primary />}

      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete prescription row"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

// ---- field primitives (local to this file — a few fields need bespoke
// parsing (sets/reps/distance-in-km) that doesn't fit the generic
// InlineNumberField/InlineDurationField shape from inline-fields.tsx, so
// only those stay here) ----

function SetsField({ set, onChange }: { set: SetRow; onChange: (patch: Partial<SetRow>) => void }) {
  const [text, setText] = useState(String(set.sets));
  useEffect(() => setText(String(set.sets)), [set.sets]);
  function commit() {
    const n = Math.max(1, Math.round(Number(text)) || 1);
    setText(String(n));
    if (n !== set.sets) onChange({ sets: n });
  }
  return (
    <div className="flex items-center gap-1">
      <input
        aria-label="Number of sets"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        inputMode="numeric"
        className="h-8 w-11 shrink-0 rounded-md border border-border bg-surface px-1 text-center text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
      <span className="shrink-0 text-xs text-muted-foreground">sets</span>
    </div>
  );
}

function RepsField({ set, onChange }: { set: SetRow; onChange: (patch: Partial<SetRow>) => void }) {
  const [text, setText] = useState(set.reps ?? "");
  useEffect(() => setText(set.reps ?? ""), [set.reps]);
  function commit() {
    const trimmed = text.trim();
    if (trimmed !== (set.reps ?? "")) onChange({ reps: trimmed || null });
  }
  return (
    <div className="flex min-w-[6rem] flex-1 items-center gap-1">
      <input
        aria-label="Reps"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        placeholder="8-10"
        className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
      <span className="shrink-0 text-xs text-muted-foreground">reps</span>
    </div>
  );
}

function RepRangeField({ set, onChange }: { set: SetRow; onChange: (patch: Partial<SetRow>) => void }) {
  return (
    <div className="flex items-center gap-1">
      <InlineNumberField label="Min reps" value={set.min_reps} onCommit={(v) => onChange({ min_reps: v })} width="w-12" min={1} />
      <span className="text-xs text-muted-foreground">–</span>
      <InlineNumberField label="Max reps" value={set.max_reps} onCommit={(v) => onChange({ max_reps: v })} width="w-12" min={1} />
      <span className="shrink-0 text-xs text-muted-foreground">reps</span>
    </div>
  );
}

function DistanceField({ set, onChange }: { set: SetRow; onChange: (patch: Partial<SetRow>) => void }) {
  return <InlineDistanceField value={set.distance_meters} onCommit={(v) => onChange({ distance_meters: v })} />;
}

function Percent1RMFields({ set, onChange }: { set: SetRow; onChange: (patch: Partial<SetRow>) => void }) {
  return (
    <>
      <InlineNumberField label="% 1RM" value={set.percent_1rm_value} onCommit={(v) => onChange({ percent_1rm_value: v })} width="w-14" />
      <select
        aria-label="Which 1RM to base this on"
        value={set.pr_record_type ?? ""}
        onChange={(e) => onChange({ pr_record_type: e.target.value || null })}
        className="h-8 shrink-0 rounded-md border border-border bg-surface px-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <option value="">Which 1RM?</option>
        {STRENGTH_PR_TYPES.map((r) => (
          <option key={r.type} value={r.type}>
            {r.label}
          </option>
        ))}
      </select>
    </>
  );
}

function HeartRateZoneField({ set, onChange }: { set: SetRow; onChange: (patch: Partial<SetRow>) => void }) {
  return (
    <select
      aria-label="Heart rate zone"
      value={set.heart_rate_zone ?? ""}
      onChange={(e) => onChange({ heart_rate_zone: e.target.value ? Number(e.target.value) : null })}
      className="h-8 shrink-0 rounded-md border border-border bg-surface px-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <option value="">Zone</option>
      {HEART_RATE_ZONES.map((z) => (
        <option key={z} value={z}>
          Zone {z}
        </option>
      ))}
    </select>
  );
}

function NotesField({
  set,
  onChange,
  placeholder,
  primary,
}: {
  set: SetRow;
  onChange: (patch: Partial<SetRow>) => void;
  placeholder: string;
  primary?: boolean;
}) {
  const [text, setText] = useState(set.notes ?? "");
  useEffect(() => setText(set.notes ?? ""), [set.notes]);
  function commit() {
    const trimmed = text.trim();
    if (trimmed !== (set.notes ?? "")) onChange({ notes: trimmed || null });
  }
  return (
    <input
      aria-label={primary ? "Coach guidance" : "Coach notes"}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      placeholder={placeholder}
      className={cn(
        "h-8 min-w-[10rem] rounded-md border border-border bg-surface px-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        primary ? "flex-1 basis-full" : "flex-1"
      )}
    />
  );
}
