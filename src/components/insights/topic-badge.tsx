import Link from "next/link";
import { cn } from "@/lib/utils";
import type { InsightsTopic } from "@/lib/insights/types";

/** Small pill linking to a topic's article-listing page — used on
 * ArticleCard, the article page's tag row, and the homepage's topic
 * browser. `interactive={false}` renders a plain span instead of a link,
 * for the rare case a topic name needs to show without being clickable
 * (e.g. inside an already-clickable ArticleCard, where a nested <a>
 * would be invalid HTML). */
export function TopicBadge({ topic, interactive = true }: { topic: InsightsTopic; interactive?: boolean }) {
  const classes = "inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors";

  if (!interactive) {
    return <span className={classes}>{topic.name}</span>;
  }

  return (
    <Link href={`/insights/topics/${topic.slug}`} className={cn(classes, "hover:bg-primary/20")}>
      {topic.name}
    </Link>
  );
}
