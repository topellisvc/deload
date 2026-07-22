"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { track } from "@vercel/analytics";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TimeInput, timePartsToSeconds, secondsToTimeParts } from "@/components/calculators/time-input";
import { PaceInput, pacePartsToSeconds, secondsToPaceParts } from "@/components/calculators/pace-input";
import {
  STANDARD_DISTANCES,
  computeDistanceKm,
  computePaceSecondsPerKm,
  computeTimeSeconds,
  convertDistance,
  formatDuration,
  formatPace,
  generateSplits,
  type DistanceUnit,
} from "@/lib/calculators/running-pace";

type SolveFor = "pace" | "time" | "distance";

const SOLVE_FOR_OPTIONS = [
  { value: "pace" as const, label: "Pace" },
  { value: "time" as const, label: "Time" },
  { value: "distance" as const, label: "Distance" },
];

const UNIT_OPTIONS = [
  { value: "km" as const, label: "km" },
  { value: "mi" as const, label: "mi" },
];

const DEFAULTS = {
  distance: "5",
  time: { hours: "0", minutes: "25", seconds: "0" },
  pace: { minutes: "5", seconds: "0" },
};

function roundTrim(value: number): string {
  return (Math.round(value * 1000) / 1000).toString();
}

export function RunningPaceCalculator() {
  const [solveFor, setSolveFor] = useState<SolveFor>("pace");
  const [unit, setUnit] = useState<DistanceUnit>("km");
  const [distanceInput, setDistanceInput] = useState(DEFAULTS.distance);
  const [time, setTime] = useState(DEFAULTS.time);
  const [pace, setPace] = useState(DEFAULTS.pace);

  const distanceValue = Number(distanceInput);
  const timeSecondsInput = timePartsToSeconds(time.hours, time.minutes, time.seconds);
  const paceSecondsPerUnitInput = pacePartsToSeconds(pace.minutes, pace.seconds);

  const kmPerUnit = convertDistance(1, unit, "km");

  const result = useMemo(() => {
    try {
      if (solveFor === "pace") {
        if (!(distanceValue > 0) || !(timeSecondsInput > 0)) return null;
        const distanceKm = convertDistance(distanceValue, unit, "km");
        const paceSecondsPerKm = computePaceSecondsPerKm(distanceKm, timeSecondsInput);
        return {
          distanceKm,
          timeSeconds: timeSecondsInput,
          paceSecondsPerUnit: paceSecondsPerKm * kmPerUnit,
        };
      }
      if (solveFor === "time") {
        if (!(distanceValue > 0) || !(paceSecondsPerUnitInput > 0)) return null;
        const distanceKm = convertDistance(distanceValue, unit, "km");
        const paceSecondsPerKm = paceSecondsPerUnitInput / kmPerUnit;
        const timeSeconds = computeTimeSeconds(distanceKm, paceSecondsPerKm);
        return { distanceKm, timeSeconds, paceSecondsPerUnit: paceSecondsPerUnitInput };
      }
      // solveFor === "distance"
      if (!(timeSecondsInput > 0) || !(paceSecondsPerUnitInput > 0)) return null;
      const paceSecondsPerKm = paceSecondsPerUnitInput / kmPerUnit;
      const distanceKm = computeDistanceKm(timeSecondsInput, paceSecondsPerKm);
      return { distanceKm, timeSeconds: timeSecondsInput, paceSecondsPerUnit: paceSecondsPerUnitInput };
    } catch {
      return null;
    }
  }, [solveFor, distanceValue, timeSecondsInput, paceSecondsPerUnitInput, unit, kmPerUnit]);

  const splits = useMemo(() => {
    if (!result) return null;
    return generateSplits(result.distanceKm, result.timeSeconds, unit);
  }, [result, unit]);

  const hasTrackedRef = useRef(false);
  useEffect(() => {
    if (hasTrackedRef.current || !result) return;
    const changed =
      distanceInput !== DEFAULTS.distance ||
      time.hours !== DEFAULTS.time.hours ||
      time.minutes !== DEFAULTS.time.minutes ||
      time.seconds !== DEFAULTS.time.seconds ||
      pace.minutes !== DEFAULTS.pace.minutes ||
      pace.seconds !== DEFAULTS.pace.seconds ||
      solveFor !== "pace";
    if (changed) {
      track("calculate_running_pace");
      hasTrackedRef.current = true;
    }
  }, [distanceInput, time, pace, solveFor, result]);

  function applyPreset(presetKm: number) {
    setDistanceInput(roundTrim(convertDistance(presetKm, "km", unit)));
  }

  function handleUnitChange(next: DistanceUnit) {
    if (next === unit) return;
    if (distanceValue > 0) {
      setDistanceInput(roundTrim(convertDistance(distanceValue, unit, next)));
    }
    if (paceSecondsPerUnitInput > 0) {
      // Convert pace to the new unit's seconds-per-unit.
      const paceSecondsPerKm = paceSecondsPerUnitInput / kmPerUnit;
      const newKmPerUnit = convertDistance(1, next, "km");
      setPace(secondsToPaceParts(paceSecondsPerKm * newKmPerUnit));
    }
    setUnit(next);
  }

  // Whenever the calculator produces a fresh result, write the solved
  // field's value back into its own input state — so switching "solve for"
  // mode always shows the freshly computed number instead of a stale one
  // from before the mode switch. The two fields still being edited by the
  // user are left untouched.
  useEffect(() => {
    if (!result) return;
    switch (solveFor) {
      case "distance":
        setDistanceInput(roundTrim(convertDistance(result.distanceKm, "km", unit)));
        break;
      case "time":
        setTime(secondsToTimeParts(result.timeSeconds));
        break;
      case "pace":
        setPace(secondsToPaceParts(result.paceSecondsPerUnit));
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, solveFor]);

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          <div className="flex flex-col gap-2">
            <Label>Solve for</Label>
            <SegmentedControl
              aria-label="Solve for"
              options={SOLVE_FOR_OPTIONS}
              value={solveFor}
              onChange={setSolveFor}
              className="w-full [&>button]:flex-1"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Units</Label>
            <SegmentedControl aria-label="Distance unit" options={UNIT_OPTIONS} value={unit} onChange={handleUnitChange} />
          </div>

          {solveFor !== "distance" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="distance">Distance</Label>
              <div className="relative">
                <Input
                  id="distance"
                  inputMode="decimal"
                  value={distanceInput}
                  onChange={(e) => setDistanceInput(e.target.value)}
                  className="pr-10"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {unit}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {STANDARD_DISTANCES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => applyPreset(d.km)}
                    className="rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {solveFor !== "time" && (
            <TimeInput
              label="Time"
              idPrefix="time"
              hours={time.hours}
              minutes={time.minutes}
              seconds={time.seconds}
              onChange={setTime}
            />
          )}

          {solveFor !== "pace" && (
            <PaceInput
              label="Pace"
              idPrefix="pace"
              minutes={pace.minutes}
              seconds={pace.seconds}
              unit={unit}
              onChange={setPace}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        {result ? (
          <motion.div
            key={`${solveFor}-${result.distanceKm}-${result.timeSeconds}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-6"
          >
            <Card>
              <CardContent className="flex flex-col gap-5 pt-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Pace</span>
                    <span className="font-mono text-2xl tabular-nums text-foreground">
                      {formatPace(result.paceSecondsPerUnit)}
                    </span>
                    <span className="text-xs text-muted-foreground">/{unit}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Time</span>
                    <span className="font-mono text-2xl tabular-nums text-foreground">
                      {formatDuration(result.timeSeconds)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Distance</span>
                    <span className="font-mono text-2xl tabular-nums text-foreground">
                      {convertDistance(result.distanceKm, "km", unit).toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground">{unit}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {splits && splits.length > 1 && (
              <Card>
                <CardContent className="flex flex-col gap-3 pt-6">
                  <span className="text-sm font-medium text-muted-foreground">
                    Even splits
                  </span>
                  <div className="flex flex-col divide-y divide-border">
                    {splits.map((row) => (
                      <div key={row.marker} className="flex items-center justify-between py-2 text-sm">
                        <span className="text-muted-foreground">
                          {row.distance % 1 === 0 ? row.distance : row.distance.toFixed(2)} {unit}
                        </span>
                        <span className="font-mono tabular-nums text-foreground">
                          {formatDuration(row.cumulativeSeconds)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              Fill in the two known values to solve for the third.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
