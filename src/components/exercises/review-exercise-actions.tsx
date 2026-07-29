"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { setExerciseReviewStatus } from "@/lib/exercises/mutations";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

/** Admin-only approve/reject for a "pending" coach-submitted exercise
 * (migration 0038) — only ever rendered for rows where review_status is
 * "pending" (see exercise-admin-panel.tsx), mirroring
 * ArchiveExerciseButton's confirm-dialog + toast + router.refresh shape. */
export function ReviewExerciseActions({ exerciseId }: { exerciseId: string }) {
  const [confirmAction, setConfirmAction] = useState<"approved" | "rejected" | null>(null);
  const router = useRouter();
  const { showToast } = useToast();
  const supabase = createClient();

  async function handleConfirm() {
    if (!confirmAction) return;
    const { error } = await setExerciseReviewStatus(supabase, exerciseId, confirmAction);
    if (error) {
      showToast(error, "error");
      return;
    }
    showToast(confirmAction === "approved" ? "Exercise approved." : "Exercise rejected.");
    setConfirmAction(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setConfirmAction("approved")}>
          <Check className="size-3.5" />
          Approve
        </Button>
        <Button variant="outline" size="sm" onClick={() => setConfirmAction("rejected")}>
          <X className="size-3.5" />
          Reject
        </Button>
      </div>
      <ConfirmDialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        title={confirmAction === "approved" ? "Approve this exercise?" : "Reject this exercise?"}
        description={
          confirmAction === "approved"
            ? "It becomes visible and selectable for every coach and athlete, not just the one who created it."
            : "It stays visible only to the coach who created it — they'll still see it in their own library and programs."
        }
        confirmLabel={confirmAction === "approved" ? "Approve" : "Reject"}
        destructive={confirmAction === "rejected"}
      />
    </>
  );
}
