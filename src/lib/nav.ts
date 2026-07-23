/**
 * Whether a nav item's href should be shown as the current page — an exact
 * match, or a prefix match for section routes (e.g. "/programs" should
 * stay highlighted while looking at "/programs/abc123" or
 * "/programs/abc123/edit"). None of the app's top-level nav destinations
 * nest inside one another, so this single rule works for all of them
 * without per-route special-casing.
 */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const navLinkClassName =
  "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

/** Layered on top of navLinkClassName (via cn) when isActivePath is true. */
export const navLinkActiveClassName = "bg-muted text-foreground";
