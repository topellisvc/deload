import { describe, it, expect } from "vitest";
import { ParsedProgramSchema, parsedProgramToWeeks, parsedProgramToTree, type ParsedProgram } from "@/lib/programs/text-parse";

function baseParsed(): ParsedProgram {
  return {
    name: "Test Block",
    discipline: "hybrid",
    weeks: [
      {
        label: null,
        days: [
          {
            label: "Day 1",
            is_rest_day: false,
            exercises: [
              {
                name: "Back Squat",
                category: "strength",
                role: null,
                prescription_type: "fixed_weight",
                notes: null,
                sets: [{ sets: 5, reps: "5", weight_kg: 80, percent_1rm: null, rpe: null, rir: null, rest_seconds: null, distance_meters: null, duration_seconds: null, pace_seconds_per_km: null, heart_rate_zone: null, calories: null, notes: null }],
              },
            ],
          },
          { label: "Day 2", is_rest_day: true, exercises: [] },
        ],
      },
    ],
  };
}

describe("ParsedProgramSchema", () => {
  it("accepts a well-formed parse", () => {
    const result = ParsedProgramSchema.safeParse(baseParsed());
    expect(result.success).toBe(true);
  });

  it("rejects an unknown category", () => {
    const bad = baseParsed();
    // @ts-expect-error deliberately invalid for the test
    bad.weeks[0].days[0].exercises[0].category = "swimming";
    expect(ParsedProgramSchema.safeParse(bad).success).toBe(false);
  });
});

describe("parsedProgramToWeeks", () => {
  it("builds a rest day with no blocks", () => {
    const weeks = parsedProgramToWeeks(baseParsed());
    const restDay = weeks[0]!.days[1]!;
    expect(restDay.is_rest_day).toBe(true);
    expect(restDay.blocks).toEqual([]);
  });

  it("puts each exercise in its own straight block, main role by default", () => {
    const weeks = parsedProgramToWeeks(baseParsed());
    const day1 = weeks[0]!.days[0]!;
    expect(day1.blocks).toHaveLength(1);
    expect(day1.blocks[0]!.block_type).toBe("straight");
    expect(day1.blocks[0]!.block_role).toBe("main");
    expect(day1.blocks[0]!.exercises[0]!.custom_name).toBe("Back Squat");
    expect(day1.blocks[0]!.exercises[0]!.exercise_category).toBe("strength");
  });

  it("carries set fields through, filling unset ones with null", () => {
    const weeks = parsedProgramToWeeks(baseParsed());
    const set = weeks[0]!.days[0]!.blocks[0]!.exercises[0]!.sets[0]!;
    expect(set.sets).toBe(5);
    expect(set.reps).toBe("5");
    expect(set.weight_value).toBe(80);
    expect(set.prescription_type).toBe("fixed_weight");
    expect(set.distance_meters).toBeNull();
    expect(set.rpe_value).toBeNull();
  });

  it("falls back to a valid prescription type when the category/type combo is mismatched", () => {
    const parsed = baseParsed();
    // percent_1rm isn't a valid type for "running" — should fall back to "coach_notes".
    parsed.weeks[0]!.days[0]!.exercises[0]! = {
      ...parsed.weeks[0]!.days[0]!.exercises[0]!,
      category: "running",
      prescription_type: "percent_1rm",
    };
    const weeks = parsedProgramToWeeks(parsed);
    expect(weeks[0]!.days[0]!.blocks[0]!.exercises[0]!.sets[0]!.prescription_type).toBe("coach_notes");
  });

  it("defaults missing week/day labels", () => {
    const weeks = parsedProgramToWeeks(baseParsed());
    expect(weeks[0]!.label).toBe("Week 1");
  });
});

describe("parsedProgramToTree", () => {
  it("passes through name and discipline alongside the mapped weeks", () => {
    const tree = parsedProgramToTree(baseParsed());
    expect(tree.name).toBe("Test Block");
    expect(tree.discipline).toBe("hybrid");
    expect(tree.weeks).toHaveLength(1);
  });
});
