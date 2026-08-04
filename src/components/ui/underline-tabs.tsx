"use client";

import { cn } from "@/lib/utils";

export interface UnderlineTabOption<T extends string> {
  value: T;
  label: string;
  /** Shown as a small pill after the label when > 0 — e.g. a pending-
   * requests count. Omit (or 0) to show no badge at all. */
  count?: number;
}

interface UnderlineTabsProps<T extends string> {
  options: readonly UnderlineTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
  className?: string;
}

/** A lighter-weight tab style than SegmentedControl's boxed pill toggle —
 * a bottom border on the active tab instead of a filled background, closer
 * to how most real dashboards (and Ellis's own mockup) present a page's
 * primary section tabs. SegmentedControl is still the right choice for
 * true two/three-way toggles (units, categories); this is for page-level
 * tab navigation specifically. */
export function UnderlineTabs<T extends string>({ options, value, onChange, className, ...aria }: UnderlineTabsProps<T>) {
  return (
    <div role="tablist" aria-label={aria["aria-label"]} className={cn("flex items-center gap-5 overflow-x-auto border-b border-border", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 pb-2.5 text-sm font-medium transition-colors focus-visible:outline-none",
              selected ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
            {!!option.count && (
              <span
                className={cn(
                  "flex min-w-[1.1rem] items-center justify-center rounded-full px-1 py-0.5 text-[10px] font-semibold leading-none",
                  selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
