"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteUserAccount } from "@/lib/admin/mutations";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

/**
 * Admin-only, permanent account deletion — the /api/admin/delete-user route
 * this calls is the only place in the app that can actually remove an
 * auth.users row (needs the service-role key, never available client-side).
 * Same confirm-dialog + toast + router.refresh shape as
 * ArchiveExerciseButton, except this one is irreversible: no restore path,
 * unlike archive/restore.
 */
export function DeleteAccountButton({ userId, email }: { userId: string; email: string | null }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  async function handleDelete() {
    const { error } = await deleteUserAccount(userId);
    if (error) {
      showToast(error, "error");
      return;
    }
    showToast("Account deleted.");
    setConfirmOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        className="border-danger/30 text-danger hover:border-danger hover:bg-danger/10"
      >
        <Trash2 className="size-3.5" />
        Delete
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete this account?"
        description={`This permanently deletes ${email ?? "this account"} and everything tied to it — programs, session history, coaching relationships, all of it. This can't be undone.`}
        confirmLabel="Delete"
      />
    </>
  );
}
