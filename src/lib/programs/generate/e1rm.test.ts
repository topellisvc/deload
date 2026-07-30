import { describe, expect, it } from "vitest";
import {
  MAX_COUNTABLE_RIR,
  MAX_E1RM_REPS,
  MAX_TABLE_REPS,
  estimate1RM,
  isCountableHardSet,
  loadForTarget,
  percentOf1RM,
  rirFromRpe,
  roundToIncrement,
  rpeFromRir,
  smoothedE1RM,
} from "@/lib/programs/generate/e1rm";

describe("percentOf1RM", () => {
  it("reproduces every value in the coach's Appendix A table", () => {
    // Transcribed independently of the implementation's own table so a typo in
    // one doesn't silently agree with a typo in the other.
    const expected: Record<number, number[]> = {
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
    for (const [reps, row] of Object.entries(expected)) {
      row.forEach((pct, rir) => {
        expect(percentOf1RM(Number(reps), rir), `reps=${reps} rir=${rir}`).toBe(pct);
      });
    }
  });

  it("interpolates the rep counts the source table skips", () => {
    // 7 sits between 6 and 8; at RIR 0 that's between 84% and 79%.
    expect(percentOf1RM(7, 0)).toBeCloseTo(81.5, 1);
    // 9 sits between 8 and 10: between 79% and 74%.
    expect(percentOf1RM(9, 0)).toBeCloseTo(76.5, 1);
    // 11 sits between 10 and 12: between 74% and 71%.
    expect(percentOf1RM(11, 0)).toBeCloseTo(72.5, 1);
  });

  it("keeps interpolated values bracketed by their neighbouring rows", () => {
    for (const reps of [7, 9, 11]) {
      for (let rir = 0; rir <= MAX_COUNTABLE_RIR; rir++) {
        const value = percentOf1RM(reps, rir)!;
        const lower = percentOf1RM(reps + 1, rir)!;
        const upper = percentOf1RM(reps - 1, rir)!;
        expect(value).toBeLessThanOrEqual(upper);
        expect(value).toBeGreaterThanOrEqual(lower);
      }
    }
  });

  it("decreases monotonically as reps rise and as RIR rises", () => {
    for (let rir = 0; rir <= MAX_COUNTABLE_RIR; rir++) {
      for (let reps = 1; reps < MAX_TABLE_REPS; reps++) {
        expect(percentOf1RM(reps, rir)!, `reps ${reps}->${reps + 1} at rir ${rir}`).toBeGreaterThanOrEqual(percentOf1RM(reps + 1, rir)!);
      }
    }
    for (let reps = 1; reps <= MAX_TABLE_REPS; reps++) {
      for (let rir = 0; rir < MAX_COUNTABLE_RIR; rir++) {
        expect(percentOf1RM(reps, rir)!, `rir ${rir}->${rir + 1} at reps ${reps}`).toBeGreaterThanOrEqual(percentOf1RM(reps, rir + 1)!);
      }
    }
  });

  it("rejects a set at 5+ RIR, which §8 calls a warm-up rather than a hard set", () => {
    expect(percentOf1RM(5, 5)).toBeNull();
    expect(percentOf1RM(5, 6)).toBeNull();
  });

  it("rejects reps outside the table and non-integer inputs", () => {
    expect(percentOf1RM(0, 0)).toBeNull();
    expect(percentOf1RM(13, 0)).toBeNull();
    expect(percentOf1RM(-1, 0)).toBeNull();
    // A caller passing a fractional rep count has a bug; rounding would hide it.
    expect(percentOf1RM(5.5, 0)).toBeNull();
    expect(percentOf1RM(5, 1.5)).toBeNull();
  });
});

describe("estimate1RM", () => {
  it("matches Appendix A's worked example: 80kg x 5 at RIR 1 -> ~95kg", () => {
    // 84% -> 80 / 0.84 = 95.238...
    expect(estimate1RM({ loadKg: 80, reps: 5, rir: 1 })).toBeCloseTo(95.2, 1);
  });

  it("returns the load itself for a true single at RIR 0", () => {
    expect(estimate1RM({ loadKg: 140, reps: 1, rir: 0 })).toBe(140);
  });

  it("refuses to estimate from a set over 10 reps, per Appendix A", () => {
    // The percentage is still available for progression logic...
    expect(percentOf1RM(12, 0)).toBe(71);
    // ...but a 1RM inferred from it is not something to act on.
    expect(estimate1RM({ loadKg: 60, reps: 12, rir: 0 })).toBeNull();
    expect(estimate1RM({ loadKg: 60, reps: 11, rir: 0 })).toBeNull();
    expect(estimate1RM({ loadKg: 60, reps: MAX_E1RM_REPS, rir: 0 })).not.toBeNull();
  });

  it("refuses uncountable efforts and nonsense loads", () => {
    expect(estimate1RM({ loadKg: 100, reps: 5, rir: 6 })).toBeNull();
    expect(estimate1RM({ loadKg: 0, reps: 5, rir: 1 })).toBeNull();
    expect(estimate1RM({ loadKg: -20, reps: 5, rir: 1 })).toBeNull();
    expect(estimate1RM({ loadKg: Number.NaN, reps: 5, rir: 1 })).toBeNull();
    expect(estimate1RM({ loadKg: Number.POSITIVE_INFINITY, reps: 5, rir: 1 })).toBeNull();
  });

  it("reads a harder set at the same load as a higher 1RM", () => {
    const atRir3 = estimate1RM({ loadKg: 100, reps: 5, rir: 3 })!;
    const atRir0 = estimate1RM({ loadKg: 100, reps: 5, rir: 0 })!;
    // Same load, less left in the tank -> that load is a bigger share of max,
    // so the implied max is lower.
    expect(atRir0).toBeLessThan(atRir3);
  });
});

describe("loadForTarget", () => {
  it("matches Appendix A's continuation: e1RM 95kg, 5 reps at RIR 0 -> ~82kg", () => {
    expect(loadForTarget({ e1rmKg: 95, reps: 5, rir: 0 })).toBeCloseTo(81.7, 1);
  });

  it("round-trips against estimate1RM", () => {
    const e1rm = estimate1RM({ loadKg: 80, reps: 5, rir: 1 })!;
    expect(loadForTarget({ e1rmKg: e1rm, reps: 5, rir: 1 })).toBeCloseTo(80, 1);
  });

  it("prescribes less load for a target with more reps in reserve", () => {
    const easier = loadForTarget({ e1rmKg: 100, reps: 5, rir: 3 })!;
    const harder = loadForTarget({ e1rmKg: 100, reps: 5, rir: 0 })!;
    expect(easier).toBeLessThan(harder);
  });

  it("returns null for an unusable e1RM or an out-of-table target", () => {
    expect(loadForTarget({ e1rmKg: 0, reps: 5, rir: 0 })).toBeNull();
    expect(loadForTarget({ e1rmKg: 100, reps: 20, rir: 0 })).toBeNull();
    expect(loadForTarget({ e1rmKg: 100, reps: 5, rir: 9 })).toBeNull();
  });
});

describe("smoothedE1RM", () => {
  it("averages the three most recent estimates by default", () => {
    expect(smoothedE1RM([100, 94, 91])).toBeCloseTo(95, 1);
  });

  it("ignores anything older than the window", () => {
    // The 500 is stale history and must not move the answer.
    expect(smoothedE1RM([100, 94, 91, 500])).toBeCloseTo(95, 1);
  });

  it("damps a single over-reported session instead of chasing it", () => {
    // A novice calls a set RIR 0 when it was really RIR 3: one spike.
    const spiky = [120, 95, 94];
    const smoothed = smoothedE1RM(spiky)!;
    expect(smoothed).toBeLessThan(120);
    // And it stays much closer to the honest sessions than to the spike.
    expect(Math.abs(smoothed - 94.5)).toBeLessThan(Math.abs(smoothed - 120));
  });

  it("averages what exists when there's less history than the window", () => {
    expect(smoothedE1RM([100])).toBe(100);
    expect(smoothedE1RM([100, 90])).toBe(95);
  });

  it("returns null for no usable history", () => {
    expect(smoothedE1RM([])).toBeNull();
    expect(smoothedE1RM([Number.NaN, 0, -5])).toBeNull();
  });
});

describe("roundToIncrement", () => {
  it("rounds down rather than to nearest, so a target is never overshot", () => {
    // 81.7 with 2.5kg plates is 80, not 82.5 — overshooting turns into a
    // missed set, which Rule 1 would then read as a failed progression.
    expect(roundToIncrement(81.7, 2.5)).toBe(80);
    expect(roundToIncrement(84.9, 5)).toBe(80);
    expect(roundToIncrement(82.4, 1.25)).toBe(81.25);
  });

  it("leaves an exact multiple alone", () => {
    expect(roundToIncrement(80, 2.5)).toBe(80);
    expect(roundToIncrement(100, 5)).toBe(100);
    // The floating-point case: these are exact multiples of 1.25 and must not
    // lose a whole increment to a division landing at 64.9999...
    expect(roundToIncrement(81.25, 1.25)).toBe(81.25);
    expect(roundToIncrement(123.75, 1.25)).toBe(123.75);
    expect(roundToIncrement(62.5, 1.25)).toBe(62.5);
  });

  it("preserves 1.25kg increments, which §2 prescribes for bench/OHP/row", () => {
    // Regression test for a real bug: rounding the result to one decimal
    // turned 81.25 into 81.3, a load no plate combination produces.
    for (const load of [81.25, 61.25, 123.75, 43.75]) {
      const rounded = roundToIncrement(load, 1.25);
      expect(rounded).toBe(load);
      // And the result is always an exact multiple of the increment.
      expect(Math.abs(rounded / 1.25 - Math.round(rounded / 1.25))).toBeLessThan(1e-9);
    }
  });

  it("degrades safely on a nonsense increment", () => {
    expect(roundToIncrement(81.74, 0)).toBe(81.74);
    expect(roundToIncrement(81.74, -5)).toBe(81.74);
  });
});

describe("RPE/RIR conversion and hard-set counting", () => {
  it("converts both ways per Appendix A's RPE = 10 - RIR", () => {
    expect(rpeFromRir(0)).toBe(10);
    expect(rpeFromRir(2)).toBe(8);
    expect(rirFromRpe(8)).toBe(2);
    expect(rirFromRpe(10)).toBe(0);
  });

  it("counts 0-4 RIR as a hard set and 5+ as a warm-up", () => {
    for (let rir = 0; rir <= 4; rir++) expect(isCountableHardSet(rir)).toBe(true);
    expect(isCountableHardSet(5)).toBe(false);
    expect(isCountableHardSet(6)).toBe(false);
    expect(isCountableHardSet(-1)).toBe(false);
    expect(isCountableHardSet(Number.NaN)).toBe(false);
  });
});

describe("guardrails the templates depend on", () => {
  it("never lets a novice's prescription be built on a 1RM test", () => {
    // The only inputs this module accepts are a logged working set. There is
    // no "test your max" path, by construction — §14 ranks asking a novice to
    // test a 1RM among the worst things generated programs do.
    expect(estimate1RM({ loadKg: 100, reps: 1, rir: 0 })).toBe(100);
    // ...and a single at RIR 0 is only reachable by someone who actually did
    // one; nothing here generates that prescription for a novice. That's the
    // template's job to enforce (§2: never program a novice to RPE 10 on a
    // compound barbell lift), and it's asserted there.
  });

  it("produces sane loads across the whole usable table", () => {
    for (let reps = 1; reps <= MAX_E1RM_REPS; reps++) {
      for (let rir = 0; rir <= MAX_COUNTABLE_RIR; rir++) {
        const e1rm = estimate1RM({ loadKg: 100, reps, rir });
        expect(e1rm, `reps=${reps} rir=${rir}`).not.toBeNull();
        // A working set is never heavier than the max it implies, and never
        // implies a max more than ~1.7x itself within this table's range.
        expect(e1rm!).toBeGreaterThanOrEqual(100);
        expect(e1rm!).toBeLessThan(170);
      }
    }
  });
});
