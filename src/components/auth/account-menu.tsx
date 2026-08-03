"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, MessageSquarePlus, Moon, Sun, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { SendFeedbackDialog } from "@/components/feedback/send-feedback-dialog";

/**
 * Consolidates what used to be three separate desktop header items — the
 * user's email, a "Profile" nav link, and a standalone "Sign out" button —
 * plus the theme toggle, into one dropdown. Mobile keeps its own
 * hamburger-panel AuthStatus/ThemeToggle — that's a vertical list already,
 * not a crowded single row, so it didn't need this.
 *
 * Lives at the bottom of AppSidebar (app-shell.tsx) — it used to be a
 * compact circular trigger in SiteHeader's desktop nav row, but that row no
 * longer renders at lg+ (the sidebar replaced it), so this is now styled as
 * a wider list-item-style row (avatar + email) matching the sidebar's own
 * nav links, and the dropdown opens upward (`bottom-full`) since the
 * trigger sits at the very bottom of the viewport rather than the top.
 *
 * Follows the same click-outside/Escape/relative-container pattern as
 * NotificationBell.
 */
export function AccountMenu() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("theme", next ? "dark" : "light");
  }

  async function handleSignOut() {
    setOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
  }

  if (loading || !mounted) {
    return <div className="size-9" aria-hidden="true" />;
  }

  if (!user) {
    return (
      <Link
        href="/sign-in"
        className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        Sign in
      </Link>
    );
  }

  const initial = (user.email?.[0] ?? "?").toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">
          {initial}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{user.email}</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-xl border border-border bg-surface shadow-lg">
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-medium text-foreground">{user.email}</p>
          </div>

          <div className="py-1">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-surface-hover"
            >
              <User className="size-4 text-muted-foreground" />
              Profile
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-surface-hover"
            >
              {isDark ? <Sun className="size-4 text-muted-foreground" /> : <Moon className="size-4 text-muted-foreground" />}
              {isDark ? "Switch to light mode" : "Switch to dark mode"}
            </button>
          </div>

          <div className="border-t border-border py-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setFeedbackOpen(true);
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-surface-hover"
            >
              <MessageSquarePlus className="size-4 text-muted-foreground" />
              Send feedback
            </button>
          </div>

          <div className="border-t border-border py-1">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-surface-hover"
            >
              <LogOut className="size-4 text-muted-foreground" />
              Sign out
            </button>
          </div>
        </div>
      )}

      {feedbackOpen && <SendFeedbackDialog userId={user.id} onClose={() => setFeedbackOpen(false)} />}
    </div>
  );
}
