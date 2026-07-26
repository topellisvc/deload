import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Calculator, CheckCircle2, ClipboardList, ShieldCheck, Sparkles, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ToolCard } from "@/components/tool-card";
import { HomeRedirect } from "@/components/home-redirect";
import { BarbellLoader } from "@/components/ui/barbell-loader";
import { StarterProgramPicker } from "@/components/programs/starter-program-picker";
import { TOOLS } from "@/lib/tools-registry";

const FEATURED_TOOL_SLUGS = ["one-rep-max", "running-pace-calculator", "quick-workout"];

// Organization + SoftwareApplication structured data — helps search engines
// tie the domain to the "Deload" entity and understand what the product
// actually is (free, coaching/training software), distinct from the
// FAQPage JSON-LD each /tools calculator page already carries.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Deload",
  url: "https://deloadhq.com",
  logo: "https://deloadhq.com/icon",
};

const softwareApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Deload",
  applicationCategory: "HealthApplication",
  operatingSystem: "Web",
  description:
    "Evidence-based training software for coaches and athletes — build real programs, track training live, and use free calculators backed by published research.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

/**
 * Promoted from the /landing-test A/B experiment (built off a
 * competitive review of 5 coaching-software landing pages — Everfit,
 * TrueCoach, Trainerize, TrainHeroic, PT Distinction). Every one of them
 * led with an audience-first headline, a hero visual, a trust signal,
 * and one repeated primary CTA — the previous version of this page was
 * a single centered text block with none of that.
 *
 * Both hero-area images are real photos (not app screenshots or
 * illustrations), hotlinked from Unsplash's own CDN (see
 * next.config.mjs's remotePatterns), both confirmed free to use under
 * the Unsplash License (unsplash.com/license):
 * - Hero: "person about to lift the barbel" by Victor Freitas
 *   (@victorfreitas), photo-1517836357463-d25dfeac3438.
 * - Second section: "pair of blue-and-white Adidas running shoes" by
 *   sporlab (@sporlab), photo-1571008887538-b36bb32f4571.
 *
 * The floating "Logging today's set" card is the one moving element on
 * the page — it reuses BarbellLoader, the app's own branded
 * route-loading animation (same barbell-lift/-shadow keyframes from
 * globals.css), so the motion is the product's real animation rather
 * than a generic effect.
 *
 * Deliberately no invented customer counts or testimonials: Deload
 * doesn't have those yet, and every competitor's strongest trust signals
 * were specific and real (a named founder, an exact revenue number)
 * rather than generic — a fabricated "10,000+ users" would be worse than
 * the honest "free while we build this out" hook this leans on instead.
 *
 * The starter-program picker and tools grid below are carried over
 * unchanged from the pre-redesign homepage — real, working conversion
 * paths that the redesign was never meant to remove, just give a
 * stronger opening above.
 */
