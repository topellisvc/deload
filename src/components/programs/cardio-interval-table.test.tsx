// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardioIntervalTable } from "./cardio-interval-table";
import type { SetRow } from "@/lib/programs/types";

function makeSet(overrides: Partial<SetRow> = {}): SetRow {
  return {
    id: "set-1",
    block_exercise_id: "ex-1",
    position: 1,
    prescription_type: "intervals",
    sets: 6,
    reps: null,
    min_reps: null,
    max_reps: null,
    weight_value: null,
    percent_1rm_value: null,
    pr_record_type: null,
    rpe_value: null,
    rir_value: null,
    heart_rate_zone: null,
    calories: null,
    rest_seconds: 90,
    notes: "Sprint",
    distance_meters: 400,
    duration_seconds: 75,
    pace_seconds_per_km: null,
    advanced_config: null,
    ...overrides,
  };
}

describe("CardioIntervalTable", () => {
  it("shows a column header row and one row per interval", () => {
    render(
      <CardioIntervalTable
        sets={[makeSet({ id: "set-1" }), makeSet({ id: "set-2", notes: "Recovery", sets: 1 })]}
        onChange={vi.fn()}
        onDelete={vi.fn()}
        onAdd={vi.fn()}
        onReorder={vi.fn()}
      />
    );
    expect(screen.getByText("Interval")).toBeInTheDocument();
    expect(screen.getByText("Distance")).toBeInTheDocument();
    // "Time" and "Rest" each appear twice — once in the header row, once as
    // InlineDurationField's own inline caption on every row (see that
    // component's doc comment) — so this just confirms both are present,
    // not uniqueness.
    expect(screen.getAllByText("Time").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rest").length).toBeGreaterThan(0);
    expect(screen.getByText("Repeat")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Sprint")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Recovery")).toBeInTheDocument();
  });

  it("commits an edited interval label on blur", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CardioIntervalTable sets={[makeSet()]} onChange={onChange} onDelete={vi.fn()} onAdd={vi.fn()} onReorder={vi.fn()} />);
    const input = screen.getByDisplayValue("Sprint");
    await user.clear(input);
    await user.type(input, "Hard effort");
    await user.tab();
    expect(onChange).toHaveBeenCalledWith("set-1", { notes: "Hard effort" });
  });

  it("commits an edited repeat count on blur", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CardioIntervalTable sets={[makeSet()]} onChange={onChange} onDelete={vi.fn()} onAdd={vi.fn()} onReorder={vi.fn()} />);
    const input = screen.getByLabelText("Repeat");
    await user.clear(input);
    await user.type(input, "8");
    await user.tab();
    expect(onChange).toHaveBeenCalledWith("set-1", { sets: 8 });
  });

  it("calls onAdd when 'Add interval' is clicked", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<CardioIntervalTable sets={[makeSet()]} onChange={vi.fn()} onDelete={vi.fn()} onAdd={onAdd} onReorder={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Add interval" }));
    expect(onAdd).toHaveBeenCalled();
  });

  it("calls onDelete with the row's id when its delete button is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <CardioIntervalTable
        sets={[makeSet({ id: "set-1" }), makeSet({ id: "set-2", notes: "Recovery" })]}
        onChange={vi.fn()}
        onDelete={onDelete}
        onAdd={vi.fn()}
        onReorder={vi.fn()}
      />
    );
    const deleteButtons = screen.getAllByRole("button", { name: "Delete interval" });
    await user.click(deleteButtons[1]!);
    expect(onDelete).toHaveBeenCalledWith("set-2");
  });
});
