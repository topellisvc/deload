import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Programs",
  robots: { index: false, follow: false },
};

export default async function ProgramsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?redirect_to=/programs");
  }

  // Placeholder landing spot — the actual program builder (weeks, days,
  // exercises) lands next. This page exists now to prove the auth-gating
  // pattern end to end before building on top of it.
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Programs</h1>
        <p className="text-muted-foreground">
          Build multi-week training programs — weeks, days, and exercises,
          all on one screen.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <ClipboardList className="size-8 text-muted-foreground" />
          <p className="text-foreground">You don&apos;t have any programs yet.</p>
          <p className="text-sm text-muted-foreground">
            The program builder is coming soon — you&apos;re signed in and
            ready for it.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
