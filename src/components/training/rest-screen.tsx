"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SetDetails } from "@/components/programs/set-details";
import type { ExerciseCategory, SetPrescription } from "@/lib/programs/types";

interface RestScreenProps {
  initialSeconds: number;
  nextSetLabel: string | null;
  nextTarget: SetPrescription | null;
  /** Set only when the upcoming turn belongs to a different exercise than
   * the one just finished (a superset/circuit partner) — surfaced so the
   * athlete knows to switch exercises, not just which set is next. Null
   * for the common case of resting between two sets of the same exercise. */
  nextExerciseName: string | null;
  category: ExerciseCategory;
  onSkip: () => void;
  onContinue: () => void;
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Automatic countdown between sets. Reaching 0:00 doesn't force a
 * navigation anywhere — "the athlete can continue whenever they are ready"
 * (spec) — it just stops counting and waits for Continue.
 */
export function RestScreen({ initialSeconds, nextSetLabel, nextTarget, nextExerciseName, category, onSkip, onContinue }: RestScreenProps) {
  const [remaining, setRemaining] = useState(initialSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // Only ever runs once per rest period — this component is remounted
    // (via `key`) for each new rest, so a fresh interval each time is correct.
  }, []);

  const done = remaining <= 0;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {done ? "Rest complete" : "Rest Remaining"}
        </span>
        <span className="text-7xl font-bold tabular-nums text-foreground">{formatClock(remaining)}</span>
      </div>

      {nextTarget && (
        <div className="flex flex-col items-center gap-1.5 rounded-xl bg-muted/50 px-5 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Next Set{nextExerciseName ? ` · ${nextExerciseName}` : ""}
          </span>
          <SetDetails set={nextTarget} category={category} />
        </div>
      )}
      {!nextTarget && nextSetLabel && <p className="text-sm text-muted-foreground">{nextSetLabel}</p>}

      <div className="flex w-full flex-col gap-2.5">
        <Button size="lg" onClick={onContinue} className="h-14 text-base">
          Continue
        </Button>
        <div className="flex gap-2.5">
          <Button variant="outline" size="lg" className="flex-1" onClick={() => setRemaining((r) => r + 30)}>
            +30 Seconds
          </Button>
          <Button variant="ghost" size="lg" className="flex-1" onClick={onSkip}>
            Skip Rest
          </Button>
        </div>
      </div>
    </div>
  );
}
