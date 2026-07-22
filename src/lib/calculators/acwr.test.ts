import { describe, expect, it } from "vitest";
import { ACWR_ZONES, computeAcwr } from "./acwr";

describe("computeAcwr", () => {
  it("computes chronic load as the 4-week average and acute as the most recent week", () => {
    const result = computeAcwr([200, 220, 210, 230]);
    expect(result.chronicLoad).toBeCloseTo(215, 5);
    expect(result.acuteLoad).toBe(230);
    expect(result.ratio).toBeCloseTo(230 / 215, 5);
  });

  it("returns a ratio of 1 when all weeks are equal", () => {
    const result = computeAcwr([100, 100, 100, 100]);
    expect(result.ratio).toBe(1);
    expect(result.zone).toBe("Optimal");
  });

  it("classifies a large recent spike as High risk", () => {
    const result = computeAcwr([100, 100, 100, 300]);
    expect(result.ratio).toBeCloseTo(300 / 150, 5);
    expect(result.zone).toBe("High risk");
  });

  it("classifies a moderate spike as Caution", () => {
    // chronic = 115, acute = 150 -> ratio ~1.304
    const result = computeAcwr([100, 110, 100, 150]);
    expect(result.zone).toBe("Caution");
  });

  it("classifies a big drop in recent load as Undertrained", () => {
    const result = computeAcwr([200, 200, 200, 50]);
    expect(result.zone).toBe("Undertrained");
  });

  it("handles a zero most-recent week without dividing by zero itself", () => {
    const result = computeAcwr([100, 100, 100, 0]);
    expect(result.acuteLoad).toBe(0);
    expect(result.ratio).toBe(0);
    expect(result.zone).toBe("Undertrained");
  });

  it("rejects all-zero weeks (undefined chronic baseline)", () => {
    expect(() => computeAcwr([0, 0, 0, 0])).toThrow(RangeError);
  });

  it("rejects negative loads", () => {
    expect(() => computeAcwr([100, -10, 100, 100])).toThrow(RangeError);
  });

  it("rejects a week count other than 4", () => {
    expect(() => computeAcwr([100, 100, 100])).toThrow(RangeError);
    expect(() => computeAcwr([100, 100, 100, 100, 100])).toThrow(RangeError);
  });

  it("defines zones that cover the full non-negative number line with no gaps or overlaps", () => {
    const sorted = [...ACWR_ZONES].sort((a, b) => (a.min ?? -Infinity) - (b.min ?? -Infinity));
    expect(sorted[0]!.min).toBeNull();
    expect(sorted[sorted.length - 1]!.max).toBeNull();
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i]!.max).toBe(sorted[i + 1]!.min);
    }
  });
});
