"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { EXERCISES } from "@/lib/workout-generator/exercises";
import { exerciseNamesForCategory, getExerciseDisplayName } from "@/lib/programs/exercise-catalog";
import type { ExerciseCategory } from "@/lib/programs/types";
import { cn } from "@/lib/utils";

interface ExercisePickerProps {
  category: ExerciseCategory;
  exerciseId: string | null;
  customName: string | null;
  onChange: (patch: { exercise_id: string | null; custom_name: string | null }) => void;
  className?: string;
}

// Only the strength catalog (lib/workout-generator/exercises.ts) has real
// ids to resolve against — running/cardio names (lib/programs/exercise-catalog.ts)
// are suggestions only and always land in custom_name, same as any
// strength name typed that isn't in EXERCISES either.
const STRENGTH_NAME_TO_ID = new Map(EXERCISES.map((e) => [e.name.toLowerCase(), e.id]));

/**
 * Free-text exercise name field backed by a <datalist> of category-relevant
 * suggestions (see exerciseNamesForCategory) — type to filter, pick a
 * suggestion, or just keep typing a name that isn't in the list at all. On
 * commit (blur / Enter), an exact match against the *strength* catalog
 * resolves to `exercise_id`; every other case (a running/cardio name, or
 * any name that just isn't in either list) is stored as `custom_name`. No
 * custom combobox component needed, and it works the same on mobile as
 * desktop.
 */
export function ExercisePicker({ category, exerciseId, customName, onChange, className }: ExercisePickerProps) {
  const listId = useId();
  const suggestions = useMemo(() => exerciseNamesForCategory(category), [category]);

  const initialLabel = useMemo(() => {
    if (exerciseId) return getExerciseDisplayName({ exercise_id: exerciseId, custom_name: customName });
    return customName ?? "";
  }, [exerciseId, customName]);
  const [text, setText] = useState(initialLabel);

  useEffect(() => {
    setText(initialLabel);
  }, [initialLabel]);

  function commit() {
    const trimmed = text.trim();
    if (!trimmed) {
      setText(initialLabel);
      return;
    }
    if (trimmed === initialLabel) return;
    const matchedId = category === "strength" ? STRENGTH_NAME_TO_ID.get(trimmed.toLowerCase()) : undefined;
    if (matchedId) {
      onChange({ exercise_id: matchedId, custom_name: null });
    } else {
      onChange({ exercise_id: null, custom_name: trimmed });
    }
  }

  return (
    <>
      <input
        list={listId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="Exercise name"
        aria-label="Exercise name"
        title={text}
        className={cn(
          "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground placeholder:text-muted-foreground placeholder:font-normal transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary",
          className
        )}
      />
      <datalist id={listId}>
        {suggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </>
  );
}
