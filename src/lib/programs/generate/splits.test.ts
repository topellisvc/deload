import { describe, expect, it } from "vitest";
import type { ExperienceLevel } from "@/lib/supabase/types";
import { chooseSplit, missingWeeklyPatterns, slotSequenceForDayRole } from "@/lib/programs/generate/splits";

const LEVELS: ExperienceLevel[] = ["beginner", "intermediate", "advanced"];

describe("chooseSplit — the §1 table", () => {
  it("uses full_body at 2 and 3 days for every level", () => {
    for (const level of LEVELS) {
      expect(chooseSplit(2, level, 45).splitType).toBe("full_body");
      expect(chooseSplit(3, level, 45).splitType).toBe("full_body");
    }
  });

  it("uses upper_lower at 4 days for every level — the coach's stated fallback default", () => {
    for (const level of LEVELS) {
      expect(chooseSplit(4, level, 60).splitType).toBe("upper_lower");
    }
  });

  it("uses upper_lower_plus_one at 5 days for every level", () => {
    for (const level of LEVELS) {
      expect(chooseSplit(5, level, 60).splitType).toBe("upper_lower_plus_one");
      expect(chooseSplit(5, level, 60).dayRoles).toHaveLength(5);
    }
  });

  it("uses push_pull_legs_x2 at 6 days for intermediate and advanced", () => {
    expect(chooseSplit(6, "intermediate", 60).splitType).toBe("push_pull_legs_x2");
    expect(chooseSplit(6, "advanced", 60).splitType).toBe("push_pull_legs_x2");
  });

  it("caps a beginner at 4 days when 6 is requested, with a warning explaining why", () => {
    const result = chooseSplit(6, "beginner", 60);
    expect(result.effectiveDaysPerWeek).toBe(4);
    expect(result.splitType).toBe("upper_lower");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("warns about completion risk at 6 days with 75+ minute sessions, for levels that keep 6 days", () => {
    const short = chooseSplit(6, "advanced", 60);
    const long = chooseSplit(6, "advanced", 90);
    expect(short.warnings).toHaveLength(0);
    expect(long.warnings.some((w) => w.toLowerCase().includes("75"))).toBe(true);
  });

  it("warns that 2 days is a maintenance ceiling for an advanced lifter, and doesn't warn other levels", () => {
    expect(chooseSplit(2, "advanced", 45).warnings.length).toBeGreaterThan(0);
    expect(chooseSplit(2, "beginner", 45).warnings).toHaveLength(0);
    expect(chooseSplit(2, "intermediate", 45).warnings).toHaveLength(0);
  });

  it("a capped beginner's 6-day request doesn't also trigger the 6-day session-length warning, since they're no longer on 6 days", () => {
    const result = chooseSplit(6, "beginner", 90);
    expect(result.warnings.some((w) => w.toLowerCase().includes("75"))).toBe(false);
  });
});

describe("missingWeeklyPatterns — §1's per-week non-negotiables", () => {
  it("every split this module produces satisfies all seven weekly non-negotiables", () => {
    for (const level of LEVELS) {
      for (const days of [2, 3, 4, 5, 6]) {
        const { dayRoles } = chooseSplit(days, level, 60);
        expect(missingWeeklyPatterns(dayRoles), `days=${days} level=${level}`).toEqual([]);
      }
    }
  });

  it("actually detects a genuinely incomplete week, proving it isn't vacuously true", () => {
    // A single push day alone can't cover a hinge, a squat, or either pull.
    expect(missingWeeklyPatterns(["push"])).toEqual(
      expect.arrayContaining(["squat_bilateral", "hinge_bilateral", "horizontal_pull", "vertical_pull", "knee_flexion"])
    );
  });

  it("is empty for an empty week only in the trivial sense that there's nothing to check — not a false pass on a real split", () => {
    expect(missingWeeklyPatterns([]).length).toBeGreaterThan(0);
  });
});

describe("slotSequenceForDayRole — §1's exercise order", () => {
  it("every day role starts with a primary slot", () => {
    const roles = ["full_body_a", "full_body_b", "upper_a", "upper_b", "lower_a", "lower_b", "push", "pull", "legs"] as const;
    for (const role of roles) {
      expect(slotSequenceForDayRole(role)[0]?.emphasis).toBe("primary");
    }
  });

  it("has exactly one primary slot per day — §1's 'one primary lift' rule", () => {
    const roles = ["full_body_a", "full_body_b", "upper_a", "upper_b", "lower_a", "lower_b", "push", "pull", "legs"] as const;
    for (const role of roles) {
      const primaries = slotSequenceForDayRole(role).filter((s) => s.emphasis === "primary");
      expect(primaries).toHaveLength(1);
    }
  });

  it("the specialization day carries no primary or secondary slot — it's the lower-priority filler day", () => {
    const slots = slotSequenceForDayRole("specialization");
    expect(slots.every((s) => s.emphasis === "accessory")).toBe(true);
  });
});
