"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { track } from "@vercel/analytics";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { MacroBar } from "@/components/calculators/macro-bar";
import { convertLength, convertMass } from "@/lib/calculators/body-fat";
import type { LengthUnit, MassUnit } from "@/lib/calculators/body-fat";
import {
  ACTIVITY_LEVELS,
  GOALS,
  computeMacros,
  estimateCalorieTarget,
  type ActivityLevelId,
  type GoalId,
  type Sex,
} from "@/lib/calculators/calorie-macro";

type UnitSystem = "metric" | "imperial";

const UNIT_SYSTEM_OPTIONS = [
  { value: "metric" as const, label: "cm / kg" },
  { value: "imperial" as const, label: "in / lb" },
];

const SEX_OPTIONS = [
  { value: "male" as const, label: "Male" },
  { value: "female" as const, label: "Female" },
];

const GOAL_OPTIONS = GOALS.map((g) => ({ value: g.id, label: g.label }));

const UNITS_FOR_SYSTEM: Record<UnitSystem, { length: LengthUnit; mass: MassUnit }> = {
  metric: { length: "cm", mass: "kg" },
  imperial: { length: "in", mass: "lb" },
};

const DEFAULT_INPUTS = {
  age: "30",
  heightCm: "178",
  weightKg: "80",
};

const positiveNumber = z.number().positive().finite();

