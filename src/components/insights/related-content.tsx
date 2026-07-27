import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ArticleCard } from "@/components/insights/article-card";
import type { ToolMeta } from "@/lib/tools-registry";
import type { InsightsArticleSummary } from "@/lib/insights/types";

interface RelatedContentProps {
  articles: InsightsArticleSummary[];
  /** Future-ready per the spec ("relevant tools" / "relevant programs" at
   * an article's bottom) — no caller passes these yet in Phase 1, since
   * matching an article to a specific tool/program isn't modeled
   * anywhere yet (that's a real design question: by topic? manually
   * curated per article?). Left as optional props so wiring it up later
   * is additive — pass `tools`/`programs` and this section appears, with
   * zero changes needed to the component itself or its callers that
   * don't have that data yet. */
  tools?: ToolMeta[];
  programs?: { id: string; name: string; href: string }[];
}

export function RelatedContent({ articles, tools = [], programs = [] }: RelatedContentProps) {
  if (articles.length === 0 && tools.length === 0 && programs.length === 0) return null;

  return (
    <section className="mx-auto mt-12 max-w-4xl border-t border-border pt-10">
      {articles.length > 0 && (
        <div className="mb-10">
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">Related Articles</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      )}

      {tools.length > 0 && (
        <div className="mb-10">
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">Relevant Tools</h2>
          <ul className="flex flex-col gap-2">
            {tools.map((tool) => (
              <li key={tool.slug}>
                <Link href={`/tools/${tool.slug}`} className="group flex items-center gap-1.5 text-sm font-medium text-primary">
                  {tool.name}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {programs.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">Relevant Programs</h2>
          <ul className="flex flex-col gap-2">
            {programs.map((program) => (
              <li key={program.id}>
                <Link href={program.href} className="group flex items-center gap-1.5 text-sm font-medium text-primary">
                  {program.name}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
