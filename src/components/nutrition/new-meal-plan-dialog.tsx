"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { createMealPlan } from "@/lib/nutrition/mutations";
import type { CoachClient } from "@/lib/supabase/types";

const MYSELF = "myself";

interface NewMealPlanDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  activeClients: CoachClient[];
  /** Pre-selects the "For" dropdown — used by the client detail page so
   * "New meal plan" there defaults to that client instead of "Myself".
   * Mirrors NewProgramDialog's own defaultAthleteId prop. */
  defaultAthleteId?: string;
}

/** Mirrors NewProgramDialog exactly, minus the discipline/days-per-week
 * fields a meal plan doesn't have — createMealPlan (lib/nutrition/
 * mutations.ts) already builds a single starter "Day 1" on its own, same
 * "empty, go straight to building it out" flow as a fresh program. */
export function NewMealPlanDialog({ open, onClose, userId, activeClients, defaultAthleteId }: NewMealPlanDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [forClientId, setForClientId] = useState(defaultAthleteId ?? MYSELF);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give the meal plan a name.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { plan, error: createError } = await createMealPlan(supabase, {
      userId,
      name: name.trim(),
      athleteId: forClientId === MYSELF ? undefined : forClientId,
    });

    if (createError || !plan) {
      setSubmitting(false);
      setError(createError ?? "Something went wrong creating the meal plan.");
      return;
    }

    router.push(`/nutrition/${plan.id}/edit`);
  }

  return (
    <Dialog open={open} onClose={onClose} title="New meal plan" description="You can add days and meals any time.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="meal-plan-name">Name</Label>
          <Input id="meal-plan-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Off-season cutting plan" autoFocus />
        </div>

        {activeClients.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="meal-plan-for">For</Label>
            <select
              id="meal-plan-for"
              value={forClientId}
              onChange={(e) => setForClientId(e.target.value)}
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value={MYSELF}>Myself</option>
              {activeClients.map((client) => (
                <option key={client.id} value={client.client_id ?? ""}>
                  {client.client_email}
                </option>
              ))}
            </select>
            {forClientId === MYSELF && (
              <p className="text-xs text-muted-foreground">You can send this to any client later — this just decides who logs it for now.</p>
            )}
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
            {submitting ? "Creating…" : "Create meal plan"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
