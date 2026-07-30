/**
 * Estimated 1RM from a logged (load, reps, RIR), and its inverse.
 *
 * This is the mechanism that lets the generator autoregulate without ever
 * asking a user for a max. From the coach interview (see
 * deload-program-generator-coach-answers.md, Appendix A): the athlete's
 * reported load-at-effort yields an estimated 1RM every single week for free,
 * so next week's prescription is derived from the most recent *actual*
 * performance rather than a number typed in at signup. That removes the "no
 * known 1RM" problem entirely, and it's why §4's answer to "how do you
 * prescribe intensity with no 1RM and no history" is never "test one" —
 * §14's mistake list ranks "prescribing %1RM to people who have no 1RM, or
 * asking a novice to test one" fourth-worst of all the things generated
 * programs do.
 *
 * Consumed by the intermediate top-set-plus-backoff wave (§2), the
 * powerlifting peak's weekly load selection and opener recommendation (§5),
 * and the runtime RIR gate (§2 Rule 1).
 *
 * Deliberately pure and dependency-free: no database, no Supabase types, no
 * clock. Everything here is a total function of its arguments, which is what
 * makes the whole "keep AI off the critical path" position defensible — these
 * are the numbers that decide how heavy someone lifts, so they're a table and
 * a division, unit-tested, not a model's opinion.
 */

/**
 * Appendix A: percentage of 1RM for a given (reps, RIR) combination.
 *
 * Rows are the reps *performed*; columns are reps left in reserve (0-4).
 * Rows 7, 9 and 11 are absent from the source table and are interpolated —
 * see percentOf1RM.
 *
 * A note on why this is stored as the literal table rather than something
 * tidier. The values look like they should collapse into a single curve
 * indexed by "total reps to failure" (reps + RIR) — pct(5 reps, 2 RIR) and
 * pct(7 reps, 0 RIR) ought to be the same lift. That mostly holds, but it
 * breaks down exactly where the coach warns the estimate gets soft: checked
 * against a linear interpolation of the RIR-0 column, most cells agree within
 * 0.5 points, but (8 reps, 4 RIR) and (10 reps, 2 RIR) are 3 full points
 * below it. The table drops faster at high rep counts than a single curve
 * would, which is the coach's own caveat ("above ~8 reps the estimate is
 * soft; above 12 it's nearly meaningless") showing up in the numbers.
 * Deriving a curve would quietly overwrite that with a cleaner shape than the
 * source actually supports, so the table stays literal.
 */
const PERCENT_BY_REPS_AND_RIR: Readonly<Record<number, readonly number[]>> = {
  //      RIR 0  1   2   3   4
  1: [100, 96, 92, 89, 86],
  2: [96, 92, 89, 86, 84],
  3: [92, 89, 86, 84, 81],
  4: [89, 86, 84, 81, 79],
  5: [86, 84, 81, 79, 76],
  6: [84, 81, 79, 76, 74],
  8: [79, 76, 74, 71, 68],
  10: [74, 71, 68, 65, 63],
  12: [71, 68, 65, 63, 60],
};

const TABLE_REPS = Object.keys(PERCENT_BY_REPS_AND_RIR)
  .map(Number)
  .sort((a, b) => a - b);

/** §8's counting rule: "Count only sets taken within ~0-4 reps of failure. A
 * set at 6 RIR is a warm-up." The table stops at 4 for the same reason — past
 * that the set isn't a countable hard set and shouldn't be feeding load
 * decisions either. */
export const MAX_COUNTABLE_RIR = 4;

/** The table's own upper bound. Usable for progression logic up here, but not
 * for an absolute 1RM prediction — see MAX_E1RM_REPS. */
export const MAX_TABLE_REPS = 12;

/** Appendix A's explicit instruction: "Don't compute e1RM from sets over 10
 * reps." The table extends to 12 because the *percentages* remain useful for
 * choosing a load, but a 1RM inferred from a set of 12 is not a number
 * anything should act on. estimate1RM enforces this; percentOf1RM does not. */
