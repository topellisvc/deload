"use client";

import { useEffect, useState } from "react";

/**
 * The Program Builder's three editing modes:
 * - "simple": the default — only the fields the vast majority of
 *   programming needs (exercise, category, prescription type, sets/reps/
 *   load, rest, coach notes). Where a coach should spend ~90% of their time.
 * - "advanced": unlocks specialised programming controls (custom fields
 *   today; tempo/drop-sets/cluster-sets/EMOM/etc. can layer on later — see
 *   advanced-fields.ts) without cluttering Simple Mode.
 * - "preview": read-only "what will the athlete actually see in Training
 *   Mode" view, not an editing surface at all.
 */
export type BuilderMode = "simple" | "advanced" | "preview";

const STORAGE_KEY = "deload.programBuilder.mode";

function isBuilderMode(value: string | null): value is BuilderMode {
  return value === "simple" || value === "advanced" || value === "preview";
}

/**
 * Persists the coach's chosen editing mode across visits (spec: "The
 * selected mode should persist for the user"). Kept in localStorage rather
 * than a database column — it's a per-browser UI preference, not program
 * data, so it doesn't need to sync across devices or be visible to anyone
 * else looking at the same program.
 *
 * Every render starts at the "simple" default (there's no localStorage to
 * read during server rendering) and swaps to whatever's actually stored in
 * an effect right after mount. That one-frame flash is a smaller cost than
 * the hydration-mismatch warning reading localStorage during the initial
 * render would cause.
 */
export function useBuilderMode(): [BuilderMode, (mode: BuilderMode) => void] {
  const [mode, setModeState] = useState<BuilderMode>("simple");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isBuilderMode(stored)) setModeState(stored);
  }, []);

  function setMode(next: BuilderMode) {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private-browsing / storage-full failures shouldn't block switching
      // modes for the current session — it just won't stick next visit.
    }
  }

  return [mode, setMode];
}
