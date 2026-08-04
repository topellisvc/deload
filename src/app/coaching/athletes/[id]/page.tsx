import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getClientLastActivity, getMyClients, getMyRole } from "@/lib/coaching/queries";
import { getProgramsForClient } from "@/lib/programs/queries";
import { getMealPlansForClient } from "@/lib/nutrition/queries";
import { getConversationMessages } from "@/lib/messaging/queries";
import { getSessionHistory, getLoggedSets, groupLoggedSetsByExercise } from "@/lib/logging/queries";
import { listExercises } from "@/lib/exercises/queries";
import { getActiveProgramContext, getWeeklyTrainingSummary } from "@/lib/dashboard/queries";
import { getMyStats } from "@/lib/profile/queries";
import { AthleteDetailPanel } from "@/components/coaching/athlete-detail-panel";

export const metadata: Metadata = {
  title: "Athlete",
  robots: { index: false, follow: false },
};

interface AthletePageProps {
  params: Promise<{ id: string }>;
}

/**
 * The detail panel athletes/layout.tsx's roster links out to — same
 * data/components as the pre-redesign page (ClientDetail's program
 * management, ClientHistorySection's full per-set history,
 * ExerciseHistoryLookup, MessageThread, NotesSection), now assembled by
 * AthleteDetailPanel into the mockup's identity-header + stats + sub-tabs
 * layout instead of one long stack, plus real This-Week/streak numbers
 * (getWeeklyTrainingSummary/getMyStats — the exact same queries the
 * athlete's own dashboard runs on themselves, just pointed at `id`).
 * No outer max-width wrapper or "back to Coaching" chrome here — the
 * layout's AthletesShell owns the page frame and the roster panel; the
 * ArrowLeft link below only shows on mobile, where the roster is hidden
 * once an athlete's selected (see AthletesShell's own doc comment).
 * `id` is the athlete's user id (coach_clients.client_id), not the
 * coach_clients row id.
 */
export default async function AthletePage({ params }: AthletePageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?redirect_to=/coaching/athletes/${id}`);
  }

  // getMyClients doesn't depend on the role check's result, only on the
  // gate passing — run both concurrently and check afterward. Worst case
  // (someone who isn't a coach) fetches one extra query that goes unused;
  // best case (the common path) saves a full round-trip.
  const [role, clients] = await Promise.all([getMyRole(supabase, user.id), getMyClients(supabase, user.id)]);
  if (role !== "coach") notFound();

  const client = clients.find((c) => c.client_id === id && c.status === "active");
  // Covers both "not actually one of this coach's clients" and "invite
  // still pending" (no linked user yet, so there's nothing here to show).
  if (!client) notFound();

  // weeklySummary needs activeContext (for workoutsScheduledThisWeek), so
  // this can't join the Promise.all below.
  const activeContext = await getActiveProgramContext(supabase, id, null);

  const [programs, mealPlans, lastActivityOn, historyEntries, messages, exercises, weeklySummary, athleteStats] = await Promise.all([
    getProgramsForClient(supabase, user.id, id),
    getMealPlansForClient(supabase, user.id, id),
    getClientLastActivity(supabase, id),
    getSessionHistory(supabase, id),
    getConversationMessages(supabase, client.id),
    listExercises(supabase, {}),
    getWeeklyTrainingSummary(supabase, id, activeContext),
    getMyStats(supabase, id, "athlete"),
  ]);
  // Depends on historyEntries' log ids, so it can't join the Promise.all
  // above — same two-step shape /history's own page uses for itself.
  const loggedSets = await getLoggedSets(supabase, historyEntries.map((e) => e.log.id));
  const loggedSetsByExercise = groupLoggedSetsByExercise(loggedSets);

  const activeClients = clients.filter((c) => c.status === "active");

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/coaching/athletes"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground lg:hidden"
      >
        <ArrowLeft className="size-4" />
        Athletes
      </Link>

      <AthleteDetailPanel
        coachId={user.id}
        athleteId={id}
        client={client}
        programs={programs}
        mealPlans={mealPlans}
        lastActivityOn={lastActivityOn}
        activeClients={activeClients}
        weeklySummary={weeklySummary}
        consistencyPercent={activeContext?.consistencyPercent ?? null}
        currentStreak={athleteStats.currentStreak}
        historyEntries={historyEntries}
        loggedSetsByExercise={loggedSetsByExercise}
        exercises={exercises}
        messages={messages}
      />
    </div>
  );
}