export const MAX_E1RM_REPS = 10;

/** Appendix A's default smoothing window for an inexperienced athlete. */
export const NOVICE_SMOOTHING_SESSIONS = 3;

/** RPE = 10 - RIR (Appendix A's last caveat), for the places that speak the
 * other scale. Note the app deliberately *asks* novices for RIR rather than
 * RPE (§4 point 4) — this converts between scales, it does not make a
 * novice's self-reported RPE trustworthy. */
export function rpeFromRir(rir: number): number {
  return 10 - rir;
}

export function rirFromRpe(rpe: number): number {
  return 10 - rpe;
}

/** True when a set was hard enough to count toward §8's weekly per-muscle
 * volume total. Anything at 5+ RIR is a warm-up and contributes nothing. */
export function isCountableHardSet(rir: number): boolean {
  return Number.isFinite(rir) && rir >= 0 && rir <= MAX_COUNTABLE_RIR;
}

/**
 * Percentage of 1RM (as a number out of 100) for a set of `reps` at `rir`
 * reps in reserve, or null if the combination is outside the table.
 *
 * Reps 7, 9 and 11 are linearly interpolated between their neighbouring rows.
 * The source table simply skips them (it goes 6, 8, 10, 12), and refusing to
 * answer for a set of 7 would be a worse failure than interpolating: 7 is a
 * perfectly ordinary set, and the neighbouring rows bracket it within about
 * 2.5 percentage points.
 *
 * Non-integer reps are rejected rather than rounded — a caller passing 5.5
 * has a bug, and silently treating it as 5 or 6 would hide it.
 */
export function percentOf1RM(reps: number, rir: number): number | null {
  if (!Number.isInteger(reps) || !Number.isInteger(rir)) return null;
  if (reps < 1 || reps > MAX_TABLE_REPS) return null;
  if (rir < 0 || rir > MAX_COUNTABLE_RIR) return null;

  const exact = PERCENT_BY_REPS_AND_RIR[reps];
  if (exact) return exact[rir]!;

  // reps is one of 7, 9, 11 — bracket it and interpolate.
  const lower = TABLE_REPS.filter((r) => r < reps).pop();
  const upper = TABLE_REPS.find((r) => r > reps);
  if (lower === undefined || upper === undefined) return null;

  const lowerPct = PERCENT_BY_REPS_AND_RIR[lower]![rir]!;
  const upperPct = PERCENT_BY_REPS_AND_RIR[upper]![rir]!;
  const ratio = (reps - lower) / (upper - lower);
  return round1(lowerPct + (upperPct - lowerPct) * ratio);
}

export interface LoggedEffort {
  loadKg: number;
  reps: number;
  /** Reps in reserve, as reported. The app asks "how many more reps could you
   * have done?" with 0/1/2/3+ buttons rather than asking for an RPE number —
   * §4 point 4 is emphatic that the 6-10 RPE scale requires experience of a
   * true limit and that novices systematically mis-rate it in both
   * directions. */
  rir: number;
}

/**
 * e1RM = load / (table value for that reps/RIR combination).
 *
 * Appendix A's worked example: 80 kg x 5 with "1 more rep" -> RIR 1 -> 84% ->
 * e1RM ~= 95 kg. Verified in the tests.
 *
 * Returns null rather than a number when the estimate would not be
 * trustworthy, which is the whole point of having this as a function instead
 * of an inline division:
 *
 * - over MAX_E1RM_REPS reps (Appendix A says don't)
 * - RIR outside 0-4 (not a countable hard set)
 * - a non-positive or non-finite load
 *
 * A null here means "don't act on this data point," and callers must handle
 * it by holding the current prescription rather than substituting a guess.
 */
export function estimate1RM(effort: LoggedEffort): number | null {
  const { loadKg, reps, rir } = effort;
  if (!Number.isFinite(loadKg) || loadKg <= 0) return null;
  if (!Number.isInteger(reps) || reps > MAX_E1RM_REPS) return null;

  const percent = percentOf1RM(reps, rir);
  if (percent === null || percent <= 0) return null;

  return round1(loadKg / (percent / 100));
}

