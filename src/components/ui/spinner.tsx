interface SpinnerProps {
  className?: string;
}

/**
 * A minimal centered spinner, used by each route's loading.tsx to give
 * instant feedback during the server round-trip a navigation triggers —
 * without one, the browser just sits on the old page with no indication
 * anything is happening until the new page's data resolves.
 */
export function Spinner({ className = "" }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`size-6 animate-spin rounded-full border-2 border-border border-t-primary ${className}`}
    />
  );
}
