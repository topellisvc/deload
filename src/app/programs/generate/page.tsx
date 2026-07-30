import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfileDetails } from "@/lib/profile/queries";
import { GenerateProgramForm } from "@/components/programs/generate-program-form";

export const metadata: Metadata = {
  title: "Build my program",
  robots: { index: false, follow: false },
};

/**
 * Entry point for the questionnaire-driven program generator
 * (lib/programs/generate/*). A full page rather than a dialog like the
 * other "create a program" flows (New Program, Describe a Program) —
 * ProgramGenerationInput has far more fields than either of those (goal,
 * schedule, athlete profile, injury screen, goal-specific follow-ups), and
 * cramming that into a modal would mean scrolling inside a scrolling
 * container.
 */
export default async function GenerateProgramPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?redirect_to=/programs/generate");
  }

  // programs-list.tsx already greys the entry-point button out for anyone
  // without access — this is the real gate, not just the cosmetic one,
  // same "disabled button isn't a security boundary" reasoning as every
  // other admin-gated route in this app checking server-side (see
  // src/app/admin/page.tsx's is_admin check).
  const profile = await getMyProfileDetails(supabase, user.id);
  if (!profile.beta_build_for_me) {
    redirect("/programs");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Build my program</h1>
        <p className="text-muted-foreground">
          Answer a few questions and we&apos;ll generate a full multi-week program — deterministic programming logic, not a model
          freehanding numbers. You&apos;ll get a chance to review it before it&apos;s created.
        </p>
      </div>
      <GenerateProgramForm userId={user.id} />
    </div>
  );
}
