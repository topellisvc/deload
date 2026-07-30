import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCoachEmail } from "@/lib/coaching/queries";
import { getPersonalRecords, getAthleteInjuryProfile } from "@/lib/profile/queries";
import { getTrainingDayForTraining, getDraftSession, getPreviousPerformanceForExercises } from "@/lib/training/queries";
import { buildExerciseList } from "@/lib/training/sequence";
import { flaggedJoints } from "@/lib/training/autoregulation";
import { TrainingSession } from "@/components/training/training-session";

export const metadata: Metadata = {
  title: "Training",
  robots: { index: false, follow: false },
};

interface TrainPageProps {
  params: Promise<{ dayId: string }>;
}

/**
 * Training Mode's entry point — what "Start Workout" launches instead of
 * just opening the program page. Athlete-only: a coach following their own
 * link to a client's day gets redirected to the (read-only) program page
 * instead, since logging what actually happened is inherently self-reported
 * (same rule session_logs/logged_sets RLS already enforces everywhere else).
 */
export default async function TrainPage({ params }: TrainPageProps) {
  const { dayId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?redirect_to=/train/${dayId}`);
  }

  const detail = await getTrainingDayForTraining(supabase, dayId);
  if (!detail) notFound();

  if (detail.program.athleteId !== user.id) {
    redirect(`/programs/${detail.program.id}`);
  }
  if (detail.day.is_rest_day) {
    redirect(`/programs/${detail.program.id}`);
  }

  const exerciseList = buildExerciseList(detail.day.blocks);

  const [draft, personalRecords, coachEmail, previousPerformance, injuries] = await Promise.all([
    getDraftSession(supabase, dayId, user.id),
    getPersonalRecords(supabase, user.id),
    detail.program.ownerId !== user.id ? getCoachEmail(supabase, { coachId: detail.program.ownerId, clientId: user.id }) : Promise.resolve(null),
    getPreviousPerformanceForExercises(
      supabase,
      user.id,
      exerciseList.map((exercise) => ({
        blockExerciseId: exercise.id,
        exerciseId: exercise.exercise_id,
        customName: exercise.custom_name,
      }))
    ),
    getAthleteInjuryProfile(supabase, user.id),
  ]);

  return (
    <TrainingSession
      trainingDayId={dayId}
      athleteId={user.id}
      programId={detail.program.id}
      programName={detail.program.name}
      weekLabel={detail.week.label || `Week ${detail.week.position}`}
      weekPosition={detail.week.position}
      totalWeeks={detail.totalWeeks}
      dayLabel={detail.day.label || `Day ${detail.day.position}`}
      coachEmail={coachEmail}
      blocks={detail.day.blocks}
      personalRecords={personalRecords}
      previousPerformance={previousPerformance}
      initialDraft={draft}
      flaggedJoints={flaggedJoints(injuries)}
    />
  );
}
