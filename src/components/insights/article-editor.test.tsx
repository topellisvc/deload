// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArticleEditor } from "./article-editor";
import type { InsightsEditableArticle, InsightsTopic } from "@/lib/insights/types";

const { routerMock, showToastMock } = vi.hoisted(() => ({
  routerMock: { push: vi.fn() },
  showToastMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: showToastMock }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/components/insights/article-body", () => ({
  ArticleBody: ({ markdown }: { markdown: string }) => <div data-testid="preview">{markdown}</div>,
}));
vi.mock("@/lib/insights/mutations", () => ({
  updateArticleDraft: vi.fn().mockResolvedValue({ error: null }),
  submitArticleForReview: vi.fn().mockResolvedValue({ error: null }),
  withdrawArticleToDraft: vi.fn().mockResolvedValue({ error: null }),
  deleteDraftArticle: vi.fn().mockResolvedValue({ error: null }),
}));

import { submitArticleForReview, updateArticleDraft, withdrawArticleToDraft } from "@/lib/insights/mutations";

const TOPICS: InsightsTopic[] = [
  { id: "topic-strength", slug: "strength", name: "Strength", description: null, position: 1 },
  { id: "topic-nutrition", slug: "nutrition", name: "Nutrition", description: null, position: 2 },
];

function makeArticle(overrides: Partial<InsightsEditableArticle> = {}): InsightsEditableArticle {
  return {
    id: "article-1",
    slug: "progressive-overload",
    title: "Progressive Overload",
    excerpt: "An excerpt.",
    featuredImageUrl: null,
    body: "Some body text.",
    status: "draft",
    seoTitle: null,
    seoDescription: null,
    editorNote: null,
    publishedAt: null,
    updatedAt: "2026-07-01T00:00:00.000Z",
    createdAt: "2026-07-01T00:00:00.000Z",
    contributorId: "contrib-1",
    topicIds: ["topic-strength"],
    references: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(updateArticleDraft).mockClear();
  vi.mocked(submitArticleForReview).mockClear();
  vi.mocked(withdrawArticleToDraft).mockClear();
  showToastMock.mockClear();
});

// These two specifically exercise the debounce timer, so they use fake
// timers and plain fireEvent (rather than userEvent, whose own internal
// scheduling doesn't play well with a faked clock) to drive the change.
describe("ArticleEditor autosave timing", () => {
  it("does not autosave on initial mount", () => {
    vi.useFakeTimers();
    render(<ArticleEditor initial={makeArticle()} topics={TOPICS} />);
    vi.advanceTimersByTime(3000);
    expect(updateArticleDraft).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("autosaves the full current field set after a debounced delay once something changes", () => {
    vi.useFakeTimers();
    render(<ArticleEditor initial={makeArticle()} topics={TOPICS} />);

    fireEvent.change(screen.getByPlaceholderText("Article title"), { target: { value: "New Title" } });
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    vi.advanceTimersByTime(1300);
    expect(updateArticleDraft).toHaveBeenCalledTimes(1);
    expect(updateArticleDraft).toHaveBeenCalledWith(expect.anything(), "article-1", expect.objectContaining({ title: "New Title" }));
    vi.useRealTimers();
  });
});

describe("ArticleEditor status transitions", () => {
  it("blocks submitting for review when required fields are missing", async () => {
    const user = userEvent.setup();
    render(<ArticleEditor initial={makeArticle({ title: "" })} topics={TOPICS} />);

    await user.click(screen.getByRole("button", { name: "Submit for Review" }));

    expect(showToastMock).toHaveBeenCalledWith(expect.stringContaining("Add a title"), "error");
    expect(submitArticleForReview).not.toHaveBeenCalled();
  });

  it("submits for review and moves the status badge to In Review", async () => {
    const user = userEvent.setup();
    render(<ArticleEditor initial={makeArticle()} topics={TOPICS} />);

    await user.click(screen.getByRole("button", { name: "Submit for Review" }));

    expect(await screen.findByText("In Review")).toBeInTheDocument();
    expect(submitArticleForReview).toHaveBeenCalledWith(expect.anything(), "article-1");
  });

  it("locks every field and shows Withdraw to Edit once status is in_review", () => {
    render(<ArticleEditor initial={makeArticle({ status: "in_review" })} topics={TOPICS} />);

    expect(screen.getByPlaceholderText("Article title")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Withdraw to Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit for Review" })).not.toBeInTheDocument();
  });

  it("shows the editor's note when changes were requested", () => {
    render(
      <ArticleEditor
        initial={makeArticle({ status: "changes_requested", editorNote: "Please add a references section." })}
        topics={TOPICS}
      />
    );
    expect(screen.getByText("Please add a references section.", { exact: false })).toBeInTheDocument();
  });

  it("withdraws a locked article back to an editable draft", async () => {
    const user = userEvent.setup();
    render(<ArticleEditor initial={makeArticle({ status: "approved" })} topics={TOPICS} />);

    await user.click(screen.getByRole("button", { name: "Withdraw to Edit" }));

    expect(await screen.findByPlaceholderText("Article title")).not.toBeDisabled();
    expect(withdrawArticleToDraft).toHaveBeenCalledWith(expect.anything(), "article-1");
  });
});
