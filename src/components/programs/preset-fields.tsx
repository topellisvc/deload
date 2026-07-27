"use client";

import { useState } from "react";
import { InlineNumberField, InlineDistanceField } from "@/components/programs/inline-fields";
import { cn } from "@/lib/utils";

/** Exported for advanced-fields-editor.tsx's Method presets row — same
 * one-tap-chip idiom, reused rather than re-implemented. */
export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        selected ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

const REST_PRESETS: { label: string; seconds: number }[] = [
  { label: "30 sec", seconds: 30 },
  { label: "60 sec", seconds: 60 },
  { label: "90 sec", seconds: 90 },
  { label: "2 min", seconds: 120 },
  { label: "3 min", seconds: 180 },
];

/**
 * Rest as a row of one-tap presets (the spec's own list: 30/60/90 sec, 2/3
 * min) instead of always typing a number — "Custom" reveals the plain
 * numeric-seconds field (InlineNumberField, unchanged) for anything the
 * presets don't cover. A rest value that doesn't match any preset (loaded
 * from an existing program, or picked before this redesign) opens straight
 * into Custom already showing that value, rather than silently looking
 * like "no preset selected."
 */
export function RestPresetField({ value, onCommit }: { value: number | null; onCommit: (v: number | null) => void }) {
  const matchesPreset = REST_PRESETS.some((p) => p.seconds === value);
  const [customOpen, setCustomOpen] = useState(value != null && !matchesPreset);

  function pickPreset(seconds: number) {
    setCustomOpen(false);
    onCommit(seconds);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Rest</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {REST_PRESETS.map((p) => (
          <Chip key={p.seconds} selected={!customOpen && value === p.seconds} onClick={() => pickPreset(p.seconds)}>
            {p.label}
          </Chip>
        ))}
        <Chip selected={customOpen} onClick={() => setCustomOpen(true)}>
          Custom
        </Chip>
        {customOpen && <InlineNumberField label="Rest" unit="sec" value={value} onCommit={onCommit} width="w-16" />}
      </div>
    </div>
  );
}

const DISTANCE_PRESETS: { label: string; meters: number }[] = [
  { label: "400m", meters: 400 },
  { label: "1km", meters: 1000 },
  { label: "5km", meters: 5000 },
  { label: "10km", meters: 10000 },
];

/**
 * Same preset-chips-plus-custom pattern as RestPresetField, for distance —
 * the common training distances a coach reaches for constantly (400m
 * repeats, a 5k, a 10k) as one tap, "Custom" for everything else via the
 * existing km-based InlineDistanceField.
 */
export function DistancePresetField({ value, onCommit }: { value: number | null; onCommit: (v: number | null) => void }) {
  const matchesPreset = DISTANCE_PRESETS.some((p) => p.meters === value);
  const [customOpen, setCustomOpen] = useState(value != null && !matchesPreset);

  function pickPreset(meters: number) {
    setCustomOpen(false);
    onCommit(meters);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Distance</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {DISTANCE_PRESETS.map((p) => (
          <Chip key={p.meters} selected={!customOpen && value === p.meters} onClick={() => pickPreset(p.meters)}>
            {p.label}
          </Chip>
        ))}
        <Chip selected={customOpen} onClick={() => setCustomOpen(true)}>
          Custom
        </Chip>
        {customOpen && <InlineDistanceField value={value} onCommit={onCommit} label="Distance (km)" />}
      </div>
    </div>
  );
}
