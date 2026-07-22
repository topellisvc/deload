"use client";

import { useState } from "react";
import { Mail, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "error";

interface SignInFormProps {
  /** Where to send the user after they click the emailed link. */
  redirectTo?: string;
}

/**
 * Email-only, passwordless sign-in. No password to set, forget, or leak —
 * just a link sent to an inbox the person already controls.
 */
export function SignInForm({ redirectTo = "/" }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("redirect_to", redirectTo);

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl.toString() },
    });

    if (signInError) {
      setStatus("error");
      setError(signInError.message);
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
          <CheckCircle2 className="size-8 text-success" />
          <p className="text-foreground">Check your email</p>
          <p className="text-sm text-muted-foreground">
            We sent a sign-in link to {email}. Click it to continue — you can
            close this tab.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-11"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              No password — we&apos;ll email you a link to sign in.
            </p>
          </div>

          {status === "error" && (
            <div className="flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
              <p className="text-sm text-foreground">{error}</p>
            </div>
          )}

          <Button type="submit" size="lg" disabled={status === "sending"}>
            {status === "sending" ? "Sending link…" : "Send sign-in link"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
