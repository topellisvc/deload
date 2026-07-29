"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { submitFeedback } from "@/lib/feedback/mutations";

/**
 * Opened from AccountMenu's "Send feedback" item. Sends the raw message
 * plus the page the person was on (usePathname, not the full URL — no
 * querystrings/hashes worth capturing here) as triage context for the
 * /admin queue. No category picker or rating scale by design (see
 * migration 0037's comment) — just "what could be better," free text.
 */
export function SendFeedbackDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const pathname = usePathname();
  const { showToast } = useToast();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await submitFeedback(supabase, userId, message, pathname);
    setSubmitting(false);
    if (error) {
      showToast(error, "error");
      return;
    }
    showToast("Thanks — your feedback's been sent.");
    onClose();
  }

  return (
    <Dialog open onClose={onClose} title="Send feedback" description="Tell us what could be better. An admin will read this.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Textarea
          rows={5}
          maxLength={4000}
          autoFocus
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What's working, what's not, what you'd like to see…"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !message.trim()}>
            {submitting ? "Sending…" : "Send feedback"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
