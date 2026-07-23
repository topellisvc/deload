import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfileDetails, getMyStats } from "@/lib/profile/queries";
import { ProfileForm } from "@/components/profile/profile-form";
import { StatsPanel } from "@/components/profile/stats-panel";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?redirect_to=/profile");
  }

  const profile = await getMyProfileDetails(supabase, user.id);
  const stats = await getMyStats(supabase, user.id, profile.role);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Your profile</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>

      <StatsPanel stats={stats} role={profile.role} createdAt={profile.created_at} />

      <ProfileForm profile={profile} />
    </div>
  );
}
