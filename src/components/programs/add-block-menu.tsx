"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
 *
 * Portals the dropdown into document.body with `position: fixed` computed
 * from the trigger button's own rect, rather than an `absolute`-positioned
 * child of the trigger — found live cut off mid-list inside the Program
 * Builder's day-columns row. That row is `lg:overflow-x-auto` (so a week
 * with more days than fit can scroll sideways); per the CSS Overflow
 * spec, an element with one axis set to a non-'visible' overflow forces
 * the *other* axis to compute as 'auto' too even when it's explicitly
 * declared 'visible' (see that row's own "overflow-y-visible" comment in
 * program-builder.tsx, which fixes wheel-scroll bubbling but not this) —
 * so this menu, tall enough to extend past the row's own box, got clipped
 * exactly at the row's bottom edge instead of overlaying the rest of the
 * page. Same "portal past a clipping/filter ancestor" fix Dialog
 * (ui/dialog.tsx) already uses for the same class of problem.
 */
export function AddBlockMenu({ role, label, fullWidth, onAddBlock }: AddBlockMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Measured fresh every time the menu opens (not just once) — the
  // trigger's position can differ between opens as the day column above
  // it grows/shrinks (adding exercises, expanding cards, etc).
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 6, left: rect.left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    // No repositioning-on-scroll here — this is a short-lived menu, not a
    // persistent popover, so closing on scroll (rather than tracking the
    // trigger's rect on every scroll tick) is the simpler, still-correct
    // fix. `capture: true` is required to see scroll at all: the scroll
    // event doesn't bubble, and the day-columns row's own horizontal
    // scroll (the thing that caused this bug in the first place) is a
    // descendant element's scroll, which only a capturing listener on a
    // shared ancestor (here, window) ever observes. That same capture-all
    // reach is why this needs its own exclusion: the menu's own option
    // list scrolls internally (max-h-[70vh] + overflow-y-auto, for a
    // viewport too short to fit all 16 options) and that scroll fires
    // through here too — closing the menu the instant someone scrolled
    // *inside* it to reach an option further down. Only scroll happening
    // outside the menu itself (the page, or the day-columns row behind it)
    // should dismiss it.
    function handleScroll(e: Event) {
      // A real page/window scroll targets document (or window itself), not
      // a Node the menu could ever contain — guard with instanceof first
      // since Node.contains() throws on a non-Node argument.
      if (e.target instanceof Node && menuRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, { capture: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, { capture: true });
      window.removeEventListener("resize", handleScroll);
    };
  }, [open]);

  function choose(blockType: BlockType) {
    setOpen(false);
    onAddBlock(role, blockType);
  }

  return (
    <div className={cn("relative", fullWidth && "flex-1")}>
      <button
        ref={triggerRef}
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

      {open &&
        mounted &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Choose block type"
            style={{ position: "fixed", top: position.top, left: position.left }}
            className="z-50 max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-lg"
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
          </div>,
          document.body
        )}
    </div>
  );
}
