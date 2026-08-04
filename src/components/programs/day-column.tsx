"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent, type SensorDescriptor, type SensorOptions } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { BookMarked, Copy, Files, Flame, Sunrise, Trash2 } from "lucide-react";
import type { BlockRole, BlockRow, BlockType, DayRow, DayTemplateRow, ExerciseCategory, ExerciseTemplateRow, PrescriptionType, SetRow } from "@/lib/programs/types";
import type { ExerciseSearchResult } from "@/lib/programs/exercise-search";
import type { BuilderMode } from "@/lib/programs/use-builder-mode";
import { buildExerciseList } from "@/lib/training/sequence";
import { ExerciseBlockCard } from "@/components/programs/exercise-block-card";
import { WorkoutSummaryBar } from "@/components/programs/workout-summary-bar";
import { AddBlockMenu } from "@/components/programs/add-block-menu";
import { cn } from "@/lib/utils";

interface DayColumnProps {
  day: DayRow;
  otherDays: { id: string; label: string | null; position: number }[];
  mode: Exclude<BuilderMode, "preview">;
  library: ExerciseSearchResult[];
  onCreateCustomExercise: (name: string, category: ExerciseCategory) => void;
  /** DB-backed Exercise Library search/create, threaded down to
   * ExerciseSearchField (see that component's own doc comments) — optional
   * so tests that don't render a real Supabase-backed builder keep working
   * unchanged. */
  librarySearch?: (query: string, category: ExerciseCategory) => Promise<ExerciseSearchResult[]>;
  onCreateInLibrary?: (name: string, category: ExerciseCategory) => Promise<{ id: string; name: string } | null>;
  onUpdateDay: (patch: { label?: string | null; is_rest_day?: boolean }) => void;
  onCopyTo: (targetDayId: string) => void;
  onDuplicateDay: () => void;
  /** Undefined (not just a no-op) when this is the last day left in the
   * week — ProgramBuilder passes undefined rather than a guarded handler
   * so the button itself can just not render, same "hide it, don't
   * disable it" pattern the week-tabs row already uses for "can't delete
   * the last week." */
  onDeleteDay?: () => void;
  onAddBlock: (role: BlockRole, blockType: BlockType) => void;
  onDeleteBlock: (blockId: string) => void;
  onReorderBlocks: (role: BlockRole, orderedBlocks: { id: string; position: number }[]) => void;
  onAddExerciseToBlock: (blockId: string) => void;
  /** Saved exercise templates available to insert with one click, and the
   * saved day templates available to insert this whole day's worth of
   * content — see save-exercise-template-dialog.tsx / ExerciseCard's "Save
   * as template" action and save-day-template-dialog.tsx for how these get
   * created. Both empty for a coach who's never saved one, in which case
   * the corresponding controls don't render at all (progressive
   * disclosure — nothing to pick from yet). */
  exerciseTemplates: ExerciseTemplateRow[];
  dayTemplates: DayTemplateRow[];
  onSaveAsTemplate: (blockId: string, blockExerciseId: string) => void;
  onInsertExerciseTemplate: (role: BlockRole, template: ExerciseTemplateRow) => void;
  onSaveDayAsTemplate: () => void;
  onInsertDayTemplate: (template: DayTemplateRow) => void;
  /** Block id currently awaiting its "add exercise" network round-trip, if
   * any — see ProgramBuilder's addingExerciseBlockId comment for why this
   * needs visible pending state rather than just firing and forgetting. */
  addingExerciseBlockId: string | null;
  onRemoveExerciseFromBlock: (blockId: string, blockExerciseId: string) => void;
  onDuplicateExercise: (blockId: string, blockExerciseId: string) => void;
  onMoveExerciseToDay: (blockId: string, blockExerciseId: string, targetDayId: string) => void;
  /** Block-exercise id currently awaiting its "move to another day" network
   * round-trip, if any — same reasoning as addingExerciseBlockId: the move
   * needs the target day's server-generated copy before local state can
   * update. */
  movingExerciseId: string | null;
  onRoundsChange: (blockId: string, rounds: number) => void;
  onExerciseChange: (blockId: string, blockExerciseId: string, patch: { exercise_id: string | null; custom_name: string | null }) => void;
  onNoteChange: (blockId: string, blockExerciseId: string, notes: string | null) => void;
  onCategoryChange: (blockId: string, blockExerciseId: string, category: ExerciseCategory) => void;
  onTestMaxBeforeChange: (blockId: string, blockExerciseId: string, testMaxBefore: boolean) => void;
  /** Every exercise's latest known max (tested or coach-entered), keyed by
   * exercise_id — see program-builder.tsx's own doc comment on this state
   * for why a shared map (not per-row data) is what makes entering a known
   * max for one appearance of an exercise update every other appearance's
   * display automatically. */
  knownMaxByExerciseId: Map<string, { valueKg: number; performedOn: string }>;
  onSaveKnownMax: (exerciseId: string, valueKg: number) => void;
  onPrescriptionTypeChange: (blockId: string, blockExerciseId: string, prescriptionType: PrescriptionType) => void;
  onAddSet: (blockId: string, blockExerciseId: string) => void;
  onSetChange: (blockId: string, blockExerciseId: string, setId: string, patch: Partial<SetRow>) => void;
  onDeleteSet: (blockId: string, blockExerciseId: string, setId: string) => void;
  onReorderSets: (blockId: string, blockExerciseId: string, orderedSets: { id: string; position: number }[]) => void;
}

