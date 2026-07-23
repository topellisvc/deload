import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/dashboard/insights";

const TONE_STYLES: Record<Insight["tone"], string> = {
  positive: "border-primary/30 bg-primary/5 text-primary",
  neutral: "border-border bg-background text-foreground",
  warning: "border-danger/30 bg-danger/5 text-danger",
};

/**
 * Purely a renderer — computeInsights (lib/dashboard/insights.ts) already
 * did all the rule evaluation. Rule-based today; swapping in AI-generated
 * insights later only means changing what produces the Insight[] array,
 * not this component.
 */
export function EvidenceInsightsSection({ insights }: { insights: Insight[] }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 flex items-center gap-1.5 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        <Sparkles className="size-3.5" />
        Evidence insights
      </h2>
      {insights.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Log a few more sessions and insights about your training will start showing up here.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className={cn("flex items-start gap-2.5 rounded-lg border p-3.5", TONE_STYLES[insight.tone])}
            >
              <insight.icon className="mt-0.5 size-4 shrink-0" />
              <p className="text-sm">{insight.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
