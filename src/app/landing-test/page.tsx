import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Calculator, CheckCircle2, ClipboardList, ShieldCheck, Sparkles, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { BarbellLoader } from "@/components/ui/barbell-loader";

export const metadata: Metadata = {
  title: "Landing page test",
  robots: { index: false, follow: false },
};

/**
 * A/B test of the marketing homepage — NOT linked anywhere, not the real
 * homepage (src/app/page.tsx is untouched). Built off a competitive
 * review of 5 other coaching-software landing pages (Everfit, TrueCoach,
 * Trainerize, TrainHeroic, PT Distinction): every one of them leads with
 * an audience-first headline, a hero visual, a trust signal, and one
 * repeated primary CTA — all things the real homepage's text-only hero
 * currently lacks.
 *
 * Both non-hero-badge images are real photos, not screenshots — the
 * first draft used real app screenshots in both spots, but a photo of
 * someone actually training reads more human than UI, in the hero and
 * in the second section alike. Both hotlinked from Unsplash's own CDN
 * (see next.config.mjs's remotePatterns) rather than downloaded/
 * self-hosted, both confirmed free to use under the Unsplash License
 * (unsplash.com/license):
 * - Hero: "person about to lift the barbel" by Victor Freitas
 *   (@victorfreitas), photo-1517836357463-d25dfeac3438.
 * - Second section: "pair of blue-and-white Adidas running shoes" by
 *   sporlab (@sporlab), photo-1571008887538-b36bb32f4571.
 *
 * The floating "Logging today's set" card is the one moving element on
 * the page — it reuses BarbellLoader, the app's own branded route-loading
 * animation (same barbell-lift/-shadow keyframes from globals.css), so
 * the motion is the product's real animation rather than a generic
 * effect bolted on for the marketing page.
 *
 * Deliberately no invented customer counts or testimonials: Deload
 * doesn't have those yet, and every competitor's strongest trust signals
 * were specific and real (a named founder, an exact revenue number)
 * rather than generic — a fabricated "10,000+ users" would be worse than
 * the honest "free while we build this out" hook this leans on instead.
 */
export default function LandingTestPage() {
  return (
    <>
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
              {/* The one moving element on the page — reuses the same
                  barbell-lift/-shadow keyframes as the app's own route
                  loader (BarbellLoader), so "something's moving" is the
                  product's real branded motion, not a generic effect. */}
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
      <div className="flex h-full flex-col gap-4 rounded-2xl border border-border bg-surface p-6 transition-colors group-hover:border-border-strong">
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
      </div>
    </Link>
  );
}
