"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { BLOCK_TYPE_OPTIONS, COMING_SOON_BLOCK_TYPES } from "@/lib/programs/block-types";
import type { BlockRole, BlockType } from "@/lib/programs/types";
import { cn } from "@/lib/utils";

interface AddBlockMenuProps {
  role: BlockRole;
  /** Trigger button's own label — "Add exercise" / "Add warm-up" / "Add
   * to conditioning", already computed by the caller (day-column.tsx) the
   * same way it always was; opening this menu doesn't change what the
   * trigger itself says. */
  label: string;
  /** True for the section footer's full-width dashed button; false for
   * the small ghost link shown while a warmup/conditioning section is
   * still empty. Purely a style switch — both open the same menu. */
  fullWidth?: boolean;
  onAddBlock: (role: BlockRole, blockType: BlockType) => void;
}

/**
 * "+ Add Block" no longer creates an exercise directly — it opens this
 * type picker first (spec: "Instead of immediately adding an exercise,
 * coaches should first choose the type of block they want to add"). Each
 * of the 7 real options is a real block_type (migration 0056); the
 * "coming soon" ones below the divider are disabled, communicating the
 * architecture's own room to grow without implying they work yet.
 */
export function AddBlockMenu({ role, label, fullWidth, onAddBlock }: AddBlockMenuProps) {
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

  function choose(blockType: BlockType) {
    setOpen(false);
    onAddBlock(role, blockType);
  }

  return (
    <div ref={containerRef} className={cn("relative", fullWidth && "flex-1")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={
          fullWidth
            ? "flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            : "flex items-center gap-1.5 self-start rounded-md px-1 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        }
      >
        <Plus className={fullWidth ? "size-4" : "size-3.5"} />
        {label}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Choose block type"
          className="absolute left-0 top-full z-20 mt-1.5 w-72 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-lg"
        >
          <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Choose block type</p>
          {BLOCK_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitem"
              onClick={() => choose(option.value)}
              className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option.icon className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </span>
            </button>
          ))}

          <div className="my-1.5 border-t border-border" />
          <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Coming soon</p>
          <div className="flex flex-col">
            {COMING_SOON_BLOCK_TYPES.map((option) => (
              <div key={option.label} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground opacity-60">
                {option.label}
                <span className="text-[10px] font-medium uppercase tracking-wide">Soon</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
