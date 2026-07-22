import type { Metadata } from "next";
import Link from "next/link";
import { BodyFatCalculator } from "@/components/calculators/body-fat-calculator";
import { RelatedTools } from "@/components/related-tools";

export const metadata: Metadata = {
  title: "Body Fat Percentage Calculator",
  description:
    "Estimate your body fat percentage from a tape measure using the U.S. Navy circumference method, with an honest accuracy margin and a fat mass / lean mass breakdown.",
  alternates: {
    canonical: "/tools/body-fat-percentage",
  },
  openGraph: {
    title: "Body Fat Percentage Calculator | Deload",
    description:
      "Estimate your body fat percentage from a tape measure using the U.S. Navy circumference method, with an honest accuracy margin and a fat mass / lean mass breakdown.",
    url: "/tools/body-fat-percentage",
  },
};

const FAQS = [
  {
    question: "How accurate is this?",
    answer:
      "Published validation studies put the Navy circumference method within about ±3-4 percentage points of a DEXA scan for most people — worse than a lab, far better than a mirror. It tends to be less reliable at the very lean end (under roughly 8% for men, 15% for women) and at the very high end, where the underlying formula was less well-fit to the original validation data.",
  },
  {
    question: "Why does the calculator want a different measurement for women?",
    answer:
      "The Navy method uses separate formulas for men and women because fat distribution differs by sex — women's formula adds a hip measurement to account for typically greater fat storage in the hip and thigh region, which a neck-and-waist-only formula would miss.",
  },
  {
    question: "Why do I need to enter my body weight if it's a percentage?",
    answer:
      "The percentage itself only needs your circumference measurements. Body weight is used purely to translate that percentage into fat mass and lean mass in real units, which is more useful for tracking progress and feeds directly into more accurate calorie calculations if you use it there.",
  },
  {
    question: "Is this better or worse than a body fat scale (BIA)?",
    answer:
      "Neither method is highly precise, but they fail differently. Bioelectrical impedance (BIA) scales are sensitive to hydration status and can swing several points based on when you last ate, drank, or exercised. The tape method is more stable day to day since it doesn't depend on hydration, but depends heavily on consistent, correct measurement technique.",
  },
  {
    question: "How should I use this number?",
    answer:
      "As a tracking tool, not a verdict. Measure the same way, at the same time of day, and watch the trend over weeks — the trend is far more informative than any single reading, given the method's error margin.",
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

export default function BodyFatPercentagePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <header className="mx-auto mb-10 flex max-w-2xl flex-col gap-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Body Fat Percentage Calculator
          </h1>
          <p className="text-muted-foreground">
            Estimate your body fat percentage from a tape measure using the
            U.S. Navy circumference method — no scale or scan required.
          </p>
        </header>

        <BodyFatCalculator />

        <article className="mx-auto mt-20 flex max-w-2xl flex-col gap-12">
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Why a tape measure instead of a fancier method
            </h2>
            <p className="text-muted-foreground">
              DEXA scans and hydrostatic weighing are more accurate, but
              neither is something you can do at home. The Navy circumference
              method (Hodgdon &amp; Beckett, 1984) was developed and validated
              specifically as a field-usable alternative — it converts a few
              tape measurements into an estimated body density, then applies
              the Siri equation to convert that density into a body fat
              percentage. It won&rsquo;t match a lab, but it&rsquo;s the most
              validated method that only needs a tape measure.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Getting a consistent measurement
            </h2>
            <p className="text-muted-foreground">
              Measure on bare skin with a flexible, non-elastic tape, snug but
              not compressing the skin. Take each measurement two or three
              times and use the average. Measuring at the same time of day —
              ideally in the morning, before eating — removes most of the
              day-to-day noise from hydration and food volume.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Using this with the calorie calculator
            </h2>
            <p className="text-muted-foreground">
              Once you know your body fat percentage, the{" "}
              <Link href="/tools/calorie-macro-calculator" className="font-medium text-primary hover:underline">
                Calorie &amp; Macro Calculator
              </Link>{" "}
              can use it to estimate your lean body mass directly, which
              produces a tighter calorie estimate than formulas that only use
              height, weight, and age.
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

      <RelatedTools currentSlug="body-fat-percentage" />
    </>
  );
}
