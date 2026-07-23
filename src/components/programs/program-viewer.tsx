"use client";

import { useState } from "react";
import { PersonStanding, Repeat, UserRound } from "lucide-react";
import type { BlockRow, ProgramDiscipline, ProgramTree, SetRow } from "@/lib/programs/types";
import { cn } from "@/lib/utils";

const DISCIPLINE_LABEL: Record<ProgramDiscipline, string> = {
  resistance: "Weights",
  running: "Running",
  hybrid: "Hybrid",
};

function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds == null) return "";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function describeSet(set: SetRow, isRun: boolean): string {
  if (isRun) {
    const distance = set.distance_meters != null ? `${set.distance_meters / 1000}km` : null;
    const duration = set.duration_seconds != null ? formatDuration(set.duration_seconds) : null;
    return [distance, duration].filter(Boolean).join(" in ") || "—";
  }

  const parts = [`${set.sets} × ${set.reps || "?"}`];
  if (set.load_value != null) {
    const unit = set.load_type === "percent_1rm" ? "%" : set.load_type === "weight" ? "kg" : "";
    parts.push(`@ ${set.load_value}${unit}`);
  } else if (set.load_type !== "weight") {
    parts.push(`(${set.load_type.replace("_", " ")})`);
  }
  if (set.rest_seconds != null) parts.push(`rest ${set.rest_seconds}s`);
  return parts.join(" ");
}

/**
 * Read-only rendering of a program tree for someone who's the athlete but
 * not the owner — a coach-assigned program. Deliberately a separate
 * component from ProgramBuilder rather than a `readOnly` prop threaded
 * through DayColumn/ExerciseBlockCard/SetRowEditor/RunSetRowEditor: those
 * are all built around live onChange handlers wired to mutations, and
 * disabled-looking input boxes are worse UX here than plain formatted
 * text. RLS already prevents any write from this page regardless — this
 * component just doesn't render the affordances to try.
 */
export function ProgramViewer({ program, assignedByEmail }: { program: ProgramTree; assignedByEmail: string | null }) {
  const [selectedWeekId, setSelectedWeekId] = useState(program.weeks[0]?.id ?? "");
  const week = program.weeks.find((w) => w.id === selectedWeekId) ?? program.weeks[0];

  return (
    <div className="mx-auto flex max-w-[100rem] flex-col gap-6 px-4 py-8 sm:px-6 lg:py-12">
      <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
        <UserRound className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-sm text-foreground">
          Assigned by {assignedByEmail ?? "your coach"} — view only.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-1 flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{program.name}</h1>
          <span className="w-fit rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {DISCIPLINE_LABEL[program.discipline]}
          </span>
        </div>
      </div>

      {week && (
        <>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {program.weeks.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setSelectedWeekId(w.id)}
                className={cn(
                  "shrink-0 rounded-lg border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  w.id === week.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground"
                )}
              >
                {w.label || `Week ${w.position}`}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:flex-nowrap lg:items-start lg:overflow-x-auto lg:pb-2">
            {week.days.map((day) => (
              <div
                key={day.id}
                className="flex w-full shrink-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-4 lg:w-96"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground">{day.label || `Day ${day.position}`}</h2>
                  {day.is_rest_day && <span className="text-xs text-muted-foreground">Rest day</span>}
                </div>

                {!day.is_rest_day && (
                  <div className="flex flex-col gap-2">
                    {day.blocks.length === 0 && (
                      <p className="text-sm text-muted-foreground">No exercises yet.</p>
                    )}
                    {day.blocks.map((block: BlockRow) => {
                      const isGrouped = block.exercises.length > 1;
                      return (
                        <div key={block.id} className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
                          {isGrouped && (
                            <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                              <Repeat className="size-3.5" />
                              Superset · {block.rounds} rounds
                            </div>
                          )}
                          {block.exercises.map((exercise) => {
                            const isRun = exercise.activity_type === "run";
                            return (
                              <div
                                key={exercise.id}
                                className={isGrouped ? "flex flex-col gap-1 border-l-2 border-primary/30 pl-2.5" : "flex flex-col gap-1"}
                              >
                                <div className="flex items-center gap-1.5">
                                  {isRun && <PersonStanding className="size-3.5 shrink-0 text-muted-foreground" />}
                                  <span className="text-sm font-medium text-foreground">
                                    {exercise.custom_name || exercise.exercise_id}
                                  </span>
                                </div>
                                <ul className="flex flex-col gap-0.5">
                                  {exercise.sets.map((set) => (
                                    <li key={set.id} className="text-xs text-muted-foreground">
                                      {describeSet(set, isRun)}
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
            ))}
          </div>
        </>
      )}
    </div>
  );
}
