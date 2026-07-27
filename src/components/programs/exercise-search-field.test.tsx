// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExerciseSearchField } from "./exercise-search-field";

describe("ExerciseSearchField", () => {
  it("shows the current exercise name on the closed trigger, and a placeholder when empty", () => {
    render(<ExerciseSearchField category="strength" exerciseId={null} customName={null} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /search exercises/i })).toBeInTheDocument();
  });

  it("opens a searchable list on click and filters as you type", async () => {
    const user = userEvent.setup();
    render(<ExerciseSearchField category="strength" exerciseId={null} customName={null} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /search exercises/i }));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option").length).toBeGreaterThan(1);

    await user.type(screen.getByRole("textbox", { name: /search exercises/i }), "Barbell Back Squat");
    await waitFor(() => expect(within(listbox).getByText("Barbell Back Squat")).toBeInTheDocument());
  });

  it("selecting a known strength exercise resolves a real exercise_id, not just a custom_name", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ExerciseSearchField category="strength" exerciseId={null} customName={null} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /search exercises/i }));
    await user.type(screen.getByRole("textbox", { name: /search exercises/i }), "Barbell Back Squat");
    await user.click(await screen.findByRole("option", { name: "Barbell Back Squat" }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ custom_name: null }));
    expect(onChange.mock.calls[0]![0].exercise_id).toBeTruthy();
  });

  it("offers 'Create' for a name that doesn't match anything, and creates it as a custom exercise", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ExerciseSearchField category="cardio" exerciseId={null} customName={null} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /search exercises/i }));
    await user.type(screen.getByRole("textbox", { name: /search exercises/i }), "Backwards Sled Drag");
    const createOption = await screen.findByRole("option", { name: /create/i });
    await user.click(createOption);

    expect(onChange).toHaveBeenCalledWith({ exercise_id: null, custom_name: "Backwards Sled Drag" });
  });

  it("closes without calling onChange when Escape is pressed", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ExerciseSearchField category="strength" exerciseId={null} customName={null} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /search exercises/i }));
    await screen.findByRole("listbox");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
