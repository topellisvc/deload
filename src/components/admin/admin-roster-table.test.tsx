// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminRosterTable } from "./admin-roster-table";
import type { AdminRosterRow } from "@/lib/admin/queries";

// DeleteAccountButton and BetaAccessToggle (both rendered per-row) need a
// router and toast context — out of scope for these tests, which are only
// about what the table itself renders, not what either button does when
// clicked (BetaAccessToggle's own behavior is covered in
// beta-access-toggle.test.tsx).
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/lib/admin/mutations", () => ({ deleteUserAccount: vi.fn(), setBetaAccess: vi.fn() }));

function makeRow(overrides: Partial<AdminRosterRow> = {}): AdminRosterRow {
  return {
    id: "user-1",
    email: "user1@example.com",
    displayName: null,
    role: "athlete",
    isAdmin: false,
    betaBuildForMe: false,
    signedUpAt: "2026-01-01T00:00:00.000Z",
    lastActiveOn: null,
    programsCreated: 0,
    sessionCount: 0,
    ...overrides,
  };
}

describe("AdminRosterTable", () => {
  it("shows an empty state when there are no accounts", () => {
    render(<AdminRosterTable roster={[]} currentUserId="viewer-id" />);
    expect(screen.getByText("No accounts yet.")).toBeInTheDocument();
  });

  it("renders each account's email, role badge, and counts", () => {
    render(
      <AdminRosterTable
        roster={[makeRow({ email: "coach@example.com", role: "coach", programsCreated: 3, sessionCount: 12 })]}
        currentUserId="viewer-id"
      />
    );
    expect(screen.getByText("coach@example.com")).toBeInTheDocument();
    expect(screen.getByText("Coach")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("shows 'Never' when a user has no last-active date", () => {
    render(<AdminRosterTable roster={[makeRow({ lastActiveOn: null })]} currentUserId="viewer-id" />);
    expect(screen.getByText("Never")).toBeInTheDocument();
  });

  it("shows an Admin badge only for admin accounts", () => {
    render(<AdminRosterTable roster={[makeRow({ isAdmin: true })]} currentUserId="viewer-id" />);
    expect(screen.getByTitle("Admin")).toBeInTheDocument();
  });

  it("omits the Admin badge for non-admin accounts", () => {
    render(<AdminRosterTable roster={[makeRow({ isAdmin: false })]} currentUserId="viewer-id" />);
    expect(screen.queryByTitle("Admin")).not.toBeInTheDocument();
  });

  it("falls back to 'No email on file' when email is null", () => {
    render(<AdminRosterTable roster={[makeRow({ email: null })]} currentUserId="viewer-id" />);
    expect(screen.getByText("No email on file")).toBeInTheDocument();
  });

  it("shows a Delete button for another account, but not for the signed-in admin's own row", () => {
    render(<AdminRosterTable roster={[makeRow({ id: "user-1" }), makeRow({ id: "viewer-id", email: "me@example.com" })]} currentUserId="viewer-id" />);
    expect(screen.getAllByRole("button", { name: /delete/i })).toHaveLength(1);
  });

  it("shows 'Beta off' for an account without beta_build_for_me", () => {
    render(<AdminRosterTable roster={[makeRow({ betaBuildForMe: false })]} currentUserId="viewer-id" />);
    expect(screen.getByRole("button", { name: "Beta off" })).toBeInTheDocument();
  });

  it("shows 'Beta on' for an account already granted beta_build_for_me", () => {
    render(<AdminRosterTable roster={[makeRow({ betaBuildForMe: true })]} currentUserId="viewer-id" />);
    expect(screen.getByRole("button", { name: "Beta on" })).toBeInTheDocument();
  });
});
