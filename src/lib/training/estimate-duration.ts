import type { BlockRow } from "@/lib/programs/types";

// Rough, clearly-labeled-as-approximate heuristic — there's no way to know
// how long a set actually takes an individual athlete, so this is only ever
// shown as "~N min" on the Overview screen, never relied on anywhere else.
const SECONDS_PER_STRENGTH_SET = 40;
const DEFAULT_STRENGTH_REST_SECONDS = 60;
const DEFAULT_CARDIO_REST_SECONDS = 30;
const DEFAULT_DURATION_SECONDS = 600; // used when a cardio/running row has no duration_seconds to go on (e.g. distance/calories-only)

/** Total estimated seconds for every prescribed set/segment across a day's
 * blocks — sum of (work time + rest) per set, using each set_prescription's
 * own rest_seconds where set, category defaults otherwise. */
export function estimateWorkoutDurationSeconds(blocks: BlockRow[]): number {
  let total = 0;
  for (const block of blocks) {
    for (const exercise of block.exercises) {
      for (const set of exercise.sets) {
        const count = Math.max(1, set.sets);
        if (exercise.exercise_category === "strength") {
          const rest = set.rest_seconds ?? DEFAULT_STRENGTH_REST_SECONDS;
          total += count * (SECONDS_PER_STRENGTH_SET + rest);
        } else {
          const rest = set.rest_seconds ?? DEFAULT_CARDIO_REST_SECONDS;
          const work = set.duration_seconds ?? DEFAULT_DURATION_SECONDS;
          total += count * (work + rest);
        }
      }
    }
  }
  return total;
}

/** "~32 min" / "~1h 15m" — the Overview screen's single duration line. */
export function formatEstimatedDuration(totalSeconds: number): string {
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `~${hours}h` : `~${hours}h ${remainder}m`;
}
