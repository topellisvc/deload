"use client";

import { useState } from "react";
import { SkipForward } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface SkipExerciseDialogProps {
  open: boolean;
  exerciseName: string;
  onClose: () => void;
  onConfirm: (reason: string | null) => void;
  skipping: boolean;
}

/**
 * Offered from the exercise screen and the exercise list for an exercise
 * the athlete isn't doing today (injury, no equipment, ran out of time) —
 * a way to move on without logging sets, distinct from End Workout (that
 * stops the whole session; this dismisses one exercise and keeps going).
 * The reason is explicitly optional (spec: "give the choice to note a
 * reason why", not require one) — Confirm works with an empty textarea.
 */
export function SkipExerciseDialog({ open, exerciseName, onClose, onConfirm, skipping }: SkipExerciseDialogProps) {
  const [reason, setReason] = useState("");

  function handleClose() {
    if (skipping) return;
    setReason("");
    onClose();
  }

  function handleConfirm() {
    onConfirm(reason.trim() || null);
    setReason("");
  }

  return (
    <Dialog open={open} onClose={handleClose} title={`Skip ${exerciseName}?`} className="max-w-sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-foreground">
          You&rsquo;ll move on without logging any sets for this one. Let your coach know why, if you want to — totally optional.
        </p>
        <Textarea
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Shoulder felt tight (optional)"
          disabled={skipping}
        />
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={handleConfirm}
            disabled={skipping}
            className="h-12 border-danger/30 text-danger hover:border-danger hover:bg-danger/10"
          >
            <SkipForward className="size-4" />
            {skipping ? "Skipping…" : "Skip This Exercise"}
          </Button>
          <Button variant="ghost" onClick={handleClose} disabled={skipping}>
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
