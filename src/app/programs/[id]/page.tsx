import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProgramTree } from "@/lib/programs/queries";
import { getCoachEmail, getMyClients } from "@/lib/coaching/queries";
import { getSessionLogs, groupLogsByDay, getLoggedSets, groupLoggedSetsByExercise } from "@/lib/logging/queries";
import { getPersonalRecords } from "@/lib/profile/queries";
import { ProgramViewer } from "@/components/programs/program-viewer";

export const metadata: Metadata = {
  title: "Program",
  robots: { index: false, follow: false },
};

interface ProgramPageProps {
  params: Promise<{ id: string }>;
}

/**
 * The default landing page for any program — always the read-only view,
 * for the self-programmer, the coach, and the client alike. Structural
 * editing lives at /programs/[id]/edit, which is owner-only; this page
 * never branches into ProgramBuilder.
 */
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

  // logs -> loggedSets is a real dependency (need log ids first), but
  // nothing else on this page depends on it or on each other — those used
  // to run as one long sequential chain of awaits, each a full network
  // round-trip to Supabase, stacking latency for no reason. Running them
  // concurrently means this page's total wait is roughly the slowest single
  // branch instead of the sum of all of them.
  const [{ logs, loggedSets }, personalRecords, assignedByEmail, clients] = await Promise.all([
    (async () => {
      const logs = await getSessionLogs(supabase, trainingDayIds);
      // Every performed set/segment across every logged session on this
      // program — fetched once here (not per DayLogControl) and handed
      // down as a flat map, same batching principle as logs/logsByDay.
      const loggedSets = await getLoggedSets(supabase, logs.map((l) => l.id));
      return { logs, loggedSets };
    })(),
    // The athlete's current 1RMs — used to prefill a suggested working
    // weight when logging a 'percent_1rm' set (spec: "Use the athlete's
    // stored 1RM to calculate a suggested working weight... remain
    // editable"). Always the *athlete's* PRs regardless of who's viewing,
    // since that's whose 1RM the percentage is relative to.
    getPersonalRecords(supabase, program.athlete_id),
    // Only relevant when the viewer isn't the owner (i.e. is the athlete
    // on a coach-assigned program) — the "Assigned by" banner only ever
    // shows in that case.
    program.owner_id !== user.id
      ? getCoachEmail(supabase, { coachId: program.owner_id, clientId: user.id })
      : Promise.resolve(null),
    // Only used by the owner-only "Send a copy" dialog's client picker,
    // but cheap enough (and RLS-scoped to this user regardless) to just
    // always fetch rather than branch on isOwner here.
    getMyClients(supabase, user.id),
  ]);

  const logsByDay = groupLogsByDay(logs);
  const loggedSetsByExercise = groupLoggedSetsByExercise(loggedSets);
  const activeClients = clients.filter((c) => c.status === "active");

  return (
    <ProgramViewer
      program={program}
      assignedByEmail={assignedByEmail}
      currentUserId={user.id}
      logsByDay={logsByDay}
      loggedSetsByExercise={loggedSetsByExercise}
      personalRecords={personalRecords}
      activeClients={activeClients}
    />
  );
}
