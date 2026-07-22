import { TOOLS } from "@/lib/tools-registry";
import { ToolCard } from "@/components/tool-card";

interface RelatedToolsProps {
  /** Slug of the tool currently being viewed, so it isn't listed again. */
  currentSlug: string;
}

/**
 * Surfaces the other live tools at the bottom of every tool page. Without
 * this, each tool page is a dead end — someone who lands on the 1RM
 * calculator from search has no obvious path to discovering the ACWR
 * calculator or workout generator exist at all.
 */
export function RelatedTools({ currentSlug }: RelatedToolsProps) {
  const others = TOOLS.filter((tool) => tool.slug !== currentSlug);
  if (others.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 pb-16">
      <h2 className="mb-6 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        More tools
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {others.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </div>
    </section>
  );
}
