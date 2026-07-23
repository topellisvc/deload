"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Mail, Trash2, UserPlus, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { inviteClient, removeClient } from "@/lib/coaching/mutations";
import type { CoachClient } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface ClientsManagerProps {
  clients: CoachClient[];
  coachId: string;
  coachEmail: string | null;
}

export function ClientsManager({ clients, coachId, coachEmail }: ClientsManagerProps) {
  const [list, setList] = useState(clients);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Enter an email address.");
      return;
    }
    if (coachEmail && trimmed === coachEmail.toLowerCase()) {
      setError("That's your own email — invite a client's address instead.");
      return;
    }
    if (list.some((c) => c.client_email === trimmed)) {
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
    const { error: inviteError } = await inviteClient(supabase, { coachId, coachEmail, email: trimmed });
    setSubmitting(false);

    if (inviteError) {
      setError(inviteError);
      return;
    }

    setList((prev) => [
      {
        id: crypto.randomUUID(),
        coach_id: coachId,
        client_id: null,
        client_email: trimmed,
        coach_email: coachEmail,
        status: "pending",
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    setEmail("");
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    const supabase = createClient();
    const { error: removeError } = await removeClient(supabase, id);
    setRemovingId(null);

    if (removeError) {
      setError(removeError);
      return;
    }
    setList((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Clients</h1>
        <p className="text-muted-foreground">
          Invite someone by email to build and assign programs for them. They&apos;ll get a
          normal sign-in email — no separate account setup needed.
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="client-email">Client&apos;s email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="client-email"
                  type="email"
                  placeholder="client@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11"
                />
              </div>
            </div>
            <Button type="submit" disabled={submitting} className="shrink-0">
              <UserPlus className="size-4" />
              {submitting ? "Inviting…" : "Invite client"}
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

      {list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Users className="size-8 text-muted-foreground" />
            <p className="text-foreground">No clients yet.</p>
            <p className="text-sm text-muted-foreground">
              Invite someone above to start building programs for them.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((client) => (
            <li key={client.id}>
              <Card>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-foreground">{client.client_email}</span>
                    <span
                      className={cn(
                        "flex items-center gap-1 text-xs",
                        client.status === "active" ? "text-success" : "text-muted-foreground"
                      )}
                    >
                      {client.status === "active" ? (
                        <CheckCircle2 className="size-3.5" />
                      ) : (
                        <Clock className="size-3.5" />
                      )}
                      {client.status === "active" ? "Active" : "Invited — waiting for them to sign in"}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemove(client.id)}
                    disabled={removingId === client.id}
                    aria-label={`Remove ${client.client_email}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
