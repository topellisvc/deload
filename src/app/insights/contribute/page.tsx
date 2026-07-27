import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfileDetails } from "@/lib/profile/queries";
import { getMyContributorProfile } from "@/lib/insights/queries";
import { ContributorApplicationView } from "@/components/insights/contributor-application-view";

export const metadata: Metadata = {
  title: "Contribute to Insights",
  robots: { index: false, follow: false },
};

/**
 * Apply to become an Insights contributor — signed-in only (there's
 * nothing here for a signed-out visitor to do), and the one entry point
 * into the whole Phase 2 workflow: apply -> admin reviews -> approved ->
 * write at /insights/write. See ContributorApplicationView for the
 * pending/rejected/approved state handling.
 */
export default async function ContributePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?redirect_to=/insights/contribute");
  }

  const [profile, contributor] = await Promise.all([getMyProfileDetails(supabase, user.id), getMyContributorProfile(supabase, user.id)]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Contribute to Insights</h1>
        <p className="text-muted-foreground">
          Insights is written by verified coaches, sports scientists, and clinicians. Apply below, and an admin will review your
          application.
        </p>
      </div>

      <ContributorApplicationView profileId={user.id} defaultName={profile.display_name ?? ""} initial={contributor} />
    </div>
  );
}
