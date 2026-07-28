import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfileDetails } from "@/lib/profile/queries";
import { listExercises } from "@/lib/exercises/queries";
import { ExerciseAdminPanel } from "@/components/exercises/exercise-admin-panel";

export const metadata: Metadata = {
  title: "Exercise Library Admin",
  robots: { index: false, follow: false },
};

/** Admin-only "Create Exercises, Edit Exercises, Merge Duplicate
 * Exercises, Archive Exercises, Restore Archived Exercises, Delete
 * Exercises" (spec) — the merge tool and the full (including archived)
 * catalog table live here; per-exercise editing stays on that exercise's
 * own detail page (see EditExerciseDialog), reached from this table. */
export default async function ExerciseAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?redirect_to=/exercises/admin");
  }

  const profile = await getMyProfileDetails(supabase, user.id);
  if (!profile.is_admin) {
    redirect("/exercises");
  }

  const exercises = await listExercises(supabase, { includeArchived: true });

  return <ExerciseAdminPanel initialExercises={exercises} />;
}
