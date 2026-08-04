import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientOverviewSection } from "@/components/coaching/client-overview-section";
import type { CoachingDashboardData } from "@/lib/coaching/types";

interface CoachingCoachViewProps {
  dashboard: CoachingDashboardData;
}

/**
 * Compact summary + link into the full two-panel athlete-management hub at
 * /coaching/athletes (the redesigned "Coach" page — roster search/filter,
 * per-athlete detail with real stats, messaging). Only rendered here for a
 * coach who's ALSO being coached by someone else, or has a pending invite
 * of their own — see /coaching/page.tsx: a coach with neither is redirected
 * straight into /coaching/athletes instead of landing on this summary
 * first, since there'd be nothing else on this page for them to see.
 */
export function CoachingCoachView({ dashboard }: CoachingCoachViewProps) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Coaching athletes</h2>
      <ClientOverviewSection data={dashboard} />
      <Link href="/coaching/athletes" className="self-start">
        <Button variant="outline">
          Manage your athletes
          <ArrowRight className="size-4" />
        </Button>
      </Link>
    </div>
  );
}
