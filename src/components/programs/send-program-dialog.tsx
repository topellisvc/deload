"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cloneProgram } from "@/lib/programs/mutations";
import type { ProgramTree } from "@/lib/programs/types";
import type { CoachClient } from "@/lib/supabase/types";

const MYSELF = "myself";

interface SendProgramDialogProps {
  open: boolean;
  onClose: () => void;
  program: ProgramTree;
  currentUserId: string;
  activeClients: CoachClient[];
}

/**
 * Sends a full, independent copy of this program to another client (or
 * duplicates it for yourself) — see cloneProgram's comment for why a copy,
 * not a "shared" program, is how the same workout plan reaches multiple
 * people: each recipient's copy has its own athlete_id, so they can log
 * and the coach can edit their copy without touching anyone else's.
 */
export function SendProgramDialog({ open, onClose, program, currentUserId, activeClients }: SendProgramDialogProps) {
  const router = useRouter();
  const [name, setName] = useState(`${program.name} (copy)`);
  const [targetId, setTargetId] = useState(MYSELF);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give the copy a name.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { program: cloned, error: cloneError } = await cloneProgram(supabase, {
      sourceProgram: program,
      ownerId: currentUserId,
      athleteId: targetId === MYSELF ? currentUserId : targetId,
      name: name.trim(),
    });

    if (cloneError || !cloned) {
      setSubmitting(false);
      setError(cloneError ?? "Something went wrong copying the program.");
      return;
    }

    router.push(`/programs/${cloned.id}/edit`);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Send a copy"
      description="Creates an independent copy — editing it, or logging against it, never touches the original."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="copy-name">Name</Label>
          <Input id="copy-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

        {activeClients.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="copy-for">For</Label>
            <select
              id="copy-for"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value={MYSELF}>Myself</option>
              {activeClients.map((client) => (
                <option key={client.id} value={client.client_id ?? ""}>
                  {client.client_email}
                </option>
              ))}
            </select>
          </div>
        )}

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
            {submitting ? "Copying…" : "Send copy"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