export function CalorieMacroCalculator() {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
  const [sex, setSex] = useState<Sex>("male");
  const [ageInput, setAgeInput] = useState(DEFAULT_INPUTS.age);
  const [heightInput, setHeightInput] = useState(DEFAULT_INPUTS.heightCm);
  const [weightInput, setWeightInput] = useState(DEFAULT_INPUTS.weightKg);
  const [activityLevel, setActivityLevel] = useState<ActivityLevelId>("moderate");
  const [goal, setGoal] = useState<GoalId>("maintain");
  const [bodyFatInput, setBodyFatInput] = useState("");

  const units = UNITS_FOR_SYSTEM[unitSystem];

  const age = Number(ageInput);
  const height = Number(heightInput);
  const weight = Number(weightInput);
  const bodyFatPercent = bodyFatInput.trim() === "" ? undefined : Number(bodyFatInput);

  const coreValid = [age, height, weight].every((v) => positiveNumber.safeParse(v).success);
  const bodyFatValid =
    bodyFatPercent === undefined || (bodyFatPercent > 0 && bodyFatPercent < 70 && Number.isFinite(bodyFatPercent));

  const calorieResult = useMemo(() => {
    if (!coreValid || !bodyFatValid) return null;
    try {
      return estimateCalorieTarget({
        sex,
        age,
        heightCm: convertLength(height, units.length, "cm"),
        weightKg: convertMass(weight, units.mass, "kg"),
        activityLevel,
        goal,
        bodyFatPercent,
      });
    } catch {
      return null;
    }
  }, [coreValid, bodyFatValid, sex, age, height, weight, units, activityLevel, goal, bodyFatPercent]);

  const macros = useMemo(() => {
    if (!calorieResult) return null;
    const weightKg = convertMass(weight, units.mass, "kg");
    return computeMacros(calorieResult.calorieTarget, weightKg, goal);
  }, [calorieResult, weight, units, goal]);

  // Fire once per session, only once inputs have actually diverged from the
  // pre-filled defaults.
  const hasTrackedRef = useRef(false);
  useEffect(() => {
    if (hasTrackedRef.current || !calorieResult) return;
    const changed =
      ageInput !== DEFAULT_INPUTS.age ||
      heightInput !== DEFAULT_INPUTS.heightCm ||
      weightInput !== DEFAULT_INPUTS.weightKg ||
      sex !== "male" ||
      activityLevel !== "moderate" ||
      goal !== "maintain" ||
      bodyFatInput !== "";
    if (changed) {
      track("calculate_calorie_macro");
      hasTrackedRef.current = true;
    }
  }, [ageInput, heightInput, weightInput, sex, activityLevel, goal, bodyFatInput, calorieResult]);

  function handleUnitSystemChange(next: UnitSystem) {
    if (next === unitSystem) return;
    const nextUnits = UNITS_FOR_SYSTEM[next];
    const round = (v: number) => (Math.round(v * 10) / 10).toString();
    if (Number.isFinite(height)) setHeightInput(round(convertLength(height, units.length, nextUnits.length)));
    if (Number.isFinite(weight)) setWeightInput(round(convertMass(weight, units.mass, nextUnits.mass)));
    setUnitSystem(next);
  }

  const displayWeightUnit = units.mass;

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
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              inputMode="numeric"
              value={ageInput}
              onChange={(e) => setAgeInput(e.target.value)}
            />
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
            <Label htmlFor="weight">Weight</Label>
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
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="activity">Activity level</Label>
            <Select
              id="activity"
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value as ActivityLevelId)}
            >
              {ACTIVITY_LEVELS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
            <p className="text-sm text-muted-foreground">
              {ACTIVITY_LEVELS.find((a) => a.id === activityLevel)?.description}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Goal</Label>
            <SegmentedControl
              aria-label="Goal"
              options={GOAL_OPTIONS}
              value={goal}
              onChange={setGoal}
              className="w-full [&>button]:flex-1"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="body-fat">Body fat % (optional)</Label>
            <Input
              id="body-fat"
              inputMode="decimal"
              placeholder="Unknown"
              value={bodyFatInput}
              onChange={(e) => setBodyFatInput(e.target.value)}
              aria-invalid={!bodyFatValid}
            />
            <p className="text-sm text-muted-foreground">
              Know it? It unlocks a tighter estimate (Katch-McArdle). Don&rsquo;t
              know it?{" "}
              <Link href="/tools/body-fat-percentage" className="font-medium text-primary hover:underline">
                Estimate it here
              </Link>
              .
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        {calorieResult && macros ? (
          <motion.div
            key={`${calorieResult.calorieTarget}-${unitSystem}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-6"
          >
            <Card>
              <CardContent className="flex flex-col gap-5 pt-6">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Daily calorie target
                  </span>
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-semibold tracking-tight tabular-nums">
                      {Math.round(calorieResult.calorieTarget)}
                    </span>
                    <span className="text-xl text-muted-foreground">kcal</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Estimated maintenance range: {Math.round(calorieResult.tdeeLow)}–
                    {Math.round(calorieResult.tdeeHigh)} kcal, across{" "}
                    {Object.keys(calorieResult.bmrByFormula).length} formulas
                    {calorieResult.usedKatchMcArdle
                      ? " including Katch-McArdle from your body fat %"
                      : ""}
                    .
                  </span>
                </div>

                <div className="rounded-lg border border-border bg-muted/50 p-4">
                  <p className="text-sm text-foreground">
                    Treat this as a starting point, not a fixed truth — track
                    your actual weight trend over 2-3 weeks and adjust up or
                    down by 5-10% if it isn&rsquo;t moving the way you expect.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex flex-col gap-5 pt-6">
                <span className="text-sm font-medium text-muted-foreground">
                  Suggested macros
                </span>

                <MacroBar
                  proteinKcal={macros.proteinKcal}
                  fatKcal={macros.fatKcal}
                  carbKcal={macros.carbKcal}
                />

                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Protein</span>
                    <span className="font-mono text-lg tabular-nums text-foreground">
                      {Math.round(macros.proteinG)}g
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Fat</span>
                    <span className="font-mono text-lg tabular-nums text-foreground">
                      {Math.round(macros.fatG)}g
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Carbs</span>
                    <span className="font-mono text-lg tabular-nums text-foreground">
                      {Math.round(macros.carbG)}g
                    </span>
                  </div>
                </div>

                {macros.carbsClampedToZero && (
                  <p className="text-sm text-warning">
                    Your calorie target is low enough relative to your protein
                    and fat targets that there&rsquo;s no room left for carbs.
                    Consider a less aggressive deficit.
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              Enter your age, height, and weight to see your estimate.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
