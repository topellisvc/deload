"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock3, Pencil, PersonStanding, Repeat, UserRound } from "lucide-react";
import type { BlockRow, ProgramDiscipline, ProgramTree, SetRow } from "@/lib/programs/types";
import type { SessionLog } from "@/lib/supabase/types";
import { DayLogControl } from "@/components/programs/day-log-control";
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

/** Local calendar date (not UTC) so "today" matches the viewer's own clock. */
function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatLogDate(isoDate: string, today: string): string {
  if (isoDate === today) return "today";
  const [year, month, day] = isoDate.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return isoDate;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * One prescription row, rendered as a scannable strip rather than a single
 * run-on sentence: the sets×reps (or run distance/duration) stands out in
 * bold, load and rest are secondary pills off to the side. Exercises with
 * more than one prescription row (e.g. a working set and a back-off set)
 * end up as a small aligned stack instead of two near-identical sentences.
 */
function SetDetails({ set, isRun }: { set: SetRow; isRun: boolean }) {
  if (isRun) {
    const distance = set.distance_meters != null ? `${set.distance_meters / 1000}km` : null;
    const duration = set.duration_seconds != null ? formatDuration(set.duration_seconds) : null;
    if (!distance && !duration) {
      return <span className="text-muted-foreground">—</span>;
    }
    return (
      <span className="flex items-baseline gap-1.5">
        {distance && <span className="text-sm font-semibold tabular-nums text-foreground">{distance}</span>}
        {distance && duration && <span className="text-[11px] text-muted-foreground">in</span>}
        {duration && <span className="text-sm font-semibold tabular-nums text-foreground">{duration}</span>}
      </span>
    );
  }

  const loadLabel =
    set.load_value != null
      ? `${set.load_value}${set.load_type === "percent_1rm" ? "%" : set.load_type === "weight" ? "kg" : ""}`
      : set.load_type !== "weight"
        ? set.load_type.replace("_", " ")
        : null;

  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-sm font-semibold tabular-nums text-foreground">
        {set.sets} <span className="text-muted-foreground/70">×</span> {set.reps || "?"}
      </span>
      {loadLabel && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-foreground/80">
          {loadLabel}
        </span>
      )}
      {set.rest_seconds != null && (
        <span className="flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
          <Clock3 className="size-3" />
          {set.rest_seconds}s
        </span>
      )}
    </span>
  );
}

/**
 * Universal read-only rendering of a program tree — the default landing
 * view for everyone with access, regardless of whether they're the owner,
 * the athlete, or both. Structural editing (exercises, sets, program
 * metadata) lives at /programs/[id]/edit, owner-only; this component never
 * renders those affordances. Deliberately a separate component from
 * ProgramBuilder rather than a `readOnly` prop threaded through
 * DayColumn/ExerciseBlockCard/SetRowEditor/RunSetRowEditor: those are all
 * built around live onChange handlers wired to mutations, and
 * disabled-looking input boxes are worse UX here than plain formatted
 * text. RLS already prevents any write from this page regardless — this
 * component just doesn't render the affordances to try.
 */
interface ProgramViewerProps {
  program: ProgramTree;
  /** Only set (and only shown) when the viewer is the athlete on a
   * coach-assigned program, i.e. !isOwner. */
  assignedByEmail: string | null;
  currentUserId: string;
  logsByDay: Record<string, SessionLog[]>;
}

export function ProgramViewer({ program, assignedByEmail, currentUserId, logsByDay }: ProgramViewerProps) {
  const [selectedWeekId, setSelectedWeekId] = useState(program.weeks[0]?.id ?? "");
  const week = program.weeks.find((w) => w.id === selectedWeekId) ?? program.weeks[0];
  const today = todayDateString();

  const isOwner = program.owner_id === currentUserId;
  const isAthlete = program.athlete_id === currentUserId;

  return (
    <div className="mx-auto flex max-w-[100rem] flex-col gap-6 px-4 py-8 sm:px-6 lg:py-12">
      {!isOwner && (
        <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <UserRound className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-sm text-foreground">
            Assigned by {assignedByEmail ?? "your coach"} — view only.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-1 flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{program.name}</h1>
          <span className="w-fit rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {DISCIPLINE_LABEL[program.discipline]}
          </span>
        </div>
        {isOwner && (
          <Link
            href={`/programs/${program.id}/edit`}
            className="flex items-center gap-1.5 self-start rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Pencil className="size-3.5" />
            Edit program
          </Link>
        )}
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
                        <div key={block.id} className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3.5">
                          {isGrouped && (
                            <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                              <Repeat className="size-3.5" />
                              Superset · {block.rounds} rounds
                            </div>
                          )}
                          {block.exercises.map((exercise, i) => {
                            const isRun = exercise.activity_type === "run";
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
                                  {isRun && <PersonStanding className="size-3.5 shrink-0 text-muted-foreground" />}
                                  <span className="text-sm font-medium text-foreground">
                                    {exercise.custom_name || exercise.exercise_id}
                                  </span>
                                </div>
                                <ul className="flex flex-col gap-1 pl-0.5">
                                  {exercise.sets.map((set) => (
                                    <li key={set.id}>
                                      <SetDetails set={set} isRun={isRun} />
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

                {!day.is_rest_day && isAthlete && (
                  <DayLogControl trainingDayId={day.id} athleteId={currentUserId} logs={logsByDay[day.id] ?? []} />
                )}

                {!day.is_rest_day && !isAthlete && isOwner && (() => {
                  const dayLogs = logsByDay[day.id] ?? [];
                  if (dayLogs.length === 0) return null;
                  return (
                    <p className="border-t border-border pt-2.5 text-xs font-medium text-muted-foreground">
                      Logged {dayLogs.length}× · last {formatLogDate(dayLogs[0]!.performed_on, today)}
                    </p>
                  );
                })()}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
