"use client";

import { useMemo, useState } from "react";
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
import { flattenProgramDays, resolveDisplayedDay } from "@/lib/dashboard/day-view";
import type { ActiveProgramContext, ActivityEvent, DashboardStats, WeeklyTrainingSummary } from "@/lib/dashboard/types";
import type { Insight } from "@/lib/dashboard/insights";
import type { CoachingDashboardData } from "@/lib/coaching/types";
import type { PersonalRecord, Profile } from "@/lib/supabase/types";

interface DashboardContentProps {
  profile: Profile;
  userEmail: string;
  userId: string;
  activeContext: ActiveProgramContext | null;
  stats: DashboardStats;
  records: PersonalRecord[];
  recentActivity: ActivityEvent[];
  coachingData: CoachingDashboardData | null;
  weeklySummary: WeeklyTrainingSummary;
  insights: Insight[];
}

/**
 * Everything below was previously the dashboard page's own return JSX,
 * moved here so it can own day-browsing as local client state instead of
 * the old `?day=<id>` URL param, which reran the ENTIRE server-side data
 * fetch (program tree, every stat on the page — ~15-20 sequential DB round
 * trips) on every single prev/next click just to swap which day is shown.
 * That was the actual cause of "changing to the next day is slow."
 *
 * All the DATA here is still fetched exactly once, server-side, in
 * dashboard/page.tsx — nothing in this component fetches anything. Browsing
 * only needs `activeContext.program` (the full tree) and
 * `activeContext.dayStatusById` (completed/draft status for every day,
 * already computed server-side from data it already had) to resolve a new
 * `today` via day-view.ts's resolveDisplayedDay — pure, synchronous, and
 * instant.
 */
export function DashboardContent({
  profile,
  userEmail,
  userId,
  activeContext,
  stats,
  records,
  recentActivity,
  coachingData,
  weeklySummary,
  insights,
}: DashboardContentProps) {
  const flat = useMemo(() => (activeContext ? flattenProgramDays(activeContext.program.weeks) : []), [activeContext]);
  // null = "use the server-resolved view as-is" (the auto-resolved today,
  // or whatever ?day= was on the initial load/deep link) — only set once
  // the athlete actually clicks prev/next/Today here on the client.
  const [viewedIndex, setViewedIndex] = useState<number | null>(null);

  const displayContext = useMemo((): ActiveProgramContext | null => {
    if (!activeContext) return null;
    if (viewedIndex == null) return activeContext;
    const today = resolveDisplayedDay({
      flat,
      totalWeeks: activeContext.program.weeks.length,
      displayIndex: viewedIndex,
      todayIndex: activeContext.todayIndex,
      dayStatusById: activeContext.dayStatusById,
    });
    // completionPercent/consistencyPercent/upcoming stay anchored to the
    // real today regardless of what's being browsed — same invariant
    // getActiveProgramContext's own doc comment already states, just
    // preserved here by only ever overriding `today`.
    return { ...activeContext, today };
  }, [activeContext, viewedIndex, flat]);

  function handleNavigateDay(dayId: string) {
    const index = flat.findIndex((f) => f.day.id === dayId);
    if (index >= 0) setViewedIndex(index);
  }

  function handleGoToToday() {
    setViewedIndex(null);
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 lg:py-10">
      {/* Desktop-only card grid (the mockups Ellis shared) — Active Program
          beside This Week's real numbers, then Next Workout / Weekly Volume
          / Recent Activity in a row, then the main-lift PRs. Hidden below
          lg; the single-column stack right below renders the exact same
          underlying data through the ordinary mobile components instead —
          see the lg:hidden wrappers there for which 4 sections this grid
          supersedes. Progress/Evidence Insights/Goals/Upcoming/Coaching
          have no desktop-specific equivalent, so they're not duplicated up
          here — they stay in their one spot in the stack below at every
          width. */}
      <div className="hidden lg:flex lg:flex-col lg:gap-4">
        <div className="grid grid-cols-[2fr_1fr] items-start gap-4">
          <HeroSection
            displayName={profile.display_name}
            email={userEmail}
            athleteId={userId}
            activeContext={displayContext}
            onNavigateDay={handleNavigateDay}
            onGoToToday={handleGoToToday}
          />
          <ThisWeekStats summary={weeklySummary} consistencyPercent={activeContext?.consistencyPercent ?? null} />
        </div>
        <div className="grid grid-cols-3 items-start gap-4">
          <TodayWorkoutSection context={displayContext} />
          <WeeklyVolumeChart data={weeklySummary.dailyVolumeKg} />
          <RecentActivitySection events={recentActivity} />
        </div>
        <PersonalRecordsRow records={records} />
      </div>

      <div className="lg:hidden">
        <HeroSection
          displayName={profile.display_name}
          email={userEmail}
          athleteId={userId}
          activeContext={displayContext}
          onNavigateDay={handleNavigateDay}
          onGoToToday={handleGoToToday}
        />
      </div>

      <div className="lg:hidden">
        <DashboardSnapshot stats={stats} />
      </div>

      <div className="lg:hidden">
        <TodayWorkoutSection context={displayContext} />
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
