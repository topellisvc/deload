"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { reviewContributorApplication } from "@/lib/insights/mutations";
import type { InsightsContributorApplication } from "@/lib/insights/types";

/**
 * Admin's Insights contributor-application review queue — Approve
 * removes the application from this list immediately (it's now visible
 * on the public Contributors page instead); Reject opens a small dialog
 * for an optional note back to the applicant, then does the same. Only
 * ever renders anything for an actual admin — getPendingContributorApplications
 * (RLS-scoped, migration 0025) is what the /admin page uses to fetch this
 * list in the first place.
 */
export function ContributorApplicationQueue({ initial }: { initial: InsightsContributorApplication[] }) {
  const { showToast } = useToast();
  const [applications, setApplications] = useState(initial);
  const [rejecting, setRejecting] = useState<InsightsContributorApplication | null>(null);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleApprove(application: InsightsContributorApplication) {
    setBusyId(application.id);
    const supabase = createClient();
    const { error } = await reviewContributorApplication(supabase, application.id, "approved");
    setBusyId(null);
    if (error) {
      showToast(error, "error");
      return;
    }
    setApplications((prev) => prev.filter((a) => a.id !== application.id));
    showToast(`Approved ${application.name}`);
  }

  async function handleReject() {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    const supabase = createClient();
    const { error } = await reviewContributorApplication(supabase, rejecting.id, "rejected", note);
    setBusyId(null);
    if (error) {
      showToast(error, "error");
      return;
    }
    setApplications((prev) => prev.filter((a) => a.id !== rejecting.id));
    showToast(`Rejected ${rejecting.name}`);
    setRejecting(null);
    setNote("");
  }

  if (applications.length === 0) {
    return <p className="text-sm text-muted-foreground">No pending applications.</p>;
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {applications.map((application) => (
          <li
            key={application.id}
            className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">
                {application.name} — {application.title}
              </span>
              {application.organisation && <span className="text-xs text-muted-foreground">{application.organisation}</span>}
              {application.qualifications && <span className="text-xs text-muted-foreground">{application.qualifications}</span>}
              <p className="mt-1 text-sm text-muted-foreground">{application.bio}</p>
              {application.expertise.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {application.expertise.map((area) => (
                    <span key={area} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      {area}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" onClick={() => handleApprove(application)} disabled={busyId === application.id}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-danger/30 text-danger hover:border-danger hover:bg-danger/10"
                onClick={() => setRejecting(application)}
                disabled={busyId === application.id}
              >
                Reject
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title="Reject application"
        description={rejecting ? `Optionally leave a note for ${rejecting.name} explaining why.` : undefined}
      >
        <div className="flex flex-col gap-4">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note…" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              className="border-danger/30 text-danger hover:border-danger hover:bg-danger/10"
              onClick={handleReject}
              disabled={busyId === rejecting?.id}
            >
              Reject
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
