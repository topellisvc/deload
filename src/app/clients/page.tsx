import { redirect } from "next/navigation";

/**
 * Coaching relationship management (invites, roster, upgrade prompt) all
 * moved to /coaching as part of the Coaching hub — this route stays only
 * so old links/bookmarks still land somewhere useful instead of 404ing.
 */
export default function ClientsRedirectPage() {
  redirect("/coaching");
}
