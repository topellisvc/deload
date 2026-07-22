"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { track } from "@vercel/analytics";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { BodyFatScale } from "@/components/calculators/body-fat-scale";
import {
  ESTIMATED_ERROR_MARGIN_PCT,
  convertLength,
  convertMass,
  estimateBodyFat,
  type BiologicalSex,
  type LengthUnit,
  type MassUnit,
} from "@/lib/calculators/body-fat";
import { cn } from "@/lib/utils";

type UnitSystem = "metric" | "imperial";

const UNIT_SYSTEM_OPTIONS = [
  { value: "metric" as const, label: "cm / kg" },
  { value: "imperial" as const, label: "in / lb" },
];

const SEX_OPTIONS = [
  { value: "male" as const, label: "Male" },
  { value: "female" as const, label: "Female" },
];

const UNITS_FOR_SYSTEM: Record<UnitSystem, { length: LengthUnit; mass: MassUnit }> = {
  metric: { length: "cm", mass: "kg" },
  imperial: { length: "in", mass: "lb" },
};

const DEFAULT_INPUTS = {
  heightCm: "178",
  neckCm: "38",
  waistCm: "86",
  hipCm: "100",
  weightKg: "80",
};

const measurementSchema = z.number().positive().finite();

export function BodyFatCalculator() {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
  const [sex, setSex] = useState<BiologicalSex>("male");
  const [heightInput, setHeightInput] = useState(DEFAULT_INPUTS.heightCm);
  const [neckInput, setNeckInput] = useState(DEFAULT_INPUTS.neckCm);
  const [waistInput, setWaistInput] = useState(DEFAULT_INPUTS.waistCm);
  const [hipInput, setHipInput] = useState(DEFAULT_INPUTS.hipCm);
  const [weightInput, setWeightInput] = useState(DEFAULT_INPUTS.weightKg);

  const units = UNITS_FOR_SYSTEM[unitSystem];

  const height = Number(heightInput);
  const neck = Number(neckInput);
  const waist = Number(waistInput);
  const hip = Number(hipInput);
  const weight = Number(weightInput);

  const fields = [height, neck, waist, weight, ...(sex === "female" ? [hip] : [])];
  const allValid = fields.every((v) => measurementSchema.safeParse(v).success);
  const waistGreaterThanNeck = waist > neck;

  const result = useMemo(() => {
    if (!allValid || !waistGreaterThanNeck) return null;
    try {
      return estimateBodyFat({
        sex,
        heightIn: convertLength(height, units.length, "in"),
        neckIn: convertLength(neck, units.length, "in"),
        waistIn: convertLength(waist, units.length, "in"),
        hipIn: sex === "female" ? convertLength(hip, units.length, "in") : undefined,
        weightKg: convertMass(weight, units.mass, "kg"),
      });
    } catch {
      return null;
    }
  }, [allValid, waistGreaterThanNeck, sex, height, neck, waist, hip, weight, units]);

  const displayWeightUnit = units.mass;

  // Fire once per session, only once inputs have actually diverged from the
  // pre-filled defaults — distinguishes real usage from someone just
  // landing on the page with the seed values intact.
  const hasTrackedRef = useRef(false);
  useEffect(() => {
    if (hasTrackedRef.current || !result) return;
    const changed =
      heightInput !== DEFAULT_INPUTS.heightCm ||
      neckInput !== DEFAULT_INPUTS.neckCm ||
      waistInput !== DEFAULT_INPUTS.waistCm ||
      weightInput !== DEFAULT_INPUTS.weightKg ||
      sex !== "male";
    if (changed) {
      track("calculate_body_fat");
      hasTrackedRef.current = true;
    }
  }, [heightInput, neckInput, waistInput, weightInput, sex, result]);

  function handleUnitSystemChange(next: UnitSystem) {
    if (next === unitSystem) return;
    const nextUnits = UNITS_FOR_SYSTEM[next];
    const convert = (value: number, kind: "length" | "mass") =>
      kind === "length"
        ? convertLength(value, units.length, nextUnits.length)
        : convertMass(value, units.mass, nextUnits.mass);
    const round = (v: number) => (Math.round(v * 10) / 10).toString();

    if (Number.isFinite(height)) setHeightInput(round(convert(height, "length")));
    if (Number.isFinite(neck)) setNeckInput(round(convert(neck, "length")));
    if (Number.isFinite(waist)) setWaistInput(round(convert(waist, "length")));
    if (Number.isFinite(hip)) setHipInput(round(convert(hip, "length")));
    if (Number.isFinite(weight)) setWeightInput(round(convert(weight, "mass")));
    setUnitSystem(next);
  }

  const showWaistError = waist > 0 && neck > 0 && !waistGreaterThanNeck;

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          <div className="flex items-center justify-between">
            <Label>Units</Label>
            <SegmentedControl
              aria-label="Unit system"
              options={UNIT_SYSTEM_OPTIONS}
              value={unitSystem}
              onChange={handleUnitSystemChange}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Sex</Label>
            <SegmentedControl aria-label="Sex" options={SEX_OPTIONS} value={sex} onChange={setSex} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="height">Height</Label>
            <div className="relative">
              <Input
                id="height"
                inputMode="decimal"
                value={heightInput}
                onChange={(e) => setHeightInput(e.target.value)}
                className="pr-10"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {units.length}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="neck">Neck circumference</Label>
            <div className="relative">
              <Input
                id="neck"
                inputMode="decimal"
                value={neckInput}
                onChange={(e) => setNeckInput(e.target.value)}
                aria-invalid={showWaistError}
                className="pr-10"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {units.length}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Measure just below the larynx, tape sloping slightly downward
              to the front.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="waist">Waist circumference</Label>
            <div className="relative">
              <Input
                id="waist"
                inputMode="decimal"
                value={waistInput}
                onChange={(e) => setWaistInput(e.target.value)}
                aria-invalid={showWaistError}
                className="pr-10"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {units.length}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {sex === "male"
                ? "Measure at the navel, relaxed — don't suck in."
                : "Measure at the narrowest point of your waist."}
            </p>
            {showWaistError && (
              <p className="text-sm text-danger">
                Waist must be greater than neck circumference.
              </p>
            )}
          </div>

          {sex === "female" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="hip">Hip circumference</Label>
              <div className="relative">
                <Input
                  id="hip"
                  inputMode="decimal"
                  value={hipInput}
                  onChange={(e) => setHipInput(e.target.value)}
                  className="pr-10"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {units.length}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Measure at the widest point of your hips.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="weight">Body weight</Label>
            <div className="relative">
              <Input
                id="weight"
                inputMode="decimal"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="pr-10"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {displayWeightUnit}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Used only to convert your percentage into fat mass and lean mass.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        {result ? (
          <motion.div
            key={`${result.bodyFatPercent}-${unitSystem}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-6"
          >
            <Card>
              <CardContent className="flex flex-col gap-5 pt-6">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Estimated body fat
                  </span>
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-semibold tracking-tight tabular-nums">
                      {result.bodyFatPercent.toFixed(1)}%
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full bg-primary/15 px-3 py-1 text-sm font-medium text-primary"
                      )}
                    >
                      {result.category}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Typically accurate within ±{ESTIMATED_ERROR_MARGIN_PCT} percentage
                    points of a DEXA scan — treat this as a well-informed
                    estimate, not a lab result.
                  </span>
                </div>

                <BodyFatScale sex={sex} bodyFatPercent={result.bodyFatPercent} />

                <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Fat mass</span>
                    <span className="font-mono text-lg tabular-nums text-foreground">
                      {convertMass(result.fatMassKg, "kg", units.mass).toFixed(1)}{" "}
                      {units.mass}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Lean mass</span>
                    <span className="font-mono text-lg tabular-nums text-foreground">
                      {convertMass(result.leanMassKg, "kg", units.mass).toFixed(1)}{" "}
                      {units.mass}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              Enter your measurements to see your estimate. Waist must be
              greater than neck circumference.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
