"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, GripVertical, Plus, RotateCw, StickyNote, Trash2 } from "lucide-react";
import type { BlockRow, CompletionMethod, ExerciseCategory, PrescriptionType, SetRow } from "@/lib/programs/types";
import type { ExerciseSearchResult } from "@/lib/programs/exercise-search";
import type { BuilderMode } from "@/lib/programs/use-builder-mode";
import { defaultCompletionMethod, getCompletionMethodDef, isFieldRelevant } from "@/lib/programs/completion-methods";
import { ExerciseCard } from "@/components/programs/exercise-card";
import { CompletionMethodPicker } from "@/components/programs/completion-method-picker";
import { CoachNoteField } from "@/components/programs/coach-note-field";
import { InlineTextField } from "@/components/programs/inline-fields";
import { PresetChipField } from "@/components/programs/preset-fields";
import { cn } from "@/lib/utils";

const ROUNDS_PRESETS = [1, 2, 3, 4, 5].map((n) => ({ label: String(n), value: n }));
const REST_BETWEEN_EXERCISES_PRESETS = [0, 15, 30, 45, 60, 90].map((s) => ({ label: formatSeconds(s), value: s }));
const REST_BETWEEN_ROUNDS_PRESETS = [30, 60, 90, 120, 180].map((s) => ({ label: formatSeconds(s), value: s }));
const DURATION_PRESETS = [300, 600, 900, 1200, 1800].map((s) => ({ label: formatSeconds(s), value: s }));
const INTERVAL_PRESETS = [30, 45, 60, 90, 120].map((s) => ({ label: formatSeconds(s), value: s }));

function formatSeconds(s: number): string {
  if (s === 0) return "0s";
  if (s % 60 === 0) return `${s / 60}min`;
  return `${s}s`;
}

export type CircuitSettingsPatch = Partial<{
  custom_name: string | null;
  notes: string | null;
  goal: string | null;
  completion_method: CompletionMethod | null;
  rest_between_exercises_seconds: number | null;
  rest_between_rounds_seconds: number | null;
  duration_seconds: number | null;
  interval_seconds: number | null;
  rounds: number;
}>;

interface CircuitBlockCardProps {
  block: BlockRow;
  expandedExerciseId: string | null;
  onToggleExpand: (exerciseId: string) => void;
  mode: Exclude<BuilderMode, "preview">;
  library: ExerciseSearchResult[];
  onCreateCustomExercise: (name: string, category: ExerciseCategory) => void;
  librarySearch?: (query: string, category: ExerciseCategory) => Promise<ExerciseSearchResult[]>;
  onCreateInLibrary?: (name: string, category: ExerciseCategory) => Promise<{ id: string; name: string } | null>;
  onDeleteBlock: () => void;
  onAddExerciseToBlock: () => void;
  isAddingExercise: boolean;
  onRemoveExerciseFromBlock: (blockExerciseId: string) => void;
  onDuplicateExercise: (blockExerciseId: string) => void;
  otherDays: { id: string; label: string | null; position: number }[];
  onMoveExerciseToDay: (blockExerciseId: string, targetDayId: string) => void;
  movingExerciseId: string | null;
  onSettingsChange: (patch: CircuitSettingsPatch) => void;
  onExerciseChange: (blockExerciseId: string, patch: { exercise_id: string | null; custom_name: string | null }) => void;
  onNoteChange: (blockExerciseId: string, notes: string | null) => void;
  onCategoryChange: (blockExerciseId: string, category: ExerciseCategory) => void;
  onTestMaxBeforeChange: (blockExerciseId: string, testMaxBefore: boolean) => void;
  knownMaxByExerciseId: Map<string, { valueKg: number; performedOn: string }>;
  onSaveKnownMax: (exerciseId: string, valueKg: number) => void;
  onPrescriptionTypeChange: (blockExerciseId: string, prescriptionType: PrescriptionType) => void;
  onAddSet: (blockExerciseId: string) => void;
  onSetChange: (blockExerciseId: string, setId: string, patch: Partial<SetRow>) => void;
  onDeleteSet: (blockExerciseId: string, setId: string) => void;
  onReorderSets: (blockExerciseId: string, orderedSets: { id: string; position: number }[]) => void;
  onSaveAsTemplate: (blockExerciseId: string) => void;
}

