"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { formatDuration, parseDuration } from "@/lib/programs/duration";
import { cn } from "@/lib/utils";

/**
 * Large, touch-friendly input primitives for Training Mode — deliberately
 * separate from components/programs/inline-fields.tsx's compact desktop
 * table inputs (h-8, small text). Same commit-on-blur/commit-on-change
 * pattern underneath, just built for "glanceable and tappable mid-set" over
 * "dense and scannable in a review table" (spec: "large typography, clear
 * buttons... comfortable to use while training").
 */
export function BigNumberField({
  label,
  unit,
  value,
  onChange,
  step = 1,
  min = 0,
  placeholder = "—",
  autoFocus,
}: {
  label: string;
  unit?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  min?: number;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(value != null ? String(value) : "");
  useEffect(() => setText(value != null ? String(value) : ""), [value]);

  function commit(raw: string) {
    const trimmed = raw.trim();
    if (trimmed === "") {
      onChange(null);
      return;
    }
    const n = Number(trimmed);
    if (Number.isFinite(n)) onChange(Math.max(min, n));
    else setText(value != null ? String(value) : "");
  }

  function bump(delta: number) {
    const base = value ?? 0;
    const next = Math.max(min, Math.round((base + delta) * 100) / 100);
    setText(String(next));
    onChange(next);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => bump(-step)}
          aria-label={`Decrease ${label}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-surface-hover active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Minus className="size-5" />
        </button>
        <div className="flex items-baseline gap-1">
          <input
            aria-label={label}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => commit(text)}
            inputMode="decimal"
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="w-24 border-none bg-transparent text-center text-4xl font-bold tabular-nums text-foreground focus-visible:outline-none"
          />
          {unit && <span className="text-base font-medium text-muted-foreground">{unit}</span>}
        </div>
        <button
          type="button"
          onClick={() => bump(step)}
          aria-label={`Increase ${label}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-surface-hover active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Plus className="size-5" />
        </button>
      </div>
    </div>
  );
}

export function BigDurationField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(formatDuration(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => setText(formatDuration(value)), [value]);

  function commit() {
    const trimmed = text.trim();
    if (trimmed === "") {
      setInvalid(false);
      onChange(null);
      return;
    }
    const parsed = parseDuration(trimmed);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setText(formatDuration(parsed));
    onChange(parsed);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
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
          "w-32 rounded-xl border bg-surface px-3 py-2 text-center text-3xl font-bold tabular-nums text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          invalid ? "border-danger" : "border-border"
        )}
      />
    </div>
  );
}

export function BigDistanceField({ label = "Distance", value, onChange }: { label?: string; value: number | null; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(value != null ? String(value / 1000) : "");
  useEffect(() => setText(value != null ? String(value / 1000) : ""), [value]);

  function commit() {
    const trimmed = text.trim();
    if (trimmed === "") {
      onChange(null);
      return;
    }
    const km = Number(trimmed);
    if (Number.isFinite(km)) onChange(Math.round(km * 1000));
    else setText(value != null ? String(value / 1000) : "");
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <input
          aria-label={label}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          inputMode="decimal"
          placeholder="0"
          className="w-24 border-none bg-transparent text-center text-4xl font-bold tabular-nums text-foreground focus-visible:outline-none"
        />
        <span className="text-base font-medium text-muted-foreground">km</span>
      </div>
    </div>
  );
}

export function BigTextField({
  label,
  value,
  onCommit,
  placeholder,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <textarea
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text !== value) onCommit(text);
        }}
        placeholder={placeholder}
        rows={2}
        className="w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
    </div>
  );
}
