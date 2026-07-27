import type { InsightsReference } from "@/lib/insights/types";

/**
 * Dedicated references section at the bottom of an article — one row per
 * citation (journal, authors, year, optional link), matching the spec's
 * "dedicated References section" requirement. Deliberately not formatted
 * as a specific citation style (APA/Vancouver/etc.) yet — the schema
 * (migration 0023) stores structured fields precisely so a real citation
 * formatter can be dropped in later without touching stored data; this
 * renders a plain, readable "Authors (Year). Journal/Source." line, with
 * a "View source" link only when a url was confidently attached.
 */
export function ArticleReferences({ references }: { references: InsightsReference[] }) {
  if (references.length === 0) return null;

  return (
    <section className="mx-auto mt-12 max-w-2xl border-t border-border pt-8">
      <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">References</h2>
      <ol className="flex flex-col gap-3">
        {references.map((reference, index) => (
          <li key={reference.id} className="flex gap-3 text-sm text-muted-foreground">
            <span className="shrink-0 font-medium text-foreground/60">{index + 1}.</span>
            <span>
              {reference.authors}
              {reference.year ? ` (${reference.year})` : ""}. <em className="italic">{reference.journalTitle}</em>.
              {reference.url && (
                <>
                  {" "}
                  <a
                    href={reference.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
                  >
                    View source
                  </a>
                </>
              )}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
