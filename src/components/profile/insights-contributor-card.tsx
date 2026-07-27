import Link from "next/link";
import { Newspaper } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { InsightsContributorApplication } from "@/lib/insights/types";

/** A small, always-present entry point into the Insights contributor
 * workflow from Profile — the one other place (besides Insights' own
 * homepage CTA) someone would think to look for "how do I write for
 * this." Copy/CTA changes based on where their application actually is,
 * rather than always saying "Apply." */
export function InsightsContributorCard({ contributor }: { contributor: InsightsContributorApplication | null }) {
  const { heading, description, href, label } = describe(contributor);

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Newspaper className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{heading}</span>
            <span className="text-sm text-muted-foreground">{description}</span>
          </div>
        </div>
        <Link href={href} className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shrink-0")}>
          {label}
        </Link>
      </CardContent>
    </Card>
  );
}

function describe(contributor: InsightsContributorApplication | null): {
  heading: string;
  description: string;
  href: string;
  label: string;
} {
  if (!contributor) {
    return {
      heading: "Write for Insights",
      description: "Apply to become a verified contributor.",
      href: "/insights/contribute",
      label: "Apply",
    };
  }
  if (contributor.status === "pending") {
    return {
      heading: "Insights application: under review",
      description: "We'll let you know once it's been reviewed.",
      href: "/insights/contribute",
      label: "View",
    };
  }
  if (contributor.status === "rejected") {
    return {
      heading: "Insights application: needs updates",
      description: "Update your details and resubmit whenever you're ready.",
      href: "/insights/contribute",
      label: "Update",
    };
  }
  return {
    heading: "Insights contributor",
    description: "Write, edit, and submit articles for review.",
    href: "/insights/write",
    label: "My Articles",
  };
}
