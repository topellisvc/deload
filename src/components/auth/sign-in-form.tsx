"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, CheckCircle2, AlertTriangle, KeyRound, Dumbbell, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type Status = "idle" | "sending" | "sent" | "verifying" | "error";

interface SignInFormProps {
  /** Where to send the user after they sign in. */
  redirectTo?: string;
}

// Remembered on this browser only (never sent anywhere but this form's own
// next autofill) so a returning user isn't forced to retype their name and
// re-pick a role on every single sign-in — only a brand-new account
// actually needs them, but this form can't tell new from returning before
// an email is even entered (Supabase deliberately doesn't expose that; see
// signInWithOtp's docs on account-enumeration). Required either way, so a
// first-timer on a fresh browser always fills them in once.
const NAME_STORAGE_KEY = "deload:signin_name";
const ROLE_STORAGE_KEY = "deload:signin_role";

const ROLE_OPTIONS: { value: UserRole; label: string; description: string; icon: typeof Dumbbell }[] = [
  { value: "athlete", label: "Training myself", description: "Build my own programs, or follow one from a coach", icon: Dumbbell },
  { value: "coach", label: "Training others", description: "Invite clients and build programs for them", icon: Sparkles },
];

/**
 * Email-only, passwordless sign-in. Sends both a clickable link and an
 * 8-digit code in the same email.
 *
 * The code matters for a real case the link alone doesn't cover: someone
 * requests sign-in on their laptop, but checks email on their phone.
 * Clicking the link there signs in the phone's browser, not the laptop.
 * Typing the code from the phone back into the laptop's form signs in the
 * laptop directly, no matter which device opened the email.
 *
 * Name + role are collected here now too (rather than only via the
 * post-login RoleOnboarding prompt) so a brand-new account already has
 * both by the time it's created — handle_new_user (migration 0039) reads
 * them straight off the signup email's user_metadata. RoleOnboarding still
 * exists as a fallback for anyone who reaches an account without them (an
 * invited client, or anyone who signed up before this existed).
 */
export function SignInForm({ redirectTo = "/" }: SignInFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // Prefill from a previous visit rather than in useState's initializer —
  // this is SSR'd, and localStorage doesn't exist on the server, so reading
  // it any earlier than an effect would mismatch the server-rendered HTML.
  useEffect(() => {
    const savedName = window.localStorage.getItem(NAME_STORAGE_KEY);
    const savedRole = window.localStorage.getItem(ROLE_STORAGE_KEY);
    if (savedName) setName(savedName);
    if (savedRole === "athlete" || savedRole === "coach") setRole(savedRole);
  }, []);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return;
    setStatus("sending");
    setError(null);

    window.localStorage.setItem(NAME_STORAGE_KEY, name.trim());
    window.localStorage.setItem(ROLE_STORAGE_KEY, role);

    const supabase = createClient();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("redirect_to", redirectTo);

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl.toString(),
        // Only ever consumed by handle_new_user's AFTER INSERT trigger on
        // auth.users — a no-op for a returning user, since that trigger
        // can't fire a second time for an account that already exists.
        data: { display_name: name.trim(), role },
      },
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
              We sent a link and an 8-digit code to {email}. Click the link on
              this device, or — if you&apos;re reading the email somewhere
              else — enter the code below instead.
            </p>
          </div>

          <form onSubmit={handleVerifyCode} className="flex flex-col gap-3 border-t border-border pt-5">
            <Label htmlFor="code">8-digit code</Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="12345678"
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
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              required
              autoComplete="name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>How will you use Deload?</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ROLE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = role === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRole(option.value)}
                    aria-pressed={selected}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      selected ? "border-primary bg-primary/5" : "border-border hover:border-border-strong"
                    )}
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

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

          <Button type="submit" size="lg" disabled={status === "sending" || name.trim().length === 0 || !role}>
            {status === "sending" ? "Sending…" : "Continue with email"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            By continuing, you agree to Deload&apos;s{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