/**
 * A `block_type: 'circuit'` block's own card — a real, separate component
 * from ExerciseBlockCard rather than a "circuit mode" flag bolted onto it,
 * per the redesign's own instruction not to just add a Circuit option to
 * the existing superset UI. Owns circuit-level settings (name, rounds,
 * rest, goal, completion method and its method-specific fields, coach
 * notes) that a plain superset never had anywhere to live, on top of the
 * same per-exercise editing ExerciseBlockCard already provides (each
 * exercise here still keeps its own independent category/prescription —
 * see this file's own doc comments on ExerciseCard for why that's a
 * per-exercise concern, not a circuit-level one).
 *
 * Starts expanded for a brand-new circuit (nothing to summarize yet) and
 * collapsed otherwise — the spec's "Collapsed Circuit Card" / "Expanded
 * Circuit" distinction. Collapse state is local, not threaded through
 * ProgramBuilder: which circuits happen to be open is view state, not data
 * that needs to survive a page reload or sync across other viewers.
 */
export function CircuitBlockCard({
  block,
  expandedExerciseId,
  onToggleExpand,
  mode,
  library,
  onCreateCustomExercise,
  librarySearch,
  onCreateInLibrary,
  onDeleteBlock,
  onAddExerciseToBlock,
  isAddingExercise,
  onRemoveExerciseFromBlock,
  onDuplicateExercise,
  otherDays,
  onMoveExerciseToDay,
  movingExerciseId,
  onSettingsChange,
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
  onSaveAsTemplate,
}: CircuitBlockCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const [expanded, setExpanded] = useState(block.exercises.length === 0);
  const [name, setName] = useState(block.custom_name ?? "");

  const method = block.completion_method ?? defaultCompletionMethod();
  const methodDef = getCompletionMethodDef(method);
  const isGrouped = block.exercises.length > 1;

  const roundsSummary = isFieldRelevant(method, "rounds") ? `${block.rounds} round${block.rounds === 1 ? "" : "s"}` : null;
  const restSummary =
    isFieldRelevant(method, "rest_between_rounds") && block.rest_between_rounds_seconds != null
      ? `${formatSeconds(block.rest_between_rounds_seconds)} rest between rounds`
      : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-primary/30 bg-surface p-2.5",
        isDragging && "z-10 opacity-60 shadow-lg"
      )}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="flex h-11 w-11 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground active:cursor-grabbing lg:h-7 lg:w-7"
        >
          <GripVertical className="size-4" />
        </button>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-1 text-left transition-colors hover:bg-surface-hover"
        >
          <RotateCw className="size-3.5 shrink-0 text-primary" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
              {block.custom_name || "Circuit"}
              {block.notes && <StickyNote aria-label="Has a coach note" className="size-3.5 shrink-0 text-primary" />}
            </span>
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
              <span>
                {block.exercises.length} exercise{block.exercises.length === 1 ? "" : "s"}
              </span>
              {roundsSummary && <span>· {roundsSummary}</span>}
              {restSummary && <span>· {restSummary}</span>}
              {methodDef && <span>· {methodDef.label}</span>}
            </span>
          </div>
          <ChevronRight aria-hidden="true" className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")} />
        </button>

        <button
          type="button"
          onClick={onDeleteBlock}
          aria-label="Delete whole circuit"
          title="Delete whole circuit"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:h-7 lg:w-7"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Circuit name</span>
            <InlineTextField
              label="Circuit name"
              value={name || null}
              onCommit={(v) => {
                setName(v ?? "");
                onSettingsChange({ custom_name: v });
              }}
              placeholder="e.g. Upper Body Circuit"
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Completion method</span>
            <CompletionMethodPicker value={method} onChange={(m) => onSettingsChange({ completion_method: m })} />
          </div>

          <div className="flex flex-wrap items-start gap-4">
            {isFieldRelevant(method, "rounds") && (
              <PresetChipField
                fieldLabel="Rounds"
                unit="rounds"
                presets={ROUNDS_PRESETS}
                value={block.rounds}
                onCommit={(v) => onSettingsChange({ rounds: Math.max(1, v ?? 1) })}
                min={1}
              />
            )}
            {isFieldRelevant(method, "rest_between_exercises") && (
              <PresetChipField
                fieldLabel="Rest between exercises"
                unit="sec"
                presets={REST_BETWEEN_EXERCISES_PRESETS}
                value={block.rest_between_exercises_seconds}
                onCommit={(v) => onSettingsChange({ rest_between_exercises_seconds: v })}
              />
            )}
            {isFieldRelevant(method, "rest_between_rounds") && (
              <PresetChipField
                fieldLabel="Rest between rounds"
                unit="sec"
                presets={REST_BETWEEN_ROUNDS_PRESETS}
                value={block.rest_between_rounds_seconds}
                onCommit={(v) => onSettingsChange({ rest_between_rounds_seconds: v })}
              />
            )}
            {isFieldRelevant(method, "duration") && (
              <PresetChipField
                fieldLabel="Duration"
                unit="sec"
                presets={DURATION_PRESETS}
                value={block.duration_seconds}
                onCommit={(v) => onSettingsChange({ duration_seconds: v })}
              />
            )}
            {isFieldRelevant(method, "interval") && (
              <PresetChipField
                fieldLabel="Interval"
                unit="sec"
                presets={INTERVAL_PRESETS}
                value={block.interval_seconds}
                onCommit={(v) => onSettingsChange({ interval_seconds: v })}
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Circuit goal</span>
            <InlineTextField
              label="Circuit goal"
              value={block.goal}
              onCommit={(v) => onSettingsChange({ goal: v })}
              placeholder="e.g. Conditioning, Strength, Mobility…"
              className="w-full"
            />
          </div>

          <CoachNoteField value={block.notes} onCommit={(v) => onSettingsChange({ notes: v })} placeholder="e.g. Move continuously, minimal rest." />
        </div>
      )}

      {expanded && (
        <div className="flex flex-col gap-1.5">
          {block.exercises.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              isGrouped={isGrouped}
              groupLabel="Circuit"
              expanded={expandedExerciseId === exercise.id}
              onToggleExpand={() => onToggleExpand(exercise.id)}
              mode={mode}
              library={library}
              onCreateCustomExercise={onCreateCustomExercise}
              librarySearch={librarySearch}
              onCreateInLibrary={onCreateInLibrary}
              onExerciseChange={(patch) => onExerciseChange(exercise.id, patch)}
              onNoteChange={(notes) => onNoteChange(exercise.id, notes)}
              onCategoryChange={(category) => onCategoryChange(exercise.id, category)}
              onTestMaxBeforeChange={(testMaxBefore) => onTestMaxBeforeChange(exercise.id, testMaxBefore)}
              knownMax={exercise.exercise_id ? (knownMaxByExerciseId.get(exercise.exercise_id) ?? null) : null}
              onSaveKnownMax={(valueKg) => onSaveKnownMax(exercise.exercise_id!, valueKg)}
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

          <button
            type="button"
            onClick={onAddExerciseToBlock}
            disabled={isAddingExercise}
            className="flex items-center gap-1 self-start rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className={cn("size-3.5", isAddingExercise && "animate-spin")} />
            {isAddingExercise ? "Adding…" : "Add exercise"}
          </button>
        </div>
      )}
    </div>
  );
}
