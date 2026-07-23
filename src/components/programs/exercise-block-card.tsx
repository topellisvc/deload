"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Repeat, X } from "lucide-react";
import type { BlockRow, ExerciseCategory, PrescriptionType, SetRow } from "@/lib/programs/types";
import { EXERCISE_CATEGORY_LABELS, PRESCRIPTION_TYPES_BY_CATEGORY, defaultPrescriptionType } from "@/lib/programs/prescription-types";
import { ExercisePicker } from "@/components/programs/exercise-picker";
import { PrescriptionRowEditor } from "@/components/programs/prescription-row-editor";
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
  onCategoryChange: (blockExerciseId: string, category: ExerciseCategory) => void;
  onPrescriptionTypeChange: (blockExerciseId: string, prescriptionType: PrescriptionType) => void;
  onAddSet: (blockExerciseId: string) => void;
  onSetChange: (blockExerciseId: string, setId: string, patch: Partial<SetRow>) => void;
  onDeleteSet: (blockExerciseId: string, setId: string) => void;
}

const CATEGORY_OPTIONS = (Object.keys(EXERCISE_CATEGORY_LABELS) as ExerciseCategory[]).map((value) => ({
  value,
  label: EXERCISE_CATEGORY_LABELS[value],
}));

/**
 * A block holds one exercise (straight set) or several performed back to
 * back for a set number of rounds (superset/circuit — the UI doesn't
 * distinguish the two, both just mean "2+ exercises, N rounds"). Drop
 * sets don't need separate block-level handling: they're already just
 * multiple prescription rows on one exercise with decreasing load, which
 * PrescriptionRowEditor's "Add row" already supports.
 *
 * Each exercise now has Category (Strength/Running/Cardio) and
 * Prescription Type pickers — the program builder's "Step 1 / Step 2 /
 * Step 3" flow from the product spec, done inline rather than as a modal
 * wizard, matching this app's existing philosophy of live, no-dialog
 * editing everywhere else in the builder (day copying, supersets, week
 * add-on). The prescription type applies to every row on the exercise at
 * once (see onPrescriptionTypeChange) — one exercise, one type, matching
 * "every Strength exercise must have a required field: Prescription
 * Type" rather than letting individual rows drift to different types.
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
  onCategoryChange,
  onPrescriptionTypeChange,
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
          const category = exercise.exercise_category;
          const prescriptionType = exercise.sets[0]?.prescription_type ?? defaultPrescriptionType(category);
          const typeOptions = PRESCRIPTION_TYPES_BY_CATEGORY[category];

          return (
            <div
              key={exercise.id}
              className={isGrouped ? "flex flex-col gap-1.5 border-l-2 border-primary/30 pl-2.5" : "flex flex-col gap-1.5"}
            >
              <div className="flex items-start gap-2">
                <ExercisePicker
                  category={category}
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

              <div className="flex flex-wrap items-center gap-2">
                <SegmentedControl
                  aria-label="Exercise category"
                  options={CATEGORY_OPTIONS}
                  value={category}
                  onChange={(newCategory) => onCategoryChange(exercise.id, newCategory)}
                  className="w-fit"
                />
                <select
                  aria-label="Prescription type"
                  value={prescriptionType}
                  onChange={(e) => onPrescriptionTypeChange(exercise.id, e.target.value as PrescriptionType)}
                  className="h-8 rounded-md border border-border bg-surface px-2 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {typeOptions.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                {exercise.sets.map((set) => (
                  <PrescriptionRowEditor
                    key={set.id}
                    category={category}
                    set={set}
                    onChange={(patch) => onSetChange(exercise.id, set.id, patch)}
                    onDelete={() => onDeleteSet(exercise.id, set.id)}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => onAddSet(exercise.id)}
                className="flex items-center gap-1 self-start rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Plus className="size-3.5" />
                Add row
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