/**
 * One day of the week grid. On mobile these stack vertically (parent
 * controls that via a flex-col / lg:grid-flow-col layout); on desktop
 * they sit side by side so a whole week is visible without navigating
 * between days.
 *
 * Owns `expandedExerciseId` — "generally only one exercise expanded at a
 * time" (spec) is scoped per day, not globally across the whole visible
 * week, since every day in the week renders simultaneously and forcing a
 * click in one day to collapse something open in a different day would be
 * surprising.
 *
 * A day's blocks are split into three sections by `block_role` (migration
 * 0032) — Warm-up, the main workout, and Conditioning/Finisher — each
 * visually separate per spec, each its own independent drag surface (a
 * block dragged within Warm-up reorders Warm-up; it can't be dragged into
 * Main). Warm-up and Conditioning are optional and start collapsed to a
 * single "+" affordance when empty, so a day with neither still reads as
 * "just a workout," matching how every day looked before this existed.
 */
export function DayColumn({
  day,
  otherDays,
  mode,
  library,
  onCreateCustomExercise,
  librarySearch,
  onCreateInLibrary,
  onUpdateDay,
  onCopyTo,
  onDuplicateDay,
  onDeleteDay,
  onAddBlock,
  onDeleteBlock,
  onReorderBlocks,
  onAddExerciseToBlock,
  addingExerciseBlockId,
  onRemoveExerciseFromBlock,
  onDuplicateExercise,
  onMoveExerciseToDay,
  movingExerciseId,
  onRoundsChange,
  onExerciseChange,
  onNoteChange,
  onCategoryChange,
  onTestMaxBeforeChange,
  knownMaxByExerciseId,
  onSaveKnownMax,
  onPrescriptionTypeChange,
  onAddSet,
  onSetChange,
  onDeleteSet,
  onReorderSets,
  exerciseTemplates,
  dayTemplates,
  onSaveAsTemplate,
  onInsertExerciseTemplate,
  onSaveDayAsTemplate,
  onInsertDayTemplate,
}: DayColumnProps) {
  const [label, setLabel] = useState(day.label ?? "");
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);

  useEffect(() => setLabel(day.label ?? ""), [day.label]);

  // A distance-based activation constraint (rather than firing on the very
  // first pixel of movement) is what lets the drag handle still register a
  // plain click/tap without the pointer sensor eating it as a micro-drag —
  // dnd-kit's own recommended pattern for drag-handle-only sortables. One
  // sensor pair is shared across all three sections' DndContexts below —
  // sensors hold no per-list state, so there's no reason to instantiate
  // three.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function toggleExpand(exerciseId: string) {
    setExpandedExerciseId((current) => (current === exerciseId ? null : exerciseId));
  }

  function commitLabel() {
    const trimmed = label.trim();
    if (trimmed !== (day.label ?? "")) onUpdateDay({ label: trimmed || null });
    if (!trimmed) setLabel(day.label ?? "");
  }

  // Warm-up → main → conditioning, same order the athlete sees (see
  // buildExerciseList's own doc comment) — this is what ArrowUp/ArrowDown
  // walk below, so keyboard order matches visual/tab order regardless of
  // each section's raw (per-role-scoped) positions.
  const orderedExercises = useMemo(() => buildExerciseList(day.blocks), [day.blocks]);

  /**
   * One delegated keydown listener for the whole day, rather than one per
   * exercise — every shortcut here only fires when e.target is a specific
   * exercise's collapse/expand toggle button (identified via its
   * data-exercise-toggle attribute, set in exercise-card.tsx), which for
   * free means none of them fire while focus is inside that exercise's own
   * expanded body (a text input, the notes field, etc.) — no separate
   * "am I typing right now" guard needed. Enter/Space already expand or
   * collapse via native <button> semantics, so only Arrow/Delete/Cmd+D/
   * Escape need handling here.
   */
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const exerciseId = (e.target as HTMLElement).dataset.exerciseToggle;
    if (!exerciseId) return;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const ids = orderedExercises.map((ex) => ex.id);
      const index = ids.indexOf(exerciseId);
      if (index === -1) return;
      const targetId = ids[e.key === "ArrowDown" ? index + 1 : index - 1];
      if (targetId) document.getElementById(`exercise-toggle-${targetId}`)?.focus();
      return;
    }

    if (e.key === "Escape") {
      if (expandedExerciseId === exerciseId) {
        e.preventDefault();
        setExpandedExerciseId(null);
      }
      return;
    }

    const exercise = orderedExercises.find((ex) => ex.id === exerciseId);
    const block = exercise && day.blocks.find((b) => b.id === exercise.block_id);
    if (!exercise || !block) return;

    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      if (block.exercises.length > 1) onRemoveExerciseFromBlock(block.id, exerciseId);
      else onDeleteBlock(block.id);
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      onDuplicateExercise(block.id, exerciseId);
    }
  }

  // Re-filtering/sorting day.blocks three times on every keystroke anywhere
  // in this day (every edit re-renders the whole day — see this component's
  // performance-pass note further down) is wasted work once a day has a
  // realistic number of blocks; useMemo skips it unless day.blocks itself
  // changed.
  const warmupBlocks = useMemo(() => day.blocks.filter((b) => b.block_role === "warmup").sort((a, b) => a.position - b.position), [day.blocks]);
  const mainBlocks = useMemo(() => day.blocks.filter((b) => b.block_role === "main").sort((a, b) => a.position - b.position), [day.blocks]);
  const conditioningBlocks = useMemo(
    () => day.blocks.filter((b) => b.block_role === "conditioning").sort((a, b) => a.position - b.position),
    [day.blocks]
  );

  const sectionProps = {
    sensors,
    mode,
    library,
    onCreateCustomExercise,
    librarySearch,
    onCreateInLibrary,
    expandedExerciseId,
    toggleExpand,
    onDeleteBlock,
    onReorderBlocks,
    onAddExerciseToBlock,
    addingExerciseBlockId,
    onRemoveExerciseFromBlock,
    onDuplicateExercise,
    otherDays,
    onMoveExerciseToDay,
    movingExerciseId,
    onRoundsChange,
    onExerciseChange,
    onNoteChange,
    onCategoryChange,
    onTestMaxBeforeChange,
    knownMaxByExerciseId,
    onSaveKnownMax,
    onPrescriptionTypeChange,
    onAddSet,
    onSetChange,
    onDeleteSet,
    onReorderSets,
    exerciseTemplates,
    onSaveAsTemplate,
    onInsertExerciseTemplate,
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      className="flex w-full shrink-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-4 lg:w-96"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={commitLabel}
            placeholder={`Day ${day.position}`}
            aria-label="Day label"
            className={cn(
              "min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-base font-semibold text-foreground transition-colors",
              "hover:border-border focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary",
              day.is_rest_day && "text-muted-foreground"
            )}
          />
          {dayTemplates.length > 0 && (
            <div className="relative shrink-0">
              <select
                aria-label="Insert a saved day template into this day"
                value=""
                onChange={(e) => {
                  const template = dayTemplates.find((t) => t.id === e.target.value);
                  if (template) onInsertDayTemplate(template);
                  e.target.value = "";
                }}
                className="peer h-11 w-11 cursor-pointer appearance-none rounded-md border border-border bg-surface text-transparent lg:h-8 lg:w-8"
              >
                <option value="" disabled>
                  Insert template…
                </option>
                {dayTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <BookMarked
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 text-muted-foreground"
              />
            </div>
          )}

          {day.blocks.length > 0 && (
            <button
              type="button"
              onClick={onSaveDayAsTemplate}
              aria-label="Save this day as a template"
              title="Save day as template"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:h-8 lg:w-8"
            >
              <BookMarked className="size-4" />
            </button>
          )}

          {day.blocks.length > 0 && (
            <button
              type="button"
              onClick={onDuplicateDay}
              aria-label="Duplicate this day"
              title="Duplicate day"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:h-8 lg:w-8"
            >
              <Files className="size-4" />
            </button>
          )}

          {otherDays.length > 0 && (
            <div className="relative shrink-0">
              <select
                aria-label="Copy this day's exercises to another day"
                value=""
                onChange={(e) => {
                  if (e.target.value) onCopyTo(e.target.value);
                  e.target.value = "";
                }}
                disabled={day.blocks.length === 0}
                className="peer h-11 w-11 cursor-pointer appearance-none rounded-md border border-border bg-surface text-transparent disabled:cursor-not-allowed disabled:opacity-40 lg:h-8 lg:w-8"
              >
                <option value="" disabled>
                  Copy to…
                </option>
                {otherDays.map((d) => (
                  <option key={d.id} value={d.id}>
                    Copy to {d.label || `Day ${d.position}`}
                  </option>
                ))}
              </select>
              <Copy
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 text-muted-foreground peer-disabled:opacity-40"
              />
            </div>
          )}

          {onDeleteDay && (
            <button
              type="button"
              onClick={onDeleteDay}
              aria-label={`Delete ${day.label || `Day ${day.position}`}`}
              title="Delete day"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:h-8 lg:w-8"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={day.is_rest_day}
            onChange={(e) => onUpdateDay({ is_rest_day: e.target.checked })}
            className="size-3.5 rounded border-border-strong text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          Rest day
        </label>
      </div>

      {day.is_rest_day && day.blocks.length > 0 && (
        // Checking "Rest day" hides the exercises below without deleting
        // anything (see the unchanged branch below) — but with no
        // indication of that, watching a day's whole exercise list vanish
        // the instant you check the box reads as "I just lost my work."
        // This only needs to show up when there's actually something
        // hidden; an already-empty rest day has nothing to reassure anyone
        // about.
        <p className="text-xs text-muted-foreground">
          Exercises are hidden while this is a rest day — uncheck it to see them again.
        </p>
      )}

      {!day.is_rest_day && (
        <>
          <WorkoutSummaryBar blocks={mainBlocks} />

          <BlockSection
            role="warmup"
            blocks={warmupBlocks}
            icon={<Sunrise className="size-3.5" />}
            sectionLabel="Warm-up"
            addLabel={warmupBlocks.length === 0 ? "Add warm-up" : "Add to warm-up"}
            emptyAddLabel="Add warm-up"
            onAddBlock={onAddBlock}
            {...sectionProps}
          />

          <BlockSection role="main" blocks={mainBlocks} addLabel="Add exercise" onAddBlock={onAddBlock} {...sectionProps} />

          <BlockSection
            role="conditioning"
            blocks={conditioningBlocks}
            icon={<Flame className="size-3.5" />}
            sectionLabel="Conditioning / Finisher"
            addLabel={conditioningBlocks.length === 0 ? "Add conditioning" : "Add to conditioning"}
            emptyAddLabel="Add conditioning"
            onAddBlock={onAddBlock}
            {...sectionProps}
          />
        </>
      )}
    </div>
  );
}

interface BlockSectionProps {
  role: BlockRole;
  blocks: BlockRow[];
  /** Present for warmup/conditioning; omitted for 'main', which renders
   * with no header at all — it's the default content, not a labeled
   * add-on. */
  sectionLabel?: string;
  icon?: ReactNode;
  addLabel: string;
  /** Only set for warmup/conditioning — collapses the whole section to a
   * single ghost "+" button while empty, so a day using neither still
   * looks exactly like a plain workout. */
  emptyAddLabel?: string;
  onAddBlock: (role: BlockRole, blockType: BlockType) => void;
  sensors: SensorDescriptor<SensorOptions>[];
  mode: Exclude<BuilderMode, "preview">;
  library: ExerciseSearchResult[];
  onCreateCustomExercise: (name: string, category: ExerciseCategory) => void;
  /** DB-backed Exercise Library search/create, threaded down to
   * ExerciseSearchField (see that component's own doc comments) — optional
   * so tests that don't render a real Supabase-backed builder keep working
   * unchanged. */
  librarySearch?: (query: string, category: ExerciseCategory) => Promise<ExerciseSearchResult[]>;
  onCreateInLibrary?: (name: string, category: ExerciseCategory) => Promise<{ id: string; name: string } | null>;
  expandedExerciseId: string | null;
  toggleExpand: (exerciseId: string) => void;
  onDeleteBlock: (blockId: string) => void;
  onReorderBlocks: (role: BlockRole, orderedBlocks: { id: string; position: number }[]) => void;
  onAddExerciseToBlock: (blockId: string) => void;
  addingExerciseBlockId: string | null;
  onRemoveExerciseFromBlock: (blockId: string, blockExerciseId: string) => void;
  onDuplicateExercise: (blockId: string, blockExerciseId: string) => void;
  otherDays: { id: string; label: string | null; position: number }[];
  onMoveExerciseToDay: (blockId: string, blockExerciseId: string, targetDayId: string) => void;
  movingExerciseId: string | null;
  onRoundsChange: (blockId: string, rounds: number) => void;
  onExerciseChange: (blockId: string, blockExerciseId: string, patch: { exercise_id: string | null; custom_name: string | null }) => void;
  onNoteChange: (blockId: string, blockExerciseId: string, notes: string | null) => void;
  onCategoryChange: (blockId: string, blockExerciseId: string, category: ExerciseCategory) => void;
  onTestMaxBeforeChange: (blockId: string, blockExerciseId: string, testMaxBefore: boolean) => void;
  knownMaxByExerciseId: Map<string, { valueKg: number; performedOn: string }>;
  onSaveKnownMax: (exerciseId: string, valueKg: number) => void;
  onPrescriptionTypeChange: (blockId: string, blockExerciseId: string, prescriptionType: PrescriptionType) => void;
  onAddSet: (blockId: string, blockExerciseId: string) => void;
  onSetChange: (blockId: string, blockExerciseId: string, setId: string, patch: Partial<SetRow>) => void;
  onDeleteSet: (blockId: string, blockExerciseId: string, setId: string) => void;
  onReorderSets: (blockId: string, blockExerciseId: string, orderedSets: { id: string; position: number }[]) => void;
  exerciseTemplates: ExerciseTemplateRow[];
  onSaveAsTemplate: (blockId: string, blockExerciseId: string) => void;
  onInsertExerciseTemplate: (role: BlockRole, template: ExerciseTemplateRow) => void;
}

function BlockSection({
  role,
  blocks,
  sectionLabel,
  icon,
  addLabel,
  emptyAddLabel,
  onAddBlock,
  sensors,
  mode,
  library,
  onCreateCustomExercise,
  librarySearch,
  onCreateInLibrary,
  expandedExerciseId,
  toggleExpand,
  onDeleteBlock,
  onReorderBlocks,
  onAddExerciseToBlock,
  addingExerciseBlockId,
  onRemoveExerciseFromBlock,
  onDuplicateExercise,
  otherDays,
  onMoveExerciseToDay,
  movingExerciseId,
  onRoundsChange,
  onExerciseChange,
  onNoteChange,
  onCategoryChange,
  onTestMaxBeforeChange,
  knownMaxByExerciseId,
  onSaveKnownMax,
  onPrescriptionTypeChange,
  onAddSet,
  onSetChange,
  onDeleteSet,
  onReorderSets,
  exerciseTemplates,
  onSaveAsTemplate,
  onInsertExerciseTemplate,
}: BlockSectionProps) {
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(blocks, oldIndex, newIndex);
    onReorderBlocks(role, reordered.map((b, i) => ({ id: b.id, position: i + 1 })));
  }

  if (blocks.length === 0 && emptyAddLabel) {
    return (
      <div className="flex items-center gap-1">
        <AddBlockMenu role={role} label={emptyAddLabel} onAddBlock={onAddBlock} />
        <TemplateInsertSelect role={role} templates={exerciseTemplates} onInsert={onInsertExerciseTemplate} />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", sectionLabel && "rounded-xl border border-dashed border-border p-2.5")}>
      {sectionLabel && (
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {icon}
          {sectionLabel}
        </div>
      )}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {blocks.map((block) => (
              <ExerciseBlockCard
                key={block.id}
                block={block}
                expandedExerciseId={expandedExerciseId}
                onToggleExpand={toggleExpand}
                mode={mode}
                library={library}
                onCreateCustomExercise={onCreateCustomExercise}
                librarySearch={librarySearch}
                onCreateInLibrary={onCreateInLibrary}
                onDeleteBlock={() => onDeleteBlock(block.id)}
                onAddExerciseToBlock={() => onAddExerciseToBlock(block.id)}
                isAddingExercise={addingExerciseBlockId === block.id}
                onRemoveExerciseFromBlock={(blockExerciseId) => onRemoveExerciseFromBlock(block.id, blockExerciseId)}
                onDuplicateExercise={(blockExerciseId) => onDuplicateExercise(block.id, blockExerciseId)}
                otherDays={otherDays}
                onMoveExerciseToDay={(blockExerciseId, targetDayId) => onMoveExerciseToDay(block.id, blockExerciseId, targetDayId)}
                movingExerciseId={movingExerciseId}
                onRoundsChange={(rounds) => onRoundsChange(block.id, rounds)}
                onExerciseChange={(blockExerciseId, patch) => onExerciseChange(block.id, blockExerciseId, patch)}
                onNoteChange={(blockExerciseId, notes) => onNoteChange(block.id, blockExerciseId, notes)}
                onCategoryChange={(blockExerciseId, category) => onCategoryChange(block.id, blockExerciseId, category)}
                onTestMaxBeforeChange={(blockExerciseId, testMaxBefore) => onTestMaxBeforeChange(block.id, blockExerciseId, testMaxBefore)}
                knownMaxByExerciseId={knownMaxByExerciseId}
                onSaveKnownMax={onSaveKnownMax}
                onPrescriptionTypeChange={(blockExerciseId, prescriptionType) =>
                  onPrescriptionTypeChange(block.id, blockExerciseId, prescriptionType)
                }
                onAddSet={(blockExerciseId) => onAddSet(block.id, blockExerciseId)}
                onSetChange={(blockExerciseId, setId, patch) => onSetChange(block.id, blockExerciseId, setId, patch)}
                onDeleteSet={(blockExerciseId, setId) => onDeleteSet(block.id, blockExerciseId, setId)}
                onReorderSets={(blockExerciseId, orderedSets) => onReorderSets(block.id, blockExerciseId, orderedSets)}
                onSaveAsTemplate={(blockExerciseId) => onSaveAsTemplate(block.id, blockExerciseId)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex items-center gap-1">
        <AddBlockMenu role={role} label={addLabel} fullWidth onAddBlock={onAddBlock} />
        <TemplateInsertSelect role={role} templates={exerciseTemplates} onInsert={onInsertExerciseTemplate} />
      </div>
    </div>
  );
}

/** A saved exercise template, inserted with one click — the native
 * `<select>`-behind-an-icon trick already used above for "Copy to another
 * day," reused here rather than building a second dropdown pattern.
 * Renders nothing when there's nothing to pick from yet. */
function TemplateInsertSelect({
  role,
  templates,
  onInsert,
}: {
  role: BlockRole;
  templates: ExerciseTemplateRow[];
  onInsert: (role: BlockRole, template: ExerciseTemplateRow) => void;
}) {
  if (templates.length === 0) return null;
  return (
    <div className="relative shrink-0">
      <select
        aria-label="Insert a saved exercise template"
        value=""
        onChange={(e) => {
          const template = templates.find((t) => t.id === e.target.value);
          if (template) onInsert(role, template);
          e.target.value = "";
        }}
        className="peer h-11 w-11 cursor-pointer appearance-none rounded-md border border-dashed border-border bg-surface text-transparent lg:h-8 lg:w-8"
      >
        <option value="" disabled>
          Insert template…
        </option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <BookMarked
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
