import type { ReactNode } from "react";
import { Flame, Moon, MessageSquareText, PersonStanding, Sunrise } from "lucide-react";
import { getExerciseDisplayName } from "@/lib/programs/exercise-catalog";
import { EXERCISE_CATEGORY_LABELS } from "@/lib/programs/prescription-types";
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

  const warmupExercises = flattenExercises(warmupBlocks);
  const mainExercises = flattenExercises(mainBlocks);
  const conditioningExercises = flattenExercises(conditioningBlocks);

  if (warmupExercises.length === 0 && mainExercises.length === 0 && conditioningExercises.length === 0) {
    return <p className="rounded-2xl border border-dashed border-border-strong p-8 text-center text-sm text-muted-foreground">Nothing added to this day yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {warmupExercises.length > 0 && (
        <PreviewSection label="Warm-up" icon={<Sunrise className="size-3.5" />}>
          {warmupExercises.map((exercise) => (
            <ExercisePreviewCard key={exercise.id} exercise={exercise} />
          ))}
        </PreviewSection>
      )}

      <WorkoutSummaryBar blocks={mainBlocks} />
      {mainExercises.map((exercise, i) => (
        <ExercisePreviewCard key={exercise.id} exercise={exercise} index={i} total={mainExercises.length} />
      ))}

      {conditioningExercises.length > 0 && (
        <PreviewSection label="Conditioning / Finisher" icon={<Flame className="size-3.5" />}>
          {conditioningExercises.map((exercise) => (
            <ExercisePreviewCard key={exercise.id} exercise={exercise} />
          ))}
        </PreviewSection>
      )}
    </div>
  );
}

function flattenExercises(blocks: BlockRow[]): BlockExerciseRow[] {
  return [...blocks].sort((a, b) => a.position - b.position).flatMap((block) => [...block.exercises].sort((a, b) => a.position - b.position));
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
