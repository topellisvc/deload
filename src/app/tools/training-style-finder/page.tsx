import type { Metadata } from "next";
import { TrainingStyleFinder } from "@/components/calculators/training-style-finder";
import { RelatedTools } from "@/components/related-tools";

export const metadata: Metadata = {
  title: "Training Style Finder",
  description:
    "Not sure what kind of training actually fits you? Answer 3 questions to find out whether powerlifting-style, bodybuilding-style, calisthenics, general fitness, or hybrid training suits your goal and equipment.",
  alternates: {
    canonical: "/tools/training-style-finder",
  },
  openGraph: {
    title: "Training Style Finder | Deload",
    description:
      "Not sure what kind of training actually fits you? Answer 3 questions to find out whether powerlifting-style, bodybuilding-style, calisthenics, general fitness, or hybrid training suits your goal and equipment.",
    url: "/tools/training-style-finder",
  },
};

const FAQS = [
  {
    question: "How is this different from the Training Split Finder?",
    answer:
      "This one answers a bigger question first: which overall discipline actually fits you — powerlifting-style, bodybuilding-style, calisthenics, general fitness, or hybrid training. The Training Split Finder assumes you've already settled on general resistance training and helps you structure the week (Full Body, Upper/Lower, or Push/Pull/Legs). Use this one first if you're not sure what you're even training toward.",
  },
  {
    question: "Is this scientifically validated?",
    answer:
      "Partly, and we want to be upfront about which part. Ruling out powerlifting-style training when you don't have barbell access is a hard practical fact, not a preference. But which discipline suits you best given your goals and what you enjoy is genuinely personal — there's no study that proves bodybuilding is \"correct\" for someone who wants visible muscle over someone who wants hybrid training instead. This tool matches your stated goals and preferences to the style built around them; it isn't claiming one is scientifically superior to another.",
  },
  {
    question: "What if I get a \"close second\"?",
    answer:
      "It means your answers were genuinely split between two disciplines — there wasn't a clear winner. That's useful information on its own: it usually means either would suit you reasonably well, so it's worth trying the top recommendation first and switching to the second if it doesn't click after a few weeks.",
  },
  {
    question: "Can I combine styles, or do I have to pick one?",
    answer:
      "Plenty of real training blends elements of more than one of these — the categories here are useful starting points, not rigid boxes. If your result doesn't feel quite right, that's a signal to adjust rather than a fixed verdict.",
  },
  {
    question: "What do I do with this recommendation?",
    answer:
      "Head to the Training Split Finder next to figure out how to structure your training week for that style, then the Quick Workout Generator to build actual sessions using your available equipment.",
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

export default function TrainingStyleFinderPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <header className="mx-auto mb-10 flex max-w-2xl flex-col gap-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Training Style Finder
          </h1>
          <p className="text-muted-foreground">
            Not sure what kind of training actually fits you? Answer 3
            questions to find out.
          </p>
        </header>

        <TrainingStyleFinder />

        <article className="mx-auto mt-20 flex max-w-2xl flex-col gap-12">
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Why we ask about equipment before preferences
            </h2>
            <p className="text-muted-foreground">
              Powerlifting-style training is built around barbell squat,
              bench, and deadlift — without consistent barbell access, it
              genuinely isn&rsquo;t that discipline anymore, no matter how much
              you&rsquo;d prefer it. We treat that as a hard constraint rather
              than just another preference, and only match on goals and
              session style once the practical question is settled.
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

      <RelatedTools currentSlug="training-style-finder" />
    </>
  );
}
