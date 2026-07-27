// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopicCard } from "./topic-card";
import type { InsightsTopic } from "@/lib/insights/types";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const TOPIC: InsightsTopic = { id: "topic-1", slug: "nutrition", name: "Nutrition", description: "Fueling training.", position: 5 };

describe("TopicCard", () => {
  it("links to the topic's article-listing page and shows its name and description", () => {
    render(<TopicCard topic={TOPIC} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/insights/topics/nutrition");
    expect(screen.getByText("Nutrition")).toBeInTheDocument();
    expect(screen.getByText("Fueling training.")).toBeInTheDocument();
  });

  it("shows a generic call to action when no article count is given", () => {
    render(<TopicCard topic={TOPIC} />);
    expect(screen.getByText("Browse articles")).toBeInTheDocument();
  });

  it("shows a singular/plural article count when given", () => {
    const { rerender } = render(<TopicCard topic={TOPIC} articleCount={1} />);
    expect(screen.getByText("1 article")).toBeInTheDocument();

    rerender(<TopicCard topic={TOPIC} articleCount={3} />);
    expect(screen.getByText("3 articles")).toBeInTheDocument();
  });
});
