/**
 * Fire-to-completion request to /api/auth/check-email — SignInForm's way
 * of deciding whether to ask for a name + role before sending the sign-in
 * email. Needs the service-role-backed admin client (see that route),
 * which can't live in this browser-side module.
 *
 * Fails open toward `true` (treat as an existing account, skip the extra
 * fields) on any network/parse error — worst case a genuinely new
 * signup slips through without a name/role, which just falls back to the
 * post-login RoleOnboarding/WelcomeTour prompts that already handle that
 * case. Never blocks anyone from signing in over this check failing.
 */
export async function checkEmailHasAccount(email: string): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/check-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return true;
    const data = (await res.json()) as { hasAccount?: boolean };
    return data.hasAccount ?? true;
  } catch {
    return true;
  }
}
