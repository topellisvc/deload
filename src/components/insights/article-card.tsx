import Link from "next/link";
import Image from "next/image";
import { Clock, Newspaper } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ContributorAvatar } from "@/components/insights/contributor-avatar";
import { TopicBadge } from "@/components/insights/topic-badge";
import { formatArticleDate } from "@/lib/insights/format-date";
import type { InsightsArticleSummary } from "@/lib/insights/types";

interface ArticleCardProps {
  article: InsightsArticleSummary;
  /** The homepage's featured-article slot renders a larger, image-left
   * layout instead of the standard vertical card used everywhere else
   * (Latest Articles, topic pages, contributor pages, search results). */
  featured?: boolean;
}

export function ArticleCard({ article, featured = false }: ArticleCardProps) {
  // Non-interactive badges — the whole card is already a link to the
  // article, so a nested <a> per topic would be invalid HTML (and
  // ambiguous to click). Topic pages are reachable from the article page
  // itself and from "Browse by Topic," not from here.
  const topicRow = article.topics.slice(0, 2).map((topic) => <TopicBadge key={topic.id} topic={topic} interactive={false} />);

  return (
    <Link href={`/insights/${article.slug}`} className="group block h-full focus-visible:outline-none">
      <Card
        className={
          featured
            ? "grid h-full overflow-hidden transition-colors group-hover:border-border-strong group-focus-visible:ring-2 group-focus-visible:ring-primary md:grid-cols-2"
            : "flex h-full flex-col overflow-hidden transition-colors group-hover:border-border-strong group-focus-visible:ring-2 group-focus-visible:ring-primary"
        }
      >
        <ArticleImage article={article} className={featured ? "aspect-[4/3] md:aspect-auto md:h-full" : "aspect-[16/9]"} />
        <CardContent className={featured ? "flex flex-col justify-center gap-3 p-6 pt-6 md:p-8" : "flex flex-1 flex-col gap-3 pt-5"}>
          {topicRow.length > 0 && <div className="flex flex-wrap gap-1.5">{topicRow}</div>}
          <h3 className={featured ? "text-2xl font-bold tracking-tight text-foreground" : "font-semibold text-foreground"}>
            {article.title}
          </h3>
          <p className={featured ? "text-base text-muted-foreground" : "line-clamp-2 text-sm text-muted-foreground"}>
            {article.excerpt}
          </p>
          <div className="mt-auto flex items-center gap-2.5 pt-2">
            <ContributorAvatar name={article.contributor.name} photoUrl={article.contributor.photoUrl} size="sm" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-xs font-medium text-foreground">{article.contributor.name}</span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                {formatArticleDate(article.publishedAt)}
                <span aria-hidden>·</span>
                <Clock className="size-3" />
                {article.readingTimeMinutes} min read
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ArticleImage({ article, className }: { article: InsightsArticleSummary; className: string }) {
  if (!article.featuredImageUrl) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className}`}>
        <Newspaper className="size-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image
        src={article.featuredImageUrl}
        alt=""
        fill
        sizes="(min-width: 768px) 50vw, 100vw"
        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />
    </div>
  );
}
