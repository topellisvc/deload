import type { BlockExerciseRow, BlockRow, SetPrescription } from "@/lib/programs/types";

/**
 * Flat, ordered list of every distinct exercise in a day — block position
 * then exercise position order. This is what Training Mode's default
 * auto-advance and its exercise picker both walk.
 *
 * Superset/circuit blocks used to force a round-robin turn order (A1, B1,
 * A2, B2...) so partner exercises alternated set-by-set. That was dropped
 * after athlete feedback that real gym order is dictated by whatever
 * machine happens to be free, not the programmed order — forcing
 * alternation is actively incompatible with letting someone jump to any
 * exercise at will. Each exercise's sets are now always logged back-to-back
 * whenever the athlete is on it, in whatever order they choose to visit
 * exercises; a superset's two exercises simply sit next to each other in
 * this list, same as any other pair of exercises in a block.
 */
export function buildExerciseList(blocks: BlockRow[]): BlockExerciseRow[] {
  const sortedBlocks = [...blocks].sort((a, b) => a.position - b.position);
  const list: BlockExerciseRow[] = [];
  for (const block of sortedBlocks) {
    const sortedExercises = [...block.exercises].sort((a, b) => a.position - b.position);
    list.push(...sortedExercises);
  }
  return list;
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
 * First exercise in `list` that hasn't logged every prescribed set yet —
 * where a fresh workout starts, where a resumed one picks back up, and
 * where auto-advance lands after an exercise is finished (so someone who
 * free-navigated out of order still gets routed to whatever's actually
 * left, not just "the next one in the list"). Returns null once every
 * exercise is fully logged (or skipped) — draft's done, just hasn't been
 * finished yet.
 *
 * `skippedExerciseIds` excludes exercises the athlete explicitly chose not
 * to do today (see SkipExerciseDialog) from "what's incomplete" — a skip
 * is a deliberate decision to move on, not something that should keep
 * getting surfaced as the resume target.
 */
export function findResumeExerciseId(
  list: BlockExerciseRow[],
  loggedSetCountByExercise: Map<string, number>,
  skippedExerciseIds: ReadonlySet<string> = new Set()
): string | null {
  for (const exercise of list) {
    if (skippedExerciseIds.has(exercise.id)) continue;
    const targetCount = buildSetTargets(exercise.sets).length;
    const logged = loggedSetCountByExercise.get(exercise.id) ?? 0;
    if (logged < targetCount) return exercise.id;
  }
  return null;
}
