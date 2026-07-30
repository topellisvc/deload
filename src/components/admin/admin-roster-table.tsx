import Link from "next/link";
import { Eye, ShieldCheck } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import type { AdminRosterRow } from "@/lib/admin/queries";
import { Button } from "@/components/ui/button";
import { DeleteAccountButton } from "@/components/admin/delete-account-button";

const ROLE_BADGE_CLASS: Record<AdminRosterRow["role"], string> = {
  athlete: "bg-muted text-muted-foreground",
  coach: "bg-primary/10 text-primary",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Roster of every signed-up account — started view-only (migration 0021's
 * comment: mutation controls deliberately left for later, once there's an
 * actual need). Account deletion is the first one, added once test-account
 * cleanup during development made "there's no way to remove one" a real
 * problem rather than a speculative one. A plain <table> rather than
 * ClientListSection's card grid, matching TrainingTable's convention —
 * this is denser, more columns, and more rows than a coach's few clients,
 * so a scannable table fits better than cards here.
 *
 * currentUserId hides the delete action on the signed-in admin's own row —
 * belt-and-suspenders alongside the API route's own same-user check, so
 * there isn't even a button to misclick.
 */
export function AdminRosterTable({ roster, currentUserId }: { roster: AdminRosterRow[]; currentUserId: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-6 py-3 font-medium">
              User
            </th>
            <th scope="col" className="px-6 py-3 font-medium">
              Role
            </th>
            <th scope="col" className="px-6 py-3 font-medium">
              Signed up
            </th>
            <th scope="col" className="px-6 py-3 font-medium">
              Last active
            </th>
            <th scope="col" className="px-6 py-3 text-right font-medium">
              Programs
            </th>
            <th scope="col" className="px-6 py-3 text-right font-medium">
              Sessions
            </th>
            <th scope="col" className="px-6 py-3" />
          </tr>
        </thead>
        <tbody>
          {roster.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="px-6 py-3">
                <div className="flex items-center gap-3">
                  <div
                    aria-hidden="true"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                  >
                    {getInitials(row.displayName, row.email ?? "")}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{row.email ?? "No email on file"}</p>
                    {row.displayName && <p className="truncate text-xs text-muted-foreground">{row.displayName}</p>}
                  </div>
                  {row.isAdmin && (
                    <span
                      title="Admin"
                      className="flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success"
                    >
                      <ShieldCheck className="size-3" />
                      Admin
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 py-3">
                <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", ROLE_BADGE_CLASS[row.role])}>
                  {row.role === "coach" ? "Coach" : "Athlete"}
                </span>
              </td>
              <td className="px-6 py-3 text-muted-foreground">{formatDate(row.signedUpAt)}</td>
              <td className="px-6 py-3 text-muted-foreground">{row.lastActiveOn ? formatDate(row.lastActiveOn) : "Never"}</td>
              <td className="px-6 py-3 text-right tabular-nums text-foreground">{row.programsCreated}</td>
              <td className="px-6 py-3 text-right tabular-nums text-foreground">{row.sessionCount}</td>
              <td className="px-6 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Link href={`/admin/users/${row.id}`}>
                    <Button variant="outline" size="sm">
                      <Eye className="size-3.5" />
                      View
                    </Button>
                  </Link>
                  {row.id !== currentUserId && <DeleteAccountButton userId={row.id} email={row.email} />}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {roster.length === 0 && <p className="px-6 py-8 text-center text-sm text-muted-foreground">No accounts yet.</p>}
    </div>
  );
}
