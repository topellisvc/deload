"use client";

import { useEffect, useRef, useState } from "react";
import { Apple, Plus, Search } from "lucide-react";
import type { Food } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface FoodSearchFieldProps {
  /** Fired when the coach picks a result — this is a one-shot picker, not
   * an editable field like ExerciseSearchField (a meal item's food is fixed
   * at add time; changing it later means removing the item and adding a
   * different one, same as any other line-item picker). */
  onSelect: (food: Food) => void;
  /** DB-backed lookup (lib/nutrition/queries.ts's searchFoods) — injected
   * rather than called directly so this component never talks to Supabase
   * itself, same separation ExerciseSearchField's librarySearch prop
   * keeps. */
  search: (query: string) => Promise<Food[]>;
  /** "Import a food that isn't in the database" — fired with whatever the
   * coach had typed so far, letting the caller open a real macro-entry form
   * (createCustomFood needs calories/protein/carbs/fat, not just a name, so
   * this can't resolve inline the way ExerciseSearchField's plain-text
   * custom_name fallback does). */
  onAddCustomFood?: (query: string) => void;
  placeholder?: string;
  className?: string;
}

/** Per-100g calorie/protein/carbs/fat hint shown next to each result, so a
 * coach can tell "chicken breast, raw" from "chicken breast, fried, batter"
 * without opening each one. */
function macroHint(food: Food): string {
  return `${Math.round(food.calories)} cal · ${Math.round(food.protein_g)}p / ${Math.round(food.carbs_g)}c / ${Math.round(food.fat_g)}f per 100g`;
}

export function FoodSearchField({ onSelect, search, onAddCustomFood, placeholder = "Search foods…", className }: FoodSearchFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    // Debounced — unlike searchExercises' in-memory filter, this is a real
    // Supabase round trip, so firing one on every keystroke would hammer
    // the DB while someone's still typing.
    const timer = setTimeout(() => {
      search(query).then((found) => {
        if (!cancelled) {
          setResults(found);
          setLoading(false);
        }
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, search]);

  useEffect(() => setHighlighted(0), [results]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function openSearch() {
    setQuery("");
    setResults([]);
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function close() {
    setOpen(false);
  }

  function select(food: Food) {
    onSelect(food);
    close();
  }

  function addCustom() {
    onAddCustomFood?.(query.trim());
    close();
  }

  const trimmedQuery = query.trim();
  const showAddCustom = Boolean(onAddCustomFood) && trimmedQuery.length > 0;
  const rowCount = results.length + (showAddCustom ? 1 : 0);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, rowCount - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted < results.length) {
        const f = results[highlighted];
        if (f) select(f);
      } else if (showAddCustom) {
        addCustom();
      }
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={openSearch}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-left text-sm font-medium text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary hover:border-border-strong"
      >
        <Plus className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-normal text-muted-foreground">Add food…</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-full min-w-[20rem] overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              aria-label={placeholder}
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
            />
          </div>
          <ul role="listbox" aria-label="Food results" className="max-h-72 overflow-y-auto py-1">
            {loading && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Searching…</li>}
            {!loading && results.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">No foods found</li>
            )}
            {!loading &&
              results.map((food, i) => (
                <li key={food.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === highlighted}
                    onMouseEnter={() => setHighlighted(i)}
                    onClick={() => select(food)}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors",
                      i === highlighted ? "bg-primary/10 text-primary" : "text-foreground hover:bg-surface-hover"
                    )}
                  >
                    <Apple className="size-3.5 shrink-0 translate-y-0.5 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">
                        {food.name}
                        {food.brand ? ` (${food.brand})` : ""}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{macroHint(food)}</span>
                    </span>
                  </button>
                </li>
              ))}
            {showAddCustom && (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={results.length === highlighted}
                  onMouseEnter={() => setHighlighted(results.length)}
                  onClick={addCustom}
                  className={cn(
                    "flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm font-medium transition-colors",
                    results.length === highlighted ? "bg-primary/10 text-primary" : "text-primary hover:bg-surface-hover"
                  )}
                >
                  <Plus className="size-3.5 shrink-0" />
                  <span className="truncate">Add &ldquo;{trimmedQuery}&rdquo; as a custom food</span>
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
