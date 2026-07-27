"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { saveDayAsTemplate } from "@/lib/programs/day-templates";
import type { DayRow, DayTemplateRow } from "@/lib/programs/types";

interface SaveDayTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  day: DayRow;
  currentUserId: string;
  /** Called with the new template row so the caller (ProgramBuilder) can
   * add it to the "insert day template" list without a refetch. */
  onSaved?: (template: DayTemplateRow) => void;
}

/**
 * Snapshots a whole training day — Warm-up, Main, Conditioning, every
 * section — into a reusable template (spec's Day Templates: "Upper
 * Strength," "Lower Hypertrophy," reusable across programs). Mirrors
 * SaveAsTemplateDialog's shape exactly, just scoped to one day.
 */
export function SaveDayTemplateDialog({ open, onClose, day, currentUserId, onSaved }: SaveDayTemplateDialogProps) {
  const { showToast } = useToast();
  const [name, setName] = useState(day.label ?? `Day ${day.position}`);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give the template a name.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { template, error: saveError } = await saveDayAsTemplate(supabase, {
      ownerId: currentUserId,
      name: name.trim(),
      day,
    });
    setSubmitting(false);

    if (saveError || !template) {
      setError(saveError ?? "Something went wrong saving this template.");
      return;
    }

    showToast(`Saved "${name.trim()}" as a template`);
    onSaved?.(template);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Save day as template"
      description="Snapshots this entire day — every section — so you can reuse it in this program or any other."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="day-template-name">Name</Label>
          <Input id="day-template-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

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
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save template"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
