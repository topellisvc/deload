"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import type { MealTemplateWithItems } from "@/lib/nutrition/types";
import { itemMacros, sumMacros } from "@/lib/nutrition/macros";
import { cn } from "@/lib/utils";

interface MealTemplatePickerProps {
  /** The whole library (lib/nutrition/queries.ts' getMealTemplates) —
   * fetched once server-side and passed down, same "small fixed set, no
   * separate query API" reasoning as ExerciseSearchField's in-memory
   * catalog. Unlike FoodSearchField this never talks to Supabase itself. */
  templates: MealTemplateWithItems[];
  onSelect: (template: MealTemplateWithItems) => void;
}

const CATEGORY_ORDER = ["breakfast", "lunch", "dinner", "snack"] as const;
const CATEGORY_LABEL: Record<(typeof CATEGORY_ORDER)[number], string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

/**
 * "Insert a pre-made healthy meal" — sits next to FoodSearchField in each
 * meal option. Picking a template bulk-adds every one of its items in one
 * shot (MealPlanBuilder's handleAddTemplate -> applyMealTemplate), rather
 * than making the coach add each food individually.
 */
export function MealTemplatePicker({ templates, onSelect }: MealTemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (templates.length === 0) return null;

  function select(template: MealTemplateWithItems) {
    onSelect(template);
    setOpen(false);
  }

  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    templates: templates.filter((t) => t.category === category),
  })).filter((g) => g.templates.length > 0);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Sparkles className="size-4 shrink-0" />
        Templates…
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-72 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          <ul role="listbox" aria-label="Meal templates" className="max-h-80 overflow-y-auto py-1">
            {groups.map((group) => (
              <li key={group.category}>
                <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{CATEGORY_LABEL[group.category]}</p>
                <ul>
                  {group.templates.map((template) => {
                    const totals = sumMacros(template.items.map(itemMacros));
                    return (
                      <li key={template.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={false}
                          onClick={() => select(template)}
                          className={cn(
                            "flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                          )}
                        >
                          <span className="truncate font-medium">{template.name}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {Math.round(totals.calories)} cal · {Math.round(totals.protein_g)}p / {Math.round(totals.carbs_g)}c / {Math.round(totals.fat_g)}f
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
