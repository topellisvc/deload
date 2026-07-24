"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronDown, Pencil, PersonStanding, PlayCircle, Repeat, Send, SkipForward, UserRound } from "lucide-react";
import type { BlockRow, ProgramDiscipline, ProgramTree } from "@/lib/programs/types";
import type { CoachClient, LoggedSet, PersonalRecord, SessionLog } from "@/lib/supabase/types";
import { DayLogControl } from "@/components/programs/day-log-control";
import { getExerciseDisplayName } from "@/lib/programs/exercise-catalog";
import { SetDetails } from "@/components/programs/set-details";
import { SessionPerformanceEditor } from "@/components/programs/session-performance-editor";
import { SendProgramDialog } from "@/components/programs/send-program-dialog";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { setActiveProgram } from "@/lib/programs/mutations";
import { formatLogDate as formatLogDateShared, todayDateString } from "@/lib/dates";
import { cn } from "@/lib/utils";

const DISCIPLINE_LABEL: Record<ProgramDiscipline, string> = {
  resistance: "Weights",
  running: "Running",
  hybrid: "Hybrid",
};

// This page's inline copy always used a lowercase "today" (mid-sentence
// usage, e.g. "last today"), unlike DayLogControl's capitalized "Today" —
// preserved via the shared helper's `capitalize: false` option.
function formatLogDate(isoDate: string, today: string): string {
  return formatLogDateShared(isoDate, today, { capitalize: false });
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
  /** Keyed by `${session_log_id}:${block_exercise_id}` — see
   * groupLoggedSetsByExercise in lib/logging/queries.ts. Threaded down to
   * DayLogControl -> SessionPerformanceEditor for the Performance section
   * of each logged session. */
  loggedSetsByExercise: Record<string, LoggedSet[]>;
  /** The athlete's current 1RMs — passed down to DayLogControl so a
   * percent_1rm set can prefill a suggested working weight when logged. */
  personalRecords: PersonalRecord[];
  /** For the "Send a copy" dialog's client picker — owner-only feature, so
   * this is only ever non-empty when isOwner. */
  activeClients: CoachClient[];
}

export function ProgramViewer({
  program,
  assignedByEmail,
  currentUserId,
  logsByDay,
  loggedSetsByExercise,
  personalRecords,
  activeClients,
}: ProgramViewerProps) {
  const router = useRouter();
  const [selectedWeekId, setSelectedWeekId] = useState(program.weeks[0]?.id ?? "");
  const week = program.weeks.find((w) => w.id === selectedWeekId) ?? program.weeks[0];
  const today = todayDateString();

  const isOwner = program.owner_id === currentUserId;
  const isAthlete = program.athlete_id === currentUserId;

  const [isActive, setIsActive] = useState(program.is_active);
  const [settingActive, setSettingActive] = useState(false);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  // Coach Review: which logged session (by session_log.id) has its
  // Planned-vs-Performed detail expanded. One id across the whole page is
  // enough — session_log ids are globally unique, so this doubles as a
  // simple accordion without needing per-day state.
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  async function handleSetActive() {
    setSettingActive(true);
    setActiveError(null);
    const supabase = createClient();
    const { error } = await setActiveProgram(supabase, program.id);
    setSettingActive(false);
    if (error) {
      setActiveError(error);
      return;
    }
    setIsActive(true);
    // The previously-active program's own page (and the dashboard/programs
    // list) are separate routes that Next.js may have already prefetched
    // and cached before this mutation ran — this call bypasses Server
    // Actions entirely (a direct Supabase RPC), so nothing else tells the
    // router those cached payloads are now stale. router.refresh() clears
    // that cache and forces a fresh server fetch, so the switch shows up
    // everywhere without a manual hard reload.
    router.refresh();
  }

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
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-fit rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {DISCIPLINE_LABEL[program.discipline]}
            </span>
            {isActive && (
              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                <CheckCircle2 className="size-3.5" />
                Active program
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          {isOwner && !isActive && (
            <Button variant="outline" size="sm" disabled={settingActive} onClick={handleSetActive}>
              {settingActive ? "Setting active…" : "Set as active"}
            </Button>
          )}
          {isOwner && (
            <Button variant="outline" size="sm" onClick={() => setSendDialogOpen(true)}>
              <Send className="size-3.5" />
              Send a copy
            </Button>
          )}
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
      </div>

      {activeError && (
        <div className="flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-sm text-foreground">{activeError}</p>
        </div>
      )}

      {isOwner && (
        <SendProgramDialog
          open={sendDialogOpen}
          onClose={() => setSendDialogOpen(false)}
          program={program}
          currentUserId={currentUserId}
          activeClients={activeClients}
        />
      )}

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

                {!day.is_rest_day && isAthlete && day.blocks.length > 0 && (
                  <Link href={`/train/${day.id}`}>
                    <Button size="sm" className="w-full">
                      <PlayCircle className="size-3.5" />
                      Start Workout
                    </Button>
                  </Link>
                )}

                {!day.is_rest_day && isAthlete && (
                  <DayLogControl
                    trainingDayId={day.id}
                    athleteId={currentUserId}
                    logs={logsByDay[day.id] ?? []}
                    blocks={day.blocks}
                    loggedSetsByExercise={loggedSetsByExercise}
                    personalRecords={personalRecords}
                  />
                )}

                {!day.is_rest_day && !isAthlete && isOwner && (() => {
                  const dayLogs = logsByDay[day.id] ?? [];
                  if (dayLogs.length === 0) return null;
                  const trainedCount = dayLogs.filter((l) => !l.skipped).length;
                  const skippedCount = dayLogs.length - trainedCount;
                  return (
                    <div className="flex flex-col gap-2 border-t border-border pt-2.5 text-xs">
                      <span className="font-medium text-muted-foreground">
                        Logged {trainedCount}× · last {formatLogDate(dayLogs[0]!.performed_on, today)}
                        {skippedCount > 0 && ` · Skipped ${skippedCount}×`}
                      </span>
                      <ul className="flex flex-col gap-1.5">
                        {dayLogs.map((log) =>
                          log.skipped ? (
                            <li key={log.id} className="flex items-center gap-1.5 font-medium text-muted-foreground">
                              <SkipForward className="size-3.5" />
                              {formatLogDate(log.performed_on, today)} · Skipped
                            </li>
                          ) : (
                            <li key={log.id} className="flex flex-col gap-1.5">
                              <button
                                type="button"
                                onClick={() => setExpandedLogId((v) => (v === log.id ? null : log.id))}
                                className="flex items-center gap-1 self-start font-medium text-foreground/80 transition-colors hover:text-foreground"
                              >
                                {formatLogDate(log.performed_on, today)}
                                <ChevronDown className={cn("size-3.5 transition-transform", expandedLogId === log.id && "rotate-180")} />
                              </button>
                              {expandedLogId === log.id && (
                                // Planned vs Performed, side by side per set — the coach's
                                // review view. Same SessionPerformanceEditor the athlete logs
                                // into, just readOnly, so the two can never render differently.
                                <SessionPerformanceEditor
                                  sessionLogId={log.id}
                                  blocks={day.blocks}
                                  loggedSetsByExercise={loggedSetsByExercise}
                                  personalRecords={personalRecords}
                                  readOnly
                                />
                              )}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
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
