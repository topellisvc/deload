import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ToolMeta } from "@/lib/tools-registry";

export function ToolCard({ tool }: { tool: ToolMeta }) {
  const Icon = tool.icon;
  return (
    <Link href={`/tools/${tool.slug}`} className="group block focus-visible:outline-none">
      <Card className="h-full transition-colors group-hover:border-border-strong group-focus-visible:ring-2 group-focus-visible:ring-primary">
        <CardContent className="flex h-full flex-col gap-4 pt-6">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <h3 className="font-semibold text-foreground">{tool.name}</h3>
            <p className="text-sm text-muted-foreground">{tool.description}</p>
          </div>
          <span className="flex items-center gap-1 text-sm font-medium text-primary">
            Open tool
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
