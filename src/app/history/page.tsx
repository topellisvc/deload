import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionHistory, getLoggedSets, groupLoggedSetsByExercise } from "@/lib/logging/queries";
import { HistoryList } from "@/components/history/history-list";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "History",
  robots: { index: false, follow: false },
};

/**
 * Every session the signed-in user has logged, across every program
 * they've trained on — the athlete's own permanent record, separate from
 * (and much fuller than) the dashboard's "Recent activity" strip, which is
 * capped at 8 summary-only events. Scoped to session_logs.athlete_id, so
 * this is always "my own training," never a client's — a coach reviewing
 * a client's history still does that from /coaching/athletes/[id].
 */
export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?redirect_to=/history");
  }

  const entries = await getSessionHistory(supabase, user.id);
  const loggedSets = await getLoggedSets(supabase, entries.map((e) => e.log.id));
  const loggedSetsByExercise = groupLoggedSetsByExercise(loggedSets);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">History</h1>
        <p className="text-muted-foreground">
          Every session you&apos;ve logged, across every program — tap a date to see exactly what you did.
        </p>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <CalendarDays className="size-8 text-muted-foreground" />
            <p className="text-foreground">Nothing logged yet.</p>
            <p className="text-sm text-muted-foreground">
              Log a session from any of your programs and it&apos;ll show up here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <HistoryList entries={entries} loggedSetsByExercise={loggedSetsByExercise} />
      )}
    </div>
  );
}
