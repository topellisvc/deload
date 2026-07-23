import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getAthleteSummary,
  getCoachingSummary,
  getCurrentProgram,
  getMyProfileDetails,
  getMyStats,
  getPersonalRecords,
} from "@/lib/profile/queries";
import { ProfileHeader } from "@/components/profile/profile-header";
import { TrainingSnapshot } from "@/components/profile/training-snapshot";
import { ProfileForm } from "@/components/profile/profile-form";
import { StatsPanel } from "@/components/profile/stats-panel";
import { PersonalRecords } from "@/components/profile/personal-records";
import { CoachingSummaryCard } from "@/components/profile/coaching-summary";
import { AthleteSummaryCard } from "@/components/profile/athlete-summary";
import { Achievements } from "@/components/profile/achievements";
import { AccountSettings } from "@/components/profile/account-settings";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

/**
 * The personal dashboard: header, quick-glance snapshot, editable
 * training profile, activity stats, PRs, coaching/athlete summaries
 * (whichever apply), achievements, and account settings — in that order,
 * per the page's actual information hierarchy (who you are and how
 * you're doing, before the editable form, before account-level actions).
 *
 * Every section either reads data that already exists elsewhere in the
 * schema (programs, session_logs, coach_clients) or the small set of new
 * profile columns/personal_records rows added in migration 0009 — no
 * duplicate tracking anywhere.
 */
export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?redirect_to=/profile");
  }

  const profile = await getMyProfileDetails(supabase, user.id);
  const [stats, currentProgram, records, athleteSummary] = await Promise.all([
    getMyStats(supabase, user.id, profile.role),
    getCurrentProgram(supabase, user.id),
    getPersonalRecords(supabase, user.id),
    getAthleteSummary(supabase, user.id),
  ]);
  const coachingSummary = profile.role === "coach" ? await getCoachingSummary(supabase, user.id) : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <ProfileHeader profile={profile} email={user.email ?? ""} />

      <TrainingSnapshot
        profile={profile}
        currentProgram={currentProgram}
        currentCoachName={athleteSummary?.coachName ?? null}
        isCoach={profile.role === "coach"}
        activeClientCount={stats.activeClientCount}
      />

      <ProfileForm profile={profile} />

      <StatsPanel stats={stats} role={profile.role} />

      <PersonalRecords userId={user.id} records={records} />

      {coachingSummary && <CoachingSummaryCard summary={coachingSummary} />}

      {athleteSummary && <AthleteSummaryCard summary={athleteSummary} />}

      <Achievements
        input={{
          sessionCount: stats.sessionCount,
          programsCreated: stats.programsCreated,
          createdAt: profile.created_at,
        }}
      />

      <AccountSettings userId={user.id} email={user.email ?? ""} role={profile.role} />
    </div>
  );
}
