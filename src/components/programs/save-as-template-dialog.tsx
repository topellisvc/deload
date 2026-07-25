"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { saveProgramAsTemplate } from "@/lib/programs/mutations";
import type { ProgramTree } from "@/lib/programs/types";

interface SaveAsTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  program: ProgramTree;
  currentUserId: string;
  /** Called once the template row exists, so the caller can add it to
   * whatever local "my templates" list it's already showing without a
   * refetch. */
  onSaved?: () => void;
}

/**
 * Snapshots this program's weeks into a reusable personal template — see
 * saveProgramAsTemplate's doc comment for why this is a jsonb snapshot
 * rather than a second relational copy. Deliberately no "For" picker like
 * SendProgramDialog: a template isn't assigned to anyone yet, it's picked
 * up later (per use) from MyTemplatesSection, where that choice belongs.
 */
export function SaveAsTemplateDialog({ open, onClose, program, currentUserId, onSaved }: SaveAsTemplateDialogProps) {
  const { showToast } = useToast();
  const [name, setName] = useState(`${program.name} template`);
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
    const { template, error: saveError } = await saveProgramAsTemplate(supabase, {
      program,
      ownerId: currentUserId,
      name: name.trim(),
    });
    setSubmitting(false);

    if (saveError || !template) {
      setError(saveError ?? "Something went wrong saving this template.");
      return;
    }

    showToast(`Saved "${name.trim()}" as a template`);
    onSaved?.();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Save as template"
      description="Snapshots this program's weeks so you can reuse them as a starting point for future programs — editing the original afterward won't change the template."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="template-name">Name</Label>
          <Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
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
