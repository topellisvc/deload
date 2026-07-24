import type { BlockRow, SetPrescription } from "@/lib/programs/types";
import type { ExerciseStep } from "@/lib/training/types";

/**
 * Flattens a day's blocks into the linear, one-at-a-time sequence Training
 * Mode walks through — the spec's "only display one exercise at a time...
 * never need to scroll through the entire workout." Straight blocks (the
 * overwhelming common case) map 1:1 onto a single step. Superset/circuit
 * blocks currently flatten to "exercise A, then exercise B" rather than
 * interleaving rounds (A, B, A, B...) — a real simplification, but a
 * forward-compatible one: ExerciseStep already carries blockId/blockType/
 * blockRounds, so round-interleaving can be added later by changing how
 * this function walks a grouped block without touching anything that
 * consumes ExerciseStep.
 */
export function buildExerciseSequence(blocks: BlockRow[]): ExerciseStep[] {
  const steps: ExerciseStep[] = [];
  const sortedBlocks = [...blocks].sort((a, b) => a.position - b.position);

  for (const block of sortedBlocks) {
    const sortedExercises = [...block.exercises].sort((a, b) => a.position - b.position);
    for (const blockExercise of sortedExercises) {
      steps.push({
        blockExercise,
        blockId: block.id,
        blockType: block.block_type,
        blockRounds: block.rounds,
        stepIndex: steps.length,
      });
    }
  }

  return steps;
}

/**
 * Flattens an exercise's set_prescriptions rows into one entry per actual
 * set, in the order the athlete performs them — a plain straight set
 * (single row, `sets: 4`) becomes 4 entries all pointing at that row; a
 * drop set (schema: "multiple rows in position order, one per drop, each
 * with sets=1") becomes one entry per row, each carrying its own row's
 * target. This is what lets the per-set stepper ("Set 2 of 4") and the
 * dropset case share the same walk without dropset-specific branching
 * anywhere else — see the "Future Proofing" spec section's drop-sets item.
 */
export function buildSetTargets(sets: SetPrescription[]): SetPrescription[] {
  const sorted = [...sets].sort((a, b) => a.position - b.position);
  const targets: SetPrescription[] = [];
  for (const set of sorted) {
    const count = Math.max(1, set.sets);
    for (let i = 0; i < count; i++) targets.push(set);
  }
  return targets;
}

/**
 * Resume position: the first step whose completed-set count (from
 * draftSets) hasn't yet reached its prescribed set count (buildSetTargets'
 * length). Cardio/running steps that use a single summary form rather than
 * per-set logging still fit this — their prescription's `sets` is 1 (or the
 * interval count), and one draft set is logged per "Finish Exercise" tap.
 *
 * Returns null when every step is already fully logged (draft's done, just
 * hasn't been finished yet — lands the athlete straight on the summary).
 */
export function findResumeStepIndex(steps: ExerciseStep[], draftSetCountByExercise: Map<string, number>): number | null {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const prescribedSets = Math.max(1, buildSetTargets(step.blockExercise.sets).length);
    const logged = draftSetCountByExercise.get(step.blockExercise.id) ?? 0;
    if (logged < prescribedSets) return i;
  }
  return null;
}
