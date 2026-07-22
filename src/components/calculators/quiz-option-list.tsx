"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuizOption {
  id: string;
  label: string;
}

interface QuizOptionListProps {
  question: string;
  options: readonly QuizOption[];
  value: string;
  onChange: (id: string) => void;
  "aria-label": string;
}

/**
 * A vertical list of full-sentence, single-select options — for quiz-style
 * questions where SegmentedControl's short-label pill layout doesn't fit.
 */
export function QuizOptionList({ question, options, value, onChange, ...aria }: QuizOptionListProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{question}</span>
      <div role="radiogroup" aria-label={aria["aria-label"]} className="flex flex-col gap-2">
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.id)}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                selected
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border",
                  selected ? "border-primary bg-primary text-primary-foreground" : "border-border-strong"
                )}
              >
                {selected && <Check className="size-3" />}
              </span>
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
