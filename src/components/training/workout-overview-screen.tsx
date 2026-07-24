import Link from "next/link";
import { CalendarClock, Clock3, Dumbbell, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getExerciseDisplayName } from "@/lib/programs/exercise-catalog";
import { formatEstimatedDuration } from "@/lib/training/estimate-duration";
import type { BlockRow } from "@/lib/programs/types";

interface WorkoutOverviewScreenProps {
  programId: string;
  programName: string;
  weekLabel: string;
  weekPosition: number;
  totalWeeks: number;
  dayLabel: string;
  coachEmail: string | null;
  exerciseCount: number;
  estimatedSeconds: number;
  blocks: BlockRow[];
  onBegin: () => void;
  starting: boolean;
}

/**
 * "Before beginning, show a workout overview" — everything the spec lists,
 * plus any per-exercise coach notes (block_exercises.notes) rolled up into
 * one "Coach Notes" section, since there's no separate day-level notes field
 * in the schema and these are exactly the guidance a coach would want an
 * athlete to see before they start, not just mid-set.
 */
export function WorkoutOverviewScreen({
  programId,
  programName,
  weekLabel,
  weekPosition,
  totalWeeks,
  dayLabel,
  coachEmail,
  exerciseCount,
  estimatedSeconds,
  blocks,
  onBegin,
  starting,
}: WorkoutOverviewScreenProps) {
  const coachNotes = blocks
    .flatMap((b) => b.exercises)
    .filter((e) => e.notes)
    .map((e) => ({ id: e.id, name: getExerciseDisplayName(e), note: e.notes as string }));

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col gap-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {programName} · {weekLabel}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{dayLabel}</h1>
        {coachEmail && (
          <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <UserRound className="size-4" />
            Assigned by {coachEmail}
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-col items-center gap-1">
          <Dumbbell className="size-5 text-primary" />
          <span className="text-lg font-semibold tabular-nums text-foreground">{exerciseCount}</span>
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{exerciseCount === 1 ? "Exercise" : "Exercises"}</span>
        </div>
        <div className="h-10 w-px bg-border" />
        <div className="flex flex-col items-center gap-1">
          <Clock3 className="size-5 text-primary" />
          <span className="text-lg font-semibold tabular-nums text-foreground">{formatEstimatedDuration(estimatedSeconds)}</span>
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Estimated</span>
        </div>
        <div className="h-10 w-px bg-border" />
        <div className="flex flex-col items-center gap-1">
          <CalendarClock className="size-5 text-primary" />
          <span className="text-lg font-semibold tabular-nums text-foreground">
            {weekPosition}/{totalWeeks}
          </span>
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Week</span>
        </div>
      </div>

      {coachNotes.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">Coach Notes</span>
          <ul className="flex flex-col gap-1.5">
            {coachNotes.map((n) => (
              <li key={n.id} className="text-sm text-foreground">
                <span className="font-medium">{n.name}:</span> <span className="italic text-foreground/90">{n.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <Button size="lg" onClick={onBegin} disabled={starting} className="h-14 text-base">
          {starting ? "Starting…" : "Begin Workout"}
        </Button>
        <Link href={`/programs/${programId}`}>
          <Button variant="ghost" size="lg" className="w-full">
            Cancel
          </Button>
        </Link>
      </div>
    </div>
  );
}
