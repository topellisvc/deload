"use client";

import { useState } from "react";
import { AlertTriangle, ClipboardList, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewProgramDialog } from "@/components/programs/new-program-dialog";
import { ProgramCard } from "@/components/programs/program-card";
import { PendingInvites } from "@/components/programs/pending-invites";
import { MyCoaches } from "@/components/programs/my-coaches";
import { createClient } from "@/lib/supabase/client";
import { setActiveProgram } from "@/lib/programs/mutations";
import type { ProgramSummary } from "@/lib/programs/types";
import type { CoachClient } from "@/lib/supabase/types";

interface ProgramsListProps {
  programs: ProgramSummary[];
  userId: string;
  activeClients: CoachClient[];
  pendingInvites: CoachClient[];
  myCoaches: CoachClient[];
}

export function ProgramsList({ programs: initialPrograms, userId, activeClients, pendingInvites, myCoaches }: ProgramsListProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [programs, setPrograms] = useState(initialPrograms);
  const [settingActiveId, setSettingActiveId] = useState<string | null>(null);
  const [activeError, setActiveError] = useState<string | null>(null);

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
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <PendingInvites invites={pendingInvites} userId={userId} />
      <MyCoaches coaches={myCoaches} />

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

      {activeError && (
        <div className="mb-6 flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-sm text-foreground">{activeError}</p>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              canSetActive={program.owner_id === userId}
              settingActive={settingActiveId === program.id}
              onSetActive={handleSetActive}
            />
          ))}
        </div>
      )}

      <NewProgramDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        userId={userId}
        activeClients={activeClients}
      />
    </div>
  );
}
