export function SiteFooter() {
  return (
    // Same bottom clearance as <main> in layout.tsx, and for the same
    // reason: BottomNav is `fixed`, so it's the last thing on the page
    // (nothing after the footer to create extra scroll room) — without
    // this, the footer's last ~4rem (the copyright line) permanently sat
    // underneath the nav bar with no way to scroll it into view. lg:pb-
    // drops back to just the safe-area inset once BottomNav hides itself
    // at that breakpoint.
    <footer className="border-t border-border pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-muted-foreground">
        <p>
          Deload tools are educational and provide estimates, not medical
          or professional coaching advice. Consult a qualified coach or
          medical professional for guidance specific to you.
        </p>
        <p>&copy; {new Date().getFullYear()} Deload. All rights reserved.</p>
      </div>
    </footer>
  );
}
