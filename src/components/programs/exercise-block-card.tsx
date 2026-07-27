"use client";

import { useEffect, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Repeat, Trash2 } from "lucide-react";
import type { BlockRow, ExerciseCategory, PrescriptionType, SetRow } from "@/lib/programs/types";
import type { ExerciseSearchResult } from "@/lib/programs/exercise-search";
import type { BuilderMode } from "@/lib/programs/use-builder-mode";
import { ExerciseCard } from "@/components/programs/exercise-card";
import { cn } from "@/lib/utils";

interface ExerciseBlockCardProps {
  block: BlockRow;
  expandedExerciseId: string | null;
  onToggleExpand: (exerciseId: string) => void;
  mode: Exclude<BuilderMode, "preview">;
  library: ExerciseSearchResult[];
  onCreateCustomExercise: (name: string, category: ExerciseCategory) => void;
  onDeleteBlock: () => void;
  onAddExerciseToBlock: () => void;
  /** True while this block's "add exercise" write is in flight. The click
   * needs a server-generated exercise id before local state can update, so
   * without this the button looked like it silently ignored the first
   * click during that round-trip. */
  isAddingExercise: boolean;
  onRemoveExerciseFromBlock: (blockExerciseId: string) => void;
  onDuplicateExercise: (blockExerciseId: string) => void;
  otherDays: { id: string; label: string | null; position: number }[];
  onMoveExerciseToDay: (blockExerciseId: string, targetDayId: string) => void;
  movingExerciseId: string | null;
  onRoundsChange: (rounds: number) => void;
  onExerciseChange: (blockExerciseId: string, patch: { exercise_id: string | null; custom_name: string | null }) => void;
  onNoteChange: (blockExerciseId: string, notes: string | null) => void;
  onCategoryChange: (blockExerciseId: string, category: ExerciseCategory) => void;
  onPrescriptionTypeChange: (blockExerciseId: string, prescriptionType: PrescriptionType) => void;
  onAddSet: (blockExerciseId: string) => void;
  onSetChange: (blockExerciseId: string, setId: string, patch: Partial<SetRow>) => void;
  onDeleteSet: (blockExerciseId: string, setId: string) => void;
  onReorderSets: (blockExerciseId: string, orderedSets: { id: string; position: number }[]) => void;
  onSaveAsTemplate: (blockExerciseId: string) => void;
}

/**
 * A block holds one exercise (straight set) or several performed back to
 * back for a set number of rounds (superset/circuit — the UI doesn't
 * distinguish the two, both just mean "2+ exercises, N rounds"). This is
 * the sortable unit drag-and-drop reordering actually moves (see
 * day-column.tsx's DndContext) — for the common straight-block case that's
 * indistinguishable from "drag the exercise," which is all the spec asks
 * for; a superset's exercises still move as one group, matching how they
 * were already reordered as a unit (via move up/down) before this redesign.
 *
 * Renders one ExerciseCard per exercise (exercise-card.tsx) — this
 * component now owns only block-level chrome (drag handle, rounds, and a
 * "delete the whole superset" action that's redundant to show once there's
 * only one exercise, since that exercise's own Delete already covers it).
 */
export function ExerciseBlockCard({
  block,
  expandedExerciseId,
  onToggleExpand,
  mode,
  library,
  onCreateCustomExercise,
  onDeleteBlock,
  onAddExerciseToBlock,
  isAddingExercise,
  onRemoveExerciseFromBlock,
  onDuplicateExercise,
  otherDays,
  onMoveExerciseToDay,
  movingExerciseId,
  onRoundsChange,
  onExerciseChange,
  onNoteChange,
  onCategoryChange,
  onPrescriptionTypeChange,
  onAddSet,
  onSetChange,
  onDeleteSet,
  onReorderSets,
  onSaveAsTemplate,
}: ExerciseBlockCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const isGrouped = block.exercises.length > 1;
  const [rounds, setRounds] = useState(String(block.rounds));

  useEffect(() => setRounds(String(block.rounds)), [block.rounds]);

  function commitRounds() {
    const n = Math.max(1, Math.round(Number(rounds)) || 1);
    setRounds(String(n));
    if (n !== block.rounds) onRoundsChange(n);
  }

  if (block.exercises.length === 0) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex flex-col gap-2 rounded-xl border border-border bg-surface p-2.5", isDragging && "z-10 opacity-60 shadow-lg")}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="flex h-9 w-9 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground active:cursor-grabbing lg:h-7 lg:w-7"
        >
          <GripVertical className="size-4" />
        </button>

        {isGrouped ? (
          <div className="flex flex-1 items-center gap-1.5 text-xs font-medium text-primary">
            <Repeat className="size-3.5" />
            Superset ·
            <input
              aria-label="Rounds"
              value={rounds}
              onChange={(e) => setRounds(e.target.value)}
              onBlur={commitRounds}
              inputMode="numeric"
              className="h-6 w-9 rounded border border-border bg-background px-1 text-center text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            rounds
          </div>
        ) : (
          <span className="flex-1" />
        )}

        {isGrouped && (
          <button
            type="button"
            onClick={onDeleteBlock}
            aria-label="Delete whole superset"
            title="Delete whole superset"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:h-7 lg:w-7"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {block.exercises.map((exercise) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            isGrouped={isGrouped}
            expanded={expandedExerciseId === exercise.id}
            onToggleExpand={() => onToggleExpand(exercise.id)}
            mode={mode}
            library={library}
            onCreateCustomExercise={onCreateCustomExercise}
            onExerciseChange={(patch) => onExerciseChange(exercise.id, patch)}
            onNoteChange={(notes) => onNoteChange(exercise.id, notes)}
            onCategoryChange={(category) => onCategoryChange(exercise.id, category)}
            onPrescriptionTypeChange={(type) => onPrescriptionTypeChange(exercise.id, type)}
            onAddSet={() => onAddSet(exercise.id)}
            onSetChange={(setId, patch) => onSetChange(exercise.id, setId, patch)}
            onDeleteSet={(setId) => onDeleteSet(exercise.id, setId)}
            onReorderSets={(orderedSets) => onReorderSets(exercise.id, orderedSets)}
            onSaveAsTemplate={() => onSaveAsTemplate(exercise.id)}
            onRemoveFromBlock={isGrouped ? () => onRemoveExerciseFromBlock(exercise.id) : undefined}
            onDuplicate={() => onDuplicateExercise(exercise.id)}
            onDelete={isGrouped ? () => onRemoveExerciseFromBlock(exercise.id) : onDeleteBlock}
            otherDays={otherDays}
            onMoveToDay={(targetDayId) => onMoveExerciseToDay(exercise.id, targetDayId)}
            isMoving={movingExerciseId === exercise.id}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onAddExerciseToBlock}
        disabled={isAddingExercise}
        className="flex items-center gap-1 self-start rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Repeat className={cn("size-3.5", isAddingExercise && "animate-spin")} />
        {isAddingExercise ? "Adding…" : isGrouped ? "Add another exercise" : "Make this a superset"}
      </button>
    </div>
  );
}
