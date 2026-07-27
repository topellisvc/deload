import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CONTRIBUTOR_APPLICATION_COLUMNS,
  mapContributorApplication,
  mapEditableArticle,
  type ContributorApplicationRow,
} from "@/lib/insights/queries";
import type { InsightsContributorApplication, InsightsContributorStatus, InsightsEditableArticle } from "@/lib/insights/types";

/**
 * Insights' write layer (Phase 2) — every function here relies on RLS
 * (migration 0025) as the actual security boundary, the same way
 * queries.ts's read functions do. A caller with no permission for a given
 * write just gets an `error` back (RLS makes the underlying update/insert
 * affect zero rows or get rejected outright) rather than this file
 * duplicating its own auth checks.
 */

export interface ContributorApplicationInput {
  name: string;
  title: string;
  organisation: string | null;
  qualifications: string | null;
  bio: string;
  expertise: string[];
}

/**
 * Applies to become a contributor, or edits/resubmits an existing
 * application — one function for all three, since the form behind it is
 * the same regardless of whether this is someone's first submission or
 * their second attempt after a rejection. Only actually flips status back
 * to 'pending' when the existing row was 'rejected' (a real resubmission)
 * — editing fields on an already-'pending' or already-'approved' row
 * leaves status untouched, and the database trigger
 * (insights_contributors_guard_status) would silently reject any other
 * self-service status change anyway, so this mirrors what's actually
 * allowed rather than attempting something RLS/the trigger would just
 * undo.
 */
export async function upsertContributorApplication(
  supabase: SupabaseClient,
  profileId: string,
  input: ContributorApplicationInput
): Promise<{ contributor: InsightsContributorApplication | null; error: string | null }> {
  const { data: existing } = await supabase
    .from("insights_contributors")
    .select("id, status")
    .eq("profile_id", profileId)
    .maybeSingle<{ id: string; status: InsightsContributorStatus }>();

  const fields = {
    name: input.name,
    title: input.title,
    organisation: input.organisation,
    qualifications: input.qualifications,
    bio: input.bio,
    expertise: input.expertise,
  };

  if (existing) {
    const nextStatus = existing.status === "rejected" ? "pending" : existing.status;
    const { data, error } = await supabase
      .from("insights_contributors")
      .update({ ...fields, status: nextStatus })
      .eq("id", existing.id)
      .select(CONTRIBUTOR_APPLICATION_COLUMNS)
      .single();
    if (error) return { contributor: null, error: "Couldn't update your application. Try again." };
    return { contributor: mapContributorApplication(data as unknown as ContributorApplicationRow), error: null };
  }

  const { data, error } = await supabase
    .from("insights_contributors")
    .insert({ profile_id: profileId, status: "pending", photo_url: null, ...fields })
    .select(CONTRIBUTOR_APPLICATION_COLUMNS)
    .single();
  if (error) return { contributor: null, error: "Couldn't submit your application. Try again." };
  return { contributor: mapContributorApplication(data as unknown as ContributorApplicationRow), error: null };
}

/** Admin decision on a pending application. RLS only lets an actual admin
 * change another profile's contributor status at all (migration 0025's
 * guard trigger silently reverts anyone else's attempt), so this simply
 * fails closed for a non-admin caller rather than needing its own check. */
export async function reviewContributorApplication(
  supabase: SupabaseClient,
  contributorId: string,
  decision: "approved" | "rejected",
  note?: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("insights_contributors")
    .update({ status: decision, reviewed_at: new Date().toISOString(), review_note: note?.trim() || null })
    .eq("id", contributorId);
  return { error: error ? "Couldn't save this decision. Try again." : null };
}

/** Starts a brand-new draft with just a title — everything else (body,
 * excerpt, topics, references, SEO fields) gets filled in and autosaved
 * from the editor afterward via updateArticleDraft. The slug is a
 * first-pass guess from the title (editable immediately after, like every
 * other field) with a short random suffix so two contributors titling an
 * article "Progressive Overload" on the same day don't collide on the
 * unique slug column before either has a chance to customize it. */
