"use client";

import { ArrowRightLeft, BookMarked, Copy, StickyNote, Trash2, X } from "lucide-react";
import { getExerciseDisplayName } from "@/lib/programs/exercise-catalog";
import { summarizePrescriptionPrimary, summarizeRest } from "@/lib/programs/prescription-summary";
import { EXERCISE_CATEGORY_ACTIVE_CLASSES, EXERCISE_CATEGORY_LABELS, defaultPrescriptionType } from "@/lib/programs/prescription-types";
import type { BlockExerciseRow, ExerciseCategory, PrescriptionType, SetRow } from "@/lib/programs/types";
import type { ExerciseSearchResult } from "@/lib/programs/exercise-search";
import type { BuilderMode } from "@/lib/programs/use-builder-mode";
import { ExerciseSearchField } from "@/components/programs/exercise-search-field";
import { PrescriptionTypePicker } from "@/components/programs/prescription-type-picker";
import { PrescriptionRowEditor } from "@/components/programs/prescription-row-editor";
import { CardioIntervalTable } from "@/components/programs/cardio-interval-table";
import { CoachNoteField } from "@/components/programs/coach-note-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";

const CATEGORY_OPTIONS = (Object.keys(EXERCISE_CATEGORY_LABELS) as ExerciseCategory[]).map((value) => ({
  value,
  label: EXERCISE_CATEGORY_LABELS[value],
  activeClassName: EXERCISE_CATEGORY_ACTIVE_CLASSES[value],
}));

interface ExerciseCardProps {
  exercise: BlockExerciseRow;
  /** True when this exercise shares a block (superset/circuit) with at
   * least one other — changes what "delete" and "remove" mean (see
   * onDelete/onRemoveFromBlock) and shows the grouped left-border styling. */
  isGrouped: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  /** "preview" never reaches this component — Athlete Preview renders a
   * wholly separate read-only view (see athlete-preview.tsx), it never
   * mounts an editable ExerciseCard at all. */
  mode: Exclude<BuilderMode, "preview">;
  library: ExerciseSearchResult[];
  onCreateCustomExercise: (name: string, category: ExerciseCategory) => void;
  librarySearch?: (query: string, category: ExerciseCategory) => Promise<ExerciseSearchResult[]>;
  onCreateInLibrary?: (name: string, category: ExerciseCategory) => Promise<{ id: string; name: string } | null>;
  onExerciseChange: (patch: { exercise_id: string | null; custom_name: string | null }) => void;
  onNoteChange: (notes: string | null) => void;
  onCategoryChange: (category: ExerciseCategory) => void;
  /** "Test max before" checkbox (migration 0054) — only meaningful for a
   * strength exercise with a real library exercise_id (there's nothing to
   * test-max a custom_name-only row or a running/cardio exercise against).
   * See program-builder.tsx's syncTestingWeek call for what flipping this
   * actually does. */
  onTestMaxBeforeChange: (testMaxBefore: boolean) => void;
  onPrescriptionTypeChange: (type: PrescriptionType) => void;
  onAddSet: () => void;
  onSetChange: (setId: string, patch: Partial<SetRow>) => void;
  onDeleteSet: (setId: string) => void;
  onReorderSets: (orderedSets: { id: string; position: number }[]) => void;
  onSaveAsTemplate: () => void;
  /** Only called when isGrouped — pulls this one exercise back out of a
   * superset without touching its block-mates. */
  onRemoveFromBlock?: () => void;
  onDuplicate: () => void;
  /** Ungrouped: deletes the whole (single-exercise) block. Grouped: same
   * as onRemoveFromBlock — the caller decides which mutation that maps to,
   * this component just always shows one "delete" action either way. */
  onDelete: () => void;
  otherDays: { id: string; label: string | null; position: number }[];
  onMoveToDay: (targetDayId: string) => void;
  /** True while this exercise's move (duplicate-then-remove) write is in
   * flight — same rationale as isAddingExercise on ExerciseBlockCard. */
  isMoving: boolean;
}

