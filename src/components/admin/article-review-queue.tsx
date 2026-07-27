"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { publishArticle, reviewArticle, unpublishArticle } from "@/lib/insights/mutations";
import type { InsightsReviewQueueArticle } from "@/lib/insights/types";

interface ArticleReviewQueueProps {
  inReview: InsightsReviewQueueArticle[];
  approved: InsightsReviewQueueArticle[];
  published: InsightsReviewQueueArticle[];
}

/**
 * The admin side of the draft -> in_review -> approved -> published
 * pipeline: three lists, each moving an article into the next one on
 * success (or back to "Approved" on Unpublish — see unpublishArticle's
 * doc comment for why that's 'approved' rather than 'draft'). Article
 * titles link straight into the same editor a contributor uses
 * (/insights/write/[id]), so an admin can actually read the full piece
 * before deciding, not just a title and excerpt.
 */
export function ArticleReviewQueue({ inReview, approved, published }: ArticleReviewQueueProps) {
  const { showToast } = useToast();
  const [reviewList, setReviewList] = useState(inReview);
  const [approvedList, setApprovedList] = useState(approved);
  const [publishedList, setPublishedList] = useState(published);
  const [requestingChanges, setRequestingChanges] = useState<InsightsReviewQueueArticle | null>(null);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleApprove(article: InsightsReviewQueueArticle) {
    setBusyId(article.id);
    const supabase = createClient();
    const { error } = await reviewArticle(supabase, article.id, "approved");
    setBusyId(null);
    if (error) {
      showToast(error, "error");
      return;
    }
    setReviewList((prev) => prev.filter((a) => a.id !== article.id));
    setApprovedList((prev) => [...prev, article]);
    showToast(`Approved "${article.title}"`);
  }

  async function handleRequestChanges() {
    if (!requestingChanges) return;
    setBusyId(requestingChanges.id);
    const supabase = createClient();
    const { error } = await reviewArticle(supabase, requestingChanges.id, "changes_requested", note);
    setBusyId(null);
    if (error) {
      showToast(error, "error");
      return;
    }
    setReviewList((prev) => prev.filter((a) => a.id !== requestingChanges.id));
    showToast(`Sent "${requestingChanges.title}" back for changes`);
    setRequestingChanges(null);
    setNote("");
  }

  async function handlePublish(article: InsightsReviewQueueArticle) {
    setBusyId(article.id);
    const supabase = createClient();
    const { error } = await publishArticle(supabase, article.id);
    setBusyId(null);
    if (error) {
      showToast(error, "error");
      return;
    }
    setApprovedList((prev) => prev.filter((a) => a.id !== article.id));
    setPublishedList((prev) => [article, ...prev]);
    showToast(`Published "${article.title}"`);
  }

  async function handleUnpublish(article: InsightsReviewQueueArticle) {
    setBusyId(article.id);
    const supabase = createClient();
    const { error } = await unpublishArticle(supabase, article.id);
    setBusyId(null);
    if (error) {
      showToast(error, "error");
      return;
    }
    setPublishedList((prev) => prev.filter((a) => a.id !== article.id));
    setApprovedList((prev) => [...prev, article]);
    showToast(`Unpublished "${article.title}"`);
  }

  return (
    <div className="flex flex-col gap-8">
      <QueueSection
        title="Awaiting Review"
        emptyLabel="Nothing waiting on a decision."
        articles={reviewList}
        renderActions={(article) => (
          <>
            <Button size="sm" onClick={() => handleApprove(article)} disabled={busyId === article.id}>
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-warning/30 text-warning hover:border-warning hover:bg-warning/10"
              onClick={() => setRequestingChanges(article)}
              disabled={busyId === article.id}
            >
              Request Changes
            </Button>
          </>
        )}
      />

      <QueueSection
        title="Approved — Ready to Publish"
        emptyLabel="Nothing approved yet."
        articles={approvedList}
        renderActions={(article) => (
          <Button size="sm" onClick={() => handlePublish(article)} disabled={busyId === article.id}>
            Publish
          </Button>
        )}
      />

      <QueueSection
        title="Published"
        emptyLabel="Nothing published yet."
        articles={publishedList}
        renderActions={(article) => (
          <Button
            size="sm"
            variant="outline"
            className="border-danger/30 text-danger hover:border-danger hover:bg-danger/10"
            onClick={() => handleUnpublish(article)}
            disabled={busyId === article.id}
          >
            Unpublish
          </Button>
        )}
      />

      <Dialog
        open={requestingChanges !== null}
        onClose={() => setRequestingChanges(null)}
        title="Request changes"
        description={requestingChanges ? `Leave a note for ${requestingChanges.contributorName} on "${requestingChanges.title}".` : undefined}
      >
        <div className="flex flex-col gap-4">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What needs to change?" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRequestingChanges(null)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              className="border-warning/30 text-warning hover:border-warning hover:bg-warning/10"
              onClick={handleRequestChanges}
              disabled={busyId === requestingChanges?.id}
            >
              Send
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function QueueSection({
  title,
  emptyLabel,
  articles,
  renderActions,
}: {
  title: string;
  emptyLabel: string;
  articles: InsightsReviewQueueArticle[];
  renderActions: (article: InsightsReviewQueueArticle) => ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title} ({articles.length})
      </h3>
      {articles.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {articles.map((article) => (
            <li
              key={article.id}
              className="flex flex-col gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-0.5">
                <Link href={`/insights/write/${article.id}`} className="text-sm font-medium text-foreground hover:text-primary">
                  {article.title}
                </Link>
                <span className="text-xs text-muted-foreground">by {article.contributorName}</span>
              </div>
              <div className="flex shrink-0 gap-2">{renderActions(article)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
