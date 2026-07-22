"use client";

import { useState } from "react";
import { RefreshCw, Shuffle } from "lucide-react";
import { motion } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  generateWorkout,
  EQUIPMENT_LABELS,
  FOCUS_LABELS,
  GOAL_LABELS,
  type FocusArea,
  type Goal,
  type GeneratedWorkout,
} from "@/lib/workout-generator/generate-workout";
import { explainWorkout } from "@/lib/workout-generator/explain-workout";
import type { EquipmentTier } from "@/lib/workout-generator/exercises";

const GOAL_OPTIONS = (Object.keys(GOAL_LABELS) as Goal[]).map((value) => ({
  value,
  label: GOAL_LABELS[value],
}));

const EQUIPMENT_OPTIONS = (Object.keys(EQUIPMENT_LABELS) as EquipmentTier[]).map((value) => ({
  value,
  label: EQUIPMENT_LABELS[value],
}));

const FOCUS_OPTIONS = (Object.keys(FOCUS_LABELS) as FocusArea[]).map((value) => ({
  value,
  label: FOCUS_LABELS[value],
}));

const TIME_OPTIONS = [
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60 min" },
];

export function QuickWorkoutGenerator() {
  const [goal, setGoal] = useState<Goal>("hypertrophy");
  const [equipment, setEquipment] = useState<EquipmentTier>("dumbbell");
  const [focus, setFocus] = useState<FocusArea>("full_body");
  const [timeMinutes, setTimeMinutes] = useState("30");
  const [workout, setWorkout] = useState<GeneratedWorkout | null>(null);

  function handleGenerate() {
    setWorkout(
      generateWorkout({ goal, equipment, focus, timeMinutes: Number(timeMinutes) })
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          <div className="flex flex-col gap-2">
            <Label>Goal</Label>
            <SegmentedControl
              aria-label="Goal"
              options={GOAL_OPTIONS}
              value={goal}
              onChange={setGoal}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Equipment</Label>
            <SegmentedControl
              aria-label="Equipment"
              options={EQUIPMENT_OPTIONS}
              value={equipment}
              onChange={setEquipment}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Focus</Label>
            <SegmentedControl
              aria-label="Focus"
              options={FOCUS_OPTIONS}
              value={focus}
              onChange={setFocus}
              className="w-full flex-wrap"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Time available</Label>
            <SegmentedControl
              aria-label="Time available"
              options={TIME_OPTIONS}
              value={timeMinutes}
              onChange={setTimeMinutes}
              className="w-full"
            />
          </div>

          <Button onClick={handleGenerate} size="lg" className="mt-2">
            <Shuffle className="size-4" />
            {workout ? "Regenerate workout" : "Generate workout"}
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        {workout ? (
          <motion.div
            key={workout.exercises.map((e) => e.exercise.id).join("-")}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-6"
          >
            <Card>
              <CardContent className="flex flex-col gap-5 pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">
                      {FOCUS_LABELS[workout.focus]} · {GOAL_LABELS[workout.goal]}
                    </span>
                    <div className="text-2xl font-semibold tracking-tight">
                      ~{workout.estimatedMinutes} min · {workout.exercises.length} exercises
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={handleGenerate}>
                    <RefreshCw className="size-3.5" />
                    Regenerate
                  </Button>
                </div>

                <div className="rounded-lg border border-border bg-muted/50 p-4">
                  <p className="text-sm text-foreground">{explainWorkout(workout)}</p>
                </div>

                <ol className="flex flex-col divide-y divide-border">
                  {workout.exercises.map((we, index) => (
                    <li
                      key={we.exercise.id}
                      className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                          {index + 1}
                        </span>
                        <span className="font-medium text-foreground">
                          {we.exercise.name}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
                        {we.sets} × {we.reps} · {we.restSeconds}s rest
                      </span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              Choose your goal, equipment, focus, and time, then generate a
              workout.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
