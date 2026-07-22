import type { Metadata } from "next";
import { RunningPaceCalculator } from "@/components/calculators/running-pace-calculator";
import { RaceTimePredictor } from "@/components/calculators/race-time-predictor";
import { RelatedTools } from "@/components/related-tools";

export const metadata: Metadata = {
  title: "Running Pace Calculator",
  description:
    "Solve pace, time, or distance from any two, see even splits, and predict your finish time at other race distances using Riegel's formula.",
  alternates: {
    canonical: "/tools/running-pace-calculator",
  },
  openGraph: {
    title: "Running Pace Calculator | Deload",
    description:
      "Solve pace, time, or distance from any two, see even splits, and predict your finish time at other race distances using Riegel's formula.",
    url: "/tools/running-pace-calculator",
  },
};

const FAQS = [
  {
    question: "How does the race time predictor actually work?",
    answer:
      "It uses Riegel's formula (Peter Riegel, 1977): predicted time = known time x (target distance / known distance)^1.06. The exponent above 1.0 accounts for the fact that you can't hold your shorter-distance pace for a longer distance — it's an empirical fatigue factor derived from a large set of real race results, not a physics law.",
  },
  {
    question: "Why are some predictions marked \"rough estimate\"?",
    answer:
      "Riegel's formula assumes roughly consistent training and physiology across both distances. That assumption holds reasonably well for nearby distances (a 10K predicting a half marathon), but breaks down for large jumps — predicting a marathon from a mile time, for example, ignores that marathon performance depends heavily on endurance and fueling in ways a mile time can't capture. We flag predictions that extrapolate more than 3x in either direction so you know to treat them loosely.",
  },
  {
    question: "What are \"even splits\" and why does that matter?",
    answer:
      "Even splits means running each segment (each km or mile) at the same pace throughout. It's shown here as a reference, not necessarily a race strategy prescription — some runners deliberately negative-split (start slightly slower, finish faster), and terrain or race-day conditions can be good reasons to deviate. The table just tells you what constant pace looks like in practice, split by split.",
  },
  {
    question: "Why solve for pace, time, or distance separately instead of one form?",
    answer:
      "Because you usually know two of the three and want the third — you know your goal race distance and target pace and want to know the finish time, or you know your distance and finish time and want your pace. Picking which one to solve for keeps the inputs matched to what you actually have on hand.",
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

export default function RunningPaceCalculatorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <header className="mx-auto mb-10 flex max-w-2xl flex-col gap-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Running Pace Calculator
          </h1>
          <p className="text-muted-foreground">
            Solve pace, time, or distance from any two, see your even splits,
            and predict your finish time at other race distances.
          </p>
        </header>

        <RunningPaceCalculator />

        <div className="mx-auto mt-20 max-w-2xl">
          <h2 className="mb-2 text-xl font-semibold tracking-tight text-foreground">
            Predict your race time
          </h2>
          <p className="mb-8 text-muted-foreground">
            Enter a recent race result (any distance) to predict your
            equivalent finish time at other standard distances.
          </p>
        </div>

        <div className="mx-auto max-w-6xl">
          <RaceTimePredictor />
        </div>

        <article className="mx-auto mt-20 flex max-w-2xl flex-col gap-12">
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

      <RelatedTools currentSlug="running-pace-calculator" />
    </>
  );
}
