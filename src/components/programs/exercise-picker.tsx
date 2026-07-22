"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { EXERCISES } from "@/lib/workout-generator/exercises";
import { cn } from "@/lib/utils";

interface ExercisePickerProps {
  exerciseId: string | null;
  customName: string | null;
  onChange: (patch: { exercise_id: string | null; custom_name: string | null }) => void;
  className?: string;
}

const NAME_TO_ID = new Map(EXERCISES.map((e) => [e.name.toLowerCase(), e.id]));
const ID_TO_NAME = new Map(EXERCISES.map((e) => [e.id, e.name]));

/**
 * Free-text exercise name field backed by a <datalist> of the curated
 * exercise database — type to filter, pick a suggestion, or just keep
 * typing a name that isn't in the list at all. On commit (blur / Enter),
 * an exact match against the database resolves to `exercise_id`;
 * anything else is stored as `custom_name`. No custom combobox component
 * needed, and it works the same on mobile as desktop.
 */
export function ExercisePicker({ exerciseId, customName, onChange, className }: ExercisePickerProps) {
  const listId = useId();
  const initialLabel = useMemo(() => {
    if (exerciseId) return ID_TO_NAME.get(exerciseId) ?? customName ?? "";
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
    const matchedId = NAME_TO_ID.get(trimmed.toLowerCase());
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
        {EXERCISES.map((e) => (
          <option key={e.id} value={e.name} />
        ))}
      </datalist>
    </>
  );
}
