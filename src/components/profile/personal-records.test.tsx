// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PersonalRecords } from "./personal-records";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/profile/mutations", () => ({ upsertPersonalRecord: vi.fn(), deletePersonalRecord: vi.fn() }));

describe("PersonalRecords", () => {
  it("no longer offers manual entry for the 4 strength types — only Running is editable", () => {
    render(<PersonalRecords userId="user-1" records={[]} />);

    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.queryByText("Strength")).not.toBeInTheDocument();
    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument();
    expect(screen.queryByText("Squat")).not.toBeInTheDocument();
    expect(screen.queryByText("Deadlift")).not.toBeInTheDocument();
    expect(screen.queryByText("Overhead Press")).not.toBeInTheDocument();
    expect(screen.getByText("5K")).toBeInTheDocument();
  });

  it("explains that strength maxes are calculated automatically from a testing week", () => {
    render(<PersonalRecords userId="user-1" records={[]} />);
    expect(screen.getByText(/calculated automatically the first time you log a program's testing week/)).toBeInTheDocument();
  });
});
