export function SiteFooter() {
  return (
    <footer className="border-t border-border">
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
