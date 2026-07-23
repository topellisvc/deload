"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CheckCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { markConversationRead, sendMessage } from "@/lib/messaging/mutations";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/supabase/types";

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (date.toDateString() === now.toDateString()) return time;
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${time}`;
}

interface MessageThreadProps {
  coachClientId: string;
  currentUserId: string;
  otherPartyId: string;
  otherPartyLabel: string;
  initialMessages: Message[];
}

/**
 * A plain, chronological, text-only conversation — a training log's
 * message thread, not a social feed: no reactions, no typing indicators,
 * no media grid. `attachment_url` already exists on the row (migration
 * 0011) for whenever file sharing gets built; this component's per-message
 * rendering is the one place that'll need a new branch for that, not the
 * schema or the mutations.
 *
 * Marks the conversation read on mount and again on every incoming
 * message while this thread is open, via a Supabase Realtime subscription
 * on INSERTs for this coach_client_id — "receiving messages" means
 * actually arriving live, not just showing up on the next page load.
 */
export function MessageThread({ coachClientId, currentUserId, otherPartyId, otherPartyLabel, initialMessages }: MessageThreadProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    const supabase = createClient();
    markConversationRead(supabase, { coachClientId, userId: currentUserId });

    const channel = supabase
      .channel(`messages:${coachClientId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `coach_client_id=eq.${coachClientId}` },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
          if (incoming.recipient_id === currentUserId) {
            markConversationRead(supabase, { coachClientId, userId: currentUserId });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [coachClientId, currentUserId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;

    setSending(true);
    setError(null);
    const supabase = createClient();
    const { message, error: sendError } = await sendMessage(supabase, {
      coachClientId,
      senderId: currentUserId,
      recipientId: otherPartyId,
      body,
    });
    setSending(false);

    if (sendError || !message) {
      setError(sendError ?? "Couldn't send that message.");
      return;
    }
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    setDraft("");
  }

  return (
    <div className="flex h-[32rem] flex-col rounded-2xl border border-border bg-surface">
      <div className="border-b border-border p-4">
        <h2 className="text-sm font-medium text-foreground">{otherPartyLabel}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm text-muted-foreground">No messages yet.</p>
            <p className="text-xs text-muted-foreground">Say hello below.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((message) => {
              const mine = message.sender_id === currentUserId;
              return (
                <li key={message.id} className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm",
                      mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    )}
                  >
                    {message.body}
                  </div>
                  <span className="flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
                    {formatTimestamp(message.created_at)}
                    {mine && (message.read_at ? <CheckCheck className="size-3" /> : <Check className="size-3" />)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-border p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <Button type="submit" size="sm" disabled={sending || !draft.trim()} aria-label="Send message">
          <Send className="size-3.5" />
        </Button>
      </form>
      {error && <p className="px-4 pb-3 text-xs text-danger">{error}</p>}
    </div>
  );
}
