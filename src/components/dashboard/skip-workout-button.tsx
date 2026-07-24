"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { createSessionLog } from "@/lib/logging/mutations";
import { todayDateString } from "@/lib/dates";

interface SkipWorkoutButtonProps {
  trainingDayId: string;
  athleteId: string;
}

/**
 * A quick way off today's workout without opening Training Mode at all —
 * records a skip (see migration 0015) and refreshes, which moves the
 * dashboard's "today" pointer straight to the next day (getActiveProgramContext
 * never treats a skip as "stay put, completed today").
 */
export function SkipWorkoutButton({ trainingDayId, athleteId }: SkipWorkoutButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSkip() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: skipError } = await createSessionLog(supabase, {
      trainingDayId,
      athleteId,
      performedOn: todayDateString(),
      skipped: true,
    });
    setBusy(false);
    if (skipError) {
      setError(skipError);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <Button variant="ghost" disabled={busy} onClick={handleSkip} className="w-fit">
        <SkipForward className="size-4" />
        {busy ? "Skipping…" : "Skip"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
