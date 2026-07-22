import type { Metadata } from "next";
import { OneRepMaxCalculator } from "@/components/calculators/one-rep-max-calculator";

export const metadata: Metadata = {
  title: "One-Rep Max Calculator",
  description:
    "Estimate your true one-rep max from any set with a confidence range across five research formulas, plus a full percentage-based training table.",
  alternates: {
    canonical: "/tools/one-rep-max",
  },
  openGraph: {
    title: "One-Rep Max Calculator | Deload",
    description:
      "Estimate your true one-rep max from any set with a confidence range across five research formulas, plus a full percentage-based training table.",
    url: "/tools/one-rep-max",
  },
};

const FAQS = [
  {
    question: "How accurate is a 1RM calculator?",
    answer:
      "Sub-maximal formulas typically estimate within about 5-10% of a true tested max when the set is taken close to failure at 10 reps or fewer. Accuracy drops the higher the rep count gets, which is why we show a range across five formulas instead of a single number.",
  },
  {
    question: "How many reps should I use for the most accurate estimate?",
    answer:
      "Reps between 1 and 8 give the tightest, most reliable estimates. Between 9 and 12 reps the range widens. Above 12 reps, treat the result as a rough guide only — fatigue and pacing start to distort every formula.",
  },
  {
    question: "Should I just test my 1RM directly instead?",
    answer:
      "A supervised, properly warmed-up single-rep test is always more accurate than any formula. This calculator is most useful when a direct test isn't practical — for example between max-effort testing blocks — or as a quick sanity check on your current strength.",
  },
  {
    question: "Why do the five formulas give different results?",
    answer:
      "Each formula (Epley, Brzycki, Lombardi, McGlothin, Wathen) is a regression fit to a different dataset of lifters and lifts. None is universally correct — they simply model the fatigue-to-load relationship slightly differently, which is exactly why we show their spread as a range rather than picking one.",
  },
  {
    question: "How often should I retest my one-rep max?",
    answer:
      "For most lifters, every 6-12 weeks is enough to track meaningful strength changes without the fatigue cost of frequent maximal testing. Using this calculator from your heaviest working sets in between is a lower-fatigue way to track progress.",
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

export default function OneRepMaxPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <header className="mx-auto mb-10 flex max-w-2xl flex-col gap-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            One-Rep Max Calculator
          </h1>
          <p className="text-muted-foreground">
            Enter any set you&rsquo;ve completed and get an estimated max with an
            honest confidence range, plus a full training percentage table.
          </p>
        </header>

        <OneRepMaxCalculator />

        <article className="mx-auto mt-20 flex max-w-2xl flex-col gap-12">
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Why we show a range, not just a number
            </h2>
            <p className="text-muted-foreground">
              Every sub-maximal 1RM formula is a regression fit to a specific
              population of lifters performing specific exercises. None of
              them is objectively &ldquo;correct&rdquo; for you. Presenting a single
              decimal-precision number would overstate how much confidence
              you should have in it. Instead, we calculate your estimate five
              different ways and show you the full spread — the tighter the
              range, the more you can trust the number.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              How to use your training percentages
            </h2>
            <p className="text-muted-foreground">
              The table above turns your estimated max into a practical
              loading guide. Lower percentages (50-69%) with higher reps
              build muscular endurance and technique; the 70-89% range is the
              workhorse zone for strength and hypertrophy training; 90%+ is
              reserved for low-volume max-strength work and should be used
              sparingly to manage fatigue. Typical rep ranges are shown for
              each percentage, but individual rep tolerance varies — use them
              as a starting point, not a rule.
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
    </>
  );
}
