import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProgramTree } from "@/lib/programs/queries";
import { ProgramBuilder } from "@/components/programs/program-builder";

export const metadata: Metadata = {
  title: "Edit program",
  robots: { index: false, follow: false },
};

interface EditProgramPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProgramPage({ params }: EditProgramPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?redirect_to=/programs/${id}/edit`);
  }

  // RLS means a program another user owns simply won't come back here —
  // there's no separate "forbidden" case to handle, just "not found".
  const program = await getProgramTree(supabase, id);
  if (!program) notFound();

  // Structural editing is owner-only, no exceptions — an athlete on a
  // coach-assigned program (even if they're also a coach elsewhere) is
  // bounced back to the read-only view.
  if (program.owner_id !== user.id) {
    redirect(`/programs/${id}`);
  }

  return <ProgramBuilder initialProgram={program} />;
}
