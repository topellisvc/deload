import type { Metadata } from "next";
import { CalorieMacroCalculator } from "@/components/calculators/calorie-macro-calculator";
import { RelatedTools } from "@/components/related-tools";

export const metadata: Metadata = {
  title: "Calorie & Macro Calculator",
  description:
    "Estimate your daily calorie target and a protein/fat/carb split from multiple published formulas, with an honest range instead of one falsely precise number.",
  alternates: {
    canonical: "/tools/calorie-macro-calculator",
  },
  openGraph: {
    title: "Calorie & Macro Calculator | Deload",
    description:
      "Estimate your daily calorie target and a protein/fat/carb split from multiple published formulas, with an honest range instead of one falsely precise number.",
    url: "/tools/calorie-macro-calculator",
  },
};

const FAQS = [
  {
    question: "Isn't this usually called a \"TDEE calculator\"?",
    answer:
      "Yes — TDEE (total daily energy expenditure) is the technical term for the number this calculates. We named the tool by what it does instead of the acronym, since not everyone has run into that term before. You'll see it used in the explanations below, since it's genuinely useful vocabulary once you understand what it means.",
  },
  {
    question: "Why a range instead of one number?",
    answer:
      "Every calorie-estimation formula is a regression fit to a specific study population, so none of them is exactly right for you individually. We calculate your BMR with Mifflin-St Jeor and Harris-Benedict (and Katch-McArdle too, if you enter a body fat %), then show the spread rather than picking one and presenting it as exact. The single \"calorie target\" number is the average of that range, adjusted for your goal.",
  },
  {
    question: "How is the size of the deficit or surplus decided?",
    answer:
      "Lose weight applies a 20% deficit below maintenance — moderate enough to preserve muscle and adherence for most people, rather than an aggressive crash-diet cut. Gain weight applies a 12% surplus, sized to minimize the fat gained per pound of muscle. These are reasonable defaults, not the only valid choice — some people do better with a smaller, slower deficit or a leaner surplus.",
  },
  {
    question: "How are the protein, fat, and carb targets chosen?",
    answer:
      "Protein is set from grams per kg of body weight — 2.2 g/kg when cutting (higher to protect muscle in a deficit), 1.8 g/kg when gaining, 2.0 g/kg at maintenance — within the range sports-nutrition research (the ISSN position stand) supports for people who train. Fat is fixed at 25% of total calories, a commonly-cited floor for hormonal health. Carbs take whatever calories are left, since carb needs vary the most based on training volume and personal preference.",
  },
  {
    question: "The number doesn't match my actual weight trend — what now?",
    answer:
      "That's expected, and it's why we call this an estimate. Every formula here is a population average; your actual maintenance calories could reasonably be 200-300 kcal off in either direction. Track your weight trend (not day-to-day fluctuation) over 2-3 weeks against your intake, then adjust the target by 5-10% based on what actually happened. Your own data will always beat any formula.",
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

export default function CalorieMacroCalculatorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <header className="mx-auto mb-10 flex max-w-2xl flex-col gap-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Calorie &amp; Macro Calculator
          </h1>
          <p className="text-muted-foreground">
            Estimate your daily calorie target and a protein/fat/carb split
            from multiple published formulas — shown as a range, not a
            single falsely precise number.
          </p>
        </header>

        <CalorieMacroCalculator />

        <article className="mx-auto mt-20 flex max-w-2xl flex-col gap-12">
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              What this is actually estimating
            </h2>
            <p className="text-muted-foreground">
              Your body burns calories even at rest — that baseline is your
              BMR (basal metabolic rate). Multiplying BMR by an activity
              multiplier gives your TDEE (total daily energy expenditure):
              roughly how many calories you burn in an average day, training
              included. Eating below TDEE creates a deficit for fat loss;
              eating above it creates a surplus for muscle gain. Every number
              here starts from an estimate of that baseline, which is why the
              range matters more than any single figure.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Why entering your body fat % helps
            </h2>
            <p className="text-muted-foreground">
              Mifflin-St Jeor and Harris-Benedict both estimate your
              metabolic baseline from height, weight, and age — reasonable
              population averages, but blind to how much of your weight is
              muscle versus fat. Katch-McArdle instead uses your actual lean
              body mass, which is typically more accurate for people who are
              leaner or more muscular than average. If you don&rsquo;t know your
              body fat percentage, the Body Fat Percentage Calculator on this
              site estimates it from a tape measure in about a minute.
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

      <RelatedTools currentSlug="calorie-macro-calculator" />
    </>
  );
}
