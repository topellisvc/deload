"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, ClipboardList, Mail, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgramCard } from "@/components/programs/program-card";
import { NewProgramDialog } from "@/components/programs/new-program-dialog";
import { SendProgramDialog } from "@/components/programs/send-program-dialog";
import { createClient } from "@/lib/supabase/client";
import { deleteProgram, setActiveProgram } from "@/lib/programs/mutations";
import { getProgramTree } from "@/lib/programs/queries";
import type { ProgramSummary, ProgramTree } from "@/lib/programs/types";
import type { CoachClient } from "@/lib/supabase/types";

interface ClientDetailProps {
  coachId: string;
  client: CoachClient;
  programs: ProgramSummary[];
  lastActivityOn: string | null;
  /** Full active-client list (not just this one) so the "Send a copy"
   * dialog can also send elsewhere from this page, not only here. */
  activeClients: CoachClient[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * One client's own programs — this, not the flat client roster, is where
 * a coach adjusts what a specific person is actually training on. Reuses
 * ProgramCard/NewProgramDialog/SendProgramDialog exactly as the main
 * /programs list does, just pre-scoped to one athlete_id instead of
 * "everything I own or am assigned."
 *
 * No outer page wrapper or back-link here — the caller (/coaching/athletes/[id])
 * owns the page chrome so this can sit alongside the workout history,
 * messages, and notes sections that round out the athlete detail page,
 * all inside one shared max-width container.
 */
export function ClientDetail({ coachId, client, programs: initialPrograms, lastActivityOn, activeClients }: ClientDetailProps) {
  const router = useRouter();
  const [programs, setPrograms] = useState(initialPrograms);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [settingActiveId, setSettingActiveId] = useState<string | null>(null);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [loadingSendId, setLoadingSendId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendTarget, setSendTarget] = useState<ProgramTree | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleSetActive(programId: string) {
    const target = programs.find((p) => p.id === programId);
    if (!target) return;

    const previous = programs;
    setActiveError(null);
    setSettingActiveId(programId);
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
    // Same reasoning as ProgramsList/ProgramViewer — this mutation bypasses
    // Server Actions, so other routes (this client's dashboard-equivalent
    // views, their own program pages) need an explicit cache-bust.
    router.refresh();
  }

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

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{client.client_email}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Mail className="size-4" />
              {client.client_email}
            </span>
            {lastActivityOn && (
              <span className="flex items-center gap-1.5">
                <CalendarClock className="size-4" />
                Last trained {formatDate(lastActivityOn)}
              </span>
            )}
          </div>
        </div>
        <Button onClick={() => setNewDialogOpen(true)} className="self-start sm:self-auto">
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
            <p className="text-foreground">No programs assigned yet.</p>
            <p className="text-sm text-muted-foreground">
              Create one for them, or open an existing program and send them a copy.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              canSetActive
              settingActive={settingActiveId === program.id}
              onSetActive={handleSetActive}
              canSend
              sendingCopy={loadingSendId === program.id}
              onSend={handleSend}
              canDelete
              deleting={deletingId === program.id}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <NewProgramDialog
        open={newDialogOpen}
        onClose={() => setNewDialogOpen(false)}
        userId={coachId}
        activeClients={activeClients}
        defaultAthleteId={client.client_id ?? undefined}
      />

      {sendTarget && (
        <SendProgramDialog
          open={!!sendTarget}
          onClose={() => setSendTarget(null)}
          program={sendTarget}
          currentUserId={coachId}
          activeClients={activeClients}
        />
      )}
    </div>
  );
}
