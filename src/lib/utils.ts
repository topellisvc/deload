import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes, resolving conflicts (last one wins). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Two-letter (or one, for a single/missing name) initials for an avatar
 * fallback — no photo upload anywhere in the app yet, so this is the only
 * avatar there is. Lifted out of ProfileHeader since the Coaching page
 * needs the same thing for coach/client cards. */
export function getInitials(displayName: string | null | undefined, email: string): string {
  if (displayName?.trim()) {
    const words = displayName.trim().split(/\s+/);
    const first = words[0]?.[0] ?? "";
    const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
    const initials = `${first}${last}`.toUpperCase();
    if (initials) return initials;
  }
  return email[0]?.toUpperCase() ?? "?";
}
