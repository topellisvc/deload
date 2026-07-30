import { describe, expect, it } from "vitest";
import { decideJointCheck, decideReadinessDownregulation, decideRirGate } from "@/lib/training/autoregulation";
import type { AutoregulationEventKind, ReadinessCheck } from "@/lib/training/autoregulation";

function events(kinds: AutoregulationEventKind[]): { kind: AutoregulationEventKind }[] {
  return kinds.map((kind) => ({ kind }));
}

describe("decideRirGate — the four reported RIR buckets", () => {
  it("advances with a bit extra at 3+ RIR", () => {
    const result = decideRirGate({ performedRir: 3, repsMissed: false, recentEvents: [] });
    expect(result.outcome).toBe("advance");
    expect(result.multiplier).toBeGreaterThan(1);
    expect(result.multiplier).toBeGreaterThanOrEqual(1.03);
  });

  it("advances (a smaller bump than 3+) at 2 RIR", () => {
    const result = decideRirGate({ performedRir: 2, repsMissed: false, recentEvents: [] });
    expect(result.outcome).toBe("advance");
    const three = decideRirGate({ performedRir: 3, repsMissed: false, recentEvents: [] });
    expect(result.multiplier).toBeGreaterThan(1);
    expect(result.multiplier).toBeLessThan(three.multiplier);
  });

  it("changes nothing at 1 RIR -- proceed exactly as planned", () => {
    const result = decideRirGate({ performedRir: 1, repsMissed: false, recentEvents: [] });
    expect(result.outcome).toBe("no_change");
    expect(result.multiplier).toBe(1);
  });

  it("holds (does not increase) at 0 RIR even if reps weren't technically missed", () => {
    const result = decideRirGate({ performedRir: 0, repsMissed: false, recentEvents: [] });
    expect(result.outcome).toBe("hold");
    expect(result.multiplier).toBe(1);
  });
});

describe("decideRirGate — missed reps hold regardless of reported RIR", () => {
  it("holds on a missed rep target even if a nonzero RIR was reported", () => {
    const result = decideRirGate({ performedRir: 2, repsMissed: true, recentEvents: [] });
    expect(result.outcome).toBe("hold");
  });
});

describe("decideRirGate -- null RIR is treated as insufficient information, never a miss or a green light", () => {
  it("returns no_change rather than guessing when RIR wasn't reported", () => {
    const result = decideRirGate({ performedRir: null, repsMissed: false, recentEvents: [] });
    expect(result.outcome).toBe("no_change");
  });

  it("still returns no_change even if reps were reported missed with no RIR answer", () => {
    // Defensive: this function should never fabricate a miss-hold escalation
    // from data it doesn't have.
    const result = decideRirGate({ performedRir: null, repsMissed: true, recentEvents: [] });
    expect(result.outcome).toBe("no_change");
  });
});

describe("decideRirGate — consecutive-miss escalation to a 10% reset", () => {
  it("holds (not reset) on the first miss with no prior history", () => {
    const result = decideRirGate({ performedRir: 0, repsMissed: false, recentEvents: [] });
    expect(result.outcome).toBe("hold");
  });

  it("escalates to reset_10pct when the most recent prior event for this lift was also a hold", () => {
    const result = decideRirGate({ performedRir: 0, repsMissed: false, recentEvents: events(["hold"]) });
    expect(result.outcome).toBe("reset_10pct");
    expect(result.multiplier).toBe(0.9);
  });

  it("does not escalate when the most recent prior event was an advance", () => {
    const result = decideRirGate({ performedRir: 0, repsMissed: false, recentEvents: events(["advance", "hold"]) });
    expect(result.outcome).toBe("hold");
  });

  it("does not immediately re-escalate right after a reset_10pct -- the streak restarts", () => {
    const result = decideRirGate({ performedRir: 0, repsMissed: false, recentEvents: events(["reset_10pct", "hold"]) });
    expect(result.outcome).toBe("hold");
  });

  it("skips over readiness_downregulated events without breaking or extending the streak", () => {
    // A bad-sleep-and-soreness downregulated session sits between two real
    // misses -- Rule 3's own requirement is that this must still read as two
    // misses in a row, not be reset by the readiness event in between.
    const stillEscalates = decideRirGate({
      performedRir: 0,
      repsMissed: false,
      recentEvents: events(["readiness_downregulated", "hold"]),
    });
    expect(stillEscalates.outcome).toBe("reset_10pct");

    // And a readiness-downregulated session right after a clean advance
    // must not itself look like the start of a miss streak.
    const stillHoldsFirst = decideRirGate({
      performedRir: 0,
      repsMissed: false,
      recentEvents: events(["readiness_downregulated", "advance"]),
    });
    expect(stillHoldsFirst.outcome).toBe("hold");
  });
});

