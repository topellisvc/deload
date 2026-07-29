"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Dumbbell, Search } from "lucide-react";
import type { Exercise, ExerciseDifficulty, ExerciseEquipment, ExerciseLibraryCategory, MovementPattern, MuscleGroup } from "@/lib/exercises/types";
import {
  EXERCISE_DIFFICULTY_LABELS,
  EXERCISE_EQUIPMENT_LABELS,
  EXERCISE_LIBRARY_CATEGORIES,
  EXERCISE_LIBRARY_CATEGORY_LABELS,
  MOVEMENT_PATTERNS,
  MOVEMENT_PATTERN_LABELS,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
} from "@/lib/exercises/constants";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { DifficultyBadge } from "@/components/exercises/difficulty-badge";
import { ReviewStatusBadge } from "@/components/exercises/review-status-badge";
import { cn } from "@/lib/utils";

type ViewMode = "grid" | "list";

const ALL = "all";

/**
 * Client-side search/filter over the full, already-fetched exercise set —
 * "search should feel fast" (spec) is easiest to guarantee with zero
 * round trips against a dataset this size (a few hundred rows at most),
 * same instant-filter approach the picker's ExerciseSearchField already
 * uses for its own in-memory lists.
 */
export function ExerciseLibraryList({ exercises, isAdmin, currentUserId }: { exercises: Exercise[]; isAdmin: boolean; currentUserId: string }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ExerciseLibraryCategory | typeof ALL>(ALL);
  const [equipment, setEquipment] = useState<ExerciseEquipment | typeof ALL>(ALL);
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | typeof ALL>(ALL);
  const [movementPattern, setMovementPattern] = useState<MovementPattern | typeof ALL>(ALL);
  const [difficulty, setDifficulty] = useState<ExerciseDifficulty | typeof ALL>(ALL);
  const [view, setView] = useState<ViewMode>("grid");

  const filtered = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    return exercises.filter((e) => {
      if (category !== ALL && e.category !== category) return false;
      if (equipment !== ALL && e.equipment !== equipment) return false;
      if (muscleGroup !== ALL && e.primary_muscle_group !== muscleGroup && !e.secondary_muscle_groups.includes(muscleGroup)) return false;
      if (movementPattern !== ALL && e.movement_pattern !== movementPattern) return false;
      if (difficulty !== ALL && e.difficulty !== difficulty) return false;
      if (!trimmed) return true;
      const haystack = [e.name, e.category, e.primary_muscle_group, e.equipment, e.movement_pattern ?? "", ...e.tags].join(" ").toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [exercises, search, category, equipment, muscleGroup, movementPattern, difficulty]);

  const customCount = exercises.filter((e) => e.owner_id === currentUserId).length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Exercise Library</h1>
        <p className="text-sm text-muted-foreground">
          {exercises.length} exercises{customCount > 0 ? ` · ${customCount} of your own` : ""} · the shared catalog referenced by every program,
          Training Mode session, and coach workflow.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, muscle group, equipment, tag…"
            aria-label="Search exercises"
            className="pl-11"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="w-auto">
            <option value={ALL}>All categories</option>
            {EXERCISE_LIBRARY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXERCISE_LIBRARY_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>

          <Select aria-label="Equipment" value={equipment} onChange={(e) => setEquipment(e.target.value as typeof equipment)} className="w-auto">
            <option value={ALL}>All equipment</option>
            {Object.entries(EXERCISE_EQUIPMENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          <Select aria-label="Primary muscle group" value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value as typeof muscleGroup)} className="w-auto">
            <option value={ALL}>All muscle groups</option>
            {MUSCLE_GROUPS.map((m) => (
              <option key={m} value={m}>
                {MUSCLE_GROUP_LABELS[m]}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Movement pattern"
            value={movementPattern}
            onChange={(e) => setMovementPattern(e.target.value as typeof movementPattern)}
            className="w-auto"
          >
            <option value={ALL}>All movement patterns</option>
            {MOVEMENT_PATTERNS.map((p) => (
              <option key={p} value={p}>
                {MOVEMENT_PATTERN_LABELS[p]}
              </option>
            ))}
          </Select>

          <Select aria-label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)} className="w-auto">
            <option value={ALL}>All difficulties</option>
            {Object.entries(EXERCISE_DIFFICULTY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          <div className="ml-auto flex items-center gap-2">
            {isAdmin && (
              <Link
                href="/exercises/admin"
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
              >
                Admin tools
              </Link>
            )}
            <SegmentedControl
              aria-label="View"
              value={view}
              onChange={setView}
              options={[
                { value: "grid", label: "Grid" },
                { value: "list", label: "List" },
              ]}
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-sm text-muted-foreground">
          No exercises match those filters.
        </p>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((exercise) => (
            <ExerciseGridCard key={exercise.id} exercise={exercise} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {filtered.map((exercise) => (
            <ExerciseListRow key={exercise.id} exercise={exercise} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExerciseGridCard({ exercise }: { exercise: Exercise }) {
  return (
    <Link
      href={`/exercises/${exercise.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex h-28 items-center justify-center rounded-xl bg-muted">
        <Dumbbell className="size-8 text-muted-foreground/50" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="truncate text-sm font-semibold text-foreground">{exercise.name}</span>
        <span className="text-xs text-muted-foreground">
          {EXERCISE_LIBRARY_CATEGORY_LABELS[exercise.category]} · {MUSCLE_GROUP_LABELS[exercise.primary_muscle_group]}
        </span>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <DifficultyBadge difficulty={exercise.difficulty} />
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {EXERCISE_EQUIPMENT_LABELS[exercise.equipment]}
        </span>
        {/* Global exercises are always "approved" (0038), so this only
         * ever fires for a coach-owned row — RLS already restricts which
         * of those even reach this viewer (its owner or an admin). */}
        {exercise.review_status !== "approved" && <ReviewStatusBadge status={exercise.review_status} />}
      </div>
    </Link>
  );
}

function ExerciseListRow({ exercise }: { exercise: Exercise }) {
  return (
    <Link
      href={`/exercises/${exercise.id}`}
      className="flex items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted")}>
        <Dumbbell className="size-4 text-muted-foreground/60" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{exercise.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {EXERCISE_LIBRARY_CATEGORY_LABELS[exercise.category]} · {MUSCLE_GROUP_LABELS[exercise.primary_muscle_group]} ·{" "}
          {EXERCISE_EQUIPMENT_LABELS[exercise.equipment]}
        </span>
      </div>
      <DifficultyBadge difficulty={exercise.difficulty} />
      {exercise.review_status !== "approved" && <ReviewStatusBadge status={exercise.review_status} />}
    </Link>
  );
}
