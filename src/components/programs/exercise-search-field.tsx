"use client";

import { useEffect, useRef, useState } from "react";
import { Dumbbell, Plus, Search } from "lucide-react";
import { searchExercises, type ExerciseSearchResult } from "@/lib/programs/exercise-search";
import { getExerciseDisplayName } from "@/lib/programs/exercise-catalog";
import type { ExerciseCategory } from "@/lib/programs/types";
import { cn } from "@/lib/utils";

interface ExerciseSearchFieldProps {
  category: ExerciseCategory;
  exerciseId: string | null;
  customName: string | null;
  onChange: (patch: { exercise_id: string | null; custom_name: string | null }) => void;
  /** The signed-in coach's own saved custom exercises (see
   * lib/programs/exercise-library.ts) — merged into search results ahead
   * of the built-in suggestions. Omit entirely where there's no owner
   * context to scope a library to (there currently isn't one). */
  library?: ExerciseSearchResult[];
  /** Fired (in addition to onChange) when the coach picks "Create <name>"
   * for a name that doesn't match anything yet — the caller's chance to
   * persist it to exercise_library so it's a real search result next time,
   * not just this one row's custom_name. Ignored when onCreateInLibrary is
   * provided and succeeds (that path already persists it, more durably). */
  onCreateCustomExercise?: (name: string) => void;
  /** DB-backed results from the shared Exercise Library (see
   * lib/exercises/queries.ts's searchExerciseLibraryForPicker), merged in
   * ahead of the built-in/legacy-library results from searchExercises.
   * Optional and additive on purpose — omitting it (as every existing test
   * does) reproduces the exact pre-Exercise-Library behavior, since this
   * component itself never talks to Supabase directly. */
  librarySearch?: (query: string) => Promise<ExerciseSearchResult[]>;
  /** When provided, "Create <name>" awaits this to create a real Exercise
   * Library row and resolves with a real exercise_id instead of falling
   * back to a custom_name-only row — the Program Builder's version of the
   * spec's "Create New Exercise, which immediately adds it to the
   * library." Falls back to the plain custom_name behavior if this
   * resolves to null (e.g. a name collision) or isn't provided at all. */
  onCreateInLibrary?: (name: string) => Promise<{ id: string; name: string } | null>;
  className?: string;
}

/**
 * Replaces the old free-text-input-with-a-datalist ExercisePicker with a
 * command-palette-style search: click to open, type to filter, arrow keys
 * to move, Enter to pick — the same interaction shape as a contact search
 * or a command palette, rather than a native <input list> whose suggestion
 * UI differs per browser and doesn't offer a "create new" affordance at all.
 *
 * Reads through lib/programs/exercise-search.ts's searchExercises rather
 * than touching lib/programs/exercise-catalog.ts directly — that
 * indirection is deliberate (see that file's doc comment): swapping the
 * in-memory name lists for a real, coach-editable Exercise Library later
 * only means changing searchExercises' implementation, not this component.
 */
export function ExerciseSearchField({
  category,
  exerciseId,
  customName,
  onChange,
  library = [],
  onCreateCustomExercise,
  librarySearch,
  onCreateInLibrary,
  className,
}: ExerciseSearchFieldProps) {
  const currentLabel = exerciseId ? getExerciseDisplayName({ exercise_id: exerciseId, custom_name: customName }) : (customName ?? "");

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExerciseSearchResult[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([searchExercises(query, category, library), librarySearch ? librarySearch(query) : Promise.resolve([])]).then(
      ([builtIn, fromLibrary]) => {
        if (cancelled) return;
        // Exercise Library results lead (it's the source of truth going
        // forward), deduped by name against the built-in/legacy-library
        // results so a seeded catalog entry doesn't show up twice just
        // because its name also happens to be in the static lists.
        const libraryLower = new Set(fromLibrary.map((r) => r.name.toLowerCase()));
        setResults([...fromLibrary, ...builtIn.filter((r) => !libraryLower.has(r.name.toLowerCase()))]);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [open, query, category, library, librarySearch]);

  useEffect(() => setHighlighted(0), [results]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close();
    }
    // Escape closes regardless of which element inside the panel currently
    // has focus, same as Dialog's own document-level listener — not just
    // the search input's onKeyDown, since a mouse click on a result row
    // (see onMouseEnter below) can leave the input un-focused.
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
    setOpen(true);
    // Focus lands after the panel actually mounts (it's conditionally
    // rendered), not synchronously with the click that opens it.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function close() {
    setOpen(false);
  }

  function select(result: ExerciseSearchResult) {
    onChange({ exercise_id: result.id, custom_name: result.id ? null : result.name });
    close();
  }

  async function createCustom() {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (onCreateInLibrary) {
      const created = await onCreateInLibrary(trimmed);
      if (created) {
        onChange({ exercise_id: created.id, custom_name: null });
        close();
        return;
      }
    }
    onChange({ exercise_id: null, custom_name: trimmed });
    onCreateCustomExercise?.(trimmed);
    close();
  }

  // Derived from the already-fetched `results` (which include any live
  // Exercise Library matches) rather than only isNewExerciseName's
  // static-lists-and-legacy-library check — a substring-filtered list
  // still contains an exact match if one exists, so this stays equivalent
  // to the old check while also catching a DB match isNewExerciseName has
  // no way to see.
  const trimmedQuery = query.trim();
  const offerCreate = trimmedQuery.length > 0 && !results.some((r) => r.name.toLowerCase() === trimmedQuery.toLowerCase());
  // The create-custom row is always the last item in keyboard nav order —
  // folding it into one combined list means Up/Down/Enter don't need to
  // special-case "am I on a real result or the create row" separately.
  const rowCount = results.length + (offerCreate ? 1 : 0);

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
        const r = results[highlighted];
        if (r) select(r);
      } else if (offerCreate) {
        createCustom();
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
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <span className={cn("min-w-0 flex-1 truncate", !currentLabel && "font-normal text-muted-foreground")}>
          {currentLabel || "Search exercises…"}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-full min-w-[16rem] overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search exercises…"
              aria-label="Search exercises"
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
            />
          </div>
          <ul role="listbox" aria-label="Exercise results" className="max-h-64 overflow-y-auto py-1">
            {results.length === 0 && !offerCreate && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">No exercises found</li>
            )}
            {results.map((r, i) => (
              <li key={`${r.category}-${r.id ?? r.name}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlighted}
                  onMouseEnter={() => setHighlighted(i)}
                  onClick={() => select(r)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                    i === highlighted ? "bg-primary/10 text-primary" : "text-foreground hover:bg-surface-hover"
                  )}
                >
                  <Dumbbell className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{r.name}</span>
                </button>
              </li>
            ))}
            {offerCreate && (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={results.length === highlighted}
                  onMouseEnter={() => setHighlighted(results.length)}
                  onClick={createCustom}
                  className={cn(
                    "flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm font-medium transition-colors",
                    results.length === highlighted ? "bg-primary/10 text-primary" : "text-primary hover:bg-surface-hover"
                  )}
                >
                  <Plus className="size-3.5 shrink-0" />
                  <span className="truncate">Create &ldquo;{query.trim()}&rdquo;</span>
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
