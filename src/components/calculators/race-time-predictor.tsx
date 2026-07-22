"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { track } from "@vercel/analytics";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TimeInput, timePartsToSeconds } from "@/components/calculators/time-input";
import {
  STANDARD_DISTANCES,
  convertDistance,
  formatDuration,
  formatPace,
  predictRaceTimes,
  type DistanceUnit,
} from "@/lib/calculators/running-pace";
import { cn } from "@/lib/utils";

const UNIT_OPTIONS = [
  { value: "km" as const, label: "km" },
  { value: "mi" as const, label: "mi" },
];

const DEFAULTS = {
  distance: "5",
  time: { hours: "0", minutes: "25", seconds: "0" },
};

export function RaceTimePredictor() {
  const [unit, setUnit] = useState<DistanceUnit>("km");
  const [distanceInput, setDistanceInput] = useState(DEFAULTS.distance);
  const [time, setTime] = useState(DEFAULTS.time);

  const distanceValue = Number(distanceInput);
  const timeSeconds = timePartsToSeconds(time.hours, time.minutes, time.seconds);

  const predictions = useMemo(() => {
    if (!(distanceValue > 0) || !(timeSeconds > 0)) return null;
    try {
      const distanceKm = convertDistance(distanceValue, unit, "km");
      return predictRaceTimes(distanceKm, timeSeconds);
    } catch {
      return null;
    }
  }, [distanceValue, timeSeconds, unit]);

  const hasTrackedRef = useRef(false);
  useEffect(() => {
    if (hasTrackedRef.current || !predictions) return;
    const changed =
      distanceInput !== DEFAULTS.distance ||
      time.hours !== DEFAULTS.time.hours ||
      time.minutes !== DEFAULTS.time.minutes ||
      time.seconds !== DEFAULTS.time.seconds;
    if (changed) {
      track("predict_race_time");
      hasTrackedRef.current = true;
    }
  }, [distanceInput, time, predictions]);

  function applyPreset(presetKm: number) {
    setDistanceInput((Math.round(convertDistance(presetKm, "km", unit) * 1000) / 1000).toString());
  }

  function handleUnitChange(next: DistanceUnit) {
    if (next === unit) return;
    if (distanceValue > 0) {
      setDistanceInput((Math.round(convertDistance(distanceValue, unit, next) * 1000) / 1000).toString());
    }
    setUnit(next);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          <div className="flex items-center justify-between">
            <Label>Units</Label>
            <SegmentedControl aria-label="Distance unit" options={UNIT_OPTIONS} value={unit} onChange={handleUnitChange} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="known-distance">Known result — distance</Label>
            <div className="relative">
              <Input
                id="known-distance"
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

          <TimeInput
            label="Known result — time"
            idPrefix="known-time"
            hours={time.hours}
            minutes={time.minutes}
            seconds={time.seconds}
            onChange={setTime}
          />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        {predictions ? (
          <motion.div
            key={`${distanceValue}-${timeSeconds}-${unit}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card>
              <CardContent className="flex flex-col gap-3 pt-6">
                <span className="text-sm font-medium text-muted-foreground">
                  Predicted times at other distances
                </span>
                <div className="flex flex-col divide-y divide-border">
                  {predictions.map((p) => (
                    <div key={p.distance.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{p.distance.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatPace(p.predictedPaceSecondsPerKm)} /km pace
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg tabular-nums text-foreground">
                          {formatDuration(p.predictedSeconds)}
                        </span>
                        {!p.isReliable && (
                          <span
                            className={cn(
                              "rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning"
                            )}
                          >
                            Rough estimate
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  Predictions marked &ldquo;rough estimate&rdquo; extrapolate a long way
                  from your known result (e.g. predicting a marathon from a
                  mile time) — treat those as a very loose guide, not a
                  target.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              Enter a recent race distance and time to predict your pace at
              other distances.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
