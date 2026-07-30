"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/programs/preset-fields";

interface AdvancedFieldsEditorProps {
  value: Record<string, string> | null;
  onChange: (v: Record<string, string> | null) => void;
}

/**
 * Every specialized programming method the spec's Advanced Mode section
 * names, each as a one-tap starting point rather than a coach having to
 * remember (or reinvent) both a key name and a sensible notation for it.
 * Tapping a chip adds its key/value pair (editable afterward like any
 * other custom field); tapping an already-applied one removes it. This
 * covers the full named list through the same generic advanced_config
 * mechanism rather than 14 bespoke inputs — see AdvancedFieldsEditor's
 * own doc comment below on why that's the intended design, not a
 * shortcut: a real purpose-built control for any one of these can still
 * read/write the same key later without a schema change.
 */
const METHOD_PRESETS: { key: string; value: string }[] = [
  { key: "Tempo", value: "3-1-1-0" },
  { key: "Drop Set", value: "Drop 20% after failure" },
  { key: "Cluster Set", value: "5x(2+2+2), 15s intra-cluster rest" },
  { key: "Wave Loading", value: "3-2-1 wave, +5% each wave" },
  { key: "EMOM", value: "Every 1:00 for 10:00" },
  { key: "AMRAP", value: "AMRAP in 12:00" },
  { key: "Time Cap", value: "20:00" },
  { key: "To Failure", value: "Last set to failure" },
  { key: "Pause Reps", value: "3 sec pause at bottom" },
  { key: "Contrast", value: "Heavy 3 reps + explosive 5 reps, superset" },
  { key: "Bands/Chains", value: "Add band/chain tension at lockout" },
  { key: "Plyometric", value: "3x5 box jumps, full recovery" },
  { key: "Oly Lift", value: "Power clean, technical focus" },
  { key: "Cardio Protocol", value: "4x4min @ 90% HR, 3min recovery" },
];

/**
 * Advanced Mode's "Custom Fields" — a plain key/value editor bound to a set
 * row's advanced_config column (migration 0030). This is the extensibility
 * mechanism the spec's whole Advanced Mode section asks for: a coach can
 * attach "Tempo: 3-1-1-0" or "Band: Red" today without a schema change, and
 * a future *purpose-built* control for one of those methods (a real tempo
 * input with 4 separate digit fields, say) can still read/write the same
 * advanced_config keys under the hood — this doesn't have to be the last
 * word on any given method, just the floor every method starts from.
 *
 * Deliberately not virtualized/fancy — a set row has at most a handful of
 * custom fields, this is a short list, not a data table.
 */
export function AdvancedFieldsEditor({ value, onChange }: AdvancedFieldsEditorProps) {
  const entries = Object.entries(value ?? {});
  const appliedPresetCount = METHOD_PRESETS.filter((preset) => (value ?? {})[preset.key] === preset.value).length;
  // A set row has one of these open by default only if a preset from it is
  // already applied — otherwise collapsed. 14 chips on every single set
  // row (a program can have dozens) was the actual space complaint this
  // fixes; a set with, say, Tempo already set still shows it without an
  // extra tap to find it again.
  const [expanded, setExpanded] = useState(appliedPresetCount > 0);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  function setEntry(key: string, val: string) {
    onChange({ ...(value ?? {}), [key]: val });
  }

  function removeEntry(key: string) {
    const next = { ...(value ?? {}) };
    delete next[key];
    onChange(Object.keys(next).length > 0 ? next : null);
  }

  function addEntry() {
    const key = newKey.trim();
    if (!key) return;
    setEntry(key, newValue.trim());
    setNewKey("");
    setNewValue("");
  }

  function togglePreset(preset: { key: string; value: string }) {
    if ((value ?? {})[preset.key] === preset.value) removeEntry(preset.key);
    else setEntry(preset.key, preset.value);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border-strong p-2.5">
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex items-center gap-1 self-start text-[10px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          Methods{!expanded && appliedPresetCount > 0 ? ` (${appliedPresetCount})` : ""}
        </button>
        {expanded && (
          <div className="flex flex-wrap items-center gap-1.5">
            {METHOD_PRESETS.map((preset) => (
              <Chip key={preset.key} selected={(value ?? {})[preset.key] === preset.value} onClick={() => togglePreset(preset)}>
                {preset.key}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Custom Fields</span>
      {entries.map(([key, val]) => (
        <div key={key} className="flex items-center gap-1.5">
          <Input aria-label={`Field name: ${key}`} value={key} disabled className="h-7 w-28 shrink-0 text-xs" />
          <Input
            aria-label={`Value for ${key}`}
            defaultValue={val}
            onBlur={(e) => setEntry(key, e.target.value)}
            className="h-7 flex-1 text-xs"
          />
          <button
            type="button"
            onClick={() => removeEntry(key)}
            aria-label={`Remove ${key}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <Input
          aria-label="New custom field name"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="e.g. Tempo"
          className="h-7 w-28 shrink-0 text-xs"
        />
        <Input
          aria-label="New custom field value"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addEntry();
            }
          }}
          placeholder="e.g. 3-1-1-0"
          className="h-7 flex-1 text-xs"
        />
        <button
          type="button"
          onClick={addEntry}
          aria-label="Add custom field"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
