"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface ScrollFadeXProps {
  /** Applied to the actual scrollable element — pass the same
   * overflow-x-auto classes the row already used. */
  className?: string;
  children: ReactNode;
}

/**
 * Wraps a horizontally-scrolling row with a fade gradient on whichever
 * edge still has more content to scroll to. Without this, the week-tabs
 * row and the day-columns row (ProgramViewer, ProgramBuilder) gave no
 * hint that there was anything to scroll to beyond a sliver of the next
 * card peeking in at the edge — easy to miss, especially on a program
 * with more days than fit on screen at once.
 *
 * Reads real scroll position (not just "is this row wider than its
 * container") so the fade disappears once you've actually scrolled all
 * the way to that edge, rather than sitting there as a permanent (and
 * eventually ignored) decoration.
 */
export function ScrollFadeX({ className, children }: ScrollFadeXProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function update() {
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }

    update();
    el.addEventListener("scroll", update, { passive: true });
    // Catches both a window resize (mobile stacks days vertically, so
    // there's nothing to fade there at all) and content changes like
    // adding a week or a day's exercises changing its card height.
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", update);
      resizeObserver.disconnect();
    };
    // Intentionally run once (the ref itself never changes) — the scroll
    // listener and ResizeObserver are what keep canScrollLeft/Right correct
    // as content or viewport size changes afterward.
  }, []);

  return (
    <div className="relative">
      <div ref={ref} className={className}>
        {children}
      </div>
      {canScrollLeft && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-background to-transparent"
        />
      )}
      {canScrollRight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent"
        />
      )}
    </div>
  );
}