/**
 * The inverse: the load to prescribe for a target of `reps` at `rir`, given an
 * e1RM. This is what turns last week's performance into this week's number.
 *
 * Appendix A's continuation of the worked example: from e1RM 95 kg, a target
 * of 5 reps at RIR 0 -> 86% -> 82 kg.
 *
 * Deliberately not rounded to a plate increment here — the increment depends
 * on the lift and the equipment (§2's table gives +5 kg for squat/deadlift
 * groups against +2.5 kg for bench/OHP/row, and fixed-pin machines move a pin
 * at a time). Callers round with roundToIncrement once they know which.
 */
export function loadForTarget(params: { e1rmKg: number; reps: number; rir: number }): number | null {
  const { e1rmKg, reps, rir } = params;
  if (!Number.isFinite(e1rmKg) || e1rmKg <= 0) return null;

  const percent = percentOf1RM(reps, rir);
  if (percent === null) return null;

  return round1(e1rmKg * (percent / 100));
}

/**
 * Smoothed e1RM over the most recent `window` estimates, newest first.
 *
 * Appendix A: "Novices' RIR reports are unreliable; smooth the estimate over 3
 * sessions rather than reacting to a single data point." Without this, one
 * badly-judged "no reps left" on a set that was actually RIR 3 drags the
 * following week's prescription up by ~8% for every lift derived from it.
 *
 * Fewer than `window` estimates available is not an error — it averages what
 * there is, which is the correct behaviour in the first fortnight of a program
 * when there simply isn't more history. Returns null only for an empty list.
 */
export function smoothedE1RM(estimatesNewestFirst: readonly number[], window: number = NOVICE_SMOOTHING_SESSIONS): number | null {
  const usable = estimatesNewestFirst.filter((value) => Number.isFinite(value) && value > 0).slice(0, Math.max(1, window));
  if (usable.length === 0) return null;
  return round1(usable.reduce((sum, value) => sum + value, 0) / usable.length);
}

/**
 * Rounds a computed load down to something loadable.
 *
 * Down, not nearest, on purpose: §14 point 2 says generated programs
 * universally over-prescribe at the start, and rounding a 81.3 kg target up to
 * 82.5 kg costs an athlete reps at the top of a set for no benefit. The
 * asymmetry is real — slightly too light is a rep you didn't need, slightly
 * too heavy is a missed set that Rule 1 then reads as a failed progression.
 */
export function roundToIncrement(loadKg: number, incrementKg: number): number {
  if (!Number.isFinite(loadKg) || !Number.isFinite(incrementKg) || incrementKg <= 0) return round2(loadKg);
  // The epsilon guards the exact-multiple case: an increment-sized step
  // computed in floating point can land a hair under a whole number (a load
  // that *is* 65 steps dividing to 64.9999...), and flooring that would
  // silently drop a whole increment.
  const steps = Math.floor(loadKg / incrementKg + 1e-9);
  return round2(steps * incrementKg);
}

/** Matches suggestedWeightFromPercent1RM's convention in
 * lib/programs/prescription-types.ts — one decimal, the granularity athletes
 * actually load with 0.5 kg microplates. Used for e1RM and for a raw computed
 * target, both of which are intermediate values a caller then rounds to a real
 * increment. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Two decimals, used only by roundToIncrement.
 *
 * One decimal is wrong there and it took a failing test to notice: §2's
 * increment table prescribes +1.25 kg for the bench/OHP/row group after the
 * first 4-6 weeks, and rounding to one decimal turns a correctly-computed
 * 81.25 kg into 81.3 kg — a weight no plate combination produces. Same for
 * 61.25, 123.75, and every other odd multiple of 1.25. roundToIncrement's
 * whole job is returning something loadable, so it must not round away the
 * increment it was just asked to respect. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
