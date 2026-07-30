// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExerciseMaxLibrary } from "./exercise-max-library";
import type { ExerciseMaxHistoryEntry } from "@/lib/profile/queries";

describe("ExerciseMaxLibrary", () => {
  it("renders nothing when the athlete has never tested an exercise", () => {
    const { container } = render(<ExerciseMaxLibrary history={new Map()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the latest test prominently and puts earlier tests behind a disclosure", () => {
    const history = new Map<string, ExerciseMaxHistoryEntry[]>([
      [
        "back-squat",
        [
          { exerciseId: "back-squat", exerciseName: "Barbell Back Squat", estimated1RMKg: 160, performedOn: "2026-07-15" },
          { exerciseId: "back-squat", exerciseName: "Barbell Back Squat", estimated1RMKg: 150, performedOn: "2026-06-01" },
        ],
      ],
    ]);

    render(<ExerciseMaxLibrary history={history} />);

    expect(screen.getByText("Barbell Back Squat")).toBeInTheDocument();
    expect(screen.getByText("160kg")).toBeInTheDocument();
    const summary = screen.getByText("1 earlier test");
    expect(summary).toBeInTheDocument();
    // Collapsed by default — jsdom doesn't hide <details> content from the
    // DOM the way a real browser's rendering would, so this checks the
    // semantic "not open" state rather than content visibility.
    expect(summary.closest("details")).not.toHaveAttribute("open");
  });

  it("omits the disclosure entirely when there's only ever been one test", () => {
    const history = new Map<string, ExerciseMaxHistoryEntry[]>([
      ["bench-press", [{ exerciseId: "bench-press", exerciseName: "Barbell Bench Press", estimated1RMKg: 100, performedOn: "2026-07-01" }]],
    ]);

    render(<ExerciseMaxLibrary history={history} />);

    expect(screen.getByText("Barbell Bench Press")).toBeInTheDocument();
    expect(screen.queryByText(/earlier test/)).not.toBeInTheDocument();
  });

  it("sorts exercises alphabetically by name", () => {
    const history = new Map<string, ExerciseMaxHistoryEntry[]>([
      ["overhead-press", [{ exerciseId: "overhead-press", exerciseName: "Overhead Press", estimated1RMKg: 60, performedOn: "2026-07-01" }]],
      ["back-squat", [{ exerciseId: "back-squat", exerciseName: "Back Squat", estimated1RMKg: 160, performedOn: "2026-07-01" }]],
    ]);

    render(<ExerciseMaxLibrary history={history} />);

    const names = screen.getAllByText(/Press|Squat/).map((el) => el.textContent);
    expect(names.indexOf("Back Squat")).toBeLessThan(names.indexOf("Overhead Press"));
  });
});
