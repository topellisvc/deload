import { cn } from "@/lib/utils";
import type { InsightsArticleStatus } from "@/lib/insights/types";

const STATUS_LABEL: Record<InsightsArticleStatus, string> = {
  draft: "Draft",
  in_review: "In Review",
  changes_requested: "Changes Requested",
  approved: "Approved",
  published: "Published",
};

const STATUS_CLASSNAME: Record<InsightsArticleStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  in_review: "bg-primary/10 text-primary",
  changes_requested: "bg-warning/10 text-warning",
  approved: "bg-primary/10 text-primary",
  published: "bg-success/10 text-success",
};

/** One small pill, reused across the contributor's "My Articles" list, the
 * article editor, and the admin review queue — a single source of truth
 * for what each of the five insights_articles.status values is called and
 * colored, so the three surfaces can never drift out of sync with each
 * other. */
export function ArticleStatusBadge({ status }: { status: InsightsArticleStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", STATUS_CLASSNAME[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}
