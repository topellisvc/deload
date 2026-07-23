"use client";

import { useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { createClient } from "@/lib/supabase/client";
import { deletePersonalRecord, upsertPersonalRecord } from "@/lib/profile/mutations";
import { formatSecondsToDuration, parseDurationToSeconds, RECORD_TYPES } from "@/lib/profile/personal-records";
import type { RecordCategory, RecordTypeDef } from "@/lib/profile/personal-records";
import type { PersonalRecord, ProfileMassUnit } from "@/lib/supabase/types";

const MASS_UNIT_OPTIONS = [
  { value: "kg" as const, label: "kg" },
  { value: "lb" as const, label: "lb" },
];

function formatValue(record: PersonalRecord | undefined, category: RecordCategory): string {
  if (!record) return "Not set";
  if (category === "running") return formatSecondsToDuration(record.value_number);
  return `${record.value_number}${record.unit}`;
}

interface PersonalRecordsProps {
  userId: string;
  records: PersonalRecord[];
}

/**
 * One editable card per suggested PR type (see lib/profile/
 * personal-records.ts for the list — adding a new type there is all it
 * takes to add a card here). Only one card is ever in edit mode at a
 * time, and saving an empty value deletes the record rather than storing
 * a meaningless zero, which is how "un-setting" a PR back to "Not set"
 * works.
 */
export function PersonalRecords({ userId, records: initialRecords }: PersonalRecordsProps) {
  const [records, setRecords] = useState(initialRecords);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [draftUnit, setDraftUnit] = useState<ProfileMassUnit>("kg");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recordByType = new Map(records.map((r) => [r.record_type, r]));

  function startEdit(def: RecordTypeDef) {
    const existing = recordByType.get(def.type);
    setEditingType(def.type);
    setError(null);
    if (def.category === "strength") {
      setDraftValue(existing ? String(existing.value_number) : "");
      setDraftUnit((existing?.unit as ProfileMassUnit) ?? "kg");
    } else {
      setDraftValue(existing ? formatSecondsToDuration(existing.value_number) : "");
    }
  }

  async function handleSave(def: RecordTypeDef) {
    setError(null);
    const existing = recordByType.get(def.type);
    const trimmed = draftValue.trim();

    if (trimmed === "") {
      if (!existing) {
        setEditingType(null);
        return;
      }
      setBusy(true);
      const supabase = createClient();
      const { error: deleteError } = await deletePersonalRecord(supabase, existing.id);
      setBusy(false);
      if (deleteError) {
        setError(deleteError);
        return;
      }
      setRecords((prev) => prev.filter((r) => r.id !== existing.id));
      setEditingType(null);
      return;
    }

    let valueNumber: number | null;
    let unit: string;
    if (def.category === "strength") {
      valueNumber = Number(trimmed);
      unit = draftUnit;
      if (!Number.isFinite(valueNumber) || valueNumber <= 0) {
        setError("Enter a valid weight.");
        return;
      }
    } else {
      valueNumber = parseDurationToSeconds(trimmed);
      unit = "seconds";
      if (valueNumber === null || valueNumber <= 0) {
        setError("Enter a time like 45:00 or 1:32:00.");
        return;
      }
    }

    setBusy(true);
    const supabase = createClient();
    const { record, error: saveError } = await upsertPersonalRecord(supabase, userId, {
      recordType: def.type,
      valueNumber,
      unit,
    });
    setBusy(false);
    if (saveError || !record) {
      setError(saveError ?? "Couldn't save that PR.");
      return;
    }
    setRecords((prev) => [...prev.filter((r) => r.record_type !== def.type), record]);
    setEditingType(null);
  }

  function renderGroup(label: string, category: RecordCategory) {
    const types = RECORD_TYPES.filter((t) => t.category === category);
    return (
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {types.map((def) => {
            const existing = recordByType.get(def.type);
            const isEditing = editingType === def.type;
            return (
              <div key={def.type} className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{def.label}</span>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => startEdit(def)}
                      aria-label={`Edit ${def.label}`}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Input
                        autoFocus
                        inputMode={def.category === "strength" ? "decimal" : "text"}
                        value={draftValue}
                        onChange={(e) => setDraftValue(e.target.value)}
                        placeholder={def.category === "strength" ? "e.g. 100" : "e.g. 45:00"}
                        className="h-9 flex-1 px-3 text-sm"
                      />
                      {def.category === "strength" && (
                        <SegmentedControl
                          aria-label="Unit"
                          options={MASS_UNIT_OPTIONS}
                          value={draftUnit}
                          onChange={setDraftUnit}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleSave(def)}
                        disabled={busy}
                        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                      >
                        <Check className="size-3.5" />
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingType(null)}
                        disabled={busy}
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                      >
                        <X className="size-3.5" />
                        Cancel
                      </button>
                      {existing && (
                        <button
                          type="button"
                          onClick={() => setDraftValue("")}
                          disabled={busy}
                          className="ml-auto flex items-center gap-1 text-xs font-medium text-danger hover:underline disabled:opacity-50"
                        >
                          <Trash2 className="size-3.5" />
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <span
                    className={
                      existing
                        ? "text-lg font-semibold tabular-nums text-foreground"
                        : "text-sm text-muted-foreground"
                    }
                  >
                    {formatValue(existing, def.category)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Personal records</h2>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <div className="flex flex-col gap-5">
        {renderGroup("Strength", "strength")}
        {renderGroup("Running", "running")}
      </div>
    </div>
  );
}