export default function HomePage() {
  const featuredTools = FEATURED_TOOL_SLUGS.map((slug) => TOOLS.find((t) => t.slug === slug)).filter(
    (t): t is (typeof TOOLS)[number] => t !== undefined
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
      />
      <HomeRedirect />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-16 sm:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8">
          <div className="flex flex-col items-start gap-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">
              <Sparkles className="size-3.5" />
              Free while we&rsquo;re building this out — no trial, no card
            </span>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Build training programs your clients actually follow
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Deload is evidence-based training software for coaches and athletes — a real
              program builder, live tracking, and coaching tools, backed by published research
              instead of guesswork.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/programs" className={buttonVariants({ size: "lg" })}>
                Get started free
                <ArrowRight className="size-4" />
              </Link>
              <Link href="/tools" className={buttonVariants({ variant: "outline", size: "lg" })}>
                See the tools
              </Link>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-success" />
                No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-success" />
                Built on published research
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-success" />
                For coaches and athletes
              </span>
            </div>
          </div>

          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute -inset-8 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/20 via-zone-endurance/10 to-zone-strength/10 blur-2xl"
            />
            <div className="relative overflow-hidden rounded-2xl border border-border shadow-lg">
              <Image
                src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?fm=jpg&q=80&w=1600&auto=format&fit=crop"
                alt="Athlete mid-deadlift in a gym"
                width={1600}
                height={2000}
                className="h-[520px] w-full object-cover"
                priority
              />
              {/* The one moving element in the hero — reuses the same
                  barbell-lift/-shadow keyframes as the app's own route
                  loader (BarbellLoader), so the motion is the product's
                  real branded animation, not a generic effect. */}
              <div className="absolute bottom-5 left-5 flex items-center gap-3 rounded-xl border border-border bg-surface/95 px-4 py-3 shadow-lg backdrop-blur">
                <BarbellLoader />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">Logging today&rsquo;s set</span>
                  <span className="text-xs text-muted-foreground">3 sets · 8-10 reps · 70kg</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-4 sm:grid-cols-3">
          <PillarCard
            icon={Calculator}
            colorClass="bg-primary/10 text-primary"
            title="Tools"
            description="Free calculators and generators built on published research — 1RM, pacing, macros, splits, and more."
            href="/tools"
            cta="Browse the tools"
          />
          <PillarCard
            icon={ClipboardList}
            colorClass="bg-zone-strength/15 text-zone-strength"
            title="Programs"
            description="Build multi-week programs with sets, reps, supersets, and running sessions, then log your training as you actually do it."
            href="/programs"
            cta="Build a program"
          />
          <PillarCard
            icon={Users}
            colorClass="bg-zone-endurance/15 text-zone-endurance"
            title="Coaching"
            description="Invite clients, assign them programs, and see what actually got done — free while we're building this out."
            href="/coaching"
            cta="Become a coach"
          />
        </div>
      </section>

      {/* Second visual — breadth of disciplines */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8">
          <div className="overflow-hidden rounded-2xl border border-border shadow-lg lg:order-2">
            <Image
              src="https://images.unsplash.com/photo-1571008887538-b36bb32f4571?fm=jpg&q=80&w=1600&auto=format&fit=crop"
              alt="Runner's shoes mid-stride on a road"
              width={1600}
              height={1067}
              className="h-[420px] w-full object-cover"
            />
          </div>
          <div className="flex flex-col gap-4 lg:order-1">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Strength or endurance — programmed properly, either way
            </h2>
            <p className="text-muted-foreground">
              Deload isn&rsquo;t just a lifting app. Build resistance, running, or hybrid
              programs with the same rigor — progressive overload, sensible rep ranges, and
              pacing grounded in published research instead of guesswork.
            </p>
            <p className="text-muted-foreground">
              Start from scratch, or pick one of our ready-made 4-week starter programs and
              we&rsquo;ll set the whole thing up for you.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-6 flex flex-col gap-1.5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Not sure where to start?
          </h2>
          <p className="text-sm text-muted-foreground">
            Pick a 4-week program and we&rsquo;ll set it up for you — sign in once and it&rsquo;s ready to go.
          </p>
        </div>
        <StarterProgramPicker mode="redirect" />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Popular tools
          </h2>
          <Link
            href="/tools"
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View all {TOOLS.length}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featuredTools.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-surface to-surface p-10 text-center sm:p-16">
          <ShieldCheck className="size-8 text-primary" />
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Free while we&rsquo;re building this out
          </h2>
          <p className="max-w-md text-muted-foreground">
            No trial countdown, no credit card. Start building a program in less than a minute.
          </p>
          <Link href="/programs" className={buttonVariants({ size: "lg" })}>
            Get started free
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </>
  );
}

function PillarCard({
  icon: Icon,
  colorClass,
  title,
  description,
  href,
  cta,
}: {
  icon: typeof Calculator;
  colorClass: string;
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <Link href={href} className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <Card className="h-full transition-colors group-hover:border-border-strong group-focus-visible:ring-2 group-focus-visible:ring-primary">
        <CardContent className="flex h-full flex-col gap-4 pt-6">
          <div className={`flex size-10 items-center justify-center rounded-lg ${colorClass}`}>
            <Icon className="size-5" />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <span className="flex items-center gap-1 text-sm font-medium text-primary">
            {cta}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
