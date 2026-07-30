import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyProfileDetails } from "@/lib/profile/queries";
import { getProgramSummaries } from "@/lib/programs/queries";
import { getSessionHistory, getLoggedSets, groupLoggedSetsByExercise } from "@/lib/logging/queries";
import { ProgramCard } from "@/components/programs/program-card";
import { ClientHistorySection } from "@/components/coaching/client-history-section";

export const metadata: Metadata = {
  title: "User",
  robots: { index: false, follow: false },
};

interface AdminUserPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Admin-only, read-only look at one signed-up account's programs and full
 * session history — "as admin I would like to be able to see anyone's
 * programs/sessions." Reuses the same pieces the coach's own athlete
 * workspace uses (ProgramCard with every mutation flag false, and
 * ClientHistorySection, already canDelete={false}) rather than building a
 * parallel read-only UI from scratch — an admin viewing someone else's
 * program lands on the ordinary /programs/[id] page too (migration 0041's
 * RLS + ProgramViewer's isOwner/isAthlete checks already render that
 * read-only for a third party with no code path change needed there).
 *
 * getProgramSummaries/getSessionHistory/getLoggedSets all already accept
 * any userId — no new query functions needed, just the admin-read RLS
 * (migration 0041) that lets them actually return rows for someone who
 * isn't the caller.
 */
export default async function AdminUserPage({ params }: AdminUserPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?redirect_to=/admin/users/${id}`);
  }

  const viewerProfile = await getMyProfileDetails(supabase, user.id);
  if (!viewerProfile.is_admin) {
    redirect("/dashboard");
  }

  // getMyProfileDetails always returns a shape (it falls back to a blank
  // default rather than erroring on a missing row — see that function),
  // so it can't itself tell "no such user" from "real, mostly-empty
  // profile". A direct existence check first is the only reliable way to
  // 404 on a bad id instead of rendering a fake blank account page.
  const { data: targetRow } = await supabase.from("profiles").select("id").eq("id", id).maybeSingle();
  if (!targetRow) notFound();

  const profile = await getMyProfileDetails(supabase, id);

  const [programs, historyEntries] = await Promise.all([getProgramSummaries(supabase, id), getSessionHistory(supabase, id)]);
  // Depends on historyEntries' log ids, so it can't join the Promise.all
  // above — same two-step shape /coaching/athletes/[id]'s own page uses.
  const loggedSets = await getLoggedSets(supabase, historyEntries.map((e) => e.log.id));
  const loggedSetsByExercise = groupLoggedSetsByExercise(loggedSets);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <Link href="/admin" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />
        Admin
      </Link>

      <div className="mb-8 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{profile.display_name || profile.email || "Account"}</h1>
        <p className="text-sm text-muted-foreground">
          {profile.email ?? "No email on file"} · {profile.role === "coach" ? "Coach" : "Athlete"}
        </p>
      </div>

      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Programs ({programs.length})</h2>
          {programs.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-sm text-muted-foreground">
              No programs yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {programs.map((program) => (
                <ProgramCard
                  key={program.id}
                  program={program}
                  canSetActive={false}
                  settingActive={false}
                  onSetActive={() => {}}
                  canSend={false}
                  sendingCopy={false}
                  onSend={() => {}}
                  canDelete={false}
                  deleting={false}
                  onDelete={() => {}}
                />
              ))}
            </div>
          )}
        </div>

        <ClientHistorySection entries={historyEntries} loggedSetsByExercise={loggedSetsByExercise} />
      </div>
    </div>
  );
}
