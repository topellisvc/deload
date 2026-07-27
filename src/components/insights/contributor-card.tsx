import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ContributorAvatar } from "@/components/insights/contributor-avatar";
import type { InsightsContributor } from "@/lib/insights/types";

/** Homepage's "Featured Contributors" and the /insights/contributors
 * index — every contributor is a verified professional (spec: "showcase
 * verified professionals"), so title + organisation + qualifications sit
 * right under the name rather than being buried lower, the way an
 * anonymous blog author byline usually is. */
export function ContributorCard({ contributor, articleCount }: { contributor: InsightsContributor; articleCount?: number }) {
  return (
    <Link href={`/insights/contributors/${contributor.id}`} className="group block h-full focus-visible:outline-none">
      <Card className="h-full transition-colors group-hover:border-border-strong group-focus-visible:ring-2 group-focus-visible:ring-primary">
        <CardContent className="flex h-full flex-col gap-3 pt-6 text-center">
          <div className="mx-auto">
            <ContributorAvatar name={contributor.name} photoUrl={contributor.photoUrl} size="lg" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h3 className="font-semibold text-foreground">{contributor.name}</h3>
            <p className="text-sm text-muted-foreground">{contributor.title}</p>
            {contributor.organisation && <p className="text-xs text-muted-foreground">{contributor.organisation}</p>}
          </div>
          {articleCount !== undefined && (
            <span className="mx-auto text-xs font-medium text-primary">
              {articleCount} article{articleCount === 1 ? "" : "s"}
            </span>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
