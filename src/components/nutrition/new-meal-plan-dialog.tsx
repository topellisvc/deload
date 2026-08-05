"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { createMealPlan, instantiatePlanTemplate } from "@/lib/nutrition/mutations";
import { getMealTemplatesByIds } from "@/lib/nutrition/queries";
import type { CoachClient } from "@/lib/supabase/types";
import type { PlanTemplateTree } from "@/lib/nutrition/types";

const MYSELF = "myself";
const BLANK = "blank";

interface NewMealPlanDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  activeClients: CoachClient[];
  /** Pre-selects the "For" dropdown — used by the client detail page so
   * "New meal plan" there defaults to that client instead of "Myself".
   * Mirrors NewProgramDialog's own defaultAthleteId prop. */
  defaultAthleteId?: string;
  /** The starter plan library (lib/nutrition/queries.ts' getPlanTemplates)
   * — an empty array (the default) just hides the "Start from" picker
   * entirely, so existing call sites don't have to supply it. */
  planTemplates?: PlanTemplateTree[];
}

/** Mirrors NewProgramDialog exactly, minus the discipline/days-per-week
 * fields a meal plan doesn't have — createMealPlan (lib/nutrition/
 * mutations.ts) already builds a single starter "Day 1" on its own, same
 * "empty, go straight to building it out" flow as a fresh program. Now also
 * offers "Start from a template" (Ellis: "some pre made healthy meal
 * options... would be good") alongside blank, going through
 * instantiatePlanTemplate instead of createMealPlan when one's picked. */
export function NewMealPlanDialog({ open, onClose, userId, activeClients, defaultAthleteId, planTemplates = [] }: NewMealPlanDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [forClientId, setForClientId] = useState(defaultAthleteId ?? MYSELF);
  const [startFrom, setStartFrom] = useState(BLANK);
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
    const athleteId = forClientId === MYSELF ? undefined : forClientId;
    const planTemplate = startFrom === BLANK ? null : (planTemplates.find((t) => t.id === startFrom) ?? null);

    const { plan, error: createError } = planTemplate
      ? await (async () => {
          // Only fetch the handful of meal templates this specific plan
          // template actually references, not the whole library — same
          // "just what's needed" reasoning getMealTemplatesByIds' own doc
          // comment gives.
          const mealTemplateIds = [...new Set(planTemplate.days.flatMap((d) => d.meals.map((m) => m.meal_template_id)))];
          const mealTemplates = await getMealTemplatesByIds(supabase, mealTemplateIds);
          const mealTemplatesById = new Map(mealTemplates.map((t) => [t.id, t]));
          return instantiatePlanTemplate(supabase, { userId, athleteId, name: name.trim(), planTemplate, mealTemplatesById });
        })()
      : await createMealPlan(supabase, { userId, name: name.trim(), athleteId });

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

        {planTemplates.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="meal-plan-start-from">Start from</Label>
            <select
              id="meal-plan-start-from"
              value={startFrom}
              onChange={(e) => setStartFrom(e.target.value)}
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value={BLANK}>Blank</option>
              {planTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            {startFrom !== BLANK && (
              <p className="text-xs text-muted-foreground">
                {planTemplates.find((t) => t.id === startFrom)?.description ?? "Pre-fills days and meals you can edit freely afterward."}
              </p>
            )}
          </div>
        )}

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
