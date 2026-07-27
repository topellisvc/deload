// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArticleReviewQueue } from "./article-review-queue";
import type { InsightsReviewQueueArticle } from "@/lib/insights/types";

const { showToastMock } = vi.hoisted(() => ({ showToastMock: vi.fn() }));

vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: showToastMock }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/insights/mutations", () => ({
  adminDeleteArticle: vi.fn().mockResolvedValue({ error: null }),
  publishArticle: vi.fn().mockResolvedValue({ error: null }),
  reviewArticle: vi.fn().mockResolvedValue({ error: null }),
  unpublishArticle: vi.fn().mockResolvedValue({ error: null }),
}));

import { adminDeleteArticle } from "@/lib/insights/mutations";

function makeArticle(overrides: Partial<InsightsReviewQueueArticle> = {}): InsightsReviewQueueArticle {
  return {
    id: "article-1",
    slug: "progressive-overload",
    title: "Progressive Overload",
    excerpt: "An excerpt.",
    status: "approved",
    updatedAt: "2026-07-01T00:00:00.000Z",
    contributorId: "contrib-1",
    contributorName: "Ellis",
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(adminDeleteArticle).mockClear();
  showToastMock.mockClear();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

/** One Delete button per section, all wired to the same admin-only,
 * any-status mutation — the review queue previously had no way to
 * permanently remove an article at all (only unpublish, which just moves
 * it back to 'approved'), leaving test/junk entries stuck in the queue
 * forever. */
describe("ArticleReviewQueue delete", () => {
  it("deletes an approved article and removes it from the Approved section", async () => {
    const user = userEvent.setup();
    const article = makeArticle();
    render(<ArticleReviewQueue inReview={[]} approved={[article]} published={[]} />);

    const section = screen.getByText("Approved — Ready to Publish (1)").closest("div")!;
    await user.click(within(section).getByRole("button", { name: "Delete" }));

    expect(adminDeleteArticle).toHaveBeenCalledWith(expect.anything(), "article-1");
    expect(await screen.findByText("Approved — Ready to Publish (0)")).toBeInTheDocument();
    expect(screen.queryByText("Progressive Overload")).not.toBeInTheDocument();
  });

  it("deletes a published article from the Published section", async () => {
    const user = userEvent.setup();
    const article = makeArticle({ status: "published" });
    render(<ArticleReviewQueue inReview={[]} approved={[]} published={[article]} />);

    const section = screen.getByText("Published (1)").closest("div")!;
    await user.click(within(section).getByRole("button", { name: "Delete" }));

    expect(adminDeleteArticle).toHaveBeenCalledWith(expect.anything(), "article-1");
    expect(await screen.findByText("Published (0)")).toBeInTheDocument();
  });

  it("does not delete when the confirm dialog is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    const article = makeArticle();
    render(<ArticleReviewQueue inReview={[]} approved={[article]} published={[]} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(adminDeleteArticle).not.toHaveBeenCalled();
    expect(screen.getByText("Progressive Overload")).toBeInTheDocument();
  });
});
