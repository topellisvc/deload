"use client";

import { useEffect, useState } from "react";
import { Copy, Plus } from "lucide-react";
import type { DayRow, SetRow } from "@/lib/programs/types";
import { ExerciseBlockCard } from "@/components/programs/exercise-block-card";
import { cn } from "@/lib/utils";

interface DayColumnProps {
  day: DayRow;
  otherDays: { id: string; label: string | null; position: number }[];
  onUpdateDay: (patch: { label?: string | null; is_rest_day?: boolean }) => void;
  onCopyTo: (targetDayId: string) => void;
  onAddBlock: () => void;
  onDeleteBlock: (blockId: string) => void;
  onMoveBlock: (blockId: string, direction: "up" | "down") => void;
  onExerciseChange: (blockId: string, patch: { exercise_id: string | null; custom_name: string | null }) => void;
  onAddSet: (blockId: string) => void;
  onSetChange: (blockId: string, setId: string, patch: Partial<SetRow>) => void;
  onDeleteSet: (blockId: string, setId: string) => void;
}

/**
 * One day of the week grid. On mobile these stack vertically (parent
 * controls that via a flex-col / lg:grid-flow-col layout); on desktop
 * they sit side by side so a whole week is visible without navigating
 * between days.
 */
export function DayColumn({
  day,
  otherDays,
  onUpdateDay,
  onCopyTo,
  onAddBlock,
  onDeleteBlock,
  onMoveBlock,
  onExerciseChange,
  onAddSet,
  onSetChange,
  onDeleteSet,
}: DayColumnProps) {
  const [label, setLabel] = useState(day.label ?? "");

  useEffect(() => setLabel(day.label ?? ""), [day.label]);

  function commitLabel() {
    const trimmed = label.trim();
    if (trimmed !== (day.label ?? "")) onUpdateDay({ label: trimmed || null });
    if (!trimmed) setLabel(day.label ?? "");
  }

  return (
    <div className="flex w-full shrink-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-4 lg:w-80">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={commitLabel}
            placeholder={`Day ${day.position}`}
            aria-label="Day label"
            className={cn(
              "min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-base font-semibold text-foreground transition-colors",
              "hover:border-border focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary",
              day.is_rest_day && "text-muted-foreground"
            )}
          />
          {otherDays.length > 0 && (
            <div className="relative shrink-0">
              <select
                aria-label="Copy this day's exercises to another day"
                value=""
                onChange={(e) => {
                  if (e.target.value) onCopyTo(e.target.value);
                  e.target.value = "";
                }}
                disabled={day.blocks.length === 0}
                className="peer h-8 w-8 cursor-pointer appearance-none rounded-md border border-border bg-surface text-transparent disabled:cursor-not-allowed disabled:opacity-40"
              >
                <option value="" disabled>
                  Copy to…
                </option>
                {otherDays.map((d) => (
                  <option key={d.id} value={d.id}>
                    Copy to {d.label || `Day ${d.position}`}
                  </option>
                ))}
              </select>
              <Copy
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 text-muted-foreground peer-disabled:opacity-40"
              />
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={day.is_rest_day}
            onChange={(e) => onUpdateDay({ is_rest_day: e.target.checked })}
            className="size-3.5 rounded border-border-strong text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          Rest day
        </label>
      </div>

      {!day.is_rest_day && (
        <>
          <div className="flex flex-col gap-2">
            {day.blocks.map((block, i) => (
              <ExerciseBlockCard
                key={block.id}
                block={block}
                canMoveUp={i > 0}
                canMoveDown={i < day.blocks.length - 1}
                onMoveUp={() => onMoveBlock(block.id, "up")}
                onMoveDown={() => onMoveBlock(block.id, "down")}
                onDeleteBlock={() => onDeleteBlock(block.id)}
                onExerciseChange={(patch) => onExerciseChange(block.id, patch)}
                onAddSet={() => onAddSet(block.id)}
                onSetChange={(setId, patch) => onSetChange(block.id, setId, patch)}
                onDeleteSet={(setId) => onDeleteSet(block.id, setId)}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={onAddBlock}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Plus className="size-4" />
            Add exercise
          </button>
        </>
      )}
    </div>
  );
}
