"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { WeekRow } from "@/lib/programs/types";

interface AddWeekDialogProps {
  open: boolean;
  onClose: () => void;
  weeks: WeekRow[];
  onCreate: (params: { sourceWeek?: WeekRow; progressionPercent?: number }) => Promise<string | null>;
}

type Mode = "blank" | "copy";

/**
 * "Blank" still matches the day count/labels of the most recent week (the
 * mutation layer handles that via dayTemplate) — it just skips copying
 * blocks/exercises/sets. "Copy" duplicates a chosen week's full content,
 * optionally scaling weight/%1RM loads by a progression percentage (e.g.
 * +5% for a slight overload week, or -40% for a deload).
 */
export function AddWeekDialog({ open, onClose, weeks, onCreate }: AddWeekDialogProps) {
  const [mode, setMode] = useState<Mode>("copy");
  const [sourceWeekId, setSourceWeekId] = useState(weeks[weeks.length - 1]?.id ?? "");
  const [progression, setProgression] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const sourceWeek = mode === "copy" ? weeks.find((w) => w.id === sourceWeekId) : undefined;
    const progressionPercent = mode === "copy" ? Number(progression) || 0 : undefined;

    const errorMessage = await onCreate({ sourceWeek, progressionPercent });
    setSubmitting(false);
    if (errorMessage) {
      setError(errorMessage);
      return;
    }
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add week">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Start from</Label>
          <SegmentedControl
            aria-label="Start from"
            options={[
              { value: "copy", label: "Copy a week" },
              { value: "blank", label: "Blank" },
            ]}
            value={mode}
            onChange={setMode}
          />
        </div>

        {mode === "copy" && (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="source-week">Copy from</Label>
              <Select id="source-week" value={sourceWeekId} onChange={(e) => setSourceWeekId(e.target.value)}>
                {weeks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label || `Week ${w.position}`}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="progression">Load change</Label>
              <div className="relative">
                <Input
                  id="progression"
                  type="number"
                  step="0.5"
                  value={progression}
                  onChange={(e) => setProgression(e.target.value)}
                  className="pr-9"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Applied to weight and %1RM loads. Use a positive number to progress
                (e.g. 5), negative to deload (e.g. -40). Reps, sets, and RPE targets
                carry over unchanged.
              </p>
            </div>
          </>
        )}

        {error && (
          <div className="flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
            <p className="text-sm text-foreground">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || (mode === "copy" && !sourceWeekId)}>
            {submitting ? "Adding…" : "Add week"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
