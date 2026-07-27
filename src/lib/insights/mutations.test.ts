import { describe, it, expect, vi } from "vitest";
import {
  createArticleDraft,
  publishArticle,
  reviewArticle,
  unpublishArticle,
  updateArticleDraft,
  uploadArticleImage,
  upsertContributorApplication,
} from "./mutations";

const APPLICATION_INPUT = {
  name: "Jordan Lee",
  title: "Strength Coach",
  organisation: null,
  qualifications: null,
  bio: "Bio.",
  expertise: ["Strength"],
};

/** A minimal thenable/chainable mock covering exactly the operations
 * these mutations issue against a given table — select/eq/maybeSingle for
 * the "does a row already exist" lookups, and insert/update/delete/select
 * for the actual writes. Each table gets its own in-memory list of rows
 * so assertions can inspect what was actually written. */
function makeSupabaseMock() {
  const inserted: Record<string, unknown[]> = {};
  const updated: Record<string, unknown[]> = {};
  const deletedFilters: Record<string, Record<string, unknown>[]> = {};

  function makeBuilder(table: string, existingRow: Record<string, unknown> | null) {
    let lastInsertOrUpdate: Record<string, unknown> | null = null;
    const filters: Record<string, unknown> = {};

    const builder = {
      select: () => builder,
      eq(field: string, value: unknown) {
        filters[field] = value;
        return builder;
      },
      insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
        const rows = Array.isArray(payload) ? payload : [payload];
        inserted[table] = [...(inserted[table] ?? []), ...rows];
        lastInsertOrUpdate = Array.isArray(payload) ? payload[0]! : payload;
        return builder;
      },
      update(payload: Record<string, unknown>) {
        updated[table] = [...(updated[table] ?? []), payload];
        lastInsertOrUpdate = payload;
        return builder;
      },
      delete() {
        deletedFilters[table] = [...(deletedFilters[table] ?? []), {}];
        return builder;
      },
      single: () => Promise.resolve({ data: { ...existingRow, ...lastInsertOrUpdate, id: existingRow?.id ?? "new-id" }, error: null }),
      maybeSingle: () => Promise.resolve({ data: existingRow, error: null }),
      then(resolve: (v: { data: null; error: null }) => void) {
        resolve({ data: null, error: null });
      },
    };
    return builder;
  }

  const existingRows: Record<string, Record<string, unknown> | null> = {};

  const supabase = {
    from: vi.fn((table: string) => makeBuilder(table, existingRows[table] ?? null)),
    __setExisting: (table: string, row: Record<string, unknown> | null) => {
      existingRows[table] = row;
    },
    __inserted: inserted,
    __updated: updated,
    __deletedFilters: deletedFilters,
  };
  return supabase;
}

describe("upsertContributorApplication", () => {
  it("inserts a new pending application when the profile has never applied", async () => {
    const supabase = makeSupabaseMock();
    supabase.__setExisting("insights_contributors", null);

    const { contributor, error } = await upsertContributorApplication(supabase as never, "profile-1", APPLICATION_INPUT);

    expect(error).toBeNull();
    expect(contributor?.status).toBe("pending");
    expect(supabase.__inserted.insights_contributors?.[0]).toMatchObject({ profile_id: "profile-1", status: "pending", name: "Jordan Lee" });
  });

  it("resubmits (rejected -> pending) when editing an existing rejected application", async () => {
    const supabase = makeSupabaseMock();
    supabase.__setExisting("insights_contributors", { id: "contrib-1", status: "rejected" });

    await upsertContributorApplication(supabase as never, "profile-1", APPLICATION_INPUT);

    expect(supabase.__updated.insights_contributors?.[0]).toMatchObject({ status: "pending" });
  });

  it("leaves status untouched when editing an already-pending or approved application", async () => {
    const supabase = makeSupabaseMock();
    supabase.__setExisting("insights_contributors", { id: "contrib-1", status: "approved" });

    await upsertContributorApplication(supabase as never, "profile-1", APPLICATION_INPUT);

    expect(supabase.__updated.insights_contributors?.[0]).toMatchObject({ status: "approved" });
  });
});

describe("createArticleDraft", () => {
  it("slugifies the title and appends a random suffix to avoid collisions", async () => {
    const supabase = makeSupabaseMock();
    const { article, error } = await createArticleDraft(supabase as never, "contrib-1", "Progressive Overload!!");

    expect(error).toBeNull();
    expect(article?.slug).toMatch(/^progressive-overload-[a-z0-9]{6}$/);
    expect(article?.status).toBe("draft");
    expect(article?.topicIds).toEqual([]);
  });

  it("falls back to 'untitled' when the title has no usable characters", async () => {
    const supabase = makeSupabaseMock();
    const { article } = await createArticleDraft(supabase as never, "contrib-1", "!!!");
    expect(article?.slug).toMatch(/^untitled-[a-z0-9]{6}$/);
  });
});

