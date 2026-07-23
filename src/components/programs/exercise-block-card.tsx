"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Repeat, X } from "lucide-react";
import type { ActivityType, BlockRow, SetRow } from "@/lib/programs/types";
import { ExercisePicker } from "@/components/programs/exercise-picker";
import { SetRowEditor } from "@/components/programs/set-row-editor";
import { RunSetRowEditor } from "@/components/programs/run-set-row-editor";
import { SegmentedControl } from "@/components/ui/segmented-control";

interface ExerciseBlockCardProps {
  block: BlockRow;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDeleteBlock: () => void;
  onAddExerciseToBlock: () => void;
  onRemoveExerciseFromBlock: (blockExerciseId: string) => void;
  onRoundsChange: (rounds: number) => void;
  onExerciseChange: (blockExerciseId: string, patch: { exercise_id: string | null; custom_name: string | null }) => void;
  onActivityTypeChange: (blockExerciseId: string, activityType: ActivityType) => void;
  onAddSet: (blockExerciseId: string) => void;
  onSetChange: (blockExerciseId: string, setId: string, patch: Partial<SetRow>) => void;
  onDeleteSet: (blockExerciseId: string, setId: string) => void;
}

const ACTIVITY_OPTIONS = [
  { value: "strength" as const, label: "Lift" },
  { value: "run" as const, label: "Run" },
];

/**
 * A block holds one exercise (straight set) or several performed back to
 * back for a set number of rounds (superset/circuit — the UI doesn't
 * distinguish the two, both just mean "2+ exercises, N rounds"). Drop
 * sets don't need separate block-level handling: they're already just
 * multiple set rows on one exercise with decreasing load, which
 * SetRowEditor's "Add set row" already supports.
 *
 * Adding a second exercise via "+ Add exercise to this block" is what
 * turns a straight block into a superset; removing back down to one
 * turns it back — that flip happens in the parent (ProgramBuilder), this
 * component just renders whatever `block.exercises` currently holds.
 */
export function ExerciseBlockCard({
  block,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDeleteBlock,
  onAddExerciseToBlock,
  onRemoveExerciseFromBlock,
  onRoundsChange,
  onExerciseChange,
  onActivityTypeChange,
  onAddSet,
  onSetChange,
  onDeleteSet,
}: ExerciseBlockCardProps) {
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
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        {isGrouped ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Repeat className="size-3.5" />
            Superset ·
            <input
              aria-label="Rounds"
              value={rounds}
              onChange={(e) => setRounds(e.target.value)}
              onBlur={commitRounds}
              inputMode="numeric"
              className="h-6 w-9 rounded border border-border bg-surface px-1 text-center text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            rounds
          </div>
        ) : (
          <span />
        )}
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label="Move block up"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label="Move block down"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronDown className="size-4" />
          </button>
          <button
            type="button"
            onClick={onDeleteBlock}
            aria-label={isGrouped ? "Delete whole block" : "Delete exercise"}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {block.exercises.map((exercise) => {
          const isRun = exercise.activity_type === "run";
          return (
            <div
              key={exercise.id}
              className={isGrouped ? "flex flex-col gap-1.5 border-l-2 border-primary/30 pl-2.5" : "flex flex-col gap-1.5"}
            >
              <div className="flex items-start gap-2">
                <ExercisePicker
                  exerciseId={exercise.exercise_id}
                  customName={exercise.custom_name}
                  onChange={(patch) => onExerciseChange(exercise.id, patch)}
                  className="flex-1"
                />
                {isGrouped && (
                  <button
                    type="button"
                    onClick={() => onRemoveExerciseFromBlock(exercise.id)}
                    aria-label="Remove this exercise from the block"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              <SegmentedControl
                aria-label="Exercise type"
                options={ACTIVITY_OPTIONS}
                value={exercise.activity_type}
                onChange={(activityType) => onActivityTypeChange(exercise.id, activityType)}
                className="w-fit"
              />

              <div className="flex flex-col gap-1.5">
                {exercise.sets.map((set) =>
                  isRun ? (
                    <RunSetRowEditor
                      key={set.id}
                      set={set}
                      onChange={(patch) => onSetChange(exercise.id, set.id, patch)}
                      onDelete={() => onDeleteSet(exercise.id, set.id)}
                    />
                  ) : (
                    <SetRowEditor
                      key={set.id}
                      set={set}
                      onChange={(patch) => onSetChange(exercise.id, set.id, patch)}
                      onDelete={() => onDeleteSet(exercise.id, set.id)}
                    />
                  )
                )}
              </div>

              <button
                type="button"
                onClick={() => onAddSet(exercise.id)}
                className="flex items-center gap-1 self-start rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Plus className="size-3.5" />
                {isRun ? "Add run segment" : "Add set row"}
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onAddExerciseToBlock}
        className="flex items-center gap-1 self-start rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Repeat className="size-3.5" />
        {isGrouped ? "Add another exercise" : "Make this a superset"}
      </button>
    </div>
  );
}
