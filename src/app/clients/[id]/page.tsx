import { redirect } from "next/navigation";

interface ClientRedirectPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Per-client detail moved to /coaching/athletes/[id] as part of the
 * Coaching hub — same athlete user id, just a new home, so old
 * links/bookmarks still resolve.
 */
export default async function ClientRedirectPage({ params }: ClientRedirectPageProps) {
  const { id } = await params;
  redirect(`/coaching/athletes/${id}`);
}