describe("updateArticleDraft", () => {
  it("only writes fields that were actually passed in", async () => {
    const supabase = makeSupabaseMock();
    await updateArticleDraft(supabase as never, "article-1", { title: "New Title" });

    expect(supabase.__updated.insights_articles?.[0]).toEqual({ title: "New Title" });
  });

  it("fully replaces topic tags when topicIds is provided", async () => {
    const supabase = makeSupabaseMock();
    await updateArticleDraft(supabase as never, "article-1", { topicIds: ["topic-a", "topic-b"] });

    expect(supabase.__deletedFilters.insights_article_topics).toHaveLength(1);
    expect(supabase.__inserted.insights_article_topics).toEqual([
      { article_id: "article-1", topic_id: "topic-a" },
      { article_id: "article-1", topic_id: "topic-b" },
    ]);
  });

  it("deletes without re-inserting when topicIds is an empty array", async () => {
    const supabase = makeSupabaseMock();
    await updateArticleDraft(supabase as never, "article-1", { topicIds: [] });

    expect(supabase.__deletedFilters.insights_article_topics).toHaveLength(1);
    expect(supabase.__inserted.insights_article_topics ?? []).toHaveLength(0);
  });

  it("does not touch topics or references when neither is provided", async () => {
    const supabase = makeSupabaseMock();
    await updateArticleDraft(supabase as never, "article-1", { body: "New body" });

    expect(supabase.__deletedFilters.insights_article_topics).toBeUndefined();
    expect(supabase.__deletedFilters.insights_references).toBeUndefined();
  });
});

describe("uploadArticleImage", () => {
  /** Storage's own client shape is nothing like the postgrest builder the
   * other tests mock (from/select/eq/...) — it's its own namespaced API,
   * so this gets a small dedicated fake rather than stretching
   * makeSupabaseMock to cover both. */
  function makeStorageMock(uploadError: { message: string } | null = null) {
    const uploadCalls: { path: string; file: unknown; options: unknown }[] = [];
    const supabase = {
      storage: {
        from: (bucket: string) => ({
          upload: (path: string, file: unknown, options: unknown) => {
            uploadCalls.push({ path, file, options });
            return Promise.resolve({ data: uploadError ? null : { path }, error: uploadError });
          },
          getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.example.com/${bucket}/${path}` } }),
        }),
      },
    };
    return { supabase, uploadCalls };
  }

  it("uploads to a slug-derived path and returns the bucket's public URL", async () => {
    const { supabase, uploadCalls } = makeStorageMock();
    const file = new File(["fake-bytes"], "my vacation photo.PNG", { type: "image/png" });

    const { url, error } = await uploadArticleImage(supabase as never, "progressive-overload", file);

    expect(error).toBeNull();
    expect(url).toMatch(/^https:\/\/storage\.example\.com\/insights-images\/progressive-overload-[a-z0-9]{8}\.png$/);
    expect(uploadCalls).toHaveLength(1);
    expect(uploadCalls[0]!.path).not.toContain("vacation");
  });

  it("returns an error when the upload fails", async () => {
    const { supabase } = makeStorageMock({ message: "boom" });
    const file = new File(["fake-bytes"], "photo.png", { type: "image/png" });

    const { url, error } = await uploadArticleImage(supabase as never, "progressive-overload", file);

    expect(url).toBeNull();
    expect(error).toBe("Couldn't upload this image. Try again.");
  });
});

describe("reviewArticle", () => {
  it("clears the editor note on approval", async () => {
    const supabase = makeSupabaseMock();
    await reviewArticle(supabase as never, "article-1", "approved");
    expect(supabase.__updated.insights_articles?.[0]).toEqual({ status: "approved", editor_note: null });
  });

  it("attaches the note when requesting changes", async () => {
    const supabase = makeSupabaseMock();
    await reviewArticle(supabase as never, "article-1", "changes_requested", "Please add a references section.");
    expect(supabase.__updated.insights_articles?.[0]).toEqual({
      status: "changes_requested",
      editor_note: "Please add a references section.",
    });
  });
});

describe("publishArticle / unpublishArticle", () => {
  it("sets published_at the first time an article is published", async () => {
    const supabase = makeSupabaseMock();
    supabase.__setExisting("insights_articles", { published_at: null });

    await publishArticle(supabase as never, "article-1");

    const update = supabase.__updated.insights_articles?.[0] as { status: string; published_at: string };
    expect(update.status).toBe("published");
    expect(update.published_at).toEqual(expect.any(String));
  });

  it("preserves the original published_at on a re-publish", async () => {
    const supabase = makeSupabaseMock();
    supabase.__setExisting("insights_articles", { published_at: "2026-01-01T00:00:00.000Z" });

    await publishArticle(supabase as never, "article-1");

    expect(supabase.__updated.insights_articles?.[0]).toMatchObject({ published_at: "2026-01-01T00:00:00.000Z" });
  });

  it("unpublish moves an article to 'approved', not 'draft'", async () => {
    const supabase = makeSupabaseMock();
    await unpublishArticle(supabase as never, "article-1");
    expect(supabase.__updated.insights_articles?.[0]).toEqual({ status: "approved" });
  });
});
