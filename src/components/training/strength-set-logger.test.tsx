// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StrengthSetLogger } from "./strength-set-logger";
import type { SetPrescription } from "@/lib/supabase/types";

function makeTarget(overrides: Partial<SetPrescription> = {}): SetPrescription {
  return {
    id: "set-1",
    block_exercise_id: "ex-1",
    position: 1,
    prescription_type: "fixed_weight",
    sets: 3,
    reps: "5",
    min_reps: null,
    max_reps: null,
    weight_value: 100,
    percent_1rm_value: null,
    pr_record_type: null,
    rpe_value: null,
    rir_value: null,
    heart_rate_zone: null,
    calories: null,
    rest_seconds: 150,
    notes: null,
    distance_meters: null,
    duration_seconds: null,
    pace_seconds_per_km: null,
    advanced_config: null,
    ...overrides,
  };
}

/**
 * A percent_1rm set whose suggestedWeight actually resolved to a number is
 * a real computed recommendation — from the athlete's own tested max
 * (resolvePercent1RMRecord) or the generator's e1RM — not just an empty
 * field waiting to be typed into like a fixed_weight row is. Labeling both
 * the same ("Weight") reads as if there's nothing to go on, when there is.
 */
describe("StrengthSetLogger weight field label", () => {
  it('labels it "Recommended Weight" for a percent_1rm target with a resolved suggestion', () => {
    render(
      <StrengthSetLogger
        exerciseName="Barbell Back Squat"
        exerciseHref={null}
        setNumber={1}
        totalSets={3}
        target={makeTarget({ prescription_type: "percent_1rm", percent_1rm_value: 65, weight_value: null })}
        suggestedWeight={85.2}
        lastSet={null}
        onComplete={vi.fn()}
        busy={false}
      />
    );

    expect(screen.getByText("Recommended Weight")).toBeInTheDocument();
    expect(screen.queryByText("Weight")).not.toBeInTheDocument();
  });

  it('falls back to plain "Weight" for a percent_1rm target with nothing to suggest yet (never tested)', () => {
    render(
      <StrengthSetLogger
        exerciseName="Barbell Back Squat"
        exerciseHref={null}
        setNumber={1}
        totalSets={3}
        target={makeTarget({ prescription_type: "percent_1rm", percent_1rm_value: 65, weight_value: null })}
        suggestedWeight={null}
        lastSet={null}
        onComplete={vi.fn()}
        busy={false}
      />
    );

    expect(screen.getByText("Weight")).toBeInTheDocument();
    expect(screen.queryByText("Recommended Weight")).not.toBeInTheDocument();
  });

  it('stays plain "Weight" for a fixed_weight target, even though a suggestedWeight would never apply there', () => {
    render(
      <StrengthSetLogger
        exerciseName="Barbell Back Squat"
        exerciseHref={null}
        setNumber={1}
        totalSets={3}
        target={makeTarget({ prescription_type: "fixed_weight", weight_value: 100 })}
        suggestedWeight={null}
        lastSet={null}
        onComplete={vi.fn()}
        busy={false}
      />
    );

    expect(screen.getByText("Weight")).toBeInTheDocument();
  });
});
