// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdvancedFieldsEditor } from "./advanced-fields-editor";

describe("AdvancedFieldsEditor", () => {
  it("renders nothing but the add row when there are no custom fields yet", () => {
    render(<AdvancedFieldsEditor value={null} onChange={vi.fn()} />);
    expect(screen.getByLabelText("New custom field name")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Field name:/)).not.toBeInTheDocument();
  });

  it("adds a new key/value pair", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AdvancedFieldsEditor value={null} onChange={onChange} />);

    await user.type(screen.getByLabelText("New custom field name"), "Tempo");
    await user.type(screen.getByLabelText("New custom field value"), "3-1-1-0");
    await user.click(screen.getByLabelText("Add custom field"));

    expect(onChange).toHaveBeenCalledWith({ Tempo: "3-1-1-0" });
  });

  it("shows existing fields and lets you update a value", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AdvancedFieldsEditor value={{ Band: "Red" }} onChange={onChange} />);

    const valueField = screen.getByLabelText("Value for Band");
    await user.clear(valueField);
    await user.type(valueField, "Blue");
    await user.tab();

    expect(onChange).toHaveBeenCalledWith({ Band: "Blue" });
  });

  it("removes a field, clearing to null once the last one is gone", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AdvancedFieldsEditor value={{ Band: "Red" }} onChange={onChange} />);

    await user.click(screen.getByLabelText("Remove Band"));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("tapping a Methods preset chip adds its key/value pair", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AdvancedFieldsEditor value={null} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Tempo" }));

    expect(onChange).toHaveBeenCalledWith({ Tempo: "3-1-1-0" });
  });

  it("tapping an already-applied preset chip removes it again", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AdvancedFieldsEditor value={{ Tempo: "3-1-1-0" }} onChange={onChange} />);

    const tempoChip = screen.getByRole("button", { name: "Tempo" });
    expect(tempoChip).toHaveAttribute("aria-pressed", "true");

    await user.click(tempoChip);

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
