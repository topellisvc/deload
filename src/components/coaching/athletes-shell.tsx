"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ClientListSection } from "@/components/coaching/client-list-section";
import { PendingSentInvites } from "@/components/coaching/pending-sent-invites";
import { InviteClientForm } from "@/components/coaching/invite-client-form";
import { cn } from "@/lib/utils";
import type { CoachingDashboardData } from "@/lib/coaching/types";
import type { CoachClient } from "@/lib/supabase/types";

type AthletesTab = "clients" | "requests" | "groups" | "analytics";

const TABS: { value: AthletesTab; label: string }[] = [
  { value: "clients", label: "Clients" },
  { value: "requests", label: "Requests" },
  { value: "groups", label: "Groups" },
  { value: "analytics", label: "Analytics" },
];

const PAGE_SIZE = 8;

interface AthletesShellProps {
  coachId: string;
  coachEmail: string | null;
  dashboard: CoachingDashboardData;
  sentPendingInvites: CoachClient[];
  knownEmails: string[];
  children: ReactNode;
}

/**
 * The master-detail shell behind the mockup's 4-tab "Coach" page: a
 * persistent roster panel (real search + client-side pagination over
 * getCoachingDashboard's already-fetched clients — no separate paginated
 * query exists yet, and a coach's roster is small at this app's current
 * scale) beside `{children}` (athletes/page.tsx or athletes/[id]/page.tsx,
 * rendered by the layout). Selecting a row is a plain navigation
 * (ClientListSection's Links), so `{children}` stays a real server-rendered
 * route rather than client-fetched state — only the panel chrome around it
 * (which tab, search text, page, invite form) is local UI state here.
 *
 * Mobile: only one column shows at a time, picked from the URL itself
 * (usePathname) rather than a separate "selected" state — so the browser's
 * own back button naturally returns from a detail view to the roster.
 */
export function AthletesShell({ coachId, coachEmail, dashboard, sentPendingInvites: initialSent, knownEmails: initialKnownEmails, children }: AthletesShellProps) {
  const pathname = usePathname();
  const selectedId = pathname.match(/^\/coaching\/athletes\/([^/]+)/)?.[1] ?? null;
  const hasSelection = selectedId != null;

  const [tab, setTab] = useState<AthletesTab>("clients");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [sentInvites, setSentInvites] = useState(initialSent);
  const [knownEmails, setKnownEmails] = useState(initialKnownEmails);

  useEffect(() => {
    setPage(0);
  }, [query, tab]);

  function handleInvited(invite: CoachClient) {
    setSentInvites((prev) => [invite, ...prev]);
    setKnownEmails((prev) => [...prev, invite.client_email]);
    setInviteOpen(false);
    setTab("requests");
  }

  function handleCancelled(id: string) {
    setSentInvites((prev) => prev.filter((i) => i.id !== id));
  }

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dashboard.clients;
    return dashboard.clients.filter((c) => c.email.toLowerCase().includes(q));
  }, [query, dashboard.clients]);

  const pageCount = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE));
  const pagedClients = filteredClients.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-6 lg:flex-row lg:items-start lg:py-6">
      <div
        className={cn(
          "flex w-full flex-col gap-4 lg:sticky lg:top-6 lg:w-[380px] lg:max-h-[calc(100vh-3rem)] lg:shrink-0 lg:overflow-y-auto",
          hasSelection && "hidden lg:flex"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Coach</h1>
          <Button size="sm" onClick={() => setInviteOpen((v) => !v)} aria-expanded={inviteOpen}>
            {inviteOpen ? <X className="size-4" /> : <Plus className="size-4" />}
            Invite
          </Button>
        </div>

        {inviteOpen && (
          <InviteClientForm coachId={coachId} coachEmail={coachEmail} existingEmails={knownEmails} onInvited={handleInvited} />
        )}

        <SegmentedControl
          aria-label="Coaching sections"
          options={TABS}
          value={tab}
          onChange={setTab}
          className="w-full justify-between"
        />

        <div className="rounded-2xl border border-border bg-surface p-4">
          {tab === "clients" && (
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search athletes…"
                  aria-label="Search your athletes"
                  className="h-10 pl-10 text-sm"
                />
              </div>

              <ClientListSection clients={pagedClients} selectedId={selectedId} />

              {pageCount > 1 && (
                <div className="flex items-center justify-between pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-8 px-0"
                    disabled={page === 0}
                    aria-label="Previous page"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {page + 1} of {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-8 px-0"
                    disabled={page >= pageCount - 1}
                    aria-label="Next page"
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {tab === "requests" &&
            (sentInvites.length > 0 ? (
              <PendingSentInvites invites={sentInvites} onCancelled={handleCancelled} />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">No invites awaiting a response.</p>
            ))}

          {tab === "groups" && <ComingSoon label="Groups" description="Organize athletes into training groups — coming soon." />}

          {tab === "analytics" && (
            <ComingSoon label="Analytics" description="Roster-wide training trends and reporting — coming soon." />
          )}
        </div>
      </div>

      <div className={cn("min-w-0 flex-1", !hasSelection && "hidden lg:block")}>{children}</div>
    </div>
  );
}

function ComingSoon({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-8 text-center">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="max-w-[22rem] text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
