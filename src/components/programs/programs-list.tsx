"use client";

import { useState } from "react";
import { ClipboardList, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewProgramDialog } from "@/components/programs/new-program-dialog";
import { ProgramCard } from "@/components/programs/program-card";
import type { ProgramSummary } from "@/lib/programs/types";
import type { CoachClient } from "@/lib/supabase/types";

interface ProgramsListProps {
  programs: ProgramSummary[];
  userId: string;
  activeClients: CoachClient[];
}

export function ProgramsList({ programs, userId, activeClients }: ProgramsListProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

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
            <ProgramCard key={program.id} program={program} />
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
