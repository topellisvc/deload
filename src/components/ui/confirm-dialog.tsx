"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** Runs on confirm. Can be async (the common case — most confirms here
   * guard a network mutation) — the dialog shows its own busy state and
   * stays open until this resolves, then closes automatically as long as
   * it doesn't throw. Throw (or just don't await/close yourself) if you
   * need the dialog to stay open on failure — see history-list.tsx for
   * that pattern where the caller keeps its own error state instead. */
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button + danger icon — true for every destructive action
   * (delete/remove) this dialog currently guards. Defaults true since that
   * covers every existing call site; pass false for a non-destructive
   * confirm (e.g. "switch category and lose this data") if one comes up. */
  destructive?: boolean;
}

/**
 * Replaces window.confirm() across the app. The native dialog blocks the
 * page synchronously and can't be styled, can't show a per-action loading
 * state, and (found while live-testing) reliably times out browser
 * automation waiting on the click that triggers it. This is a thin wrapper
 * around the existing Dialog primitive with its own submitting state, so
 * callers just hand it a title/description and an onConfirm — same
 * controlled-open-state pattern as SendProgramDialog and every other modal
 * in the app.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = true,
}: ConfirmDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={submitting ? () => {} : onClose} title={title} className="max-w-md">
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          {destructive && <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />}
          <p className="text-sm text-foreground">{description}</p>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleConfirm}
            disabled={submitting}
            className={cn(destructive && "border-danger/30 text-danger hover:border-danger hover:bg-danger/10")}
          >
            {submitting ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
