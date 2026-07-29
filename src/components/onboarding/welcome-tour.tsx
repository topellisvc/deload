"use client";

import { useEffect, useState } from "react";
import { Calculator, ClipboardList, Dumbbell, History, LayoutDashboard, Users } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { getMyProfile } from "@/lib/coaching/queries";
import { markTourSeen } from "@/lib/coaching/mutations";
import type { UserRole } from "@/lib/supabase/types";

interface TourStop {
  label: string;
  description: string;
  icon: typeof Dumbbell;
}

const ATHLETE_STOPS: TourStop[] = [
  { label: "Dashboard", description: "Today's workout and your progress at a glance", icon: LayoutDashboard },
  { label: "Programs", description: "Build your own, or see one a coach assigned you", icon: ClipboardList },
  { label: "Exercise Library", description: "Look up any exercise — cues, common mistakes, and more", icon: Dumbbell },
  { label: "History", description: "Past sessions and your personal records", icon: History },
  { label: "Coaching", description: "Connect with a coach if you'd like one", icon: Users },
  { label: "Tools", description: "Free calculators — 1RM, macros, pace, and more", icon: Calculator },
];

const COACH_STOPS: TourStop[] = [
  { label: "Coaching", description: "Invite clients and keep an eye on their progress", icon: Users },
  { label: "Programs", description: "Build programs for yourself or for your clients", icon: ClipboardList },
  { label: "Exercise Library", description: "Browse exercises, or add your own — new ones go to admin review before other coaches see them", icon: Dumbbell },
  { label: "Dashboard", description: "Your own day, plus a quick look at your roster", icon: LayoutDashboard },
  { label: "History", description: "Your own training history and personal records", icon: History },
  { label: "Tools", description: "Free calculators — 1RM, macros, pace, and more", icon: Calculator },
];

/**
 * A one-time "here's where to find everything" modal shown right after
 * role selection resolves — whether that came from the sign-up form's new
 * name+role fields (role_selected already true on first login) or from
 * RoleOnboarding's fallback prompt (role_selected flips true right before
 * its own page reload). Either path lands here the same way: this only
 * checks role_selected && !tour_seen, so it never needs to know which one
 * just happened.
 *
 * Unlike RoleOnboarding this is purely informational — nothing here gates
 * any part of the app — so it uses the shared dismissable Dialog (Escape,
 * overlay click, and a close button all work) instead of RoleOnboarding's
 * bespoke non-dismissable overlay.
 */
export function WelcomeTour() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<UserRole>("athlete");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const supabase = createClient();

    getMyProfile(supabase, user.id)
      .then(({ role: fetchedRole, roleSelected, tourSeen }) => {
        if (cancelled) return;
        setRole(fetchedRole);
        setOpen(roleSelected && !tourSeen);
      })
      // Same reasoning as RoleOnboarding's equivalent catch — a failed
      // lookup just skips the tour this time rather than throwing, and
      // gets another chance on the next page load.
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleClose() {
    setOpen(false);
    if (!user) return;
    await markTourSeen(createClient(), user.id);
  }

  const stops = role === "coach" ? COACH_STOPS : ATHLETE_STOPS;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Here's where to find everything"
      description="A quick tour before you dive in — you won't see this again."
      className="max-w-lg"
    >
      <div className="flex flex-col gap-3">
        {stops.map((stop) => {
          const Icon = stop.icon;
          return (
            <div key={stop.label} className="flex items-start gap-3">
              <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{stop.label}</span>
                <span className="text-xs text-muted-foreground">{stop.description}</span>
              </div>
            </div>
          );
        })}
        <Button type="button" onClick={handleClose} className="mt-2 w-full">
          Got it
        </Button>
      </div>
    </Dialog>
  );
}
