import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ToolCard } from "@/components/tool-card";
import { TOOLS } from "@/lib/tools-registry";

export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Evidence-based tools for better training decisions
          </h1>
          <p className="text-lg text-muted-foreground">
            No fluff, no fake precision. Every tool on Deload is built on
            published research and tells you how confident to be in the
            result.
          </p>
          <Link href="/tools/one-rep-max" className={buttonVariants({ size: "lg" })}>
            Try the 1RM calculator
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="mb-6 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Tools
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      </section>
    </>
  );
}