export async function createArticleDraft(
  supabase: SupabaseClient,
  contributorId: string,
  title: string
): Promise<{ article: InsightsEditableArticle | null; error: string | null }> {
  const slug = `${slugify(title) || "untitled"}-${crypto.randomUUID().slice(0, 6)}`;

  const { data, error } = await supabase
    .from("insights_articles")
    .insert({ contributor_id: contributorId, title, slug, excerpt: "", body: "", status: "draft" })
    .select("id, slug, title, excerpt, featured_image_url, body, status, seo_title, seo_description, editor_note, published_at, updated_at, created_at, contributor_id")
    .single();
  if (error) return { article: null, error: "Couldn't start a new draft. Try again." };

  return { article: mapEditableArticle({ ...data, topics: [] }, []), error: null };
}

/**
 * Uploads a contributor's chosen file as an article's featured image to
 * the insights-images Storage bucket (migration 0026) and returns its
 * public URL. The object's path is derived entirely from the article's
 * own (already-immutable) slug plus a short random suffix — never the
 * uploaded file's original name — so nobody picks the image's URL, only
 * which file to upload; two uploads for the same article never collide,
 * and nothing about a contributor's local filename leaks into a public
 * URL. RLS (0026) is the real gate on who can write to this bucket at
 * all, same as every other write in this file.
 */
