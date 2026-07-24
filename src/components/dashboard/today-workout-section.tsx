import Link from "next/link";
import { CalendarX2, ClipboardCheck, Dumbbell, Moon, PersonStanding, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SetDetails } from "@/components/programs/set-details";
import { getExerciseDisplayName } from "@/lib/programs/exercise-catalog";
import { formatLogTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ActiveProgramContext } from "@/lib/dashboard/types";

/**
 * The full exercise list for today, not just the Hero's teaser — reuses
 * the same SetDetails formatting ProgramViewer uses so a set row reads
 * identically everywhere in the app. "Open workout" launches Training Mode
 * (the guided execution flow); "View workout" (once today's already logged)
 * still goes to the program page — there's nothing left to execute, just
 * the plan/history to look back at.
 */
export function TodayWorkoutSection({ context }: { context: ActiveProgramContext | null }) {
  if (!context || !context.today) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">Today&apos;s workout</h2>
        <div className="flex items-center gap-2 py-6 text-muted-foreground">
          <CalendarX2 className="size-5" />
          <p className="text-sm">Set an active program to see today&apos;s workout here.</p>
        </div>
      </div>
    );
  }

  const { program, today } = context;

  const sectionTitle = today.isRealToday ? "Today's workout" : today.weekLabel;

  if (today.day.is_rest_day) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">{sectionTitle}</h2>
        <div className="flex items-center gap-2 py-6">
          <Moon className="size-5 text-muted-foreground" />
          <p className="text-sm text-foreground">Rest day — nothing scheduled.</p>
        </div>
      </div>
    );
  }

  const exerciseCount = today.day.blocks.reduce((n, b) => n + b.exercises.length, 0);
  const openLabel = today.completedToday ? "View workout" : today.hasDraft ? "Continue training" : "Open workout";

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{sectionTitle}</h2>
          <p className="mt-1 text-lg font-semibold text-foreground">{today.day.label || `Day ${today.day.position}`}</p>
        </div>
        <Link href={today.completedToday ? `/programs/${program.id}` : `/train/${today.day.id}`}>
          <Button variant={today.completedToday ? "outline" : "primary"} size="sm">
            {openLabel}
          </Button>
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Dumbbell className="size-3.5" />
          {exerciseCount} {exerciseCount === 1 ? "exercise" : "exercises"}
        </span>
        {today.completedToday && (
          <span className="flex items-center gap-1.5 text-primary">
            <ClipboardCheck className="size-3.5" />
            Completed{today.completedAt ? ` ${formatLogTime(today.completedAt)}` : ""}
          </span>
        )}
      </div>

      {today.day.blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No exercises added to this day yet.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {today.day.blocks.map((block) => {
            const isGrouped = block.exercises.length > 1;
            return (
              <div key={block.id} className="flex flex-col gap-2.5 rounded-lg border border-border bg-background p-3.5">
                {isGrouped && (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                    <Repeat className="size-3.5" />
                    Superset · {block.rounds} rounds
                  </div>
                )}
                {block.exercises.map((exercise, i) => {
                  const category = exercise.exercise_category;
                  return (
                    <div
                      key={exercise.id}
                      className={cn(
                        "flex flex-col gap-1.5",
                        isGrouped && "border-l-2 border-primary/30 pl-2.5",
                        isGrouped && i > 0 && "border-t border-border/70 pt-2.5"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        {category !== "strength" && <PersonStanding className="size-3.5 shrink-0 text-muted-foreground" />}
                        <span className="text-sm font-medium text-foreground">
                          {getExerciseDisplayName(exercise)}
                        </span>
                      </div>
                      <ul className="flex flex-col gap-1 pl-0.5">
                        {exercise.sets.map((set) => (
                          <li key={set.id}>
                            <SetDetails set={set} category={category} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
