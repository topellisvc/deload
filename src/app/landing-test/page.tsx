import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Calculator, CheckCircle2, ClipboardList, ShieldCheck, Sparkles, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Landing page test",
  robots: { index: false, follow: false },
};

/**
 * A/B test of the marketing homepage — NOT linked anywhere, not the real
 * homepage (src/app/page.tsx is untouched). Built off a competitive
 * review of 5 other coaching-software landing pages (Everfit, TrueCoach,
 * Trainerize, TrainHeroic, PT Distinction): every one of them leads with
 * an audience-first headline, a real product screenshot in the hero, a
 * trust signal, and one repeated primary CTA — all things the real
 * homepage's text-only hero currently lacks.
 *
 * The two images are real screenshots of this actual app (captured live
 * off deloadhq.com, not stock photos or a fabricated mockup) — showing
 * the real product was the single biggest, most consistent gap versus
 * every competitor reviewed. Deliberately no invented customer counts or
 * testimonials: Deload doesn't have those yet, and every competitor's
 * strongest trust signals were specific and real (a named founder, an
 * exact revenue number) rather than generic — a fabricated "10,000+
 * users" would be worse than the honest "free while we build this out"
 * hook this leans on instead.
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
            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
              <Image
                src="/marketing/dashboard-preview.jpg"
                alt="Deload dashboard showing today's workout, streak, and program completion"
                width={1456}
                height={827}
                className="w-full"
                priority
              />
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

      {/* Second visual — programs, color-coded */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lg lg:order-2">
            <Image
              src="/marketing/programs-preview.jpg"
              alt="Deload programs list showing weights, hybrid, and running programs, each color-coded by discipline"
              width={1456}
              height={827}
              className="w-full"
            />
          </div>
          <div className="flex flex-col gap-4 lg:order-1">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Every program, color-coded by discipline
            </h2>
            <p className="text-muted-foreground">
              Weights, hybrid, and running programs each get their own color the moment you
              create them — scan your whole list and know what you&rsquo;re looking at before
              you read a single word.
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
