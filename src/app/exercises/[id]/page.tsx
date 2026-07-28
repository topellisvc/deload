import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfileDetails } from "@/lib/profile/queries";
import { getExerciseDetail, getExerciseUsageStats } from "@/lib/exercises/queries";
import { ExerciseDetailView } from "@/components/exercises/exercise-detail-view";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const detail = await getExerciseDetail(supabase, id);
  return { title: detail ? detail.name : "Exercise", robots: { index: false, follow: false } };
}

/**
 * The Exercise Detail page — "should feel like a premium knowledge page
 * rather than a basic database entry" (spec). Unlike the library's list
 * page, this one is readable by any signed-in user, not just coaches/
 * admins: "During Training Mode an athlete should be able to tap an
 * exercise name to open the Exercise Detail page" is exactly this page.
 */
export default async function ExerciseDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?redirect_to=/exercises/${id}`);
  }

  const [detail, usage, profile] = await Promise.all([
    getExerciseDetail(supabase, id),
    getExerciseUsageStats(supabase, id),
    getMyProfileDetails(supabase, user.id),
  ]);

  if (!detail) notFound();

  const canEdit = profile.is_admin || detail.owner_id === user.id;

  return <ExerciseDetailView exercise={detail} usage={usage} canEdit={canEdit} isAdmin={profile.is_admin} />;
}
