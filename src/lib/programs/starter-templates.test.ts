import { describe, it, expect } from "vitest";
import { STARTER_PROGRAM_TEMPLATES, getStarterTemplate } from "./starter-templates";

// The only record_type strings personal_records actually tracks (see
// lib/profile/personal-records.ts's RECORD_TYPES) — a percent_1rm set
// referencing anything else would never resolve a suggested weight, even
// once the athlete logs a matching PR, since nothing would ever match.
const VALID_STRENGTH_RECORD_TYPES = ["squat", "bench_press", "deadlift", "overhead_press"];

describe("starter program templates", () => {
  it("exposes exactly the 3 templates the starter-program feature was built around", () => {
    expect(STARTER_PROGRAM_TEMPLATES.map((t) => t.slug).sort()).toEqual(
      ["5k-base-builder", "full-body-strength", "push-pull-legs"].sort()
    );
  });

  it("getStarterTemplate looks up by slug and returns undefined for an unknown one", () => {
    expect(getStarterTemplate("full-body-strength")?.name).toBe("Full Body Strength");
    expect(getStarterTemplate("not-a-real-slug")).toBeUndefined();
  });

  it.each(STARTER_PROGRAM_TEMPLATES)("$name: every percent_1rm set references a real personal-record type", (template) => {
    for (const day of template.week1.days) {
      for (const block of day.blocks) {
        for (const exercise of block.exercises) {
          for (const set of exercise.sets) {
            if (set.prescription_type === "percent_1rm") {
              expect(VALID_STRENGTH_RECORD_TYPES).toContain(set.pr_record_type);
            }
          }
        }
      }
    }
  });

  it.each(STARTER_PROGRAM_TEMPLATES)("$name: has $daysPerWeek non-rest training days", (template) => {
    const trainingDays = template.week1.days.filter((d) => !d.is_rest_day);
    expect(trainingDays).toHaveLength(template.daysPerWeek);
  });

  it.each(STARTER_PROGRAM_TEMPLATES)("$name: has totalWeeks - 1 progression steps", (template) => {
    expect(template.progressionSteps).toHaveLength(template.totalWeeks - 1);
  });

  it.each(STARTER_PROGRAM_TEMPLATES)("$name: rest days have no blocks and non-rest days have at least one", (template) => {
    for (const day of template.week1.days) {
      if (day.is_rest_day) {
        expect(day.blocks).toHaveLength(0);
      } else {
        expect(day.blocks.length).toBeGreaterThan(0);
      }
    }
  });

  it.each(STARTER_PROGRAM_TEMPLATES)("$name: block/exercise/set positions are sequential starting at 1", (template) => {
    for (const day of template.week1.days) {
      day.blocks.forEach((block, i) => {
        expect(block.position).toBe(i + 1);
        block.exercises.forEach((exercise, j) => {
          expect(exercise.position).toBe(j + 1);
          exercise.sets.forEach((set, k) => {
            expect(set.position).toBe(k + 1);
          });
        });
      });
    }
  });
});
