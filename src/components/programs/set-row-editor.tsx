"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { LoadType, SetRow } from "@/lib/programs/types";
import { cn } from "@/lib/utils";

const LOAD_TYPE_META: Record<LoadType, { label: string; unit: string | null }> = {
  weight: { label: "Weight", unit: "kg" },
  percent_1rm: { label: "% 1RM", unit: "%" },
  rpe: { label: "RPE", unit: null },
  bodyweight: { label: "Bodyweight", unit: null },
  other: { label: "Other", unit: null },
};
const LOAD_TYPE_OPTIONS = Object.entries(LOAD_TYPE_META).map(([value, meta]) => ({
  value: value as LoadType,
  ...meta,
}));

interface SetRowEditorProps {
  set: SetRow;
  onChange: (patch: Partial<SetRow>) => void;
  onDelete: () => void;
}

/**
 * One editable row: sets x reps @ load, plus rest and a delete button.
 * Text/number fields commit onBlur (not per keystroke) to avoid firing a
 * write on every character; the load-type select and delete commit
 * immediately since they're discrete choices, not typing.
 */
export function SetRowEditor({ set, onChange, onDelete }: SetRowEditorProps) {
  const [sets, setSets] = useState(String(set.sets));
  const [reps, setReps] = useState(set.reps ?? "");
  const [loadValue, setLoadValue] = useState(set.load_value != null ? String(set.load_value) : "");
  const [rest, setRest] = useState(set.rest_seconds != null ? String(set.rest_seconds) : "");
  const [loadInvalid, setLoadInvalid] = useState(false);
  const [restInvalid, setRestInvalid] = useState(false);

  useEffect(() => setSets(String(set.sets)), [set.sets]);
  useEffect(() => setReps(set.reps ?? ""), [set.reps]);
  useEffect(() => setLoadValue(set.load_value != null ? String(set.load_value) : ""), [set.load_value]);
  useEffect(() => setRest(set.rest_seconds != null ? String(set.rest_seconds) : ""), [set.rest_seconds]);

  const loadOption = LOAD_TYPE_META[set.load_type];
  const showLoadValue = loadOption.unit !== null;

  function commitSets() {
    const n = Math.max(1, Math.round(Number(sets)) || 1);
    setSets(String(n));
    if (n !== set.sets) onChange({ sets: n });
  }

  function commitReps() {
    const trimmed = reps.trim();
    if (trimmed !== (set.reps ?? "")) onChange({ reps: trimmed || null });
  }

  // Unparsable input used to silently commit as null — the field would go
  // blank on blur with no explanation, which reads as "did that just get
  // cleared, or did I mishit something?". Now it's left alone (not
  // committed, not cleared) with a red border until fixed, same as any
  // other form validation error.
  function commitLoadValue() {
    const trimmed = loadValue.trim();
    if (trimmed === "") {
      setLoadInvalid(false);
      if (set.load_value !== null) onChange({ load_value: null });
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      setLoadInvalid(true);
      return;
    }
    setLoadInvalid(false);
    if (n !== set.load_value) onChange({ load_value: n });
  }

  function commitRest() {
    const trimmed = rest.trim();
    if (trimmed === "") {
      setRestInvalid(false);
      if (set.rest_seconds !== null) onChange({ rest_seconds: null });
      return;
    }
    const n = Math.max(0, Math.round(Number(trimmed)));
    if (!Number.isFinite(n)) {
      setRestInvalid(true);
      return;
    }
    setRestInvalid(false);
    if (n !== set.rest_seconds) onChange({ rest_seconds: n });
  }

  return (
    // Flexbox with wrap, not a fixed grid template: this row lives inside a
    // day column with a fixed pixel width regardless of viewport size, so
    // Tailwind's viewport-based sm:/lg: breakpoints don't reflect the space
    // actually available here — they were previously causing extra columns
    // to appear on wide screens with nowhere to fit, squeezing the reps
    // field to near-zero. Flex-wrap just reflows onto a second line when
    // the row runs out of room, based on the column's real width.
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <div className="flex items-center gap-1">
        <input
          aria-label="Number of sets"
          value={sets}
          onChange={(e) => setSets(e.target.value)}
          onBlur={commitSets}
          inputMode="numeric"
          className="h-8 w-11 shrink-0 rounded-md border border-border bg-surface px-1 text-center text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <span className="shrink-0 text-xs text-muted-foreground">sets</span>
      </div>
      <div className="flex min-w-[6rem] flex-1 items-center gap-1">
        <input
          aria-label="Reps"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          onBlur={commitReps}
          placeholder="8-10"
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <span className="shrink-0 text-xs text-muted-foreground">reps</span>
      </div>
      <select
        aria-label="Load type"
        value={set.load_type}
        onChange={(e) => onChange({ load_type: e.target.value as LoadType })}
        className="h-8 shrink-0 rounded-md border border-border bg-surface px-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {LOAD_TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {showLoadValue && (
        <div className="flex items-center gap-1">
          <input
            aria-label={`Load (${loadOption.unit})`}
            aria-invalid={loadInvalid}
            value={loadValue}
            onChange={(e) => {
              setLoadValue(e.target.value);
              if (loadInvalid) setLoadInvalid(false);
            }}
            onBlur={commitLoadValue}
            inputMode="decimal"
            className={cn(
              "h-8 w-14 shrink-0 rounded-md border bg-surface px-1.5 text-center text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              loadInvalid ? "border-danger" : "border-border"
            )}
          />
          <span className="shrink-0 text-xs text-muted-foreground">{loadOption.unit}</span>
        </div>
      )}
      <div className="flex items-center gap-1">
        <input
          aria-label="Rest (seconds)"
          aria-invalid={restInvalid}
          value={rest}
          onChange={(e) => {
            setRest(e.target.value);
            if (restInvalid) setRestInvalid(false);
          }}
          onBlur={commitRest}
          inputMode="numeric"
          className={cn(
            "h-8 w-16 shrink-0 rounded-md border bg-surface px-2 text-center text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            restInvalid ? "border-danger" : "border-border"
          )}
        />
        <span className="shrink-0 text-xs text-muted-foreground">rest sec</span>
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete set row"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
