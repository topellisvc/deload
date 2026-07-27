import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAllContributors } from "@/lib/insights/queries";
import { ContributorCard } from "@/components/insights/contributor-card";

const DESCRIPTION = "Verified strength coaches, sports scientists, physiotherapists, dietitians, and exercise physiologists writing for Insights.";

export const metadata: Metadata = {
  title: "Contributors",
  description: DESCRIPTION,
  alternates: { canonical: "/insights/contributors" },
  openGraph: { title: "Insights Contributors | Deload", description: DESCRIPTION, url: "/insights/contributors" },
};

export default async function InsightsContributorsPage() {
  const supabase = await createClient();
  const contributors = await getAllContributors(supabase);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-10 flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Contributors</h1>
        <p className="text-muted-foreground">{DESCRIPTION}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {contributors.map((contributor) => (
          <ContributorCard key={contributor.id} contributor={contributor} />
        ))}
      </div>
    </div>
  );
}
