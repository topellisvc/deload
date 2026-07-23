"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ActivityType, BlockRow, DayRow, ProgramDiscipline, ProgramTree, SetRow, WeekRow } from "@/lib/programs/types";
import * as m from "@/lib/programs/mutations";
import { DayColumn } from "@/components/programs/day-column";
import { AddWeekDialog } from "@/components/programs/add-week-dialog";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";

const DISCIPLINE_OPTIONS: { value: ProgramDiscipline; label: string }[] = [
  { value: "resistance", label: "Weights" },
  { value: "running", label: "Running" },
  { value: "hybrid", label: "Hybrid" },
];

interface ProgramBuilderProps {
  initialProgram: ProgramTree;
}

/**
 * Owns the whole program tree as local state and applies every edit
 * optimistically: the UI updates immediately, and the matching Supabase
 * write fires in the background. If a write fails, we surface a banner
 * rather than silently losing the edit or blocking the UI on every
 * keystroke — full rollback isn't implemented for v1, since with RLS
 * already enforcing access and the network being the main realistic
 * failure mode, a visible retry-or-refresh prompt is enough for now.
 */
export function ProgramBuilder({ initialProgram }: ProgramBuilderProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [program, setProgram] = useState(initialProgram);
  const [selectedWeekId, setSelectedWeekId] = useState(initialProgram.weeks[0]?.id ?? "");
  const [addWeekOpen, setAddWeekOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState(initialProgram.name);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => setNameDraft(program.name), [program.name]);

  // Every program is created with a first week and never allowed to drop
  // below one (handleDeleteWeek blocks removing the last week), so this is
  // safe. Asserted non-null rather than narrowed by an `if` guard because
  // the handlers below are hoisted function declarations — control-flow
  // narrowing from a guard here wouldn't carry into their bodies, but the
  // variable's actual type does.
  const week = (program.weeks.find((w) => w.id === selectedWeekId) ?? program.weeks[0])!;

  function fail(message: string) {
    setSaveError(message);
  }

  // ---- immutable tree-update helpers ----
  function updateWeek(weekId: string, updater: (w: WeekRow) => WeekRow) {
    setProgram((p) => ({ ...p, weeks: p.weeks.map((w) => (w.id === weekId ? updater(w) : w)) }));
  }
  function updateDay(weekId: string, dayId: string, updater: (d: DayRow) => DayRow) {
    updateWeek(weekId, (w) => ({ ...w, days: w.days.map((d) => (d.id === dayId ? updater(d) : d)) }));
  }
  function updateBlock(weekId: string, dayId: string, blockId: string, updater: (b: BlockRow) => BlockRow) {
    updateDay(weekId, dayId, (d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === blockId ? updater(b) : b)) }));
  }

  // ---- program-level ----
  async function commitName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === program.name) {
      setNameDraft(program.name);
      return;
    }
    setProgram((p) => ({ ...p, name: trimmed }));
    const { error } = await m.updateProgram(supabase, program.id, { name: trimmed });
    if (error) fail(error);
  }

  async function handleDisciplineChange(discipline: ProgramDiscipline) {
    setProgram((p) => ({ ...p, discipline }));
    const { error } = await m.updateProgram(supabase, program.id, { discipline });
    if (error) fail(error);
  }

  async function handleDeleteProgram() {
    if (!window.confirm(`Delete "${program.name}"? This can't be undone.`)) return;
    setDeleting(true);
    const { error } = await m.deleteProgram(supabase, program.id);
    if (error) {
      setDeleting(false);
      fail(error);
      return;
    }
    router.push("/programs");
  }

  // ---- weeks ----
  async function handleAddWeek(params: { sourceWeek?: WeekRow; progressionPercent?: number }): Promise<string | null> {
    const lastWeek = program.weeks[program.weeks.length - 1];
    if (!lastWeek) return "This program has no weeks yet.";
    const dayTemplate = lastWeek.days.map((d) => ({ label: d.label, is_rest_day: d.is_rest_day }));
    const { week: newWeek, error } = await m.addWeek(supabase, {
      programId: program.id,
      position: program.weeks.length + 1,
      dayTemplate,
      sourceWeek: params.sourceWeek,
      progressionPercent: params.progressionPercent,
    });
    if (error || !newWeek) return error ?? "Something went wrong adding the week.";
    setProgram((p) => ({ ...p, weeks: [...p.weeks, newWeek] }));
    setSelectedWeekId(newWeek.id);
    return null;
  }

  async function handleDeleteWeek(weekId: string) {
    if (program.weeks.length <= 1) return;
    const target = program.weeks.find((w) => w.id === weekId);
    if (!target) return;
    if (!window.confirm(`Delete ${target.label || `Week ${target.position}`}? This can't be undone.`)) return;

    const remaining = program.weeks.filter((w) => w.id !== weekId);
    setProgram((p) => ({ ...p, weeks: remaining }));
    if (selectedWeekId === weekId) setSelectedWeekId(remaining[0]?.id ?? "");
    const { error } = await m.deleteWeek(supabase, weekId);
    if (error) fail(error);
  }

  // ---- days ----
  function handleUpdateDay(dayId: string, patch: { label?: string | null; is_rest_day?: boolean }) {
    updateDay(week.id, dayId, (d) => ({ ...d, ...patch }));
    m.updateDay(supabase, dayId, patch).then(({ error }) => {
      if (error) fail(error);
    });
  }

  async function handleCopyDayTo(sourceDay: DayRow, targetDayId: string) {
    const targetDay = week.days.find((d) => d.id === targetDayId);
    if (!targetDay) return;
    const targetStartPosition = targetDay.blocks.length + 1;
    const { blocks, error } = await m.copyDayContents(supabase, {
      sourceDay,
      targetDayId,
      targetStartPosition,
    });
    if (error) {
      fail(error);
      return;
    }
    updateDay(week.id, targetDayId, (d) => ({ ...d, blocks: [...d.blocks, ...blocks] }));
  }

  // ---- blocks ----
  async function handleAddBlock(dayId: string) {
    const day = week.days.find((d) => d.id === dayId);
    if (!day) return;
    const { block, error } = await m.addExerciseBlock(supabase, { dayId, position: day.blocks.length + 1 });
    if (error || !block) {
      fail(error ?? "Couldn't add exercise.");
      return;
    }
    updateDay(week.id, dayId, (d) => ({ ...d, blocks: [...d.blocks, block] }));
  }

  function handleDeleteBlock(dayId: string, blockId: string) {
    updateDay(week.id, dayId, (d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== blockId) }));
    m.deleteBlock(supabase, blockId).then(({ error }) => {
      if (error) fail(error);
    });
  }

  function handleMoveBlock(dayId: string, blockId: string, direction: "up" | "down") {
    const day = week.days.find((d) => d.id === dayId);
    if (!day) return;
    const index = day.blocks.findIndex((b) => b.id === blockId);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= day.blocks.length) return;

    const a = day.blocks[index];
    const b = day.blocks[swapIndex];
    if (!a || !b) return;
    const reordered = [...day.blocks];
    reordered[index] = { ...b, position: a.position };
    reordered[swapIndex] = { ...a, position: b.position };
    reordered.sort((x, y) => x.position - y.position);
    updateDay(week.id, dayId, (d) => ({ ...d, blocks: reordered }));

    m.swapBlockPositions(supabase, { id: a.id, position: a.position }, { id: b.id, position: b.position }).then(
      ({ error }) => {
        if (error) fail(error);
      }
    );
  }

  // ---- superset/circuit grouping ----
  async function handleAddExerciseToBlock(dayId: string, blockId: string) {
    const day = week.days.find((d) => d.id === dayId);
    const block = day?.blocks.find((b) => b.id === blockId);
    if (!block) return;
    const { exercise, error } = await m.addExerciseToBlock(supabase, {
      blockId,
      position: block.exercises.length + 1,
    });
    if (error || !exercise) {
      fail(error ?? "Couldn't add exercise.");
      return;
    }
    const becomesGrouped = block.exercises.length + 1 === 2;
    updateBlock(week.id, dayId, blockId, (b) => ({
      ...b,
      exercises: [...b.exercises, exercise],
      block_type: becomesGrouped ? "superset" : b.block_type,
    }));
    if (becomesGrouped) {
      m.updateBlockType(supabase, blockId, "superset").then(({ error: e }) => {
        if (e) fail(e);
      });
    }
  }

  async function handleRemoveExerciseFromBlock(dayId: string, blockId: string, blockExerciseId: string) {
    const day = week.days.find((d) => d.id === dayId);
    const block = day?.blocks.find((b) => b.id === blockId);
    // Removing the block's only exercise should delete the whole block
    // instead (via the block's own delete button) — this button is
    // hidden in the UI until there are 2+ exercises, but guard here too.
    if (!block || block.exercises.length <= 1) return;
    const becomesUngrouped = block.exercises.length - 1 === 1;
    updateBlock(week.id, dayId, blockId, (b) => ({
      ...b,
      exercises: b.exercises.filter((ex) => ex.id !== blockExerciseId),
      block_type: becomesUngrouped ? "straight" : b.block_type,
    }));
    m.removeExerciseFromBlock(supabase, blockExerciseId).then(({ error }) => {
      if (error) fail(error);
    });
    if (becomesUngrouped) {
      m.updateBlockType(supabase, blockId, "straight").then(({ error }) => {
        if (error) fail(error);
      });
    }
  }

  function handleRoundsChange(dayId: string, blockId: string, rounds: number) {
    updateBlock(week.id, dayId, blockId, (b) => ({ ...b, rounds }));
    m.updateBlockRounds(supabase, blockId, rounds).then(({ error }) => {
      if (error) fail(error);
    });
  }

  // ---- exercise + sets ----
  function handleExerciseChange(
    dayId: string,
    blockId: string,
    blockExerciseId: string,
    patch: { exercise_id: string | null; custom_name: string | null }
  ) {
    updateBlock(week.id, dayId, blockId, (b) => ({
      ...b,
      exercises: b.exercises.map((ex) => (ex.id === blockExerciseId ? { ...ex, ...patch } : ex)),
    }));
    m.updateBlockExercise(supabase, blockExerciseId, patch).then(({ error }) => {
      if (error) fail(error);
    });
  }

  async function handleAddSet(dayId: string, blockId: string, blockExerciseId: string) {
    const day = week.days.find((d) => d.id === dayId);
    const block = day?.blocks.find((b) => b.id === blockId);
    const exercise = block?.exercises.find((ex) => ex.id === blockExerciseId);
    if (!exercise) return;
    const lastSet = exercise.sets[exercise.sets.length - 1];
    const { set, error } = await m.addSetRow(supabase, {
      blockExerciseId: exercise.id,
      position: exercise.sets.length + 1,
      activityType: exercise.activity_type,
      copyFrom: lastSet,
    });
    if (error || !set) {
      fail(error ?? "Couldn't add set.");
      return;
    }
    updateBlock(week.id, dayId, blockId, (b) => ({
      ...b,
      exercises: b.exercises.map((ex) => (ex.id === blockExerciseId ? { ...ex, sets: [...ex.sets, set] } : ex)),
    }));
  }

  async function handleActivityTypeChange(dayId: string, blockId: string, blockExerciseId: string, activityType: ActivityType) {
    const day = week.days.find((d) => d.id === dayId);
    const exercise = day?.blocks.find((b) => b.id === blockId)?.exercises.find((ex) => ex.id === blockExerciseId);
    if (!exercise || exercise.activity_type === activityType) return;

    // Switching wipes the existing set rows (sets/reps/load and
    // distance/duration aren't convertible), so confirm if there's
    // anything a user would actually lose.
    const hasData = exercise.sets.some((s) =>
      activityType === "run"
        ? s.load_value != null || (s.reps && s.reps.length > 0)
        : s.distance_meters != null || s.duration_seconds != null
    );
    if (hasData && !window.confirm(`Switch to ${activityType === "run" ? "Run" : "Lift"}? This clears the set data already entered for this exercise.`)) {
      return;
    }

    const { set, error } = await m.switchExerciseActivityType(supabase, {
      blockExerciseId: exercise.id,
      activityType,
    });
    if (error || !set) {
      fail(error ?? "Couldn't switch exercise type.");
      return;
    }
    updateBlock(week.id, dayId, blockId, (b) => ({
      ...b,
      exercises: b.exercises.map((ex) =>
        ex.id === blockExerciseId ? { ...ex, activity_type: activityType, sets: [set] } : ex
      ),
    }));
  }

  function handleSetChange(dayId: string, blockId: string, blockExerciseId: string, setId: string, patch: Partial<SetRow>) {
    updateBlock(week.id, dayId, blockId, (b) => ({
      ...b,
      exercises: b.exercises.map((ex) =>
        ex.id === blockExerciseId ? { ...ex, sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) } : ex
      ),
    }));
    m.updateSetRow(supabase, setId, patch).then(({ error }) => {
      if (error) fail(error);
    });
  }

  function handleDeleteSet(dayId: string, blockId: string, blockExerciseId: string, setId: string) {
    updateBlock(week.id, dayId, blockId, (b) => ({
      ...b,
      exercises: b.exercises.map((ex) =>
        ex.id === blockExerciseId ? { ...ex, sets: ex.sets.filter((s) => s.id !== setId) } : ex
      ),
    }));
    m.deleteSetRow(supabase, setId).then(({ error }) => {
      if (error) fail(error);
    });
  }

  return (
    <div className="mx-auto flex max-w-[100rem] flex-col gap-6 px-4 py-8 sm:px-6 lg:py-12">
      {saveError && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="flex-1 text-sm text-foreground">{saveError}</p>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            aria-label="Dismiss"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-1 flex-col gap-2">
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            aria-label="Program name"
            className="w-full rounded-md border border-transparent bg-transparent text-2xl font-semibold tracking-tight text-foreground transition-colors hover:border-border focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary sm:text-3xl"
          />
          <SegmentedControl
            aria-label="Discipline"
            options={DISCIPLINE_OPTIONS}
            value={program.discipline}
            onChange={handleDisciplineChange}
            className="w-fit"
          />
        </div>
        <div className="flex items-center gap-2 self-start">
          <Link
            href={`/programs/${program.id}`}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Done editing
          </Link>
          <Button variant="outline" size="sm" onClick={handleDeleteProgram} disabled={deleting}>
            <Trash2 className="size-4" />
            Delete program
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {program.weeks.map((w) => (
          <div key={w.id} className="group relative shrink-0">
            <button
              type="button"
              onClick={() => setSelectedWeekId(w.id)}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                w.id === selectedWeekId
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground"
              )}
            >
              {w.label || `Week ${w.position}`}
            </button>
            {program.weeks.length > 1 && (
              <button
                type="button"
                onClick={() => handleDeleteWeek(w.id)}
                aria-label={`Delete ${w.label || `Week ${w.position}`}`}
                className="absolute -right-1.5 -top-1.5 hidden size-4 items-center justify-center rounded-full bg-danger text-white group-hover:flex"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setAddWeekOpen(true)}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-border-strong px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Plus className="size-4" />
          Add week
        </button>
      </div>

      {/*
        On mobile, days stack in one column (default flex-col). On desktop
        they run in a single horizontal row that scrolls sideways instead
        of wrapping to a second line — wrapping pushed later days below
        the fold, which defeats the point of having a whole week visible
        without navigating between days. A few days fit without scrolling;
        a 6-7 day week scrolls sideways, still on one screen.
      */}
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-nowrap lg:items-start lg:overflow-x-auto lg:pb-2">
        {week.days.map((day) => (
          <DayColumn
            key={day.id}
            day={day}
            otherDays={week.days
              .filter((d) => d.id !== day.id)
              .map((d) => ({ id: d.id, label: d.label, position: d.position }))}
            onUpdateDay={(patch) => handleUpdateDay(day.id, patch)}
            onCopyTo={(targetDayId) => handleCopyDayTo(day, targetDayId)}
            onAddBlock={() => handleAddBlock(day.id)}
            onDeleteBlock={(blockId) => handleDeleteBlock(day.id, blockId)}
            onMoveBlock={(blockId, direction) => handleMoveBlock(day.id, blockId, direction)}
            onAddExerciseToBlock={(blockId) => handleAddExerciseToBlock(day.id, blockId)}
            onRemoveExerciseFromBlock={(blockId, blockExerciseId) =>
              handleRemoveExerciseFromBlock(day.id, blockId, blockExerciseId)
            }
            onRoundsChange={(blockId, rounds) => handleRoundsChange(day.id, blockId, rounds)}
            onExerciseChange={(blockId, blockExerciseId, patch) =>
              handleExerciseChange(day.id, blockId, blockExerciseId, patch)
            }
            onActivityTypeChange={(blockId, blockExerciseId, activityType) =>
              handleActivityTypeChange(day.id, blockId, blockExerciseId, activityType)
            }
            onAddSet={(blockId, blockExerciseId) => handleAddSet(day.id, blockId, blockExerciseId)}
            onSetChange={(blockId, blockExerciseId, setId, patch) =>
              handleSetChange(day.id, blockId, blockExerciseId, setId, patch)
            }
            onDeleteSet={(blockId, blockExerciseId, setId) => handleDeleteSet(day.id, blockId, blockExerciseId, setId)}
          />
        ))}
      </div>

      <AddWeekDialog
        open={addWeekOpen}
        onClose={() => setAddWeekOpen(false)}
        weeks={program.weeks}
        onCreate={handleAddWeek}
      />
    </div>
  );
}
