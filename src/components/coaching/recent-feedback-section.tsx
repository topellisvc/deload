import { MessageSquareText } from "lucide-react";
import type { Message } from "@/lib/supabase/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface RecentFeedbackSectionProps {
  /** The full conversation — already fetched for the Messages section, so
   * this just filters it rather than running a second query. */
  messages: Message[];
  coachId: string;
}

/**
 * "Feedback" is just the coach's own messages for now — there's no
 * separate structured-feedback table (workout comments, tagged notes)
 * yet. Reading `messages` here rather than a dedicated query means
 * swapping in a real feedback model later is a matter of changing what
 * this component reads, not the section's shape or its caller.
 */
export function RecentFeedbackSection({ messages, coachId }: RecentFeedbackSectionProps) {
  const feedback = messages.filter((m) => m.sender_id === coachId).slice(-3).reverse();

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Recent feedback</h2>
      {feedback.length === 0 ? (
        <p className="text-sm text-muted-foreground">No feedback from your coach yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {feedback.map((message) => (
            <li key={message.id} className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
              <MessageSquareText className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">{message.body}</p>
                <p className="text-xs text-muted-foreground">{formatDate(message.created_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
