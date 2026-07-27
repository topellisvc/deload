"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import {
  deleteDraftArticle,
  submitArticleForReview,
  updateArticleDraft,
  uploadArticleImage,
  withdrawArticleToDraft,
} from "@/lib/insights/mutations";
import { ArticleBody } from "@/components/insights/article-body";
import { ArticleStatusBadge } from "@/components/insights/article-status-badge";
import { cn } from "@/lib/utils";
import type { InsightsEditableArticle, InsightsTopic } from "@/lib/insights/types";

interface ReferenceDraft {
  /** Local-only React key — the id column's own value once it's an
   * existing reference, or a fresh random one for a row added in this
   * session that hasn't been saved yet. Never sent to the database
   * (updateArticleDraft's full-replace strategy doesn't need it). */
  key: string;
  journalTitle: string;
  authors: string;
  year: string;
  url: string;
}

function referencesFromArticle(article: InsightsEditableArticle): ReferenceDraft[] {
  return article.references.map((r) => ({
    key: r.id,
    journalTitle: r.journalTitle,
    authors: r.authors,
    year: r.year?.toString() ?? "",
    url: r.url ?? "",
  }));
}

type SaveState = "saved" | "saving" | "dirty" | "error";

/**
 * The whole editor: split-pane raw Markdown + live preview, plus every
 * other editable field, with a debounced autosave. Locks every field
 * (via `editable`) once the article has left draft/changes_requested —
 * see mutations.ts's withdrawArticleToDraft doc comment for why that
 * boundary exists (an in-flight review or a live published article
 * shouldn't silently change under a reviewer or a reader). "Withdraw to
 * Edit" is the explicit, visible way back into an editable state.
 */
