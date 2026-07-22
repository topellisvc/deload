"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, CheckCircle2, AlertTriangle, KeyRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "verifying" | "error";

interface SignInFormProps {
  /** Where to send the user after they sign in. */
  redirectTo?: string;
}

/**
 * Email-only, passwordless sign-in. Sends both a clickable link and a
 * 6-digit code in the same email.
 *
 * The code matters for a real case the link alone doesn't cover: someone
 * requests sign-in on their laptop, but checks email on their phone.
 * Clicking the link there signs in the phone's browser, not the laptop.
 * Typing the code from the phone back into the laptop's form signs in the
 * laptop directly, no matter which device opened the email.
 */
export function SignInForm({ redirectTo = "/" }: SignInFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSendCode(e: React.FormEvent) {
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

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus("verifying");
    setError(null);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (verifyError) {
      setStatus("sent");
      setError(verifyError.message);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  if (status === "sent" || status === "verifying") {
    return (
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="size-8 text-success" />
            <p className="text-foreground">Check your email</p>
            <p className="text-sm text-muted-foreground">
              We sent a link and a 6-digit code to {email}. Click the link on
              this device, or — if you&apos;re reading the email somewhere
              else — enter the code below instead.
            </p>
          </div>

          <form onSubmit={handleVerifyCode} className="flex flex-col gap-3 border-t border-border pt-5">
            <Label htmlFor="code">6-digit code</Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="pl-11 tracking-widest"
              />
            </div>

            {error && (
              <div className="flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
                <p className="text-sm text-foreground">{error}</p>
              </div>
            )}

            <Button type="submit" size="lg" disabled={status === "verifying" || code.length === 0}>
              {status === "verifying" ? "Verifying…" : "Verify code"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSendCode} className="flex flex-col gap-4">
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
              No password — we&apos;ll email you a link and a code.
            </p>
          </div>

          {status === "error" && (
            <div className="flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
              <p className="text-sm text-foreground">{error}</p>
            </div>
          )}

          <Button type="submit" size="lg" disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : "Continue with email"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