export async function uploadArticleImage(
  supabase: SupabaseClient,
  articleSlug: string,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const extension = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${articleSlug}-${crypto.randomUUID().slice(0, 8)}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("insights-images")
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (uploadError) return { url: null, error: "Couldn't upload this image. Try again." };

  const {
    data: { publicUrl },
  } = supabase.storage.from("insights-images").getPublicUrl(path);
  return { url: publicUrl, error: null };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface ArticleDraftInput {
  title?: string;
  excerpt?: string;
  featuredImageUrl?: string | null;
  body?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  topicIds?: string[];
  references?: { journalTitle: string; authors: string; year: number | null; url: string | null }[];
}

/**
 * The editor's autosave — only ever writes the fields actually passed in,
 * so a debounced "save whatever changed" call from the editor never
 * clobbers a field the user hasn't touched yet. topicIds/references (both
 * many-to-many/one-to-many, not columns on the article row itself) are
 * fully replaced rather than diffed when provided — simple, and cheap
 * enough at one article's handful of tags/citations.
 */
export async function updateArticleDraft(
  supabase: SupabaseClient,
  articleId: string,
  input: ArticleDraftInput
): Promise<{ error: string | null }> {
  const scalarFields: Record<string, unknown> = {};
  if (input.title !== undefined) scalarFields.title = input.title;
  if (input.excerpt !== undefined) scalarFields.excerpt = input.excerpt;
  if (input.featuredImageUrl !== undefined) scalarFields.featured_image_url = input.featuredImageUrl;
  if (input.body !== undefined) scalarFields.body = input.body;
  if (input.seoTitle !== undefined) scalarFields.seo_title = input.seoTitle;
  if (input.seoDescription !== undefined) scalarFields.seo_description = input.seoDescription;

  if (Object.keys(scalarFields).length > 0) {
    const { error } = await supabase.from("insights_articles").update(scalarFields).eq("id", articleId);
    if (error) return { error: "Couldn't save your changes. Try again." };
  }

  if (input.topicIds !== undefined) {
    const { error: deleteError } = await supabase.from("insights_article_topics").delete().eq("article_id", articleId);
    if (deleteError) return { error: "Couldn't update this article's topics. Try again." };
    if (input.topicIds.length > 0) {
      const { error: insertError } = await supabase
        .from("insights_article_topics")
        .insert(input.topicIds.map((topicId) => ({ article_id: articleId, topic_id: topicId })));
      if (insertError) return { error: "Couldn't update this article's topics. Try again." };
    }
  }

  if (input.references !== undefined) {
    const { error: deleteError } = await supabase.from("insights_references").delete().eq("article_id", articleId);
    if (deleteError) return { error: "Couldn't update this article's references. Try again." };
    if (input.references.length > 0) {
      const { error: insertError } = await supabase.from("insights_references").insert(
        input.references.map((ref, index) => ({
          article_id: articleId,
          journal_title: ref.journalTitle,
          authors: ref.authors,
          year: ref.year,
          url: ref.url,
          position: index,
        }))
      );
      if (insertError) return { error: "Couldn't update this article's references. Try again." };
    }
  }

  return { error: null };
}

/** draft/changes_requested -> in_review. Clears any previous editor note
 * — it applied to the last submission, not this one. */
export async function submitArticleForReview(supabase: SupabaseClient, articleId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("insights_articles").update({ status: "in_review", editor_note: null }).eq("id", articleId);
  return { error: error ? "Couldn't submit this article for review. Try again." : null };
}

/**
 * Pulls an article of any status back to 'draft' so its owner can freely
 * edit it again — the explicit boundary between "safe to autosave
 * anytime" (draft/changes_requested) and "already submitted, don't let
 * edits silently change it out from under a reviewer or a live page"
 * (in_review/approved/published). The editor UI only allows this on the
 * contributor's own article; RLS enforces the same regardless.
 */
export async function withdrawArticleToDraft(supabase: SupabaseClient, articleId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("insights_articles").update({ status: "draft", editor_note: null }).eq("id", articleId);
  return { error: error ? "Couldn't withdraw this article. Try again." : null };
}

/** Admin decision on an in_review article — "approved" means content is
 * signed off and ready to go live (a separate publishArticle call
 * actually makes it public; see that function's comment for why this
 * isn't one combined step), "changes_requested" sends it back to the
 * contributor with a note. */
export async function reviewArticle(
  supabase: SupabaseClient,
  articleId: string,
  decision: "approved" | "changes_requested",
  note?: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("insights_articles")
    .update({ status: decision, editor_note: decision === "changes_requested" ? (note?.trim() || null) : null })
    .eq("id", articleId);
  return { error: error ? "Couldn't save this decision. Try again." : null };
}

/**
 * approved -> published. Kept as its own step rather than folded into
 * reviewArticle's "approved" decision so an admin can approve several
 * articles ahead of time and publish them on their own schedule (e.g.
 * spacing out a backlog) instead of every approval immediately going
 * live. Sets published_at only the first time an article goes live —
 * re-publishing after a later unpublish/edit cycle keeps its original
 * publish date rather than looking freshly posted.
 */
export async function publishArticle(supabase: SupabaseClient, articleId: string): Promise<{ error: string | null }> {
  const { data: existing } = await supabase
    .from("insights_articles")
    .select("published_at")
    .eq("id", articleId)
    .maybeSingle<{ published_at: string | null }>();

  const { error } = await supabase
    .from("insights_articles")
    .update({ status: "published", published_at: existing?.published_at ?? new Date().toISOString() })
    .eq("id", articleId);
  return { error: error ? "Couldn't publish this article. Try again." : null };
}

/** published -> approved (not 'draft') — an unpublished article was
 * already vetted and reviewed, it's just being taken off the public site
 * (e.g. to fix something small or retire it for now); it shouldn't need
 * to go through the whole review queue again just to go back live via
 * publishArticle. published_at is left untouched, same reasoning as
 * publishArticle's own comment. */
export async function unpublishArticle(supabase: SupabaseClient, articleId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("insights_articles").update({ status: "approved" }).eq("id", articleId);
  return { error: error ? "Couldn't unpublish this article. Try again." : null };
}

/** RLS (migration 0023) already restricts this to the article's own
 * contributor and only while status='draft' — the .eq("status","draft")
 * here is a belt-and-suspenders match on the same rule, not the actual
 * security boundary. */
export async function deleteDraftArticle(supabase: SupabaseClient, articleId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("insights_articles").delete().eq("id", articleId).eq("status", "draft");
  return { error: error ? "Couldn't delete this draft. Try again." : null };
}