export function ArticleEditor({ initial, topics }: { initial: InsightsEditableArticle; topics: InsightsTopic[] }) {
  const router = useRouter();
  const { showToast } = useToast();

  const [article, setArticle] = useState(initial);
  const [title, setTitle] = useState(initial.title);
  // The slug is fixed at creation (createArticleDraft) from the title and
  // never user-editable afterward — changing it later would break any
  // links already shared to this article's URL, and nobody should be
  // hand-picking it in the first place. It's shown read-only below purely
  // so a contributor can see what their article's URL actually is.
  const [excerpt, setExcerpt] = useState(initial.excerpt);
  const [featuredImageUrl, setFeaturedImageUrl] = useState(initial.featuredImageUrl ?? "");
  const [body, setBody] = useState(initial.body);
  const [topicIds, setTopicIds] = useState<string[]>(initial.topicIds);
  const [references, setReferences] = useState<ReferenceDraft[]>(referencesFromArticle(initial));

  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const skipNextAutosave = useRef(true);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editable = article.status === "draft" || article.status === "changes_requested";

  const save = useCallback(async () => {
    setSaveState("saving");
    const supabase = createClient();
    const { error } = await updateArticleDraft(supabase, article.id, {
      title,
      excerpt,
      featuredImageUrl: featuredImageUrl.trim() || null,
      body,
      topicIds,
      references: references.map((r) => ({
        journalTitle: r.journalTitle,
        authors: r.authors,
        year: r.year.trim() ? Number(r.year) : null,
        url: r.url.trim() || null,
      })),
    });
    setSaveState(error ? "error" : "saved");
  }, [article.id, title, excerpt, featuredImageUrl, body, topicIds, references]);

  useEffect(() => {
    if (!editable) return;
    // The very first run is this effect reacting to its own initial
    // state, not a real edit — skip it so opening the editor doesn't
    // immediately fire an autosave with nothing changed.
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    setSaveState("dirty");
    const timeout = setTimeout(() => void save(), 1200);
    return () => clearTimeout(timeout);
    // save() is intentionally omitted: it's derived from the same state
    // values already listed below, and including it would just re-run
    // this effect on every render instead of only on an actual field
    // change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, title, excerpt, featuredImageUrl, body, topicIds, references]);

  function toggleTopic(topicId: string) {
    setTopicIds((prev) => (prev.includes(topicId) ? prev.filter((id) => id !== topicId) : [...prev, topicId]));
  }

  function addReference() {
    setReferences((prev) => [...prev, { key: crypto.randomUUID(), journalTitle: "", authors: "", year: "", url: "" }]);
  }

  function updateReference(key: string, patch: Partial<ReferenceDraft>) {
    setReferences((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeReference(key: string) {
    setReferences((prev) => prev.filter((r) => r.key !== key));
  }

  async function handleSubmitForReview() {
    if (!title.trim() || !excerpt.trim() || !body.trim() || topicIds.length === 0) {
      showToast("Add a title, excerpt, body, and at least one topic before submitting.", "error");
      return;
    }
    setSubmitting(true);
    await save();
    const supabase = createClient();
    const { error } = await submitArticleForReview(supabase, article.id);
    setSubmitting(false);
    if (error) {
      showToast(error, "error");
      return;
    }
    setArticle((prev) => ({ ...prev, status: "in_review" }));
    showToast("Submitted for review");
  }

  async function handleWithdraw() {
    const supabase = createClient();
    const { error } = await withdrawArticleToDraft(supabase, article.id);
    if (error) {
      showToast(error, "error");
      return;
    }
    setArticle((prev) => ({ ...prev, status: "draft", editorNote: null }));
    showToast("Moved back to draft — you can edit it again now.");
  }

  async function handleDelete() {
    if (!confirm("Delete this draft? This can't be undone.")) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await deleteDraftArticle(supabase, article.id);
    setDeleting(false);
    if (error) {
      showToast(error, "error");
      return;
    }
    router.push("/insights/write");
  }

  async function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so choosing the same file again (e.g. after removing it) still
    // fires a change event.
    e.target.value = "";
    if (!file) return;
    setUploadingImage(true);
    const supabase = createClient();
    const { url, error } = await uploadArticleImage(supabase, article.slug, file);
    setUploadingImage(false);
    if (error || !url) {
      showToast(error ?? "Couldn't upload this image. Try again.", "error");
      return;
    }
    setFeaturedImageUrl(url);
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ArticleStatusBadge status={article.status} />
          {editable && <SaveIndicator state={saveState} />}
        </div>
        <div className="flex gap-2">
          {article.status === "draft" && (
            <Button
              variant="outline"
              size="sm"
              className="border-danger/30 text-danger hover:border-danger hover:bg-danger/10"
              onClick={handleDelete}
              disabled={deleting}
            >
              Delete Draft
            </Button>
          )}
          {!editable && (
            <Button variant="outline" size="sm" onClick={handleWithdraw}>
              Withdraw to Edit
            </Button>
          )}
          {editable && (
            <Button size="sm" onClick={handleSubmitForReview} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit for Review"}
            </Button>
          )}
        </div>
      </div>

      {article.status === "changes_requested" && article.editorNote && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
          <p className="text-sm font-medium text-foreground">Changes requested</p>
          <p className="mt-1 text-sm text-muted-foreground">&ldquo;{article.editorNote}&rdquo;</p>
        </div>
      )}

      {!editable && (
        <p className="text-sm text-muted-foreground">
          This article is{" "}
          {article.status === "in_review" ? "awaiting review" : article.status === "approved" ? "approved and ready to publish" : "live"} —
          withdraw it to make further changes.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Input
          value={title}
          disabled={!editable}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Article title"
          className="h-14 text-2xl font-bold"
        />
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <span>/insights/</span>
          <span className="font-medium text-foreground">{article.slug}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="article-excerpt">Excerpt</Label>
        <Textarea
          id="article-excerpt"
          rows={2}
          disabled={!editable}
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder="A one- or two-sentence summary shown on article cards."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Featured image</Label>
          {featuredImageUrl ? (
            <div className="relative h-32 w-full max-w-xs overflow-hidden rounded-lg border border-border">
              <Image src={featuredImageUrl} alt="" fill className="object-cover" unoptimized />
              {editable && (
                <button
                  type="button"
                  onClick={() => setFeaturedImageUrl("")}
                  className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm hover:bg-background"
                  aria-label="Remove image"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No image uploaded yet.</p>
          )}
          {editable && (
            <>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageFileChange}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-fit"
                disabled={uploadingImage}
                onClick={() => imageInputRef.current?.click()}
              >
                <ImagePlus className="size-3.5" />
                {uploadingImage ? "Uploading…" : featuredImageUrl ? "Replace image" : "Upload image"}
              </Button>
            </>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label>Topics</Label>
          <div className="flex flex-wrap gap-2">
            {topics.map((topic) => {
              const selected = topicIds.includes(topic.id);
              return (
                <button
                  key={topic.id}
                  type="button"
                  disabled={!editable}
                  onClick={() => toggleTopic(topic.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-border-strong"
                  )}
                >
                  {topic.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Body (Markdown)</Label>
        <div className="grid gap-4 lg:grid-cols-2">
          <Textarea
            rows={24}
            disabled={!editable}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="## Heading&#10;&#10;Write in Markdown — headings, lists, blockquotes, tables, and images all render in the preview."
            className="font-mono text-sm"
          />
          <div className="max-h-[600px] overflow-y-auto rounded-lg border border-border bg-background p-4">
            <ArticleBody markdown={body || "*Nothing written yet.*"} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>References</Label>
          {editable && (
            <Button type="button" variant="secondary" size="sm" onClick={addReference}>
              <Plus className="size-3.5" />
              Add reference
            </Button>
          )}
        </div>
        {references.length === 0 && <p className="text-sm text-muted-foreground">No references yet.</p>}
        {references.map((reference) => (
          <div key={reference.key} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[2fr_2fr_80px_2fr_auto]">
            <Input
              disabled={!editable}
              value={reference.journalTitle}
              onChange={(e) => updateReference(reference.key, { journalTitle: e.target.value })}
              placeholder="Journal / source"
            />
            <Input
              disabled={!editable}
              value={reference.authors}
              onChange={(e) => updateReference(reference.key, { authors: e.target.value })}
              placeholder="Authors"
            />
            <Input
              disabled={!editable}
              value={reference.year}
              onChange={(e) => updateReference(reference.key, { year: e.target.value })}
              placeholder="Year"
              inputMode="numeric"
            />
            <Input
              disabled={!editable}
              value={reference.url}
              onChange={(e) => updateReference(reference.key, { url: e.target.value })}
              placeholder="URL (optional)"
            />
            {editable && (
              <Button type="button" variant="ghost" size="sm" onClick={() => removeReference(reference.key)}>
                <Trash2 className="size-4 text-danger" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") return <span className="text-xs text-muted-foreground">Saving…</span>;
  if (state === "dirty") return <span className="text-xs text-muted-foreground">Unsaved changes</span>;
  if (state === "error") return <span className="text-xs text-danger">Couldn&rsquo;t save — retrying on your next change</span>;
  return <span className="text-xs text-success">All changes saved</span>;
}
