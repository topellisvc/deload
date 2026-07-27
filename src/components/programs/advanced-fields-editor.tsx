"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface AdvancedFieldsEditorProps {
  value: Record<string, string> | null;
  onChange: (v: Record<string, string> | null) => void;
}

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

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border-strong p-2.5">
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
