"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { setBetaAccess } from "@/lib/admin/mutations";
import { useToast } from "@/components/ui/toast";

/**
 * Per-account on/off switch for profiles.beta_build_for_me (migration
 * 0053) — "Build my program" is greyed out for everyone until an admin
 * flips this here. No Switch/Toggle primitive exists in this codebase yet
 * (checked src/components/ui), so this is a plain pill button that
 * restyles itself for on/off, matching DeleteAccountButton's general shape
 * (optimistic-ish local state, toast on failure, router.refresh from the
 * parent isn't needed here since the label itself is the only thing that
 * changes and this component already reflects it locally).
 *
 * No confirm dialog, unlike DeleteAccountButton — this is reversible with
 * one more click, not a permanent action, so a confirm step would just be
 * friction for something an admin may want to flip on and off freely while
 * onboarding beta testers.
 */
export function BetaAccessToggle({ userId, initialEnabled }: { userId: string; initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);
  const { showToast } = useToast();

  async function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    setPending(true);
    const { error } = await setBetaAccess(userId, next);
    setPending(false);
    if (error) {
      setEnabled(!next);
      showToast(error, "error");
      return;
    }
    showToast(next ? "Beta access granted." : "Beta access revoked.");
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={pending}
      aria-pressed={enabled}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-60",
        enabled ? "bg-success/15 text-success hover:bg-success/25" : "bg-muted text-muted-foreground hover:bg-surface-hover"
      )}
    >
      {enabled && <Check className="size-3" />}
      {enabled ? "Beta on" : "Beta off"}
    </button>
  );
}
