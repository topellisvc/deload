import Link from "next/link";
import { Pencil } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn, getInitials } from "@/lib/utils";
import type { Profile } from "@/lib/supabase/types";

function formatMemberSince(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

interface ProfileHeaderProps {
  profile: Profile;
  email: string;
}

/**
 * No photo upload for v1 — an initials avatar covers "who is this" at a
 * glance without needing file storage/upload UI. "Edit Profile" scrolls
 * to the Training Profile form below rather than opening a separate edit
 * surface, since that form already covers every editable header field
 * (display name, bio) alongside the rest — one edit surface, not two.
 */
export function ProfileHeader({ profile, email }: ProfileHeaderProps) {
  const initials = getInitials(profile.display_name, email);

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div
          aria-hidden="true"
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary"
        >
          {initials}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {profile.display_name || email}
            </h1>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              Athlete
            </span>
            {profile.role === "coach" && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                Coach
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Member since {formatMemberSince(profile.created_at)}</p>
          <p className="max-w-md text-sm text-foreground">
            {profile.bio || <span className="text-muted-foreground">No bio yet.</span>}
          </p>
        </div>
      </div>

      <Link href="#training-profile" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "self-start")}>
        <Pencil className="size-3.5" />
        Edit Profile
      </Link>
    </div>
  );
}
