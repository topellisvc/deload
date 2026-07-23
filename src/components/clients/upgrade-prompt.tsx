"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { upgradeToCoach } from "@/lib/coaching/mutations";

/**
 * Shown on /clients instead of the roster/invite UI for anyone who isn't
 * role='coach' yet. Coaching is the paid tier — self-programming stays
 * free. There's no billing hooked up yet (see 0003_coach_clients.sql), so
 * this button flips the role directly; once real billing exists this is
 * the one place that changes, nothing downstream of the role column does.
 */
export function UpgradePrompt({ userId }: { userId: string }) {
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
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <Sparkles className="size-8 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Coaching is a paid feature</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Building your own programs is free, always. Coaching — inviting clients and
            building programs for them — is the paid tier.
          </p>

          {error && (
            <div className="flex w-full gap-3 rounded-lg border border-danger/30 bg-danger/10 p-3 text-left">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
              <p className="text-sm text-foreground">{error}</p>
            </div>
          )}

          <Button onClick={handleUpgrade} disabled={submitting} size="lg">
            {submitting ? "Upgrading…" : "Upgrade to Coach"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
