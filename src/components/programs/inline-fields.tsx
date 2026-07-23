"use client";

import { useEffect, useState } from "react";
import { formatDuration, parseDuration } from "@/lib/programs/duration";
import { cn } from "@/lib/utils";

/**
 * The commit-on-blur numeric/duration input pattern used throughout the
 * program builder and the performance logger — local draft state so
 * keystrokes don't fire a write, a red border for unparsable input left
 * in place until fixed (rather than silently discarding it), and a
 * generic `value`/`onCommit` shape so callers don't need to know whether
 * they're editing a SetPrescription or a LoggedSet field. Shared by
 * PrescriptionRowEditor and PerformanceRowEditor instead of each keeping
 * its own near-identical copy.
 */
export function InlineNumberField({
  label,
  unit,
  value,
  onCommit,
  width,
  min,
}: {
  label: string;
  unit?: string;
  value: number | null;
  onCommit: (v: number | null) => void;
  width: string;
  min?: number;
}) {
  const [text, setText] = useState(value != null ? String(value) : "");
  const [invalid, setInvalid] = useState(false);

  useEffect(() => setText(value != null ? String(value) : ""), [value]);

  function commit() {
    const trimmed = text.trim();
    if (trimmed === "") {
      setInvalid(false);
      if (value !== null) onCommit(null);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || (min !== undefined && n < min)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (n !== value) onCommit(n);
  }

  return (
    <div className="flex items-center gap-1">
      <input
        aria-label={label}
        aria-invalid={invalid}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (invalid) setInvalid(false);
        }}
        onBlur={commit}
        inputMode="decimal"
        placeholder="0"
        className={cn(
          `h-8 ${width} shrink-0 rounded-md border bg-surface px-1.5 text-center text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`,
          invalid ? "border-danger" : "border-border"
        )}
      />
      <span className="shrink-0 text-xs text-muted-foreground">{unit ?? label.toLowerCase()}</span>
    </div>
  );
}

export function InlineDurationField({ label, value, onCommit }: { label: string; value: number | null; onCommit: (v: number | null) => void }) {
  const [text, setText] = useState(formatDuration(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => setText(formatDuration(value)), [value]);

  function commit() {
    const trimmed = text.trim();
    if (trimmed === "") {
      setInvalid(false);
      if (value !== null) onCommit(null);
      return;
    }
    const parsed = parseDuration(trimmed);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setText(formatDuration(parsed));
    if (parsed !== value) onCommit(parsed);
  }

  return (
    <div className="flex items-center gap-1">
      <input
        aria-label={label}
        aria-invalid={invalid}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (invalid) setInvalid(false);
        }}
        onBlur={commit}
        placeholder="mm:ss"
        className={cn(
          "h-8 w-20 shrink-0 rounded-md border bg-surface px-2 text-center text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          invalid ? "border-danger" : "border-border"
        )}
      />
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/** Distance stored in meters, edited in km — the unit athletes and coaches
 * actually think in. Shared by PrescriptionRowEditor (planned distance) and
 * PerformanceRowEditor (performed distance) instead of each keeping its own
 * km<->meters conversion. */
export function InlineDistanceField({
  value,
  onCommit,
  label = "Distance (km)",
}: {
  value: number | null;
  onCommit: (v: number | null) => void;
  label?: string;
}) {
  const [text, setText] = useState(value != null ? String(value / 1000) : "");
  const [invalid, setInvalid] = useState(false);
  useEffect(() => setText(value != null ? String(value / 1000) : ""), [value]);

  function commit() {
    const trimmed = text.trim();
    if (trimmed === "") {
      setInvalid(false);
      if (value !== null) onCommit(null);
      return;
    }
    const km = Number(trimmed);
    if (!Number.isFinite(km)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    const meters = Math.round(km * 1000);
    if (meters !== value) onCommit(meters);
  }

  return (
    <div className="flex items-center gap-1">
      <input
        aria-label={label}
        aria-invalid={invalid}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (invalid) setInvalid(false);
        }}
        onBlur={commit}
        placeholder="0"
        inputMode="decimal"
        className={cn(
          "h-8 w-16 shrink-0 rounded-md border bg-surface px-2 text-center text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          invalid ? "border-danger" : "border-border"
        )}
      />
      <span className="text-xs text-muted-foreground">km</span>
    </div>
  );
}

export function InlineTextField({
  label,
  value,
  onCommit,
  placeholder,
  className,
}: {
  label: string;
  value: string | null;
  onCommit: (v: string | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(value ?? "");
  useEffect(() => setText(value ?? ""), [value]);
  function commit() {
    const trimmed = text.trim();
    if (trimmed !== (value ?? "")) onCommit(trimmed || null);
  }
  return (
    <input
      aria-label={label}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      placeholder={placeholder}
      className={cn(
        "h-8 min-w-[10rem] flex-1 rounded-md border border-border bg-surface px-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className
      )}
    />
  );
}
