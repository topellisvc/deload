import type { Metadata } from "next";
import { AcwrCalculator } from "@/components/calculators/acwr-calculator";
import { RelatedTools } from "@/components/related-tools";

export const metadata: Metadata = {
  title: "Training Load Ratio (ACWR) Calculator",
  description:
    "Check whether your recent training load has spiked relative to your 4-week baseline, using the acute:chronic workload ratio method from sports science.",
  alternates: {
    canonical: "/tools/acwr",
  },
  openGraph: {
    title: "Training Load Ratio (ACWR) Calculator | Deload",
    description:
      "Check whether your recent training load has spiked relative to your 4-week baseline, using the acute:chronic workload ratio method from sports science.",
    url: "/tools/acwr",
  },
};

const FAQS = [
  {
    question: "What is the acute:chronic workload ratio?",
    answer:
      "It's a way of comparing how much you've trained this week (acute load) against what you're conditioned for based on the last 4 weeks (chronic load). A ratio near 1.0 means this week is typical for you; a ratio well above 1.0 means this week is a significant spike relative to your recent history.",
  },
  {
    question: "Is ACWR scientifically proven to predict injuries?",
    answer:
      "It's genuinely debated. The original research found the 0.8-1.3 range associated with lower injury rates in some sports, but later methodological critiques pointed out that because acute load is mathematically part of chronic load in this rolling-average model, some of that correlation can be a statistical artifact rather than a pure physiological signal. Treat ACWR as one input alongside how you actually feel, not a verdict.",
  },
  {
    question: "What counts as \"training load\"?",
    answer:
      "Most commonly, session-RPE: multiply a session's duration in minutes by your perceived effort for that session on a 1-10 scale (RPE), then sum every session in the week. A 45-minute run at RPE 6 is 270. Add up all sessions for the week to get your weekly total. Any consistent metric works, as long as you use the same one every week.",
  },
  {
    question: "What should I do if I land in the \"High risk\" zone?",
    answer:
      "First check whether the spike was intentional (a planned peak week, a race, a one-off event) or accidental. If accidental, consider whether the following week should be lighter to let your chronic average catch up. This tool flags the pattern; it can't tell you whether the specific spike was appropriate for your situation.",
  },
  {
    question: "How often should I check this?",
    answer:
      "Weekly is typical — recalculate once you've logged a full new week of training. Checking more often than that just re-measures the same underlying trend with more noise.",
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

export default function AcwrPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <header className="mx-auto mb-10 flex max-w-2xl flex-col gap-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Training Load Ratio (ACWR) Calculator
          </h1>
          <p className="text-muted-foreground">
            Enter your last 4 weeks of training load to see whether this
            week is a meaningful spike relative to what you&rsquo;re
            conditioned for.
          </p>
        </header>

        <AcwrCalculator />

        <article className="mx-auto mt-20 flex max-w-2xl flex-col gap-12">
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              What this number does and doesn&rsquo;t tell you
            </h2>
            <p className="text-muted-foreground">
              The acute:chronic workload ratio compares your most recent
              week of training against your 4-week average. It&rsquo;s a widely
              used way to spot sudden load spikes, which are one of several
              known contributors to non-contact injury risk. It is not a
              diagnosis, and a ratio in the &ldquo;Optimal&rdquo; range
              doesn&rsquo;t guarantee you won&rsquo;t get injured, just as a
              high ratio doesn&rsquo;t guarantee you will. The methodology
              itself has real, published critiques (see the FAQ below) —
              this is a pattern-spotting tool, not a verdict.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              How to track your weekly load
            </h2>
            <p className="text-muted-foreground">
              The simplest widely-used method is session-RPE: rate each
              session&rsquo;s overall difficulty from 1-10 (RPE), multiply by the
              session&rsquo;s duration in minutes, and sum every session across
              the week. It works for lifting, running, team sports, or
              mixed training, since it&rsquo;s based on perceived effort rather
              than a sport-specific metric like pace or tonnage.
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

      <RelatedTools currentSlug="acwr" />
    </>
  );
}
