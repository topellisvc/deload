import type { ReactNode } from "react";
import { Flame, Moon, MessageSquareText, PersonStanding, RotateCw, Sunrise } from "lucide-react";
import { getExerciseDisplayName } from "@/lib/programs/exercise-catalog";
import { EXERCISE_CATEGORY_LABELS } from "@/lib/programs/prescription-types";
import { getCompletionMethodDef } from "@/lib/programs/completion-methods";
import { SetDetails } from "@/components/programs/set-details";
import { WorkoutSummaryBar } from "@/components/programs/workout-summary-bar";
import type { BlockExerciseRow, BlockRow, DayRow } from "@/lib/programs/types";

interface AthletePreviewDayProps {
  day: DayRow;
}

/**
 * Read-only "exactly what the athlete will see" view — not an editing
 * surface at all (spec: "It exists purely so coaches can quickly verify
 * the workout before publishing"). Deliberately reuses SetDetails
 * (set-details.tsx) rather than reimplementing prescription formatting:
 * that's the exact same component Training Mode's ExerciseScreen already
 * renders per set row, so whatever a coach sees here is guaranteed to
 * match what the athlete actually gets, not a parallel formatter that
 * could quietly drift from it.
 *
 * Shows every exercise in the day at once (flattened block-then-position
 * order, the same order lib/training/sequence.ts's buildExerciseList
 * walks) rather than stepping through one at a time the way live Training
 * Mode does — a coach verifying a day wants to see the whole thing, not
 * click through it exercise by exercise.
 *
 * Warm-up and Conditioning/Finisher (migration 0032's block_role) render
 * as their own visually separate sections, matching the spec's Athlete
 * Preview requirements exactly — and matching what the Program Builder
 * itself shows (day-column.tsx's BlockSection), so a coach previewing a
 * day sees the same section boundaries they just built. The main
 * workout keeps its "Exercise X of Y" numbering scoped to just the main
 * section; warm-up/conditioning exercises aren't part of that count.
 */
export function AthletePreviewDay({ day }: AthletePreviewDayProps) {
  if (day.is_rest_day) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-8 text-center">
        <Moon className="size-6 text-primary" />
        <p className="text-sm font-medium text-foreground">Rest day</p>
        <p className="text-xs text-muted-foreground">No training scheduled — this is what the athlete sees too.</p>
      </div>
    );
  }

  const warmupBlocks = day.blocks.filter((b) => b.block_role === "warmup");
  const mainBlocks = day.blocks.filter((b) => b.block_role === "main");
  const conditioningBlocks = day.blocks.filter((b) => b.block_role === "conditioning");

  if (day.blocks.length === 0) {
    return <p className="rounded-2xl border border-dashed border-border-strong p-8 text-center text-sm text-muted-foreground">Nothing added to this day yet.</p>;
  }

  const warmupItems = previewItemsForBlocks(warmupBlocks);
  const { items: mainItems, exerciseCount: mainExerciseCount } = numberedPreviewItemsForBlocks(mainBlocks);
  const conditioningItems = previewItemsForBlocks(conditioningBlocks);

  return (
    <div className="flex flex-col gap-3">
      {warmupItems.length > 0 && (
        <PreviewSection label="Warm-up" icon={<Sunrise className="size-3.5" />}>
          {warmupItems.map((item) => renderPreviewItem(item))}
        </PreviewSection>
      )}

      <WorkoutSummaryBar blocks={mainBlocks} />
      {mainItems.map((item) => renderPreviewItem(item, mainExerciseCount))}

      {conditioningItems.length > 0 && (
        <PreviewSection label="Conditioning / Finisher" icon={<Flame className="size-3.5" />}>
          {conditioningItems.map((item) => renderPreviewItem(item))}
        </PreviewSection>
      )}
    </div>
  );
}

/** Either a standalone exercise (single/superset block) or a whole circuit,
 * in the day's real block order — a circuit's exercises are never flattened
 * out into this section's plain exercise list the way single/superset
 * blocks' exercises are, since a circuit is a single structural unit to the
 * athlete (see CircuitPreviewCard), not N separate numbered exercises. */
type PreviewItem = { kind: "exercise"; exercise: BlockExerciseRow; index?: number } | { kind: "circuit"; block: BlockRow };

function previewItemsForBlocks(blocks: BlockRow[]): PreviewItem[] {
  const items: PreviewItem[] = [];
  for (const block of [...blocks].sort((a, b) => a.position - b.position)) {
    if (block.block_type === "circuit") {
      items.push({ kind: "circuit", block });
      continue;
    }
    for (const exercise of [...block.exercises].sort((a, b) => a.position - b.position)) {
      items.push({ kind: "exercise", exercise });
    }
  }
  return items;
}

