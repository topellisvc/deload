"use client";

import { useEffect, useState } from "react";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Copy, Plus } from "lucide-react";
import type { DayRow, ExerciseCategory, PrescriptionType, SetRow } from "@/lib/programs/types";
import type { ExerciseSearchResult } from "@/lib/programs/exercise-search";
import type { BuilderMode } from "@/lib/programs/use-builder-mode";
import { ExerciseBlockCard } from "@/components/programs/exercise-block-card";
import { WorkoutSummaryBar } from "@/components/programs/workout-summary-bar";
import { cn } from "@/lib/utils";

interface DayColumnProps {
  day: DayRow;
  otherDays: { id: string; label: string | null; position: number }[];
  mode: Exclude<BuilderMode, "preview">;
  library: ExerciseSearchResult[];
  onCreateCustomExercise: (name: string, category: ExerciseCategory) => void;
  onUpdateDay: (patch: { label?: string | null; is_rest_day?: boolean }) => void;
  onCopyTo: (targetDayId: string) => void;
  onAddBlock: () => void;
  onDeleteBlock: (blockId: string) => void;
  onReorderBlocks: (orderedBlocks: { id: string; position: number }[]) => void;
  onAddExerciseToBlock: (blockId: string) => void;
  /** Block id currently awaiting its "add exercise" network round-trip, if
   * any — see ProgramBuilder's addingExerciseBlockId comment for why this
   * needs visible pending state rather than just firing and forgetting. */
  addingExerciseBlockId: string | null;
  onRemoveExerciseFromBlock: (blockId: string, blockExerciseId: string) => void;
  onDuplicateExercise: (blockId: string, blockExerciseId: string) => void;
  onRoundsChange: (blockId: string, rounds: number) => void;
  onExerciseChange: (blockId: string, blockExerciseId: string, patch: { exercise_id: string | null; custom_name: string | null }) => void;
  onNoteChange: (blockId: string, blockExerciseId: string, notes: string | null) => void;
  onCategoryChange: (blockId: string, blockExerciseId: string, category: ExerciseCategory) => void;
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
 * surprising. Also owns the DndContext for this day's block reordering —
 * each day is its own independent drag surface, dragging a block from one
 * day's list into another isn't supported (that's what "copy to another
 * day" and, later, a real cross-day move are for).
 */
export function DayColumn({
  day,
  otherDays,
  mode,
  library,
  onCreateCustomExercise,
  onUpdateDay,
  onCopyTo,
  onAddBlock,
  onDeleteBlock,
  onReorderBlocks,
  onAddExerciseToBlock,
  addingExerciseBlockId,
  onRemoveExerciseFromBlock,
  onDuplicateExercise,
  onRoundsChange,
  onExerciseChange,
  onNoteChange,
  onCategoryChange,
  onPrescriptionTypeChange,
  onAddSet,
  onSetChange,
  onDeleteSet,
  onReorderSets,
}: DayColumnProps) {
  const [label, setLabel] = useState(day.label ?? "");
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);

  useEffect(() => setLabel(day.label ?? ""), [day.label]);

  // A distance-based activation constraint (rather than firing on the very
  // first pixel of movement) is what lets the drag handle still register a
  // plain click/tap without the pointer sensor eating it as a micro-drag —
  // dnd-kit's own recommended pattern for drag-handle-only sortables.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function toggleExpand(exerciseId: string) {
    setExpandedExerciseId((current) => (current === exerciseId ? null : exerciseId));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = day.blocks.findIndex((b) => b.id === active.id);
    const newIndex = day.blocks.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(day.blocks, oldIndex, newIndex);
    onReorderBlocks(reordered.map((b, i) => ({ id: b.id, position: i + 1 })));
  }

  function commitLabel() {
    const trimmed = label.trim();
    if (trimmed !== (day.label ?? "")) onUpdateDay({ label: trimmed || null });
    if (!trimmed) setLabel(day.label ?? "");
  }

  return (
    <div className="flex w-full shrink-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-4 lg:w-96">
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
                className="peer h-8 w-8 cursor-pointer appearance-none rounded-md border border-border bg-surface text-transparent disabled:cursor-not-allowed disabled:opacity-40"
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
          <WorkoutSummaryBar blocks={day.blocks} />

          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={day.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {day.blocks.map((block) => (
                  <ExerciseBlockCard
                    key={block.id}
                    block={block}
                    expandedExerciseId={expandedExerciseId}
                    onToggleExpand={toggleExpand}
                    mode={mode}
                    library={library}
                    onCreateCustomExercise={onCreateCustomExercise}
                    onDeleteBlock={() => onDeleteBlock(block.id)}
                    onAddExerciseToBlock={() => onAddExerciseToBlock(block.id)}
                    isAddingExercise={addingExerciseBlockId === block.id}
                    onRemoveExerciseFromBlock={(blockExerciseId) => onRemoveExerciseFromBlock(block.id, blockExerciseId)}
                    onDuplicateExercise={(blockExerciseId) => onDuplicateExercise(block.id, blockExerciseId)}
                    onRoundsChange={(rounds) => onRoundsChange(block.id, rounds)}
                    onExerciseChange={(blockExerciseId, patch) => onExerciseChange(block.id, blockExerciseId, patch)}
                    onNoteChange={(blockExerciseId, notes) => onNoteChange(block.id, blockExerciseId, notes)}
                    onCategoryChange={(blockExerciseId, category) => onCategoryChange(block.id, blockExerciseId, category)}
                    onPrescriptionTypeChange={(blockExerciseId, prescriptionType) =>
                      onPrescriptionTypeChange(block.id, blockExerciseId, prescriptionType)
                    }
                    onAddSet={(blockExerciseId) => onAddSet(block.id, blockExerciseId)}
                    onSetChange={(blockExerciseId, setId, patch) => onSetChange(block.id, blockExerciseId, setId, patch)}
                    onDeleteSet={(blockExerciseId, setId) => onDeleteSet(block.id, blockExerciseId, setId)}
                    onReorderSets={(blockExerciseId, orderedSets) => onReorderSets(block.id, blockExerciseId, orderedSets)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <button
            type="button"
            onClick={onAddBlock}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Plus className="size-4" />
            Add exercise
          </button>
        </>
      )}
    </div>
  );
}
