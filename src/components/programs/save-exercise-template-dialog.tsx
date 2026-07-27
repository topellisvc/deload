"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { saveExerciseAsTemplate } from "@/lib/programs/exercise-templates";
import { getExerciseDisplayName } from "@/lib/programs/exercise-catalog";
import type { BlockExerciseRow, ExerciseTemplateRow } from "@/lib/programs/types";

interface SaveExerciseTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  exercise: BlockExerciseRow;
  currentUserId: string;
  /** Called with the new template row so the caller (ProgramBuilder) can
   * add it to the "insert template" list already showing in every day's
   * sections without a refetch. */
  onSaved?: (template: ExerciseTemplateRow) => void;
}

/**
 * Snapshots one exercise's full prescription — every set row, notes, and
 * all — into a reusable template (spec's Exercise Templates: "Bench Press
 * 5x5 @ 80% Rest 2min Coach Note," insertable with one click). Mirrors
 * SaveAsTemplateDialog's shape exactly, just scoped to one exercise
 * instead of a whole program.
 */
export function SaveExerciseTemplateDialog({ open, onClose, exercise, currentUserId, onSaved }: SaveExerciseTemplateDialogProps) {
  const { showToast } = useToast();
  const [name, setName] = useState(getExerciseDisplayName(exercise));
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
    const { template, error: saveError } = await saveExerciseAsTemplate(supabase, {
      ownerId: currentUserId,
      name: name.trim(),
      exercise,
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
      title="Save as template"
      description="Snapshots this exercise's full prescription so you can insert it with one click into any day, in this program or any other."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="exercise-template-name">Name</Label>
          <Input id="exercise-template-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
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
