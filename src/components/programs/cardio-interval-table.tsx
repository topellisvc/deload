"use client";

import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import type { SetRow } from "@/lib/programs/types";
import { InlineDistanceField, InlineDurationField, InlineNumberField, InlineTextField } from "@/components/programs/inline-fields";
import { cn } from "@/lib/utils";

const ROW_GRID = "sm:grid-cols-[1.25rem_1fr_8rem_7rem_7rem_5rem_2rem]";

interface CardioIntervalTableProps {
  sets: SetRow[];
  onChange: (setId: string, patch: Partial<SetRow>) => void;
  onDelete: (setId: string) => void;
  onAdd: () => void;
  onReorder: (orderedSets: { id: string; position: number }[]) => void;
}

/**
 * The spec's "Cardio Builder" — Interval / Distance / Time / Rest / Repeat
 * as a structured, scannable table with add/delete/reorder, replacing the
 * generic stacked PrescriptionRowEditor for the 'intervals' prescription
 * type (running and cardio only — see exercise-card.tsx's branch). Reuses
 * a single SetRow per interval row exactly like every other prescription
 * type does, so no schema change was needed: `notes` becomes the interval's
 * short label (free on this type — 'intervals' doesn't otherwise read
 * notes), `sets` doubles as the repeat count exactly as it already did for
 * the single-row "6 x 400m" case, and add/delete/reorder are the same
 * addSetRow/removeSet/position-swap primitives every other set list uses.
 *
 * Below `sm:` the grid collapses to one column and each field's own inline
 * label (from inline-fields.tsx) carries the meaning the header row would
 * otherwise provide — avoids a second mobile-only layout while still
 * avoiding horizontal scroll.
 */
export function CardioIntervalTable({ sets, onChange, onDelete, onAdd, onReorder }: CardioIntervalTableProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sets.findIndex((s) => s.id === active.id);
    const newIndex = sets.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(sets, oldIndex, newIndex);
    onReorder(reordered.map((s, i) => ({ id: s.id, position: i + 1 })));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn("hidden text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid sm:items-center sm:gap-x-2", ROW_GRID)}>
        <span />
        <span>Interval</span>
        <span>Distance</span>
        <span>Time</span>
        <span>Rest</span>
        <span>Repeat</span>
        <span />
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={sets.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1.5">
            {sets.map((set) => (
              <IntervalRow key={set.id} set={set} onChange={(patch) => onChange(set.id, patch)} onDelete={() => onDelete(set.id)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1 self-start rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Plus className="size-3.5" />
        Add interval
      </button>
    </div>
  );
}

function IntervalRow({ set, onChange, onDelete }: { set: SetRow; onChange: (patch: Partial<SetRow>) => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: set.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-1.5 sm:grid sm:items-center sm:gap-x-2 sm:gap-y-0",
        ROW_GRID,
        isDragging && "z-10 opacity-60 shadow-lg"
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder interval"
        className="flex h-7 w-5 shrink-0 touch-none items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-3.5" />
      </button>

      <InlineTextField label="Interval label" value={set.notes} onCommit={(v) => onChange({ notes: v })} placeholder="e.g. Sprint" className="min-w-[8rem] flex-1 basis-full sm:basis-auto" />
      <InlineDistanceField value={set.distance_meters} onCommit={(v) => onChange({ distance_meters: v })} label="Distance" />
      <InlineDurationField label="Time" value={set.duration_seconds} onCommit={(v) => onChange({ duration_seconds: v })} />
      <InlineDurationField label="Rest" value={set.rest_seconds} onCommit={(v) => onChange({ rest_seconds: v })} />
      <InlineNumberField label="Repeat" unit="×" value={set.sets} onCommit={(v) => onChange({ sets: v ?? 1 })} width="w-12" min={1} />

      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete interval"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
