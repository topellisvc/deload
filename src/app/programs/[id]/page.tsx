import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProgramTree } from "@/lib/programs/queries";
import { getCoachEmail } from "@/lib/coaching/queries";
import { getSessionLogs, groupLogsByDay } from "@/lib/logging/queries";
import { ProgramBuilder } from "@/components/programs/program-builder";
import { ProgramViewer } from "@/components/programs/program-viewer";

export const metadata: Metadata = {
  title: "Program",
  robots: { index: false, follow: false },
};

interface ProgramPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProgramPage({ params }: ProgramPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?redirect_to=/programs/${id}`);
  }

  // RLS means a program another user owns simply won't come back here —
  // there's no separate "forbidden" case to handle, just "not found".
  const program = await getProgramTree(supabase, id);
  if (!program) notFound();

  const trainingDayIds = program.weeks.flatMap((w) => w.days.map((d) => d.id));
  const logs = await getSessionLogs(supabase, trainingDayIds);
  const logsByDay = groupLogsByDay(logs);

  // owner_id === athlete_id for every self-programmed program (the
  // common case) — only a coach-assigned program can differ, and only the
  // owner (coach) gets edit access; the athlete gets a read-only view.
  if (program.owner_id !== user.id) {
    const assignedByEmail = await getCoachEmail(supabase, { coachId: program.owner_id, clientId: user.id });
    return (
      <ProgramViewer
        program={program}
        assignedByEmail={assignedByEmail}
        currentUserId={user.id}
        logsByDay={logsByDay}
      />
    );
  }

  return <ProgramBuilder initialProgram={program} currentUserId={user.id} logsByDay={logsByDay} />;
}
