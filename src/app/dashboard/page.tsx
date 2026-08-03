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
  getWeeklyTrainingSummary,
} from "@/lib/dashboard/queries";
import { computeInsights } from "@/lib/dashboard/insights";
import { createProgramFromTemplate } from "@/lib/programs/mutations";
import { getStarterTemplate } from "@/lib/programs/starter-templates";
import { HeroSection } from "@/components/dashboard/hero-section";
import { DashboardSnapshot } from "@/components/dashboard/dashboard-snapshot";
import { ThisWeekStats } from "@/components/dashboard/this-week-stats";
import { TodayWorkoutSection } from "@/components/dashboard/today-workout-section";
import { WeeklyVolumeChart } from "@/components/dashboard/weekly-volume-chart";
import { ProgressSection } from "@/components/dashboard/progress-section";
import { EvidenceInsightsSection } from "@/components/dashboard/evidence-insights-section";
import { GoalsSection } from "@/components/dashboard/goals-section";
import { RecentActivitySection } from "@/components/dashboard/recent-activity-section";
import { PersonalRecordsRow } from "@/components/dashboard/personal-records-row";
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
   * Absent for the normal "today" view.
   * `?start=<template-slug>` — set by StarterProgramPicker's sign-in
   * redirect (mode="redirect" on the signed-out homepage): a visitor
   * picked a starter program before they had an account, so it's created
   * here once they land back signed in, then this redirects straight to
   * it rather than rendering the dashboard at all. */
  searchParams: Promise<{ day?: string; start?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?redirect_to=/dashboard");
  }

  const { day: viewedDayId, start: startSlug } = await searchParams;

  if (startSlug) {
    const template = getStarterTemplate(startSlug);
    if (template) {
      const { program } = await createProgramFromTemplate(supabase, { template, userId: user.id });
      // Falls through to the normal dashboard render on failure rather than
      // getting stuck — the picker is still right there in EmptyHero below
      // if this didn't work.
      if (program) redirect(`/programs/${program.id}`);
    }
  }

  // profile and activeContext are independent of each other (both only
  // need user.id) but both feed the Promise.all below (getDashboardStats
  // needs profile.role and activeContext together, computed once here
  // rather than re-derived per section — otherwise the stat cards and the
  // hero/today's-workout sections could disagree about what "today" is).
  const [profile, activeContext] = await Promise.all([
    getMyProfileDetails(supabase, user.id),
    getActiveProgramContext(supabase, user.id, viewedDayId ?? null),
  ]);

  const [stats, recentSessionActivity, records, recentActivity, coachingData, weeklySummary] = await Promise.all([
    getDashboardStats(supabase, user.id, profile.role, activeContext),
    getRecentSessionActivity(supabase, user.id),
    getPersonalRecords(supabase, user.id),
    getRecentActivity(supabase, user.id),
    profile.role === "coach" ? getCoachingDashboard(supabase, user.id) : Promise.resolve(null),
    getWeeklyTrainingSummary(supabase, user.id, activeContext),
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
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 lg:py-10">
      {/* Desktop-only card grid (the mockups Ellis shared) — Active Program
          beside This Week's real numbers, then Next Workout / Weekly Volume
          / Recent Activity in a row, then the main-lift PRs. Hidden below
          lg; the single-column stack right below renders the exact same
          underlying data (activeContext, recentActivity, records) through
          the ordinary mobile components instead — see the lg:hidden
          wrappers there for which 4 sections this grid supersedes.
          Progress/Evidence Insights/Goals/Upcoming/Coaching have no
          desktop-specific equivalent, so they're not duplicated up here —
          they stay in their one spot in the stack below at every width. */}
      <div className="hidden lg:flex lg:flex-col lg:gap-4">
        <div className="grid grid-cols-[2fr_1fr] items-start gap-4">
          <HeroSection displayName={profile.display_name} email={user.email ?? ""} athleteId={user.id} activeContext={activeContext} />
          <ThisWeekStats summary={weeklySummary} consistencyPercent={activeContext?.consistencyPercent ?? null} />
        </div>
        <div className="grid grid-cols-3 items-start gap-4">
          <TodayWorkoutSection context={activeContext} />
          <WeeklyVolumeChart data={weeklySummary.dailyVolumeKg} />
          <RecentActivitySection events={recentActivity} />
        </div>
        <PersonalRecordsRow records={records} />
      </div>

      <div className="lg:hidden">
        <HeroSection displayName={profile.display_name} email={user.email ?? ""} athleteId={user.id} activeContext={activeContext} />
      </div>

      <div className="lg:hidden">
        <DashboardSnapshot stats={stats} />
      </div>

      <div className="lg:hidden">
        <TodayWorkoutSection context={activeContext} />
      </div>

      <ProgressSection stats={stats} records={records} profile={profile} />

      <EvidenceInsightsSection insights={insights} />

      <GoalsSection goal={profile.goal} />

      <div className="lg:hidden">
        <RecentActivitySection events={recentActivity} />
      </div>

      <UpcomingSection sessions={activeContext?.upcoming ?? []} />

      {coachingData && <CoachingDashboardSection data={coachingData} />}
    </div>
  );
}
