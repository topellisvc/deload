"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { setFeedbackStatus } from "@/lib/feedback/mutations";
import type { FeedbackWithAuthor } from "@/lib/feedback/types";
import { cn } from "@/lib/utils";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * /admin's read/triage view over every submitted feedback row (migration
 * 0037). Newest first, "new" ones visually flagged; "Mark reviewed" is the
 * only action — no delete/archive, feedback stays here as a permanent
 * record either way (see that migration's comment). Same
 * fetch-once-then-update-local-state pattern as ContributorApplicationQueue.
 */
export function FeedbackQueue({ initial }: { initial: FeedbackWithAuthor[] }) {
  const { showToast } = useToast();
  const [items, setItems] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleToggleStatus(item: FeedbackWithAuthor) {
    const nextStatus = item.status === "new" ? "reviewed" : "new";
    setBusyId(item.id);
    const supabase = createClient();
    const { error } = await setFeedbackStatus(supabase, item.id, nextStatus);
    setBusyId(null);
    if (error) {
      showToast(error, "error");
      return;
    }
    setItems((prev) => prev.map((f) => (f.id === item.id ? { ...f, status: nextStatus } : f)));
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No feedback submitted yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li
          key={item.id}
          className={cn(
            "flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between",
            item.status === "new" ? "border-primary/30 bg-primary/5" : "border-border"
          )}
        >
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">{item.authorDisplayName || item.authorEmail || "Unknown user"}</span>
              {item.status === "new" && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">New</span>
              )}
              <span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
              {item.page_url && <span className="text-xs text-muted-foreground">· {item.page_url}</span>}
            </div>
            <p className="whitespace-pre-wrap text-sm text-foreground">{item.message}</p>
          </div>
          <div className="shrink-0">
            <Button size="sm" variant="outline" onClick={() => handleToggleStatus(item)} disabled={busyId === item.id}>
              {item.status === "new" ? "Mark reviewed" : "Mark new"}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
