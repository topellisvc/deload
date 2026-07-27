import Link from "next/link";
import { BookMarked, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { InsightsTopic } from "@/lib/insights/types";

/** Homepage's "Browse by Topic" grid, and the /insights/topics index —
 * mirrors ToolCard's icon-square + title + description + arrow layout so
 * Insights reads as part of the same product, not a bolted-on blog. */
export function TopicCard({ topic, articleCount }: { topic: InsightsTopic; articleCount?: number }) {
  return (
    <Link href={`/insights/topics/${topic.slug}`} className="group block focus-visible:outline-none">
      <Card className="h-full transition-colors group-hover:border-border-strong group-focus-visible:ring-2 group-focus-visible:ring-primary">
        <CardContent className="flex h-full flex-col gap-4 pt-6">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookMarked className="size-5" />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <h3 className="font-semibold text-foreground">{topic.name}</h3>
            {topic.description && <p className="text-sm text-muted-foreground">{topic.description}</p>}
          </div>
          <span className="flex items-center gap-1 text-sm font-medium text-primary">
            {articleCount !== undefined ? `${articleCount} article${articleCount === 1 ? "" : "s"}` : "Browse articles"}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
