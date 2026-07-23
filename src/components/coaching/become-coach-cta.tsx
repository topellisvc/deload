"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { upgradeToCoach } from "@/lib/coaching/mutations";

/**
 * Compact inline version of the old /clients UpgradePrompt (full-page,
 * its own mx-auto/py-16 wrapper) — reuses the exact same upgradeToCoach
 * mutation, just styled to sit as one card among the rest of /coaching
 * instead of taking over the whole page.
 */
export function BecomeCoachCta({ userId }: { userId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error: upgradeError } = await upgradeToCoach(supabase, userId);
    setSubmitting(false);
    if (upgradeError) {
      setError(upgradeError);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Sparkles className="size-6 text-primary" />
        <h2 className="text-base font-semibold text-foreground">Interested in coaching others?</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Invite athletes, build programs for them, and track what they actually get done — free while
          we&rsquo;re building things out.
        </p>
        {error && (
          <div className="flex w-full max-w-sm gap-3 rounded-lg border border-danger/30 bg-danger/10 p-3 text-left">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
            <p className="text-sm text-foreground">{error}</p>
          </div>
        )}
        <Button onClick={handleUpgrade} disabled={submitting}>
          {submitting ? "Setting you up…" : "Become a coach"}
        </Button>
      </div>
    </div>
  );
}
