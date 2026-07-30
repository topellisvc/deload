/**
 * Fire-to-completion request to /api/admin/delete-user, the one server-side
 * piece of this feature — deleting an auth.users row needs the service-role
 * key (lib/supabase/admin.ts), which can never live in this browser-side
 * module the same way every other lib/*\/mutations.ts talks straight to
 * Supabase. Unlike lib/notifications/email.ts's sendNotificationEmail this
 * one is awaited by its caller (DeleteAccountButton needs to know whether it
 * actually worked before closing the confirm dialog), so it resolves with a
 * result rather than being fire-and-forget.
 */
export async function deleteUserAccount(userId: string): Promise<{ error: string | null }> {
  try {
    const res = await fetch("/api/admin/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) return { error: null };
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return { error: data?.error ?? "Couldn't delete that account." };
  } catch {
    return { error: "Couldn't delete that account." };
  }
}
