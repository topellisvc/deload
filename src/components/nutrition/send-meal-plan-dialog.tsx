"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { cloneMealPlan } from "@/lib/nutrition/mutations";
import type { NutritionPlanTree } from "@/lib/nutrition/types";
import type { CoachClient } from "@/lib/supabase/types";

const MYSELF = "myself";

interface SendMealPlanDialogProps {
  open: boolean;
  onClose: () => void;
  plan: NutritionPlanTree;
  currentUserId: string;
  activeClients: CoachClient[];
}

/**
 * Sends a full, independent copy of this meal plan to another client (or
 * duplicates it for yourself) — mirrors SendProgramDialog exactly; see
 * cloneMealPlan's own comment for why a copy (not a shared row) is how the
 * same meal plan reaches multiple people.
 */
export function SendMealPlanDialog({ open, onClose, plan, currentUserId, activeClients }: SendMealPlanDialogProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [name, setName] = useState(`${plan.name} (copy)`);
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
    const { plan: cloned, error: cloneError } = await cloneMealPlan(supabase, {
      sourcePlan: plan,
      ownerId: currentUserId,
      athleteId: targetId === MYSELF ? currentUserId : targetId,
      name: name.trim(),
    });

    if (cloneError || !cloned) {
      setSubmitting(false);
      setError(cloneError ?? "Something went wrong copying the meal plan.");
      return;
    }

    const targetClient = targetId === MYSELF ? null : activeClients.find((c) => c.client_id === targetId);
    showToast(targetClient ? `Sent to ${targetClient.client_email}` : `"${name.trim()}" copied for you`);

    router.push(`/nutrition/${cloned.id}/edit`);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Send a copy"
      description="Creates an independent copy — editing it never touches the original."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="meal-plan-copy-name">Name</Label>
          <Input id="meal-plan-copy-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

        {activeClients.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="meal-plan-copy-for">For</Label>
            <select
              id="meal-plan-copy-for"
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
