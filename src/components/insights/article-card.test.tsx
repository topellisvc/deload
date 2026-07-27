// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArticleCard } from "./article-card";
import type { InsightsArticleSummary } from "@/lib/insights/types";

// Same rationale as program-card.test.tsx: swap next/link and next/image
// for plain DOM elements so this test is about ArticleCard's own
// rendering logic, not Next's router/image-optimization internals (which
// need an App Router / server context RTL doesn't provide).
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

function makeArticle(overrides: Partial<InsightsArticleSummary> = {}): InsightsArticleSummary {
  return {
    id: "article-1",
    slug: "progressive-overload",
    title: "Progressive Overload Explained",
    excerpt: "What it actually means.",
    featuredImageUrl: null,
    publishedAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    viewCount: 0,
    contributor: {
      id: "contrib-1",
      profileId: null,
      name: "Sarah Chen",
      title: "Strength & Conditioning Coach",
      organisation: null,
      qualifications: null,
      bio: "Bio.",
      photoUrl: null,
      expertise: [],
    },
    topics: [{ id: "topic-1", slug: "strength", name: "Strength", description: null, position: 1 }],
    readingTimeMinutes: 4,
    ...overrides,
  };
}

describe("ArticleCard", () => {
  it("links to the article's slug and shows title, author, and reading time", () => {
    render(<ArticleCard article={makeArticle()} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/insights/progressive-overload");
    expect(screen.getByText("Progressive Overload Explained")).toBeInTheDocument();
    expect(screen.getByText("Sarah Chen")).toBeInTheDocument();
    expect(screen.getByText(/4 min read/)).toBeInTheDocument();
  });

  it("shows a fallback icon instead of an image when there's no featured image", () => {
    const { container } = render(<ArticleCard article={makeArticle({ featuredImageUrl: null })} />);
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("renders the real image when a featured image is set", () => {
    // The image has an empty alt (decorative — the card's own title text
    // already conveys the same info) which removes it from the
    // accessibility tree entirely in some browsers/AT, so it's queried by
    // tag here rather than role.
    const { container } = render(<ArticleCard article={makeArticle({ featuredImageUrl: "https://images.unsplash.com/photo-1" })} />);
    expect(container.querySelector("img")).toHaveAttribute("src", "https://images.unsplash.com/photo-1");
  });

  it("shows non-interactive topic badges rather than nested links", () => {
    render(<ArticleCard article={makeArticle()} />);
    // Exactly one link (the card itself) — a nested <a> per topic would be
    // invalid HTML, which is exactly what interactive={false} avoids.
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByText("Strength")).toBeInTheDocument();
  });
});
