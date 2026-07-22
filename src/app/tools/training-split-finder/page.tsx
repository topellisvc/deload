import type { Metadata } from "next";
import { TrainingSplitFinder } from "@/components/calculators/training-split-finder";
import { RelatedTools } from "@/components/related-tools";

export const metadata: Metadata = {
  title: "Training Split Finder",
  description:
    "Find the training split that actually fits your goal, experience, and how many days a week you can train — Full Body, Upper/Lower, or Push/Pull/Legs, with the reasoning shown.",
  alternates: {
    canonical: "/tools/training-split-finder",
  },
  openGraph: {
    title: "Training Split Finder | Deload",
    description:
      "Find the training split that actually fits your goal, experience, and how many days a week you can train — Full Body, Upper/Lower, or Push/Pull/Legs, with the reasoning shown.",
    url: "/tools/training-split-finder",
  },
};

const FAQS = [
  {
    question: "Is this split actually the \"best\" one for me?",
    answer:
      "Not in the sense of guaranteed superior results. Research on training frequency generally finds that different splits produce similar outcomes once total weekly volume per muscle group is matched — no split has been shown to reliably outperform the others on its own. What actually differs is how the volume gets distributed across your available days and how sustainable that feels. This tool recommends the structure that best fits your specific goal, experience, and day count, not a claim that it's mathematically optimal.",
  },
  {
    question: "Why does experience level change the recommendation?",
    answer:
      "Beginners generally get more out of practicing the same lifts more often — it's how technique and neural adaptations develop fastest early on, which is why well-established beginner programs (Starting Strength, StrongLifts, and similar) are built around full-body sessions. More specialized splits become more useful once you have enough training experience that a single weekly exposure to a movement pattern doesn't leave you leaving progress on the table.",
  },
  {
    question: "Why does the split change based on my goal, not just my days per week?",
    answer:
      "Strength and general fitness goals benefit most from consistent, frequent practice of the same lifts — so this tool keeps them on full body or upper/lower even at higher day counts. Muscle growth (hypertrophy) benefits more from fitting enough total volume into a muscle group per session, which is where push/pull/legs earns its extra specialization at 5-6 days a week.",
  },
  {
    question: "What if I can only train fewer days some weeks?",
    answer:
      "Re-run this with your realistic minimum, not your best-case week. A full-body or upper/lower split you actually complete every week beats a more specialized split you only half-finish. Consistency over months matters far more than which split you pick.",
  },
  {
    question: "What do I do with this recommendation?",
    answer:
      "Use the day types (Push, Pull, Legs, Upper, Lower, or Full Body) as the focus area when building sessions with the Quick Workout Generator — it uses the same movement-pattern logic to fill in the actual exercises for each day.",
  },
] as const;

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export default function TrainingSplitFinderPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <header className="mx-auto mb-10 flex max-w-2xl flex-col gap-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Training Split Finder
          </h1>
          <p className="text-muted-foreground">
            Answer three questions to find a weekly training structure that
            fits your goal, experience, and schedule — with the reasoning
            behind it, not just an answer.
          </p>
        </header>

        <TrainingSplitFinder />

        <article className="mx-auto mt-20 flex max-w-2xl flex-col gap-12">
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              What a &ldquo;split&rdquo; actually means
            </h2>
            <p className="text-muted-foreground">
              A training split is just how you organize your training week —
              which muscle groups or movement patterns get trained on which
              days. Full body trains everything every session; upper/lower
              and push/pull/legs spread that work across more specialized
              days. None of them are a program on their own — they&rsquo;re the
              structure a program gets built inside.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Frequently asked questions
            </h2>
            <div className="flex flex-col divide-y divide-border">
              {FAQS.map((faq) => (
                <div key={faq.question} className="flex flex-col gap-2 py-5 first:pt-0">
                  <h3 className="font-medium text-foreground">{faq.question}</h3>
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                </div>
              ))}
            </div>
          </section>
        </article>
      </div>

      <RelatedTools currentSlug="training-split-finder" />
    </>
  );
}
