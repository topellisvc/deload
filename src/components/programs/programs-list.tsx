"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ClipboardList, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewProgramDialog } from "@/components/programs/new-program-dialog";
import { ProgramCard } from "@/components/programs/program-card";
import { SendProgramDialog } from "@/components/programs/send-program-dialog";
import { createClient } from "@/lib/supabase/client";
import { deleteProgram, setActiveProgram } from "@/lib/programs/mutations";
import { getProgramTree } from "@/lib/programs/queries";
import type { ProgramSummary, ProgramTree } from "@/lib/programs/types";
import type { CoachClient } from "@/lib/supabase/types";

interface ProgramsListProps {
  programs: ProgramSummary[];
  userId: string;
  activeClients: CoachClient[];
}

/** Invitations and the coach roster used to render at the top of this
 * page — both moved to /coaching as part of the Coaching hub. */
export function ProgramsList({ programs: initialPrograms, userId, activeClients }: ProgramsListProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [programs, setPrograms] = useState(initialPrograms);
  const [settingActiveId, setSettingActiveId] = useState<string | null>(null);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [loadingSendId, setLoadingSendId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendTarget, setSendTarget] = useState<ProgramTree | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  async function handleDelete(programId: string) {
    const target = programs.find((p) => p.id === programId);
    if (!target) return;
    if (!window.confirm(`Delete "${target.name}"? This removes every week, day, and logged session in it — this can't be undone.`)) {
      return;
    }

    const previous = programs;
    setDeleteError(null);
    setDeletingId(programId);
    setPrograms((current) => current.filter((p) => p.id !== programId));

    const supabase = createClient();
    const { error } = await deleteProgram(supabase, programId);
    setDeletingId(null);
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
            canSetActive={program.owner_id === userId}
            settingActive={settingActiveId === program.id}
            onSetActive={handleSetActive}
            canSend={program.owner_id === userId}
            sendingCopy={loadingSendId === program.id}
            onSend={handleSend}
            canDelete={program.owner_id === userId}
            deleting={deletingId === program.id}
            onDelete={handleDelete}
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

      {(activeError || sendError || deleteError) && (
        <div className="mb-6 flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-sm text-foreground">{activeError || sendError || deleteError}</p>
        </div>
      )}

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
    </div>
  );
}
