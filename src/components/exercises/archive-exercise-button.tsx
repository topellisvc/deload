"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { archiveExercise, restoreExercise } from "@/lib/exercises/mutations";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

/** Admin-only "Archive Exercises / Restore Archived Exercises" (spec) —
 * soft-delete rather than the separate hard-delete path, which stays
 * gated by RLS's "only when safe" (unused-everywhere) check instead. */
export function ArchiveExerciseButton({ exerciseId, isArchived }: { exerciseId: string; isArchived: boolean }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();
  const supabase = createClient();

  async function handleToggle() {
    const { error } = isArchived ? await restoreExercise(supabase, exerciseId) : await archiveExercise(supabase, exerciseId);
    if (error) {
      showToast(error, "error");
      return;
    }
    showToast(isArchived ? "Exercise restored." : "Exercise archived.");
    setConfirmOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
        {isArchived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
        {isArchived ? "Restore" : "Archive"}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleToggle}
        title={isArchived ? "Restore this exercise?" : "Archive this exercise?"}
        description={
          isArchived
            ? "It'll reappear in search results and be selectable in the Program Builder again."
            : "It stays visible on programs that already reference it, but won't show up in search or the picker anymore."
        }
        confirmLabel={isArchived ? "Restore" : "Archive"}
        destructive={!isArchived}
      />
    </>
  );
}
