// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminRosterTable } from "./admin-roster-table";
import type { AdminRosterRow } from "@/lib/admin/queries";

function makeRow(overrides: Partial<AdminRosterRow> = {}): AdminRosterRow {
  return {
    id: "user-1",
    email: "user1@example.com",
    displayName: null,
    role: "athlete",
    isAdmin: false,
    signedUpAt: "2026-01-01T00:00:00.000Z",
    lastActiveOn: null,
    programsCreated: 0,
    sessionCount: 0,
    ...overrides,
  };
}

describe("AdminRosterTable", () => {
  it("shows an empty state when there are no accounts", () => {
    render(<AdminRosterTable roster={[]} />);
    expect(screen.getByText("No accounts yet.")).toBeInTheDocument();
  });

  it("renders each account's email, role badge, and counts", () => {
    render(
      <AdminRosterTable
        roster={[makeRow({ email: "coach@example.com", role: "coach", programsCreated: 3, sessionCount: 12 })]}
      />
    );
    expect(screen.getByText("coach@example.com")).toBeInTheDocument();
    expect(screen.getByText("Coach")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("shows 'Never' when a user has no last-active date", () => {
    render(<AdminRosterTable roster={[makeRow({ lastActiveOn: null })]} />);
    expect(screen.getByText("Never")).toBeInTheDocument();
  });

  it("shows an Admin badge only for admin accounts", () => {
    render(<AdminRosterTable roster={[makeRow({ isAdmin: true })]} />);
    expect(screen.getByTitle("Admin")).toBeInTheDocument();
  });

  it("omits the Admin badge for non-admin accounts", () => {
    render(<AdminRosterTable roster={[makeRow({ isAdmin: false })]} />);
    expect(screen.queryByTitle("Admin")).not.toBeInTheDocument();
  });

  it("falls back to 'No email on file' when email is null", () => {
    render(<AdminRosterTable roster={[makeRow({ email: null })]} />);
    expect(screen.getByText("No email on file")).toBeInTheDocument();
  });
});
