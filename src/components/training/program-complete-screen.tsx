"use client";

import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProgramCompleteScreenProps {
  programName: string;
  onDone: () => void;
}

/**
 * Shown instead of navigating straight back to the dashboard when Finish
 * Workout was also the last non-rest day left in the program (see
 * isProgramComplete in lib/training/queries.ts) — a distinct moment from
 * the regular per-workout WorkoutSummaryScreen this follows, since
 * "you finished today's session" and "you finished the whole program" are
 * different things worth celebrating differently. onDone is the only way
 * off this screen (no back navigation) — it's what actually does the
 * dashboard refresh + redirect, so the dashboard's own Program Complete
 * hero (see hero-section.tsx) is guaranteed to see fresh data.
 */
export function ProgramCompleteScreen({ programName, onDone }: ProgramCompleteScreenProps) {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-lg flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <Trophy className="size-16 text-primary" />
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Program Complete!</h1>
        <p className="text-sm text-muted-foreground">
          You&apos;ve finished every workout in <span className="font-medium text-foreground">{programName}</span>. Nice work.
        </p>
      </div>
      <Button size="lg" onClick={onDone} className="mt-4 h-14 w-full max-w-xs text-base">
        Ready for what&apos;s next
      </Button>
    </div>
  );
}
