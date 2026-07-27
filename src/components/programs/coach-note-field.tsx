"use client";

import { useEffect, useState } from "react";
import { NotebookPen, Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface CoachNoteFieldProps {
  value: string | null;
  onCommit: (v: string | null) => void;
  placeholder?: string;
}

/**
 * The exercise-level coach note (block_exercises.notes — "Focus on bar
 * speed.", "Leave 2 reps in reserve.", "Control the eccentric.") was
 * previously write-only from the builder's perspective: updateBlockExercise
 * already accepted a `notes` patch and Training Mode's ExerciseScreen /
 * ProgramViewer already rendered it, but nothing in the builder UI actually
 * exposed a way to set it. This is that editor.
 *
 * Collapsed to a "+ Add coach note" affordance unless a note already
 * exists — per spec, most exercises won't have one, and a Textarea sitting
 * empty on every single exercise card would be exactly the clutter Simple
 * Mode is trying to avoid.
 */
export function CoachNoteField({ value, onCommit, placeholder = "e.g. Focus on bar speed." }: CoachNoteFieldProps) {
  const [manuallyOpened, setManuallyOpened] = useState(false);
  const [text, setText] = useState(value ?? "");

  useEffect(() => setText(value ?? ""), [value]);

  const open = !!value || manuallyOpened;

  function commit() {
    const trimmed = text.trim();
    if (trimmed !== (value ?? "")) onCommit(trimmed || null);
    if (!trimmed) setManuallyOpened(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setManuallyOpened(true)}
        className="flex items-center gap-1 self-start rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Plus className="size-3.5" />
        Add coach note
      </button>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <NotebookPen className="mt-2.5 size-3.5 shrink-0 text-muted-foreground" />
      <Textarea
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        placeholder={placeholder}
        aria-label="Coach note"
        className="flex-1 text-sm"
      />
    </div>
  );
}
