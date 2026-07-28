"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Merge } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mergeExercises } from "@/lib/exercises/mutations";
import type { Exercise } from "@/lib/exercises/types";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

/**
 * Admin's "Merge Duplicate Exercises" (spec) — picks a source (the
 * duplicate to retire) and a target (the one to keep), delegates the
 * actual repointing to the merge_exercises() DB function (migration
 * 0035) so every block_exercises row and relationship edge referencing
 * the source moves in one transaction. The source is archived, not
 * deleted, afterward — reversible, and it still resolves correctly on
 * any historical program that referenced it.
 */
export function MergeExercisesPanel({ exercises, onMerged }: { exercises: Exercise[]; onMerged: () => void }) {
  const sorted = useMemo(() => [...exercises].filter((e) => !e.is_archived).sort((a, b) => a.name.localeCompare(b.name)), [exercises]);
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { showToast } = useToast();

  const source = sorted.find((e) => e.id === sourceId);
  const target = sorted.find((e) => e.id === targetId);
  const canMerge = source && target && source.id !== target.id;

  async function handleMerge() {
    if (!source || !target) return;
    const supabase = createClient();
    const { error } = await mergeExercises(supabase, source.id, target.id);
    if (error) {
      showToast(error, "error");
      return;
    }
    showToast(`Merged "${source.name}" into "${target.name}".`);
    setSourceId("");
    setTargetId("");
    setConfirmOpen(false);
    onMerged();
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6">
      <h2 className="flex items-center gap-1.5 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        <Merge className="size-3.5" />
        Merge duplicate exercises
      </h2>
      <p className="text-sm text-muted-foreground">
        Every program, relationship, and reference to the duplicate moves onto the exercise you keep. The duplicate is archived, not deleted.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Duplicate to merge" value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="w-auto min-w-[14rem]">
          <option value="">Duplicate exercise…</option>
          {sorted.map((e) => (
            <option key={e.id} value={e.id} disabled={e.id === targetId}>
              {e.name}
            </option>
          ))}
        </Select>

        <ArrowRight className="size-4 shrink-0 text-muted-foreground" />

        <Select aria-label="Exercise to keep" value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-auto min-w-[14rem]">
          <option value="">Keep this exercise…</option>
          {sorted.map((e) => (
            <option key={e.id} value={e.id} disabled={e.id === sourceId}>
              {e.name}
            </option>
          ))}
        </Select>

        <Button type="button" disabled={!canMerge} onClick={() => setConfirmOpen(true)}>
          Merge
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleMerge}
        title="Merge these exercises?"
        description={`Every reference to "${source?.name}" will move onto "${target?.name}". "${source?.name}" will be archived.`}
        confirmLabel="Merge"
      />
    </div>
  );
}