describe("decideRirGate — no_change sessions never pollute the miss-streak read", () => {
  it("a 1-RIR (no_change) session in history behaves like it was never recorded", () => {
    // no_change results are never written as events at all (see this
    // module's header comment) -- this test documents that expectation by
    // confirming a miss right after one still reads as a first miss, not a
    // second, since a caller correctly never included a no_change entry.
    const result = decideRirGate({ performedRir: 0, repsMissed: false, recentEvents: [] });
    expect(result.outcome).toBe("hold");
  });
});

describe("decideReadinessDownregulation — Rule 3's two-question check", () => {
  function readiness(overrides: Partial<ReadinessCheck>): ReadinessCheck {
    return { sleep: "good", soreness: "fresh", ...overrides };
  }

  it("downregulates only when both sleep is bad AND soreness is beat_up", () => {
    expect(decideReadinessDownregulation(readiness({ sleep: "bad", soreness: "beat_up" }))).toBe(true);
  });

  it("does not downregulate for bad sleep alone", () => {
    expect(decideReadinessDownregulation(readiness({ sleep: "bad", soreness: "normal" }))).toBe(false);
  });

  it("does not downregulate for beat_up soreness alone", () => {
    expect(decideReadinessDownregulation(readiness({ sleep: "ok", soreness: "beat_up" }))).toBe(false);
  });

  it("does not downregulate when both are merely middling (ok / normal)", () => {
    expect(decideReadinessDownregulation(readiness({ sleep: "ok", soreness: "normal" }))).toBe(false);
  });

  it("does not downregulate when everything is good", () => {
    expect(decideReadinessDownregulation(readiness({ sleep: "good", soreness: "fresh" }))).toBe(false);
  });
});

describe("decideJointCheck — Rule 4's per-joint better/same/worse check", () => {
  it("regresses only when 'worse' is reported two sessions in a row", () => {
    expect(decideJointCheck("worse", "worse")).toBe("regress");
  });

  it("does not regress on a single 'worse' with no prior worse reading", () => {
    expect(decideJointCheck("worse", null)).toBe("no_change");
    expect(decideJointCheck("worse", "same")).toBe("no_change");
    expect(decideJointCheck("worse", "better")).toBe("no_change");
  });

  it("progresses only when 'better' is reported two sessions in a row", () => {
    expect(decideJointCheck("better", "better")).toBe("progress");
  });

  it("does not progress on a single 'better' with no prior better reading", () => {
    expect(decideJointCheck("better", null)).toBe("no_change");
    expect(decideJointCheck("better", "same")).toBe("no_change");
    expect(decideJointCheck("better", "worse")).toBe("no_change");
  });

  it("never changes anything for a 'same' reading, regardless of what came before", () => {
    expect(decideJointCheck("same", "worse")).toBe("no_change");
    expect(decideJointCheck("same", "better")).toBe("no_change");
    expect(decideJointCheck("same", "same")).toBe("no_change");
    expect(decideJointCheck("same", null)).toBe("no_change");
  });
});
