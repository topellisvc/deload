"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { track } from "@vercel/analytics";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { buttonVariants } from "@/components/ui/button";
import {
  EXPERIENCE_LEVELS,
  GOALS,
  MAX_DAYS_PER_WEEK,
  MIN_DAYS_PER_WEEK,
  recommendTrainingSplit,
  type ExperienceLevel,
  type Goal,
} from "@/lib/training-split/recommend-split";

const GOAL_OPTIONS = GOALS.map((g) => ({ value: g.id, label: g.label }));
const EXPERIENCE_OPTIONS = EXPERIENCE_LEVELS.map((e) => ({ value: e.id, label: e.label }));

const DAYS_PER_WEEK_OPTIONS = Array.from(
  { length: MAX_DAYS_PER_WEEK - MIN_DAYS_PER_WEEK + 1 },
  (_, i) => MIN_DAYS_PER_WEEK + i
);

const DEFAULTS = {
  goal: "general_fitness" as Goal,
  experience: "beginner" as ExperienceLevel,
  daysPerWeek: 3,
};

export function TrainingSplitFinder() {
  const [goal, setGoal] = useState<Goal>(DEFAULTS.goal);
  const [experience, setExperience] = useState<ExperienceLevel>(DEFAULTS.experience);
  const [daysPerWeek, setDaysPerWeek] = useState<number>(DEFAULTS.daysPerWeek);

  const result = useMemo(() => {
    try {
      return recommendTrainingSplit({ goal, experience, daysPerWeek });
    } catch {
      return null;
    }
  }, [goal, experience, daysPerWeek]);

  const hasTrackedRef = useRef(false);
  useEffect(() => {
    if (hasTrackedRef.current || !result) return;
    const changed =
      goal !== DEFAULTS.goal || experience !== DEFAULTS.experience || daysPerWeek !== DEFAULTS.daysPerWeek;
    if (changed) {
      track("find_training_split", { goal, experience, split: result.split.id });
      hasTrackedRef.current = true;
    }
  }, [goal, experience, daysPerWeek, result]);

  const experienceDescription = EXPERIENCE_LEVELS.find((e) => e.id === experience)?.description;

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          <div className="flex flex-col gap-2">
            <Label>What&apos;s your main goal?</Label>
            <SegmentedControl
              aria-label="Goal"
              options={GOAL_OPTIONS}
              value={goal}
              onChange={setGoal}
              className="w-full [&>button]:flex-1"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Training experience</Label>
            <SegmentedControl
              aria-label="Experience"
              options={EXPERIENCE_OPTIONS}
              value={experience}
              onChange={setExperience}
              className="w-full [&>button]:flex-1"
            />
            {experienceDescription && (
              <p className="text-sm text-muted-foreground">{experienceDescription}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="days-per-week">Days per week you can actually train</Label>
            <Select
              id="days-per-week"
              value={daysPerWeek}
              onChange={(e) => setDaysPerWeek(Number(e.target.value))}
            >
              {DAYS_PER_WEEK_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </Select>
            <p className="text-sm text-muted-foreground">
              Be realistic here — a split that assumes more days than
              you&apos;ll actually train is worse than a simpler one
              you&apos;ll stick to.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        {result ? (
          <motion.div
            key={`${result.split.id}-${daysPerWeek}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-6"
          >
            <Card>
              <CardContent className="flex flex-col gap-5 pt-6">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Recommended split
                  </span>
                  <span className="text-3xl font-semibold tracking-tight text-foreground">
                    {result.split.name}
                  </span>
                  <span className="text-sm text-muted-foreground">{result.split.summary}</span>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  {result.schedule.map((day, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center gap-1 rounded-lg bg-muted px-3 py-2"
                    >
                      <span className="text-xs text-muted-foreground">Day {i + 1}</span>
                      <span className="text-sm font-medium text-foreground">{day}</span>
                    </div>
                  ))}
                </div>

                <p className="text-sm text-foreground">{result.frequencyDescription}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex flex-col gap-3 pt-6">
                <span className="text-sm font-medium text-muted-foreground">Why this split</span>
                <p className="text-sm text-foreground">{result.reasoning}</p>
                <p className="text-sm text-muted-foreground">
                  No split is proven objectively best — research generally
                  finds similar results across splits once total weekly
                  volume per muscle group is matched. This just recommends a
                  structure that fits your constraints well.
                </p>
              </CardContent>
            </Card>

            <Link href="/tools/quick-workout" className={buttonVariants({ size: "lg", className: "w-full" })}>
              Build a session for your {result.schedule[0]} day
              <ArrowRight className="size-4" />
            </Link>
          </motion.div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              Answer the questions to see your recommended split.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
