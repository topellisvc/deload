"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, Lock, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { upgradeToCoach } from "@/lib/coaching/mutations";
import type { UserRole } from "@/lib/supabase/types";

interface AccountSettingsProps {
  userId: string;
  email: string;
  role: UserRole;
}

/**
 * Account-level actions, kept visually separate from training data —
 * this section is about the account itself, not training info.
 *
 * Notification preferences and privacy settings are placeholders: there's
 * no notification system or privacy-config backend in the app yet, so
 * these are labeled "Coming soon" rather than wired to controls that
 * would silently do nothing.
 *
 * Delete account is deliberately NOT wired to real deletion. Doing that
 * safely needs Supabase's admin API (auth.admin.deleteUser), which
 * requires a service-role key — this app only has the public anon key
 * (see mutations.ts comments elsewhere for the same constraint on
 * invites). Building a fake delete button that doesn't actually delete
 * anything would be worse than being upfront about it.
 */
export function AccountSettings({ userId, email, role }: AccountSettingsProps) {
  const router = useRouter();
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteRequested, setDeleteRequested] = useState(false);

  async function handleBecomeCoach() {
    setUpgrading(true);
    setError(null);
    const supabase = createClient();
    const { error: upgradeError } = await upgradeToCoach(supabase, userId);
    setUpgrading(false);
    if (upgradeError) {
      setError(upgradeError);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Account settings</h2>

      <div className="flex flex-col divide-y divide-border">
        <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
          <span className="text-sm text-muted-foreground">Email</span>
          <span className="text-sm font-medium text-foreground">{email}</span>
        </div>

        <div className="flex items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Notification preferences</span>
          </div>
          <span className="text-xs text-muted-foreground">Coming soon</span>
        </div>

        <div className="flex items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Privacy settings</span>
          </div>
          <span className="text-xs text-muted-foreground">Coming soon</span>
        </div>

        {role !== "coach" && (
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Coaching</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleBecomeCoach} disabled={upgrading}>
              {upgrading ? "Setting you up…" : "Become a coach"}
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
          <div className="flex items-center gap-2">
            <Trash2 className="size-4 text-danger" />
            <span className="text-sm text-muted-foreground">Delete account</span>
          </div>
          {deleteRequested ? (
            <span className="text-xs text-muted-foreground">
              Email {" "}
              <a href="mailto:support@deloadhq.com" className="text-primary hover:underline">
                support@deloadhq.com
              </a>{" "}
              to request this.
            </span>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setDeleteRequested(true)}>
              Delete account
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-sm text-foreground">{error}</p>
        </div>
      )}
    </div>
  );
}
