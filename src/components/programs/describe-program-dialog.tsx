"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Sparkles } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { createProgramFromParsedProgram } from "@/lib/programs/mutations";
import { parsedProgramToTree, type ParsedProgram } from "@/lib/programs/text-parse";
import type { CoachClient } from "@/lib/supabase/types";

const MYSELF = "myself";

const PLACEHOLDER = `Week 1, Day 1: Squat 5x5 at 80kg, Bench Press 3x8 @ RPE 8, then a 20 minute easy row.
Day 2: Rest.
Day 3: Deadlift 4x5, Pull-ups 3x10, finish with a 5k easy run.`;

interface DescribeProgramDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  activeClients: CoachClient[];
}

type Stage = "idle" | "parsing" | "creating";

export function DescribeProgramDialog({ open, onClose, userId, activeClients }: DescribeProgramDialogProps) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [forClientId, setForClientId] = useState(MYSELF);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      setError("Describe at least one day of training.");
      return;
    }
    setError(null);
    setNotConfigured(false);
    setStage("parsing");

    let parsed: ParsedProgram;
    try {
      const res = await fetch("/api/programs/parse-text", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      const data = await res.json();
      if (data.skipped) {
        setStage("idle");
        setNotConfigured(true);
        return;
      }
      if (!res.ok || data.error) {
        setStage("idle");
        setError(data.error ?? "Couldn't parse that description. Try rephrasing it.");
        return;
      }
      parsed = data.parsed;
    } catch {
      setStage("idle");
      setError("Couldn't reach the server. Check your connection and try again.");
      return;
    }

    setStage("creating");
    const supabase = createClient();
    const { name, discipline, weeks } = parsedProgramToTree(parsed);
    const { program, error: createError } = await createProgramFromParsedProgram(supabase, {
      name,
      discipline,
      weeks,
      userId,
      athleteId: forClientId === MYSELF ? undefined : forClientId,
    });

    if (createError || !program) {
      setStage("idle");
      setError(createError ?? "The program was parsed but couldn't be saved.");
      return;
    }

    // Straight to the editor so the coach can check the AI's work before
    // it's ever trained on — same "review before it's live" pattern as
    // NewProgramDialog and the starter templates.
    router.push(`/programs/${program.id}/edit`);
  }

  const submitting = stage !== "idle";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Describe a program"
      description="Type or paste it in plain English — Claude turns it into weeks, days, and exercises you can review and tweak."
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="program-description">Program description</Label>
          <Textarea
            id="program-description"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={8}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Mention sets, reps, weights or paces where you have them — leave anything out and it&apos;ll just be skipped rather than guessed.
          </p>
        </div>

        {activeClients.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="describe-program-for">For</Label>
            <select
              id="describe-program-for"
              value={forClientId}
              onChange={(e) => setForClientId(e.target.value)}
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value={MYSELF}>Myself</option>
              {activeClients.map((client) => (
                <option key={client.id} value={client.client_id ?? ""}>
                  {client.client_email}
                </option>
              ))}
            </select>
          </div>
        )}

        {notConfigured && (
          <div className="flex gap-3 rounded-lg border border-border bg-surface-hover p-3">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              This feature isn&apos;t set up yet — an admin needs to add an <code className="text-foreground">ANTHROPIC_API_KEY</code> to the app&apos;s environment variables.
            </p>
          </div>
        )}

        {error && (
          <div className="flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
            <p className="text-sm text-foreground">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {stage === "parsing" ? "Reading it…" : stage === "creating" ? "Building program…" : "Generate program"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
