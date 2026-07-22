"use client";

import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import type { BlockRow, SetRow } from "@/lib/programs/types";
import { ExercisePicker } from "@/components/programs/exercise-picker";
import { SetRowEditor } from "@/components/programs/set-row-editor";

interface ExerciseBlockCardProps {
  block: BlockRow;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDeleteBlock: () => void;
  onExerciseChange: (patch: { exercise_id: string | null; custom_name: string | null }) => void;
  onAddSet: () => void;
  onSetChange: (setId: string, patch: Partial<SetRow>) => void;
  onDeleteSet: (setId: string) => void;
}

/**
 * Straight-set block card: one exercise, one or more set rows. The schema
 * already supports superset/circuit/dropset block types (multiple
 * exercises per block, multiple set rows per drop) — Phase 1's UI only
 * ever creates 'straight' blocks with a single exercise, so this
 * component only renders `block.exercises[0]`.
 */
export function ExerciseBlockCard({
  block,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDeleteBlock,
  onExerciseChange,
  onAddSet,
  onSetChange,
  onDeleteSet,
}: ExerciseBlockCardProps) {
  const exercise = block.exercises[0];
  if (!exercise) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
      <div className="flex items-start gap-2">
        <ExercisePicker
          exerciseId={exercise.exercise_id}
          customName={exercise.custom_name}
          onChange={onExerciseChange}
          className="flex-1"
        />
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label="Move exercise up"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label="Move exercise down"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronDown className="size-4" />
          </button>
          <button
            type="button"
            onClick={onDeleteBlock}
            aria-label="Delete exercise"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {exercise.sets.map((set) => (
          <SetRowEditor
            key={set.id}
            set={set}
            onChange={(patch) => onSetChange(set.id, patch)}
            onDelete={() => onDeleteSet(set.id)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onAddSet}
        className="flex items-center gap-1 self-start rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Plus className="size-3.5" />
        Add set row
      </button>
    </div>
  );
}
