import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCoachEmail } from "@/lib/coaching/queries";
import { getPersonalRecords } from "@/lib/profile/queries";
import { getTrainingDayForTraining, getDraftSession, getPreviousPerformanceForExercises } from "@/lib/training/queries";
import { buildExerciseSequence } from "@/lib/training/sequence";
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

  const sequence = buildExerciseSequence(detail.day.blocks);

  const [draft, personalRecords, coachEmail, previousPerformance] = await Promise.all([
    getDraftSession(supabase, dayId, user.id),
    getPersonalRecords(supabase, user.id),
    detail.program.ownerId !== user.id ? getCoachEmail(supabase, { coachId: detail.program.ownerId, clientId: user.id }) : Promise.resolve(null),
    getPreviousPerformanceForExercises(
      supabase,
      user.id,
      sequence.map((step) => ({
        blockExerciseId: step.blockExercise.id,
        exerciseId: step.blockExercise.exercise_id,
        customName: step.blockExercise.custom_name,
      }))
    ),
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
    />
  );
}