/** Same walk as previewItemsForBlocks, but also assigns each standalone
 * exercise its 0-based position in the "Exercise X of Y" count — a circuit
 * block doesn't consume a number itself (it's shown as its own card, see
 * renderPreviewItem) and its own exercises aren't numbered against the rest
 * of the day's exercises either, matching how warm-up/conditioning
 * exercises already sit outside this count entirely. */
function numberedPreviewItemsForBlocks(blocks: BlockRow[]): { items: PreviewItem[]; exerciseCount: number } {
  const items: PreviewItem[] = [];
  let index = 0;
  for (const block of [...blocks].sort((a, b) => a.position - b.position)) {
    if (block.block_type === "circuit") {
      items.push({ kind: "circuit", block });
      continue;
    }
    for (const exercise of [...block.exercises].sort((a, b) => a.position - b.position)) {
      items.push({ kind: "exercise", exercise, index: index });
      index++;
    }
  }
  return { items, exerciseCount: index };
}

function renderPreviewItem(item: PreviewItem, total?: number): ReactNode {
  if (item.kind === "circuit") return <CircuitPreviewCard key={item.block.id} block={item.block} />;
  return <ExercisePreviewCard key={item.exercise.id} exercise={item.exercise} index={item.index} total={item.index !== undefined ? total : undefined} />;
}

function PreviewSection({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

function ExercisePreviewCard({ exercise, index, total }: { exercise: BlockExerciseRow; index?: number; total?: number }) {
  const category = exercise.exercise_category;
  const name = getExerciseDisplayName(exercise);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      {index !== undefined && total !== undefined && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Exercise {index + 1} of {total}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-foreground">{name}</h3>
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {category !== "strength" && <PersonStanding className="size-3.5" />}
          {EXERCISE_CATEGORY_LABELS[category]}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-background p-3">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Prescription</span>
        <ul className="flex flex-col gap-1">
          {exercise.sets.map((set) => (
            <li key={set.id}>
              <SetDetails set={set} category={category} />
            </li>
          ))}
        </ul>
      </div>

      {exercise.notes && (
        <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <MessageSquareText className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-sm italic text-foreground">{exercise.notes}</p>
        </div>
      )}
    </div>
  );
}

function formatSeconds(s: number): string {
  if (s === 0) return "0s";
  if (s % 60 === 0) return `${s / 60}min`;
  return `${s}s`;
}

/**
 * A `block_type: 'circuit'` block's own read-only preview — the spec's
 * "round-by-round structure": a "Round 1 of N" header (one pass through is
 * enough to show the athlete what repeats; this isn't a full N-times
 * simulation), the exercise list they work through each round, then the
 * circuit's own rest — reusing SetDetails per exercise exactly like
 * ExercisePreviewCard, so a circuit's prescriptions read identically to any
 * other exercise's. Sits outside the main section's "Exercise X of Y" count
 * (see numberedPreviewItemsForBlocks) since the whole circuit is one
 * structural unit, not N separately-numbered exercises.
 */
function CircuitPreviewCard({ block }: { block: BlockRow }) {
  const methodDef = block.completion_method ? getCompletionMethodDef(block.completion_method) : undefined;
  const exercises = [...block.exercises].sort((a, b) => a.position - b.position);

  const restParts: string[] = [];
  if (block.rest_between_exercises_seconds != null) restParts.push(`${formatSeconds(block.rest_between_exercises_seconds)} between exercises`);
  if (block.rest_between_rounds_seconds != null) restParts.push(`${formatSeconds(block.rest_between_rounds_seconds)} between rounds`);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-surface p-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <RotateCw className="size-4 text-primary" />
          <h3 className="text-base font-semibold text-foreground">{block.custom_name || "Circuit"}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Round 1 of {block.rounds}</span>
          {methodDef && <span>· {methodDef.label}</span>}
          {block.goal && <span>· {block.goal}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {exercises.map((exercise) => {
          const category = exercise.exercise_category;
          return (
            <div key={exercise.id} className="flex flex-col gap-1.5 rounded-xl border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{getExerciseDisplayName(exercise)}</span>
                <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {category !== "strength" && <PersonStanding className="size-3" />}
                  {EXERCISE_CATEGORY_LABELS[category]}
                </span>
              </div>
              <ul className="flex flex-col gap-1">
                {exercise.sets.map((set) => (
                  <li key={set.id}>
                    <SetDetails set={set} category={category} />
                  </li>
                ))}
              </ul>
              {exercise.notes && <p className="text-xs italic text-muted-foreground">{exercise.notes}</p>}
            </div>
          );
        })}
      </div>

      {restParts.length > 0 && <p className="text-xs text-muted-foreground">Rest: {restParts.join(", ")}</p>}

      {block.notes && (
        <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <MessageSquareText className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-sm italic text-foreground">{block.notes}</p>
        </div>
      )}
    </div>
  );
}
