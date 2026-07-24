import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfileDetails, getPersonalRecords } from "@/lib/profile/queries";
import {
  getActiveProgramContext,
  getCoachingDashboard,
  getDashboardStats,
  getRecentActivity,
  getRecentSessionActivity,
} from "@/lib/dashboard/queries";
import { computeInsights } from "@/lib/dashboard/insights";
import { HeroSection } from "@/components/dashboard/hero-section";
import { DashboardSnapshot } from "@/components/dashboard/dashboard-snapshot";
import { TodayWorkoutSection } from "@/components/dashboard/today-workout-section";
import { ProgressSection } from "@/components/dashboard/progress-section";
import { EvidenceInsightsSection } from "@/components/dashboard/evidence-insights-section";
import { GoalsSection } from "@/components/dashboard/goals-section";
import { RecentActivitySection } from "@/components/dashboard/recent-activity-section";
import { UpcomingSection } from "@/components/dashboard/upcoming-section";
import { CoachingDashboardSection } from "@/components/dashboard/coaching-dashboard-section";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

/**
 * The real landing page for signed-in users — lives at /dashboard rather
 * than replacing the static marketing homepage at / (see site-header /
 * home-redirect for how signed-in visitors get here). Every section reads
 * from the Active Program (lib/dashboard/queries.ts's
 * getActiveProgramContext) plus the same stats/records infrastructure
 * /profile already uses — nothing here is tracked twice.
 */
export default async function DashboardPage({
  searchParams,
}: {
  /** `?day=<training_day_id>` — set by the Hero's prev/next browse arrows
   * (see resolveViewedDay usage in HeroSection/getActiveProgramContext).
   * Absent for the normal "today" view. */
  searchParams: Promise<{ day?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?redirect_to=/dashboard");
  }

  const { day: viewedDayId } = await searchParams;

  // profile and activeContext are independent of each other (both only
  // need user.id) but both feed the Promise.all below (getDashboardStats
  // needs profile.role and activeContext together, computed once here
  // rather than re-derived per section — otherwise the stat cards and the
  // hero/today's-workout sections could disagree about what "today" is).
  const [profile, activeContext] = await Promise.all([
    getMyProfileDetails(supabase, user.id),
    getActiveProgramContext(supabase, user.id, viewedDayId ?? null),
  ]);

  const [stats, recentSessionActivity, records, recentActivity, coachingData] = await Promise.all([
    getDashboardStats(supabase, user.id, profile.role, activeContext),
    getRecentSessionActivity(supabase, user.id),
    getPersonalRecords(supabase, user.id),
    getRecentActivity(supabase, user.id),
    profile.role === "coach" ? getCoachingDashboard(supabase, user.id) : Promise.resolve(null),
  ]);

  let upcomingWeekLabel: string | null = null;
  if (activeContext?.today) {
    const weekPosition = activeContext.today.weekPosition;
    const nextWeek = activeContext.program.weeks.find((w) => w.position === weekPosition + 1);
    upcomingWeekLabel = nextWeek ? nextWeek.label || `Week ${nextWeek.position}` : null;
  }

  const insights = computeInsights({
    currentStreak: stats.currentStreak,
    sessionsLast14Days: recentSessionActivity.sessionsLast14Days,
    sessionsPrevious14Days: recentSessionActivity.sessionsPrevious14Days,
    daysSinceLastSession: recentSessionActivity.daysSinceLastSession,
    completionPercent: activeContext?.completionPercent ?? null,
    upcomingWeekLabel,
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
      <HeroSection displayName={profile.display_name} email={user.email ?? ""} athleteId={user.id} activeContext={activeContext} />

      <DashboardSnapshot stats={stats} />

      <TodayWorkoutSection context={activeContext} />

      <ProgressSection stats={stats} records={records} profile={profile} />

      <EvidenceInsightsSection insights={insights} />

      <GoalsSection goal={profile.goal} />

      <RecentActivitySection events={recentActivity} />

      <UpcomingSection sessions={activeContext?.upcoming ?? []} />

      {coachingData && <CoachingDashboardSection data={coachingData} />}
    </div>
  );
}
