"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { motion } from "motion/react";
import { track } from "@vercel/analytics";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { FormulaBreakdown } from "@/components/calculators/formula-breakdown";
import { TrainingTable } from "@/components/calculators/training-table";
import {
  MAX_REPS,
  MIN_REPS,
  RELIABLE_REP_CEILING,
  convertWeight,
  estimateOneRepMax,
  generateTrainingTable,
  type WeightUnit,
} from "@/lib/calculators/one-rep-max";
import { cn } from "@/lib/utils";

const inputSchema = z.object({
  weight: z.number().positive("Enter a weight greater than 0."),
  reps: z
    .number()
    .int("Reps must be a whole number.")
    .min(MIN_REPS, `Reps must be at least ${MIN_REPS}.`)
    .max(MAX_REPS, `This calculator supports up to ${MAX_REPS} reps.`),
});

const UNIT_OPTIONS = [
  { value: "kg" as const, label: "kg" },
  { value: "lb" as const, label: "lb" },
];

export function OneRepMaxCalculator() {
  const [weightInput, setWeightInput] = useState("100");
  const [repsInput, setRepsInput] = useState("5");
  const [unit, setUnit] = useState<WeightUnit>("kg");

  const weight = Number(weightInput);
  const reps = Number(repsInput);

  const parsed = inputSchema.safeParse({ weight, reps });

  const result = useMemo(() => {
    if (!parsed.success) return null;
    return estimateOneRepMax(parsed.data.weight, parsed.data.reps);
  }, [parsed]);

  const table = useMemo(() => {
    if (!result) return null;
    return generateTrainingTable(result.average);
  }, [result]);

  // Fire once per session, only once the user has actually changed an
  // input away from the pre-filled defaults — distinguishes real usage
  // from someone just landing on the page with the seed values intact.
  const hasTrackedRef = useRef(false);
  useEffect(() => {
    if (hasTrackedRef.current || !result) return;
    if (weightInput !== "100" || repsInput !== "5") {
      track("calculate_1rm");
      hasTrackedRef.current = true;
    }
  }, [weightInput, repsInput, result]);

  function handleUnitChange(next: WeightUnit) {
    if (next === unit) return;
    const current = Number(weightInput);
    if (Number.isFinite(current) && current > 0) {
      const converted = convertWeight(current, unit, next);
      setWeightInput((Math.round(converted * 10) / 10).toString());
    }
    setUnit(next);
  }

  const weightError =
    !parsed.success && weightInput !== ""
      ? parsed.error.issues.find((i) => i.path[0] === "weight")?.message
      : undefined;
  const repsError =
    !parsed.success && repsInput !== ""
      ? parsed.error.issues.find((i) => i.path[0] === "reps")?.message
      : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          <div className="flex items-center justify-between">
            <Label>Unit</Label>
            <SegmentedControl
              aria-label="Weight unit"
              options={UNIT_OPTIONS}
              value={unit}
              onChange={handleUnitChange}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="weight">Weight lifted</Label>
            <div className="relative">
              <Input
                id="weight"
                inputMode="decimal"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                aria-describedby={weightError ? "weight-error" : undefined}
                aria-invalid={Boolean(weightError)}
                className="pr-12"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {unit}
              </span>
            </div>
            {weightError && (
              <p id="weight-error" className="text-sm text-danger">
                {weightError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="reps">Reps completed</Label>
            <Input
              id="reps"
              inputMode="numeric"
              value={repsInput}
              onChange={(e) => setRepsInput(e.target.value)}
              aria-describedby={repsError ? "reps-error" : "reps-hint"}
              aria-invalid={Boolean(repsError)}
            />
            {repsError ? (
              <p id="reps-error" className="text-sm text-danger">
                {repsError}
              </p>
            ) : (
              <p id="reps-hint" className="text-sm text-muted-foreground">
                The last set you performed close to failure, 1–{MAX_REPS} reps.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        {result ? (
          <motion.div
            key={`${result.average}-${unit}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-6"
          >
            <Card>
              <CardContent className="flex flex-col gap-5 pt-6">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Estimated one-rep max
                  </span>
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-semibold tracking-tight tabular-nums">
                      {result.average.toFixed(1)}
                    </span>
                    <span className="text-xl text-muted-foreground">{unit}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Likely range: {result.low.toFixed(1)}–{result.high.toFixed(1)}{" "}
                    {unit}
                  </span>
                </div>

                {result.isLowConfidence && (
                  <div className="flex gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                    <p className="text-sm text-foreground">
                      Above {RELIABLE_REP_CEILING} reps, every estimation formula&rsquo;s
                      error grows quickly. Treat this as a rough guide, and
                      retest with a heavier, lower-rep set when you can for a
                      tighter estimate.
                    </p>
                  </div>
                )}

                <FormulaBreakdown estimate={result} unit={unit} />
              </CardContent>
            </Card>

            {table && <TrainingTable rows={table} unit={unit} />}
          </motion.div>
        ) : (
          <Card className={cn("flex items-center justify-center")}>
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              Enter a valid weight and rep count to see your estimate.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