/**
 * One exercise, collapsed to a single scannable line by default —
 * "Bench Press · Strength · 4 × 6 @ 80% · Rest 2:00" — expanding on click
 * into the full editing surface. Replaces the old always-expanded
 * per-exercise block inside ExerciseBlockCard; the spec's whole "Compact
 * Exercise Cards" section is this component. Which card (if any) is
 * expanded is owned by the parent (DayColumn) rather than local state here,
 * so it can enforce "generally only one exercise expanded at a time."
 */
export function ExerciseCard({
  exercise,
  isGrouped,
  expanded,
  onToggleExpand,
  mode,
  library,
  onCreateCustomExercise,
  librarySearch,
  onCreateInLibrary,
  onExerciseChange,
  onNoteChange,
  onCategoryChange,
  onTestMaxBeforeChange,
  onPrescriptionTypeChange,
  onAddSet,
  onSetChange,
  onDeleteSet,
  onReorderSets,
  onSaveAsTemplate,
  onRemoveFromBlock,
  onDuplicate,
  onDelete,
  otherDays,
  onMoveToDay,
  isMoving,
}: ExerciseCardProps) {
  const category = exercise.exercise_category;
  const exerciseName = getExerciseDisplayName(exercise);
  const firstSet = exercise.sets[0];
  const prescriptionType = firstSet?.prescription_type ?? defaultPrescriptionType(category);
  const primarySummary = firstSet ? summarizePrescriptionPrimary(firstSet, category) : "No prescription yet";
  const restSummary = firstSet ? summarizeRest(firstSet) : null;
  // Prescription-level guidance (e.g. sprint effort %, pacing cues) lives in
  // set.notes and is otherwise invisible until the card is expanded — for a
  // non-notes-only prescription type it wasn't shown anywhere in the
  // collapsed view at all, so a distance/time/etc. row with real coaching
  // detail attached (see power-athletic-templates.ts's sprintPrescription)
  // looked like a bare number with no explanation of what to actually do.
  // coach_notes(_only) already fold their note into primarySummary itself,
  // so this only fires for every other type.
  const isNotesOnlyType = firstSet?.prescription_type === "coach_notes_only" || firstSet?.prescription_type === "coach_notes";
  const fullNote = firstSet && !isNotesOnlyType ? firstSet.notes : null;
  // Truncated to keep the collapsed row to one line — the full text is
  // still there once the card is expanded (PrescriptionRowEditor's notes
  // field), this is just enough to flag "there's guidance here, expand to
  // read it" rather than reproducing a whole paragraph inline.
  const noteSummary = fullNote && fullNote.length > 64 ? `${fullNote.slice(0, 64).trimEnd()}…` : fullNote;

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-background transition-colors",
        isGrouped ? "border-l-2 border-primary/30" : "border-border",
        expanded && "border-primary/40"
      )}
    >
      {/* The expand/collapse trigger and the quick-action buttons are
          siblings, not nested — a <button> can't legally contain another
          <button> (invalid HTML, breaks hydration), so the actions live
          next to the toggle rather than inside it. */}
      <div className="flex items-center gap-1 px-3 py-2.5">
        <button
          type="button"
          id={`exercise-toggle-${exercise.id}`}
          // Both read by DayColumn's single delegated keydown handler (see
          // its own doc comment) — the data attribute identifies which
          // exercise a keyboard shortcut applies to purely from
          // e.target/e.currentTarget, and the id is how ArrowUp/ArrowDown
          // move focus to a sibling exercise's toggle. Enter/Space already
          // expand or collapse for free once this button has focus — that's
          // native <button> behavior, nothing to wire up.
          data-exercise-toggle={exercise.id}
          onClick={onToggleExpand}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left transition-colors hover:bg-surface-hover"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
              {exerciseName}
              {exercise.notes && <StickyNote aria-label="Has a coach note" className="size-3.5 shrink-0 text-primary" />}
            </span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", EXERCISE_CATEGORY_ACTIVE_CLASSES[category])}>
                {EXERCISE_CATEGORY_LABELS[category]}
              </span>
              <span>{primarySummary}</span>
              {restSummary && <span>· {restSummary}</span>}
              {noteSummary && <span className="italic">· {noteSummary}</span>}
            </span>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onDuplicate}
            aria-label={`Duplicate ${exerciseName}`}
            title="Duplicate"
            className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:h-7 lg:w-7"
          >
            <Copy className="size-3.5" />
          </button>
          {isGrouped && onRemoveFromBlock ? (
            <button
              type="button"
              onClick={onRemoveFromBlock}
              aria-label={`Remove ${exerciseName} from this superset`}
              title="Remove from superset"
              className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:h-7 lg:w-7"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete ${exerciseName}`}
              title="Delete"
              className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:h-7 lg:w-7"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-border px-3 py-3">
          <ExerciseSearchField
            category={category}
            exerciseId={exercise.exercise_id}
            customName={exercise.custom_name}
            onChange={onExerciseChange}
            library={library}
            onCreateCustomExercise={(name) => onCreateCustomExercise(name, category)}
            librarySearch={librarySearch ? (query) => librarySearch(query, category) : undefined}
            onCreateInLibrary={onCreateInLibrary ? (name) => onCreateInLibrary(name, category) : undefined}
          />

          <SegmentedControl aria-label="Exercise category" options={CATEGORY_OPTIONS} value={category} onChange={onCategoryChange} className="w-fit" />

          {category === "strength" && exercise.exercise_id && (
            <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={exercise.test_max_before ?? false}
                onChange={(e) => onTestMaxBeforeChange(e.target.checked)}
                className="size-4 rounded border-border-strong text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              Test max before
            </label>
          )}

          <PrescriptionTypePicker category={category} value={prescriptionType} onChange={onPrescriptionTypeChange} />

          {prescriptionType === "intervals" ? (
            // The spec's "Cardio Builder" — a structured table (own
            // add/delete/reorder controls) instead of the generic stacked
            // rows every other prescription type uses. See
            // cardio-interval-table.tsx's own doc comment for why this
            // needed no schema change.
            <CardioIntervalTable sets={exercise.sets} onChange={onSetChange} onDelete={onDeleteSet} onAdd={onAddSet} onReorder={onReorderSets} />
          ) : (
            <>
              <div className="flex flex-col gap-2.5">
                {exercise.sets.map((set) => (
                  <PrescriptionRowEditor
                    key={set.id}
                    category={category}
                    set={set}
                    onChange={(patch) => onSetChange(set.id, patch)}
                    onDelete={() => onDeleteSet(set.id)}
                    advanced={mode === "advanced"}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={onAddSet}
                className="flex items-center gap-1 self-start rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Add row
              </button>
            </>
          )}

          <CoachNoteField value={exercise.notes} onCommit={onNoteChange} />

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onSaveAsTemplate}
              className="flex items-center gap-1.5 self-start rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <BookMarked className="size-3.5" />
              Save as template
            </button>

            {otherDays.length > 0 && (
              <div className="relative flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-xs font-medium text-muted-foreground">
                <ArrowRightLeft className="size-3.5" />
                {isMoving ? "Moving…" : "Move to…"}
                <select
                  aria-label={`Move ${exerciseName} to another day`}
                  value=""
                  onChange={(e) => {
                    if (e.target.value) onMoveToDay(e.target.value);
                    e.target.value = "";
                  }}
                  disabled={isMoving}
                  className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
                >
                  <option value="" disabled>
                    Move to…
                  </option>
                  {otherDays.map((d) => (
                    <option key={d.id} value={d.id}>
                      Move to {d.label || `Day ${d.position}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
