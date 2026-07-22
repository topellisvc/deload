"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, TrendingDown, TrendingUp, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AcwrBarChart } from "@/components/calculators/acwr-bar-chart";
import { computeAcwr, type AcwrZone } from "@/lib/calculators/acwr";
import { cn } from "@/lib/utils";

const WEEK_LABELS = ["4 weeks ago", "3 weeks ago", "2 weeks ago", "This week"];

const loadSchema = z
  .array(
    z
      .number()
      .nonnegative("Loads must be 0 or greater.")
      .finite()
  )
  .length(4);

const ZONE_STYLES: Record<AcwrZone, { badge: string; icon: typeof CheckCircle2 }> = {
  Undertrained: { badge: "bg-zone-endurance/15 text-zone-endurance", icon: TrendingDown },
  Optimal: { badge: "bg-success/15 text-success", icon: CheckCircle2 },
  Caution: { badge: "bg-warning/15 text-warning", icon: TrendingUp },
  "High risk": { badge: "bg-danger/15 text-danger", icon: AlertTriangle },
};

export function AcwrCalculator() {
  const [inputs, setInputs] = useState(["220", "240", "230", "230"]);

  const numericLoads = inputs.map((v) => Number(v));
  const parsed = loadSchema.safeParse(numericLoads);
  const allFilled = inputs.every((v) => v.trim() !== "");

  const result = useMemo(() => {
    if (!parsed.success) return null;
    if (numericLoads.every((v) => v === 0)) return null;
    try {
      return computeAcwr(numericLoads);
    } catch {
      return null;
    }
  }, [parsed, numericLoads]);

  function handleChange(index: number, value: string) {
    setInputs((prev) => prev.map((v, i) => (i === index ? value : v)));
  }

  const hasError = allFilled && !parsed.success;
  const allZero = allFilled && parsed.success && numericLoads.every((v) => v === 0);

  const ZoneIcon = result ? ZONE_STYLES[result.zone].icon : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          <div className="flex flex-col gap-1">
            <Label>Weekly training load</Label>
            <p className="text-sm text-muted-foreground">
              Any consistent weekly load number works — session-RPE totals
              (duration in minutes × RPE 1–10, summed for the week), TSS,
              distance, whatever you already track.
            </p>
          </div>

          {WEEK_LABELS.map((label, index) => (
            <div key={label} className="flex flex-col gap-2">
              <Label htmlFor={`week-${index}`}>{label}</Label>
              <Input
                id={`week-${index}`}
                inputMode="decimal"
                value={inputs[index]}
                onChange={(e) => handleChange(index, e.target.value)}
                aria-invalid={hasError}
              />
            </div>
          ))}

          {hasError && (
            <p className="text-sm text-danger">
              Loads must be numbers of 0 or greater.
            </p>
          )}
          {allZero && (
            <p className="text-sm text-muted-foreground">
              Enter at least one week with load greater than 0.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        {result && ZoneIcon ? (
          <motion.div
            key={result.ratio}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-6"
          >
            <Card>
              <CardContent className="flex flex-col gap-5 pt-6">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Acute:Chronic Workload Ratio
                  </span>
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-semibold tracking-tight tabular-nums">
                      {result.ratio.toFixed(2)}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
                        ZONE_STYLES[result.zone].badge
                      )}
                    >
                      <ZoneIcon className="size-4" />
                      {result.zone}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    This week: {result.acuteLoad.toFixed(0)} · 4-week average:{" "}
                    {result.chronicLoad.toFixed(0)}
                  </span>
                </div>

                <div className="rounded-lg border border-border bg-muted/50 p-4">
                  <p className="text-sm text-foreground">{result.zoneDescription}</p>
                </div>

                <AcwrBarChart weeklyLoads={numericLoads} labels={WEEK_LABELS} />
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              Enter all four weeks of training load to see your ratio.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
