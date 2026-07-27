"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ArticleStatusBadge } from "@/components/insights/article-status-badge";
import { createClient } from "@/lib/supabase/client";
import { createArticleDraft } from "@/lib/insights/mutations";
import type { InsightsMyArticleSummary } from "@/lib/insights/types";

/** A contributor's own dashboard — a title field to start a brand-new
 * draft (createArticleDraft immediately navigates into the editor once
 * it exists, rather than staying here) plus every article they've ever
 * written, any status, linking straight into the same editor. */
export function MyArticlesList({ contributorId, initial }: { contributorId: string; initial: InsightsMyArticleSummary[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    const supabase = createClient();
    const { article, error } = await createArticleDraft(supabase, contributorId, newTitle.trim());
    setCreating(false);
    if (error || !article) {
      showToast(error ?? "Couldn't start a new draft.", "error");
      return;
    }
    router.push(`/insights/write/${article.id}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleCreate} className="flex gap-2">
        <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="New article title…" className="flex-1" />
        <Button type="submit" disabled={creating || !newTitle.trim()}>
          {creating ? "Creating…" : "New Article"}
        </Button>
      </form>

      {initial.length === 0 ? (
        <p className="text-sm text-muted-foreground">You haven&rsquo;t written anything yet — start with the field above.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {initial.map((article) => (
            <li key={article.id}>
              <Link
                href={`/insights/write/${article.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3.5 transition-colors hover:border-border-strong hover:bg-surface-hover"
              >
                <span className="text-sm font-medium text-foreground">{article.title || "Untitled"}</span>
                <ArticleStatusBadge status={article.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
