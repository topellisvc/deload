import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAllTopics } from "@/lib/insights/queries";
import { TopicCard } from "@/components/insights/topic-card";

const DESCRIPTION = "Every topic covered on Insights — strength, hypertrophy, running, nutrition, recovery, and more.";

export const metadata: Metadata = {
  title: "Topics",
  description: DESCRIPTION,
  alternates: { canonical: "/insights/topics" },
  openGraph: { title: "Insights Topics | Deload", description: DESCRIPTION, url: "/insights/topics" },
};

export default async function InsightsTopicsPage() {
  const supabase = await createClient();
  const topics = await getAllTopics(supabase);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-10 flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Topics</h1>
        <p className="text-muted-foreground">{DESCRIPTION}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map((topic) => (
          <TopicCard key={topic.id} topic={topic} />
        ))}
      </div>
    </div>
  );
}
