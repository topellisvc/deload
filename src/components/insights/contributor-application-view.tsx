"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { ContributorApplicationForm } from "@/components/insights/contributor-application-form";
import type { InsightsContributorApplication } from "@/lib/insights/types";

interface ContributorApplicationViewProps {
  profileId: string;
  defaultName: string;
  initial: InsightsContributorApplication | null;
}

/**
 * Owns the "which view am I in" state client-side so saving/resubmitting
 * updates the page in place — a fresh application, an under-review one, a
 * rejected one (with the admin's note, and a form to resubmit), or an
 * approved one (a link into the actual article editor at /insights/write
 * rather than staying on this page). The form itself is always rendered
 * below the status except once approved, since an approved contributor
 * should still be able to edit their own public bio/credentials later.
 */
export function ContributorApplicationView({ profileId, defaultName, initial }: ContributorApplicationViewProps) {
  const [contributor, setContributor] = useState(initial);

  return (
    <div className="flex flex-col gap-6">
      {contributor && <StatusBanner contributor={contributor} />}

      {/* Rendered regardless of status — an approved contributor can still
          edit their own bio/credentials, and a pending/rejected one edits
          the same fields they applied with. */}
      <ContributorApplicationForm profileId={profileId} existing={contributor} defaultName={defaultName} onSaved={setContributor} />
    </div>
  );
}

function StatusBanner({ contributor }: { contributor: InsightsContributorApplication }) {
  if (contributor.status === "pending") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/50 p-4">
        <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium text-foreground">Your application is under review</p>
          <p className="text-sm text-muted-foreground">
            We&rsquo;ll let you know once it&rsquo;s been reviewed. You can keep editing the details below in the meantime.
          </p>
        </div>
      </div>
    );
  }

  if (contributor.status === "rejected") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4">
        <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium text-foreground">Your application wasn&rsquo;t approved</p>
          {contributor.reviewNote && <p className="text-sm text-muted-foreground">&ldquo;{contributor.reviewNote}&rdquo;</p>}
          <p className="text-sm text-muted-foreground">Update the details below and resubmit whenever you&rsquo;re ready.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-4">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-foreground">You&rsquo;re an approved Insights contributor</p>
        <p className="text-sm text-muted-foreground">
          Head to{" "}
          <Link href="/insights/write" className="font-medium text-primary underline underline-offset-2">
            your articles
          </Link>{" "}
          to start writing.
        </p>
      </div>
    </div>
  );
}
