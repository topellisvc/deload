"use client";

import { useState } from "react";
import { AlertTriangle, Mail, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { inviteClient } from "@/lib/coaching/mutations";
import type { CoachClient } from "@/lib/supabase/types";

interface InviteClientFormProps {
  coachId: string;
  coachEmail: string | null;
  existingEmails: string[];
  onInvited: (invite: CoachClient) => void;
}

/**
 * Moved here from ClientsManager, plus the new optional invite message —
 * reuses inviteClient exactly as before (now just passing `message`
 * through to it, see mutations.ts).
 */
export function InviteClientForm({ coachId, coachEmail, existingEmails, onInvited }: InviteClientFormProps) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Enter an email address.");
      return;
    }
    if (coachEmail && trimmed === coachEmail.toLowerCase()) {
      setError("That's your own email — invite an athlete's address instead.");
      return;
    }
    if (existingEmails.includes(trimmed)) {
      setError("You've already invited this email.");
      return;
    }
    if (!coachEmail) {
      setError("Couldn't determine your own email — try signing in again.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: inviteError } = await inviteClient(supabase, { coachId, coachEmail, email: trimmed, message });
    setSubmitting(false);

    if (inviteError) {
      setError(inviteError);
      return;
    }

    onInvited({
      id: crypto.randomUUID(),
      coach_id: coachId,
      client_id: null,
      client_email: trimmed,
      coach_email: coachEmail,
      status: "pending",
      invite_message: message.trim() || null,
      accepted_at: null,
      created_at: new Date().toISOString(),
    });
    setEmail("");
    setMessage("");
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="client-email">Athlete&apos;s email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="client-email"
                type="email"
                placeholder="athlete@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-11"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-message">Message (optional)</Label>
            <Textarea
              id="invite-message"
              placeholder="A short note to include with your invite…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
            />
          </div>

          <Button type="submit" disabled={submitting} className="self-start">
            <UserPlus className="size-4" />
            {submitting ? "Inviting…" : "Invite athlete"}
          </Button>
        </form>

        {error && (
          <div className="mt-3 flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
            <p className="text-sm text-foreground">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
