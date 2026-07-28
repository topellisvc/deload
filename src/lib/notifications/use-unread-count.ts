"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { getUnreadNotificationCount } from "@/lib/notifications/queries";

/**
 * Shared unread-notification-count logic for NotificationBell (the header
 * dropdown) and BottomNav (the mobile tab bar's Home badge) — both need
 * the same number, and having two independent from-scratch
 * fetch-then-subscribe implementations was how NotificationBell's own
 * increment/decrement-in-place logic almost got copy-pasted a second time
 * here.
 *
 * Refetches on every INSERT or UPDATE to this user's notifications rather
 * than trying to increment/decrement in place — at this feature's actual
 * volume (see queries.ts's doc comment: "a lightweight dropdown, not a
 * full notifications page") a refetch is cheap and can't drift out of
 * sync the way optimistic local bookkeeping can when two independent
 * components (bell + bottom nav) are both watching the same count and
 * only one of them is what triggered a given change.
 */
export function useUnreadNotificationCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    const supabase = createClient();
    let cancelled = false;

    function refetch() {
      getUnreadNotificationCount(supabase, user!.id)
        .then((n) => {
          if (!cancelled) setCount(n);
        })
        // A failed fetch (offline, a blocked request) just leaves the
        // count at whatever it last was rather than throwing an unhandled
        // rejection — same "degrade instead of hang/crash" reasoning as
        // the fix in auth-provider.tsx.
        .catch(() => {});
    }

    refetch();

    // Unique topic per mount, same reasoning as NotificationBell's own
    // channel: Supabase's realtime client dedupes by topic name and can
    // hand back a still-tearing-down instance from a previous mount
    // (React Strict Mode's mount->cleanup->mount) otherwise.
    const channel = supabase
      .channel(`unread-count:${user.id}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        refetch
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  return count;
}
