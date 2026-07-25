"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ClipboardList, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewProgramDialog } from "@/components/programs/new-program-dialog";
import { ProgramCard } from "@/components/programs/program-card";
import { SendProgramDialog } from "@/components/programs/send-program-dialog";
import { SaveAsTemplateDialog } from "@/components/programs/save-as-template-dialog";
import { MyTemplatesSection } from "@/components/programs/my-templates-section";
import { StarterProgramPicker } from "@/components/programs/starter-program-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import { deleteProgram, removeAssignedProgram, setActiveProgram } from "@/lib/programs/mutations";
import { getMyProgramTemplates, getProgramTree } from "@/lib/programs/queries";
import type { ProgramSummary, ProgramTemplateRow, ProgramTree } from "@/lib/programs/types";
import type { CoachClient } from "@/lib/supabase/types";

interface ProgramsListProps {
  programs: ProgramSummary[];
  userId: string;
  activeClients: CoachClient[];
  templates: ProgramTemplateRow[];
}

/** Invitations and the coach roster used to render at the top of this
 * page — both moved to /coaching as part of the Coaching hub. */
export function ProgramsList({ programs: initialPrograms, userId, activeClients, templates: initialTemplates }: ProgramsListProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [programs, setPrograms] = useState(initialPrograms);
  const [templates, setTemplates] = useState(initialTemplates);
  const [settingActiveId, setSettingActiveId] = useState<string | null>(null);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [loadingSendId, setLoadingSendId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendTarget, setSendTarget] = useState<ProgramTree | null>(null);
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateTarget, setTemplateTarget] = useState<ProgramTree | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ProgramSummary | null>(null);

  // ProgramCard only has the lightweight ProgramSummary shape (no nested
  // tree — see getProgramSummaries), so sending a copy from the list needs
  // a one-time fetch of the full tree before the dialog can clone it.
  async function handleSend(programId: string) {
    setSendError(null);
    setLoadingSendId(programId);
    const supabase = createClient();
    const tree = await getProgramTree(supabase, programId);
    setLoadingSendId(null);
    if (!tree) {
      setSendError("Couldn't load this program to copy it.");
      return;
    }
    setSendTarget(tree);
  }

  // Same one-time full-tree fetch as handleSend, above, for the same
  // reason — SaveAsTemplateDialog needs the nested weeks/days/blocks/sets
  // to snapshot, not just the lightweight ProgramSummary this list renders.
  async function handleSaveAsTemplate(programId: string) {
    setTemplateError(null);
    setLoadingTemplateId(programId);
    const supabase = createClient();
    const tree = await getProgramTree(supabase, programId);
    setLoadingTemplateId(null);
    if (!tree) {
      setTemplateError("Couldn't load this program to save it as a template.");
      return;
    }
    setTemplateTarget(tree);
  }

  function handleTemplateDeleted(templateId: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
  }

  // SaveAsTemplateDialog only reports success/failure, not the new row
  // itself — a lightweight refetch is simpler than threading the created
  // template back through onSaved just to avoid one query.
  async function handleTemplateSaved() {
    const supabase = createClient();
    const refreshed = await getMyProgramTemplates(supabase, userId);
    setTemplates(refreshed);
  }

  async function handleSetActive(programId: string) {
    const target = programs.find((p) => p.id === programId);
    if (!target) return;

    const previous = programs;
    setActiveError(null);
    setSettingActiveId(programId);
    // Optimistic: only one program per athlete can be active, so flip every
    // other program that shares this one's athlete_id to inactive.
    setPrograms((current) =>
      current.map((p) =>
        p.id === programId ? { ...p, is_active: true } : p.athlete_id === target.athlete_id ? { ...p, is_active: false } : p
      )
    );

    const supabase = createClient();
    const { error } = await setActiveProgram(supabase, programId);
    setSettingActiveId(null);
    if (error) {
      setPrograms(previous);
      setActiveError(error);
      return;
    }
    // This page's own cards are already right (optimistic update above),
    // but other routes (dashboard, the programs' own detail pages) may
    // have cached RSC payloads from before this switch — refresh() clears
    // that so they're not left showing the old active program.
    router.refresh();
  }

  function handleDeleteClick(programId: string) {
    const target = programs.find((p) => p.id === programId);
    if (target) setConfirmTarget(target);
  }

  async function handleDelete() {
    const target = confirmTarget;
    if (!target) return;
    const programId = target.id;
    // Owner deleting a program they built removes it outright; an athlete
    // "deleting" a coach-assigned copy just removes their own copy (see
    // ProgramViewer's handleRemove and removeAssignedProgram's comment) —
    // the coach keeps it, with a "removed" note instead of it silently
    // vanishing from their Client programs list.
    const isOwner = target.owner_id === userId;

    const previous = programs;
    setDeleteError(null);
    setDeletingId(programId);
    // Either way it disappears from *this viewer's* list: a hard delete for
    // the owner, or (for the athlete) simply no longer theirs to see —
    // getProgramSummaries hides a program the athlete has removed from
    // their own view even though the row (and the coach's visibility into
    // it) lives on.
    setPrograms((current) => current.filter((p) => p.id !== programId));

    const supabase = createClient();
    const { error } = isOwner
      ? await deleteProgram(supabase, programId)
      : await removeAssignedProgram(supabase, programId);
    setDeletingId(null);
    setConfirmTarget(null);
    if (error) {
      setPrograms(previous);
      setDeleteError(error);
      return;
    }
    router.refresh();
  }

  // A program's assignmentLabel starts with "For " exactly when the viewer
  // owns it but someone else (a client) is the athlete — see
  // getProgramSummaries. Everything else (self-programmed, or a "From "
  // program where the viewer IS the athlete on a coach-assigned plan) is
  // "the viewer's own" for this page's purposes: it's what THEY train on,
  // regardless of who built it.
  const ownPrograms = programs.filter((p) => !p.assignmentLabel?.startsWith("For "));
  const clientPrograms = programs.filter((p) => p.assignmentLabel?.startsWith("For "));

  function renderGrid(list: ProgramSummary[]) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((program) => (
          <ProgramCard
            key={program.id}
            program={program}
            canSetActive={(program.owner_id === userId || program.athlete_id === userId) && !program.removed_by_athlete_at}
            settingActive={settingActiveId === program.id}
            onSetActive={handleSetActive}
            canSend={program.owner_id === userId}
            sendingCopy={loadingSendId === program.id}
            onSend={handleSend}
            canSaveAsTemplate={program.owner_id === userId}
            savingTemplate={loadingTemplateId === program.id}
            onSaveAsTemplate={handleSaveAsTemplate}
            canDelete={program.owner_id === userId || (program.athlete_id === userId && !program.removed_by_athlete_at)}
            deleting={deletingId === program.id}
            onDelete={handleDeleteClick}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Programs</h1>
          <p className="text-muted-foreground">
            Build multi-week training programs — weeks, days, and exercises,
            all on one screen.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="self-start sm:self-auto">
          <Plus className="size-4" />
          New program
        </Button>
      </div>

      {(activeError || sendError || templateError || deleteError) && (
        <div className="mb-6 flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-sm text-foreground">{activeError || sendError || templateError || deleteError}</p>
        </div>
      )}

      <MyTemplatesSection templates={templates} userId={userId} activeClients={activeClients} onDeleted={handleTemplateDeleted} />

      <section className="mb-10 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">Not sure where to start?</h2>
          <p className="text-sm text-muted-foreground">Try one of our 4-week starter programs — we&apos;ll set the whole thing up for you.</p>
        </div>
        <StarterProgramPicker mode="create" userId={userId} />
      </section>

      {programs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <ClipboardList className="size-8 text-muted-foreground" />
            <p className="text-foreground">You don&apos;t have any programs yet.</p>
            <p className="text-sm text-muted-foreground">
              Create one to start building out weeks and days.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-10">
          {/* Own programs get their own section even for someone who's
              purely a coach with no self-programmed plans (an empty section
              would look broken) — so this only renders when there's at
              least one to show, same as the client section below. */}
          {ownPrograms.length > 0 && (
            <section>
              {clientPrograms.length > 0 && (
                <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Your programs</h2>
              )}
              {renderGrid(ownPrograms)}
            </section>
          )}

          {clientPrograms.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Client programs</h2>
              {renderGrid(clientPrograms)}
            </section>
          )}
        </div>
      )}

      <NewProgramDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        userId={userId}
        activeClients={activeClients}
      />

      {sendTarget && (
        <SendProgramDialog
          open={!!sendTarget}
          onClose={() => setSendTarget(null)}
          program={sendTarget}
          currentUserId={userId}
          activeClients={activeClients}
        />
      )}

      {templateTarget && (
        <SaveAsTemplateDialog
          open={!!templateTarget}
          onClose={() => setTemplateTarget(null)}
          program={templateTarget}
          currentUserId={userId}
          onSaved={handleTemplateSaved}
        />
      )}

      <ConfirmDialog
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleDelete}
        title={confirmTarget?.owner_id === userId ? "Delete program?" : "Remove program?"}
        description={
          confirmTarget?.owner_id === userId
            ? `Delete "${confirmTarget?.name}"? This removes every week, day, and logged session in it — this can't be undone.`
            : `Remove "${confirmTarget?.name}"? This only removes your own copy — it won't affect your coach's original.`
        }
        confirmLabel={confirmTarget?.owner_id === userId ? "Delete" : "Remove"}
      />
    </div>
  );
}
