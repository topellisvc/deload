"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FORMULAS, type OneRepMaxEstimate, type WeightUnit } from "@/lib/calculators/one-rep-max";
import { cn } from "@/lib/utils";

interface FormulaBreakdownProps {
  estimate: OneRepMaxEstimate;
  unit: WeightUnit;
}

/**
 * Shows the per-formula results behind the headline average. This is a
 * trust feature: instead of asking the user to take a single number on
 * faith, we show our work and explain why formulas disagree.
 */
export function FormulaBreakdown({ estimate, unit }: FormulaBreakdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
      >
        <span>How this was calculated ({FORMULAS.length} formulas)</span>
        <ChevronDown
          className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            No single formula is universally accurate — each is a regression
            fit to a different population of lifters. We calculate all five
            and use their spread as your confidence range, rather than
            presenting one falsely precise number.
          </p>
          <dl className="grid gap-2">
            {FORMULAS.map((formula) => (
              <div
                key={formula.id}
                className="flex items-center justify-between gap-4 rounded-lg bg-muted px-3 py-2"
              >
                <div className="flex flex-col">
                  <dt className="text-sm font-medium text-foreground">{formula.label}</dt>
                  <dd className="text-xs text-muted-foreground">{formula.description}</dd>
                </div>
                <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                  {estimate.byFormula[formula.id].toFixed(1)} {unit}
                </span>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
