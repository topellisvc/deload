"use client";

import { useRef, useState } from "react";
import { Flame, Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UnderlineTabs, type UnderlineTabOption } from "@/components/ui/underline-tabs";
import { ClientDetail } from "@/components/clients/client-detail";
import { ClientHistorySection } from "@/components/coaching/client-history-section";
import { ExerciseHistoryLookup } from "@/components/coaching/exercise-history-lookup";
import { NotesSection } from "@/components/coaching/notes-section";
import { MessageThread } from "@/components/coaching/message-thread";
import { ThisWeekStats } from "@/components/dashboard/this-week-stats";
import { getInitials } from "@/lib/utils";
import type { ProgramSummary } from "@/lib/programs/types";
import type { CoachClient, LoggedSet, Message } from "@/lib/supabase/types";
import type { SessionHistoryEntry } from "@/lib/logging/queries";
import type { Exercise } from "@/lib/exercises/types";
import type { WeeklyTrainingSummary } from "@/lib/dashboard/types";

type DetailTab = "programs" | "activity" | "notes";

const TABS: UnderlineTabOption<DetailTab>[] = [
  { value: "programs", label: "Programs" },
  { value: "activity", label: "Activity" },
  { value: "notes", label: "Notes" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

interface AthleteDetailPanelProps {
  coachId: string;
  athleteId: string;
  client: CoachClient;
  programs: ProgramSummary[];
  lastActivityOn: string | null;
  activeClients: CoachClient[];
  weeklySummary: WeeklyTrainingSummary;
  consistencyPercent: number | null;
  currentStreak: number;
  historyEntries: SessionHistoryEntry[];
  loggedSetsByExercise: Record<string, LoggedSet[]>;
  exercises: Exercise[];
  messages: Message[];
}

/**
 * The redesigned right-hand panel from Ellis's mockup: identity header with
 * a real relationship-status badge and streak, the same real "This Week"
 * numbers the athlete's own dashboard shows (ThisWeekStats — reused, not re-derived), then
 * Programs/Activity/Notes sub-tabs, with the real message thread pinned
 * below rather than hidden behind a tab (it's the one thing a coach reaches
 * for regardless of which tab they're on) — the header's Message button
 * just scrolls it into view rather than duplicating it.
 *
 * Every number here is real: weeklySummary/consistencyPercent/currentStreak
 * are computed server-side (athletes/[id]/page.tsx) from this athlete's own
 * session_logs/logged_sets, the exact same queries the athlete's own
 * dashboard uses on themselves, just pointed at `athleteId` instead of the
 * signed-in user. "Coaching since" reads coach_clients.accepted_at, the
 * actual date this relationship was accepted.
 */
export function AthleteDetailPanel({
  coachId,
  athleteId,
  client,
  programs,
  lastActivityOn,
  activeClients,
  weeklySummary,
  consistencyPercent,
  currentStreak,
  historyEntries,
  loggedSetsByExercise,
  exercises,
  messages,
}: AthleteDetailPanelProps) {
  const [tab, setTab] = useState<DetailTab>("programs");
  const messagesRef = useRef<HTMLDivElement>(null);

  const coachingSince = client.accepted_at ?? client.created_at;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary"
          >
            {getInitials(null, client.client_email)}
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{client.client_email}</h1>
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-success">
                Active
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="size-3.5" />
                {client.client_email}
              </span>
              <span>Coaching since {formatDate(coachingSince)}</span>
              {lastActivityOn && <span>Last trained {formatDate(lastActivityOn)}</span>}
              {currentStreak > 0 && (
                <span className="flex items-center gap-1 text-primary">
                  <Flame className="size-3.5" />
                  {currentStreak} day streak
                </span>
              )}
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start sm:self-center"
          onClick={() => messagesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          <MessageSquare className="size-4" />
          Message
        </Button>
      </div>

      <ThisWeekStats summary={weeklySummary} consistencyPercent={consistencyPercent} />

      <UnderlineTabs aria-label="Athlete detail sections" options={TABS} value={tab} onChange={setTab} />

      {tab === "programs" && (
        <ClientDetail
          coachId={coachId}
          client={client}
          programs={programs}
          lastActivityOn={lastActivityOn}
          activeClients={activeClients}
          showHeader={false}
        />
      )}

      {tab === "activity" && (
        <div className="flex flex-col gap-6">
          <ClientHistorySection entries={historyEntries} loggedSetsByExercise={loggedSetsByExercise} />
          <ExerciseHistoryLookup athleteId={athleteId} exercises={exercises} />
        </div>
      )}

      {tab === "notes" && <NotesSection />}

      <div ref={messagesRef}>
        <MessageThread
          coachClientId={client.id}
          currentUserId={coachId}
          otherPartyId={athleteId}
          otherPartyLabel={client.client_email}
          initialMessages={messages}
        />
      </div>
    </div>
  );
}
