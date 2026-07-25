import { cn } from "@/lib/utils";

interface BarbellLoaderProps {
  className?: string;
}

/**
 * Branded route-loading indicator: a barbell mid-rep, plates lifting and
 * settling on a loop, with a shadow beneath that compresses on the way up
 * to sell the motion. Same job as a generic spinner — "something is
 * loading" — but one that actually looks like it belongs to a training
 * app. Keyframes live in globals.css (--animate-barbell-lift/-shadow)
 * following this project's existing pattern for custom Tailwind v4
 * animations (see --animate-fade-up).
 */
export function BarbellLoader({ className }: BarbellLoaderProps) {
  return (
    <div role="status" aria-label="Loading" className={cn("inline-flex", className)}>
      <svg viewBox="0 0 100 40" className="h-10 w-24" aria-hidden="true">
        <ellipse
          cx="50"
          cy="34"
          rx="30"
          ry="4"
          className="fill-foreground/10 animate-barbell-shadow"
          style={{ transformOrigin: "50px 34px" }}
        />
        <g className="animate-barbell-lift" style={{ transformOrigin: "50px 20px" }}>
          {/* bar */}
          <rect x="18" y="18" width="64" height="4" rx="2" className="fill-muted-foreground" />
          {/* left plate */}
          <circle cx="14" cy="20" r="14" className="fill-primary" />
          <circle cx="14" cy="20" r="5" className="fill-background" />
          {/* right plate */}
          <circle cx="86" cy="20" r="14" className="fill-primary" />
          <circle cx="86" cy="20" r="5" className="fill-background" />
        </g>
      </svg>
    </div>
  );
}
