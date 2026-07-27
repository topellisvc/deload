// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContributorCard } from "./contributor-card";
import type { InsightsContributor } from "@/lib/insights/types";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const CONTRIBUTOR: InsightsContributor = {
  id: "contrib-1",
  profileId: null,
  name: "Emily Novak",
  title: "Physiotherapist",
  organisation: "Northbridge Sports Physiotherapy",
  qualifications: "DPT",
  bio: "Bio text.",
  photoUrl: null,
  expertise: ["Recovery"],
};

describe("ContributorCard", () => {
  it("links to the contributor's profile and shows name, title, and organisation", () => {
    render(<ContributorCard contributor={CONTRIBUTOR} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/insights/contributors/contrib-1");
    expect(screen.getByText("Emily Novak")).toBeInTheDocument();
    expect(screen.getByText("Physiotherapist")).toBeInTheDocument();
    expect(screen.getByText("Northbridge Sports Physiotherapy")).toBeInTheDocument();
  });

  it("falls back to initials when there's no photo", () => {
    render(<ContributorCard contributor={CONTRIBUTOR} />);
    expect(screen.getByText("EN")).toBeInTheDocument();
  });

  it("shows an article count only when given", () => {
    const { rerender } = render(<ContributorCard contributor={CONTRIBUTOR} />);
    expect(screen.queryByText(/article/)).not.toBeInTheDocument();

    rerender(<ContributorCard contributor={CONTRIBUTOR} articleCount={2} />);
    expect(screen.getByText("2 articles")).toBeInTheDocument();
  });
});
