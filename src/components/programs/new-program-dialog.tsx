"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { createClient } from "@/lib/supabase/client";
import { createProgram } from "@/lib/programs/mutations";
import type { ProgramDiscipline } from "@/lib/programs/types";
import type { CoachClient } from "@/lib/supabase/types";

const DISCIPLINE_OPTIONS: { value: ProgramDiscipline; label: string }[] = [
  { value: "resistance", label: "Weights" },
  { value: "running", label: "Running" },
  { value: "hybrid", label: "Hybrid" },
];

const MYSELF = "myself";

interface NewProgramDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  activeClients: CoachClient[];
}

export function NewProgramDialog({ open, onClose, userId, activeClients }: NewProgramDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [discipline, setDiscipline] = useState<ProgramDiscipline>("resistance");
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [forClientId, setForClientId] = useState(MYSELF);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give the program a name.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const dayLabels = Array.from({ length: daysPerWeek }, (_, i) => `Day ${i + 1}`);
    const { program, error: createError } = await createProgram(supabase, {
      userId,
      name: name.trim(),
      discipline,
      dayLabels,
      athleteId: forClientId === MYSELF ? undefined : forClientId,
    });

    if (createError || !program) {
      setSubmitting(false);
      setError(createError ?? "Something went wrong creating the program.");
      return;
    }

    router.push(`/programs/${program.id}`);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New program"
      description="You can rename days and change details any time."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="program-name">Name</Label>
          <Input
            id="program-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Off-season strength block"
            autoFocus
          />
        </div>

        {activeClients.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="program-for">For</Label>
            <select
              id="program-for"
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

        <div className="flex flex-col gap-2">
          <Label>Discipline</Label>
          <SegmentedControl
            aria-label="Discipline"
            options={DISCIPLINE_OPTIONS}
            value={discipline}
            onChange={setDiscipline}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="days-per-week">Training days per week</Label>
          <Input
            id="days-per-week"
            type="number"
            min={1}
            max={7}
            value={daysPerWeek}
            onChange={(e) => setDaysPerWeek(Math.min(7, Math.max(1, Number(e.target.value) || 1)))}
          />
          <p className="text-xs text-muted-foreground">
            You can mark any of these as a rest day later, or rename them.
          </p>
        </div>

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
            {submitting ? "Creating…" : "Create program"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
