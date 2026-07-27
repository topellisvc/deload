import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContributorProfile } from "@/lib/insights/queries";
import { ContributorAvatar } from "@/components/insights/contributor-avatar";
import { ArticleCard } from "@/components/insights/article-card";

interface ContributorPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ContributorPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const contributor = await getContributorProfile(supabase, id);
  if (!contributor) return { title: "Contributor not found" };

  const description = `${contributor.title}${contributor.organisation ? ` at ${contributor.organisation}` : ""}. ${contributor.bio}`.slice(0, 200);
  return {
    title: contributor.name,
    description,
    alternates: { canonical: `/insights/contributors/${contributor.id}` },
    openGraph: { title: `${contributor.name} | Insights | Deload`, description, url: `/insights/contributors/${contributor.id}` },
  };
}

/**
 * A contributor's public profile — photo, credentials, bio, and every
 * published article of theirs, per the spec's "showcase verified
 * professionals" goal. Doesn't require any articles to exist (a
 * contributor added ahead of their first publish still gets a real page,
 * just with an empty article list) — it's linked from
 * /insights/contributors regardless.
 */
export default async function ContributorPage({ params }: ContributorPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const contributor = await getContributorProfile(supabase, id);
  if (!contributor) notFound();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-16">
      <div className="flex flex-col items-center gap-4 text-center">
        <ContributorAvatar name={contributor.name} photoUrl={contributor.photoUrl} size="lg" />
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{contributor.name}</h1>
          <p className="text-muted-foreground">
            {contributor.title}
            {contributor.organisation && ` · ${contributor.organisation}`}
          </p>
          {contributor.qualifications && <p className="text-sm text-muted-foreground">{contributor.qualifications}</p>}
        </div>
        {contributor.expertise.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {contributor.expertise.map((area) => (
              <span key={area} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                {area}
              </span>
            ))}
          </div>
        )}
        <p className="max-w-xl text-sm text-muted-foreground">{contributor.bio}</p>
      </div>

      {contributor.articles.length > 0 && (
        <div>
          <h2 className="mb-5 text-lg font-semibold tracking-tight text-foreground">Articles by {contributor.name}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {contributor.articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
