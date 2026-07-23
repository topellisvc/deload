"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { SetRow } from "@/lib/programs/types";

interface RunSetRowEditorProps {
  set: SetRow;
  onChange: (patch: Partial<SetRow>) => void;
  onDelete: () => void;
}

function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds == null) return "";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Accepts "25:00", "25", or "1:05:00" — returns total seconds, or null if unparsable. */
function parseDuration(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return null;
  const [a, b, c] = parts;
  if (parts.length === 1 && a !== undefined) return Math.round(a * 60); // bare number = minutes
  if (parts.length === 2 && a !== undefined && b !== undefined) return a * 60 + b;
  if (parts.length === 3 && a !== undefined && b !== undefined && c !== undefined) return a * 3600 + b * 60 + c;
  return null;
}

/**
 * Set-row editor for 'run' exercises: distance + duration instead of
 * sets/reps/load. A run "row" is one segment of the session — a single
 * easy run is one row, an interval session (e.g. 6x400m) is several rows
 * with the same distance and a target duration, matching how
 * SetRowEditor's "Add set row" already works for straight sets.
 */
export function RunSetRowEditor({ set, onChange, onDelete }: RunSetRowEditorProps) {
  const [distance, setDistance] = useState(set.distance_meters != null ? String(set.distance_meters / 1000) : "");
  const [duration, setDuration] = useState(formatDuration(set.duration_seconds));

  useEffect(() => setDistance(set.distance_meters != null ? String(set.distance_meters / 1000) : ""), [set.distance_meters]);
  useEffect(() => setDuration(formatDuration(set.duration_seconds)), [set.duration_seconds]);

  function commitDistance() {
    const trimmed = distance.trim();
    const km = trimmed === "" ? null : Number(trimmed);
    const meters = km != null && Number.isFinite(km) ? Math.round(km * 1000) : null;
    if (meters !== set.distance_meters) onChange({ distance_meters: meters });
  }

  function commitDuration() {
    const parsed = parseDuration(duration);
    setDuration(formatDuration(parsed));
    if (parsed !== set.duration_seconds) onChange({ duration_seconds: parsed });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="flex items-center gap-1">
        <input
          aria-label="Distance (km)"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          onBlur={commitDistance}
          placeholder="0"
          inputMode="decimal"
          className="h-8 w-16 shrink-0 rounded-md border border-border bg-surface px-2 text-center text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <span className="text-xs text-muted-foreground">km</span>
      </div>
      <div className="flex items-center gap-1">
        <input
          aria-label="Duration (minutes:seconds)"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          onBlur={commitDuration}
          placeholder="mm:ss"
          className="h-8 w-20 shrink-0 rounded-md border border-border bg-surface px-2 text-center text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <span className="text-xs text-muted-foreground">time</span>
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete run segment"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
