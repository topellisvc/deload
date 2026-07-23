import Link from "next/link";
import { ArrowRight, Calculator, ClipboardList, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ToolCard } from "@/components/tool-card";
import { HomeRedirect } from "@/components/home-redirect";
import { TOOLS } from "@/lib/tools-registry";

const FEATURED_TOOL_SLUGS = ["one-rep-max", "running-pace-calculator", "quick-workout"];

const PILLARS = [
  {
    icon: Calculator,
    title: "Tools",
    description:
      "Free calculators and generators built on published research — 1RM, pacing, macros, splits, and more.",
    href: "/tools",
    cta: "Browse the tools",
  },
  {
    icon: ClipboardList,
    title: "Programs",
    description:
      "Build multi-week programs with sets, reps, supersets, and running sessions, then log your training as you actually do it.",
    href: "/programs",
    cta: "Build a program",
  },
  {
    icon: Users,
    title: "Coaching",
    description:
      "Invite clients, assign them programs, and see what actually got done — free while we're building this out.",
    href: "/coaching",
    cta: "Become a coach",
  },
];

export default function HomePage() {
  const featuredTools = FEATURED_TOOL_SLUGS.map((slug) => TOOLS.find((t) => t.slug === slug)).filter(
    (t): t is (typeof TOOLS)[number] => t !== undefined
  );

  return (
    <>
      <HomeRedirect />

      <section className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Evidence-based training, start to finish
          </h1>
          <p className="text-lg text-muted-foreground">
            Calculate your numbers, build a program around them, and track whether the
            work&rsquo;s actually happening. No fluff, no fake precision — every tool and
            feature is built on published research.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/programs" className={buttonVariants({ size: "lg" })}>
              Get started
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/tools" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Browse the tools
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-3">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <Link key={pillar.title} href={pillar.href} className="group block focus-visible:outline-none">
                <Card className="h-full transition-colors group-hover:border-border-strong group-focus-visible:ring-2 group-focus-visible:ring-primary">
                  <CardContent className="flex h-full flex-col gap-4 pt-6">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5">
                      <h3 className="font-semibold text-foreground">{pillar.title}</h3>
                      <p className="text-sm text-muted-foreground">{pillar.description}</p>
                    </div>
                    <span className="flex items-center gap-1 text-sm font-medium text-primary">
                      {pillar.cta}
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
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
    </>
  );
}
