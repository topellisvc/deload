import type { Metadata } from "next";
import { ToolCard } from "@/components/tool-card";
import { TOOLS } from "@/lib/tools-registry";

export const metadata: Metadata = {
  title: "Tools",
  description:
    "Browse Deload's collection of evidence-based training tools for athletes and coaches.",
};

export default function ToolsPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-10 flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Tools</h1>
        <p className="text-muted-foreground">
          Every tool here is fully built, evidence-based, and free to use.
          We add new ones slowly, on purpose.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </div>
    </section>
  );
}
