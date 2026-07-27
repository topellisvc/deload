"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface EndWorkoutDialogProps {
  open: boolean;
  onClose: () => void;
  onSaveAndFinish: () => void;
  onDiscard: () => void | Promise<void>;
  discarding: boolean;
}

/**
 * Offered from any mid-workout screen (exercise list, exercise, rest) for
 * someone who wants to stop before finishing every exercise — added after
 * feedback that the only way to stop early was "Skip Workout," which
 * always discarded whatever had already been logged, with no way to keep
 * it. Saving routes through the exact same summary/finish flow a fully
 * completed workout uses (see handleSaveAndFinish in training-session.tsx)
 * — it just may have fewer sets in it. Discarding reuses the same
 * skip-workout mutation the Overview screen's "Skip Workout" already used.
 */
export function EndWorkoutDialog({ open, onClose, onSaveAndFinish, onDiscard, discarding }: EndWorkoutDialogProps) {
  return (
    <Dialog open={open} onClose={discarding ? () => {} : onClose} title="End this workout early?" className="max-w-sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-foreground">
          You can save what you&rsquo;ve logged so far and finish now, or discard this attempt entirely.
        </p>
        <div className="flex flex-col gap-2">
          <Button size="lg" onClick={onSaveAndFinish} disabled={discarding} className="h-12">
            <CheckCircle2 className="size-4" />
            Save &amp; Finish
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onDiscard}
            disabled={discarding}
            className="h-12 border-danger/30 text-danger hover:border-danger hover:bg-danger/10"
          >
            <AlertTriangle className="size-4" />
            {discarding ? "Discarding…" : "Discard Workout"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={discarding}>
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
