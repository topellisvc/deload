"use client";

import { useEffect, useRef, useState } from "react";
import { ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SetDetails } from "@/components/programs/set-details";
import type { ExerciseCategory, SetPrescription } from "@/lib/programs/types";

interface RestScreenProps {
  initialSeconds: number;
  /** Rest now only ever happens between two sets of the SAME exercise —
   * free exercise navigation means the athlete decides when to switch,
   * rather than a superset partner forcing an exercise change mid-rest
   * (see sequence.ts's buildExerciseList doc comment) — so this is always
   * that exercise's next set target, never a different exercise's. */
  nextTarget: SetPrescription;
  category: ExerciseCategory;
  onOpenExerciseList: () => void;
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
 *
 * Anchored to a real wall-clock end time rather than counting down "one
 * tick = one second" — browsers throttle or fully suspend setInterval in a
 * backgrounded/inactive tab (mobile Safari does this aggressively), which
 * made the old tick-based version appear to freeze whenever someone
 * switched apps or locked their phone mid-rest, only catching back up once
 * they returned. Deriving `remaining` from `endAt - Date.now()` on every
 * tick means it's always correct regardless of how long the tab was
 * throttled, and the visibilitychange listener forces an immediate
 * recompute the moment the tab becomes visible again rather than waiting up
 * to a second for the next tick.
 */
export function RestScreen({ initialSeconds, nextTarget, category, onOpenExerciseList, onSkip, onContinue }: RestScreenProps) {
  const endAtRef = useRef(Date.now() + initialSeconds * 1000);
  const [remaining, setRemaining] = useState(initialSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function recompute() {
    setRemaining(Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000)));
  }

  useEffect(() => {
    intervalRef.current = setInterval(recompute, 1000);
    document.addEventListener("visibilitychange", recompute);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", recompute);
    };
    // Only ever runs once per rest period — this component is remounted
    // (via `key`) for each new rest, so a fresh interval each time is correct.
  }, []);

  const done = remaining <= 0;

  return (
    <div className="relative mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      <Button
        variant="secondary"
        size="sm"
        onClick={onOpenExerciseList}
        className="absolute right-6 top-6"
      >
        <ListOrdered className="size-3.5" />
        All Exercises
      </Button>

      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {done ? "Rest complete" : "Rest Remaining"}
        </span>
        <span className="text-7xl font-bold tabular-nums text-foreground">{formatClock(remaining)}</span>
      </div>

      <div className="flex flex-col items-center gap-1.5 rounded-xl bg-muted/50 px-5 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Next Set</span>
        <SetDetails set={nextTarget} category={category} />
      </div>

      <div className="flex w-full flex-col gap-2.5">
        <Button size="lg" onClick={onContinue} className="h-14 text-base">
          Continue
        </Button>
        <div className="flex gap-2.5">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => {
              endAtRef.current += 30_000;
              recompute();
            }}
          >
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
