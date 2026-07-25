"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BookMarked, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import { createProgramFromSavedTemplate, deleteProgramTemplate } from "@/lib/programs/mutations";
import type { ProgramTemplateRow } from "@/lib/programs/types";
import type { CoachClient } from "@/lib/supabase/types";

const MYSELF = "myself";

const DISCIPLINE_LABEL: Record<string, string> = {
  resistance: "Weights",
  running: "Running",
  hybrid: "Hybrid",
};

interface MyTemplatesSectionProps {
  templates: ProgramTemplateRow[];
  userId: string;
  /** Only used to offer a "for <client>" choice — same list ProgramsList
   * already fetches for NewProgramDialog/SendProgramDialog's own "For"
   * pickers, reused here rather than a second query. */
  activeClients: CoachClient[];
  onDeleted: (templateId: string) => void;
}

/**
 * A coach (or any self-programmer reusing their own design) picking up a
 * previously-saved template — see saveProgramAsTemplate/ProgramCard's
 * "Save as template" action for how these get created. Renders nothing
 * when there are none, same as StarterProgramPicker never needing an empty
 * state: an empty "Your templates" section would only ever clutter the
 * page for the common case of someone who's never saved one.
 */
export function MyTemplatesSection({ templates, userId, activeClients, onDeleted }: MyTemplatesSectionProps) {
  const router = useRouter();
  const [targetByTemplate, setTargetByTemplate] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ProgramTemplateRow | null>(null);

  if (templates.length === 0) return null;

  async function handleUse(template: ProgramTemplateRow) {
    setError(null);
    setLoadingId(template.id);
    const athleteChoice = targetByTemplate[template.id] ?? MYSELF;
    const supabase = createClient();
    const { program, error: createError } = await createProgramFromSavedTemplate(supabase, {
      template,
      userId,
      athleteId: athleteChoice === MYSELF ? undefined : athleteChoice,
    });
    setLoadingId(null);
    if (createError || !program) {
      setError(createError ?? "Something went wrong creating this program.");
      return;
    }
    router.push(`/programs/${program.id}`);
  }

  async function handleDelete() {
    const target = confirmTarget;
    if (!target) return;
    setDeletingId(target.id);
    const supabase = createClient();
    const { error: deleteError } = await deleteProgramTemplate(supabase, target.id);
    setDeletingId(null);
    setConfirmTarget(null);
    if (deleteError) {
      setError(deleteError);
      return;
    }
    onDeleted(target.id);
  }

  return (
    <section className="mb-10 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">Your templates</h2>
        <p className="text-sm text-muted-foreground">Programs you&apos;ve saved to reuse as a starting point.</p>
      </div>

      {error && (
        <div className="flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-sm text-foreground">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  <BookMarked className="size-3.5" />
                  {DISCIPLINE_LABEL[template.discipline] ?? template.discipline}
                </span>
                <button
                  type="button"
                  aria-label="Delete template"
                  disabled={deletingId === template.id}
                  onClick={() => setConfirmTarget(template)}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>

              <h3 className="text-base font-semibold text-foreground">{template.name}</h3>
              <p className="text-sm text-muted-foreground">
                {template.template_data.weeks.length} {template.template_data.weeks.length === 1 ? "week" : "weeks"}
              </p>

              {activeClients.length > 0 && (
                <select
                  aria-label={`Who to create "${template.name}" for`}
                  value={targetByTemplate[template.id] ?? MYSELF}
                  onChange={(e) => setTargetByTemplate((prev) => ({ ...prev, [template.id]: e.target.value }))}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value={MYSELF}>For myself</option>
                  {activeClients.map((client) => (
                    <option key={client.id} value={client.client_id ?? ""}>
                      For {client.client_email}
                    </option>
                  ))}
                </select>
              )}

              <Button size="sm" disabled={loadingId === template.id} onClick={() => handleUse(template)}>
                {loadingId === template.id ? "Creating…" : "Use template"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleDelete}
        title="Delete template?"
        description={`Delete "${confirmTarget?.name}"? This can't be undone — programs already created from it aren't affected.`}
        confirmLabel="Delete"
      />
    </section>
  );
}
