import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCoachingDashboard, getMyClients, getMyRole } from "@/lib/coaching/queries";
import { AthletesShell } from "@/components/coaching/athletes-shell";

export const metadata: Metadata = {
  title: "Your athletes",
  robots: { index: false, follow: false },
};

/**
 * The coach's real workspace (mockup's 4-tab "Coach" page) — a persistent
 * left panel (search/filter/tabs over the roster, `AthletesShell`) beside
 * `{children}`, which is either the "select an athlete" empty state
 * (athletes/page.tsx) or one athlete's full detail (athletes/[id]/page.tsx).
 * Both children keep working as ordinary routes — this layout just adds the
 * list panel around them, so a direct link to /coaching/athletes/<id>
 * (dashboard's CoachingDashboardSection, /clients/[id]'s redirect) still
 * lands on exactly the right detail view, just with the roster visible
 * alongside it now instead of only a "back to Coaching" link.
 *
 * Auth/role gate mirrors athletes/[id]/page.tsx's own (that page repeats it
 * rather than trusting the layout, in case it's ever reached some other
 * way) — a signed-out visitor or non-coach never sees the roster at all.
 */
export default async function AthletesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?redirect_to=/coaching/athletes");
  }

  const role = await getMyRole(supabase, user.id);
  if (role !== "coach") notFound();

  const [dashboard, clients] = await Promise.all([getCoachingDashboard(supabase, user.id), getMyClients(supabase, user.id)]);
  const sentPendingInvites = clients.filter((c) => c.status === "pending");
  const knownEmails = clients.map((c) => c.client_email);

  return (
    <AthletesShell
      coachId={user.id}
      coachEmail={user.email ?? null}
      dashboard={dashboard}
      sentPendingInvites={sentPendingInvites}
      knownEmails={knownEmails}
    >
      {children}
    </AthletesShell>
  );
}
