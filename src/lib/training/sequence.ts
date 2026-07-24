import type { BlockExerciseRow, BlockRow, SetPrescription } from "@/lib/programs/types";
import type { ExerciseStep } from "@/lib/training/types";

/**
 * How many turns (rest-separated stops at this exercise) it contributes to
 * the sequence. Strength exercises get one turn per prescribed set, so a
 * superset partner interleaves set-by-set rather than all at once.
 * Running/cardio exercises always contribute exactly one turn, since
 * they're logged as a single summary form rather than per-set (see
 * ExerciseScreen's category branch) — unaffected by this change.
 */
function turnCount(exercise: BlockExerciseRow): number {
  if (exercise.exercise_category !== "strength") return 1;
  return Math.max(1, buildSetTargets(exercise.sets).length);
}

/**
 * Flattens a day's blocks into the linear, one-at-a-time sequence Training
 * Mode walks through — the spec's "only display one exercise at a time...
 * never need to scroll through the entire workout." Straight blocks (a
 * single exercise, the overwhelming common case) just run that exercise's
 * turns back to back. Grouped blocks (superset/circuit, 2+ exercises)
 * round-robin instead: A1, B1, A2, B2... rather than finishing A entirely
 * before starting B — matches how a superset is actually performed. An
 * exercise with fewer turns than a partner's (e.g. 3 straight sets paired
 * with a single cardio finisher) simply drops out of later rounds once its
 * own turns are used up, rather than blocking the round from advancing.
 */
export function buildExerciseSequence(blocks: BlockRow[]): ExerciseStep[] {
  const steps: ExerciseStep[] = [];
  const sortedBlocks = [...blocks].sort((a, b) => a.position - b.position);

  for (const block of sortedBlocks) {
    const sortedExercises = [...block.exercises].sort((a, b) => a.position - b.position);
    if (sortedExercises.length === 0) continue;

    const turnsByExercise = sortedExercises.map((ex) => turnCount(ex));

    if (sortedExercises.length === 1) {
      // Straight block — no round-robin needed, just this exercise's turns.
      const blockExercise = sortedExercises[0]!;
      for (let round = 0; round < turnsByExercise[0]!; round++) {
        steps.push({
          blockExercise,
          blockId: block.id,
          blockType: block.block_type,
          blockRounds: block.rounds,
          stepIndex: steps.length,
          roundNumber: round,
        });
      }
      continue;
    }

    const maxRounds = Math.max(1, ...turnsByExercise);
    for (let round = 0; round < maxRounds; round++) {
      sortedExercises.forEach((blockExercise, i) => {
        if (round < turnsByExercise[i]!) {
          steps.push({
            blockExercise,
            blockId: block.id,
            blockType: block.block_type,
            blockRounds: block.rounds,
            stepIndex: steps.length,
            roundNumber: round,
          });
        }
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
 * Resume position: the first step whose exercise hasn't logged enough sets
 * to cover every turn of that exercise seen so far in the sequence.
 * Cardio/running steps that use a single summary form rather than per-set
 * logging still fit this — their prescription's `sets` is 1 (or the
 * interval count), and one draft set is logged per "Finish Exercise" tap.
 *
 * A superset exercise now appears as multiple steps (one per turn — see
 * buildExerciseSequence), so this can't just compare against the
 * exercise's total prescribed set count at its first occurrence the way a
 * one-step-per-exercise sequence could: that would send the athlete back
 * to an exercise's very first turn even after they'd already interleaved
 * partway through its later turns with a partner exercise. Tracking how
 * many of THIS exercise's turns have been seen up to and including the
 * current step, and comparing that running count against what's actually
 * logged, correctly finds the next not-yet-done turn regardless of how the
 * sequence interleaves other exercises in between.
 *
 * Returns null when every step is already fully logged (draft's done, just
 * hasn't been finished yet — lands the athlete straight on the summary).
 */
export function findResumeStepIndex(steps: ExerciseStep[], draftSetCountByExercise: Map<string, number>): number | null {
  const turnsSeen = new Map<string, number>();
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const exerciseId = step.blockExercise.id;
    const seen = (turnsSeen.get(exerciseId) ?? 0) + 1;
    turnsSeen.set(exerciseId, seen);
    const logged = draftSetCountByExercise.get(exerciseId) ?? 0;
    if (logged < seen) return i;
  }
  return null;
}
