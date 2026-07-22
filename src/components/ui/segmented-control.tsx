"use client";

import { cn } from "@/lib/utils";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
  className?: string;
}

/** Accessible two-to-four-way toggle, keyboard navigable via arrow keys. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  ...aria
}: SegmentedControlProps<T>) {
  function handleKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + delta + options.length) % options.length;
    const next = options[nextIndex];
    if (next) onChange(next.value);
  }

  return (
    <div
      role="radiogroup"
      aria-label={aria["aria-label"]}
      className={cn(
        "inline-flex items-center rounded-lg border border-border bg-muted p-1",
        className
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              selected
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
