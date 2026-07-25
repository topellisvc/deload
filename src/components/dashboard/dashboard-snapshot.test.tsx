// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardSnapshot } from "./dashboard-snapshot";
import type { DashboardStats } from "@/lib/dashboard/types";

function makeStats(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    currentStreak: 0,
    sessionCount: 1,
    programsCreated: 11,
    completionPercent: null,
    consistencyPercent: null,
    ...overrides,
  };
}

/**
 * Pins down the tone thresholds (percentTone/streakTone) since those are
 * plain functions with no other test coverage — a regression here would
 * be an untested, silently-wrong color on a real user's dashboard.
 */
describe("DashboardSnapshot", () => {
  it("keeps count-only cards (sessions, programs) neutral regardless of value", () => {
    render(<DashboardSnapshot stats={makeStats({ sessionCount: 0, programsCreated: 0 })} />);
    const sessionsIcon = screen.getByText("Sessions logged").parentElement?.querySelector("svg");
    expect(sessionsIcon).toHaveClass("text-primary");
  });

  it("colors a zero streak neutral and a positive streak success-green", () => {
    const { rerender } = render(<DashboardSnapshot stats={makeStats({ currentStreak: 0 })} />);
    expect(screen.getByText("0 days").className).toContain("text-foreground");

    rerender(<DashboardSnapshot stats={makeStats({ currentStreak: 5 })} />);
    expect(screen.getByText("5 days")).toHaveClass("text-success");
  });

  it("hides completion/consistency cards when null, shows them colored by band when present", () => {
    const { rerender } = render(<DashboardSnapshot stats={makeStats()} />);
    expect(screen.queryByText("Program completion")).not.toBeInTheDocument();
    expect(screen.queryByText("Consistency")).not.toBeInTheDocument();

    rerender(<DashboardSnapshot stats={makeStats({ completionPercent: 90, consistencyPercent: 60 })} />);
    expect(screen.getByText("90%")).toHaveClass("text-success");
    expect(screen.getByText("60%")).toHaveClass("text-warning");
  });

  it("colors low percentages danger", () => {
    render(<DashboardSnapshot stats={makeStats({ completionPercent: 20 })} />);
    expect(screen.getByText("20%")).toHaveClass("text-danger");
  });
});
