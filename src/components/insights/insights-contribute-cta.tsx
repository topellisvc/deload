import Link from "next/link";
import { PenLine } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { InsightsContributorApplication } from "@/lib/insights/types";

/**
 * The Insights homepage's bottom CTA — a fixed "apply" pitch for a
 * signed-out visitor or anyone who's never applied, but switches to
 * whatever's actually relevant once someone HAS applied: their pending/
 * rejected status, or — once approved — direct buttons into the article
 * editor, rather than still pointing them back at the application form
 * they already got past.
 */
export function InsightsContributeCta({ contributor }: { contributor: InsightsContributorApplication | null }) {
  if (contributor?.status === "approved") {
    return (
      <section className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-primary/30 bg-primary/5 px-6 py-8 text-center">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <PenLine className="size-5" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">You&rsquo;re an approved Insights contributor</p>
          <p className="text-sm text-muted-foreground">Ready to write? Start a new article or check on your existing ones.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/insights/write" className={buttonVariants({ size: "sm" })}>
            Write New Article
          </Link>
          <Link href="/insights/write" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
            My Articles
          </Link>
        </div>
      </section>
    );
  }

  if (contributor?.status === "pending") {
    return (
      <section className="mx-auto w-full max-w-2xl rounded-2xl border border-border bg-muted/30 px-6 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Your contributor application is under review.{" "}
          <Link href="/insights/contribute" className="font-medium text-primary underline underline-offset-2">
            View application
          </Link>
          .
        </p>
      </section>
    );
  }

  if (contributor?.status === "rejected") {
    return (
      <section className="mx-auto w-full max-w-2xl rounded-2xl border border-border bg-muted/30 px-6 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Your contributor application needs some updates.{" "}
          <Link href="/insights/contribute" className="font-medium text-primary underline underline-offset-2">
            Update and resubmit
          </Link>
          .
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-2xl rounded-2xl border border-border bg-muted/30 px-6 py-8 text-center">
      <p className="text-sm text-muted-foreground">
        Are you a coach, sports scientist, or clinician?{" "}
        <Link href="/insights/contribute" className="font-medium text-primary underline underline-offset-2">
          Apply to contribute
        </Link>
        .
      </p>
    </section>
  );
}
