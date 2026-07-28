import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfileDetails } from "@/lib/profile/queries";
import { listExercises } from "@/lib/exercises/queries";
import { ExerciseLibraryList } from "@/components/exercises/exercise-library-list";

export const metadata: Metadata = {
  title: "Exercise Library",
  robots: { index: false, follow: false },
};

/**
 * The Exercise Library's browse page — "Initially this page should only
 * be visible to coaches and administrators. Athletes access exercises
 * through Training Mode or program pages" (spec). The redirect here is an
 * app-level nicety, not the real access boundary: RLS lets any
 * authenticated user select from `exercises`, so nothing sensitive would
 * leak even if this guard were bypassed — same reasoning as /admin's own
 * guard comment.
 */
export default async function ExerciseLibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?redirect_to=/exercises");
  }

  const profile = await getMyProfileDetails(supabase, user.id);
  if (profile.role !== "coach" && !profile.is_admin) {
    redirect("/dashboard");
  }

  const exercises = await listExercises(supabase, {});

  return <ExerciseLibraryList exercises={exercises} isAdmin={profile.is_admin} currentUserId={user.id} />;
}
