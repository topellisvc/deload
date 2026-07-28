import type { Metadata } from "next";
import { ArticleBody } from "@/components/insights/article-body";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Deload collects, uses, and protects your information.",
  alternates: {
    canonical: "/privacy",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const LAST_UPDATED = "July 28, 2026";

// Reuses ArticleBody (src/components/insights/article-body.tsx) rather than
// hand-rolling headings/paragraphs here — it's already the app's one
// styled, safe (no dangerouslySetInnerHTML) Markdown renderer, tuned for
// exactly this "long-form reading" layout. Content lives as a plain
// Markdown string in this file rather than the database: unlike Insights
// articles, this isn't editorial content an admin should be able to
// publish through the UI — it needs to stay in version control, reviewed
// like code, since getting it wrong has real legal weight.
const CONTENT = `
Deload ("Deload," "we," "us," or "our") provides training-program and coaching software at deloadhq.com and, where offered, a corresponding mobile app. This policy explains what information we collect, how we use it, and what choices you have.

We are not lawyers, and this policy describes our actual practices in plain language rather than trying to anticipate every jurisdiction's specific requirements. If you have questions about how a particular law applies to your use of Deload, we'd encourage you to consult your own advisor.

## Information we collect

**Account information.** When you sign in, we collect your email address. Deload uses passwordless sign-in (a one-time code sent to your email) — we never ask for or store a password.

**Profile information.** Anything you choose to add to your profile: display name, bio, date of birth, sex, experience level, training style, height, weight, and training goals. All of this is optional beyond what's needed to create an account.

**Training data.** The programs you build or are assigned, the workouts you log (sets, reps, weight, pace, duration), personal records, and your training history.

**Coaching data.** If you use Deload's coaching features, we collect the email addresses of people you invite, and the messages exchanged between a coach and their athlete.

**Content you submit.** If you apply to write for Deload Insights, we collect your application details and, if approved, the articles you publish.

**Usage information.** We use Vercel Analytics and Speed Insights to understand aggregate site traffic and performance. These are cookieless — they don't track you individually or across other sites.

**Technical information.** If error monitoring is enabled, we use Sentry to capture technical details about errors (like a stack trace and the page you were on) so we can fix bugs. We don't attach your name or email to these reports, and we don't record session replays.

## How we use your information

We use your information to:

- Provide the core product — building and following training programs, logging workouts, and the coaching relationship between coaches and their athletes
- Send account-related and coaching-related emails (like a coach assigning you a program), via our email provider, Resend
- Maintain and improve the security and reliability of the service
- Respond to you when you contact us

We do not sell your information, and we do not use it for third-party advertising.

## Who we share information with

We share information with the service providers that make Deload work, each limited to what they need to do their job:

- **Supabase** — our database, authentication, and file storage provider. This is where your account and training data actually live.
- **Vercel** — hosting, and the analytics/performance monitoring described above.
- **Resend** — delivers transactional emails on our behalf (like a coach's program assignment).
- **Sentry** — technical error monitoring, if enabled.

We don't share your information with anyone else, except where required by law, to protect Deload's or others' rights and safety, or in connection with a merger, acquisition, or sale of assets (in which case we'd let you know).

If you're an athlete working with a coach, that coach can see the training data and messages relevant to your coaching relationship — that visibility is the point of the feature, not something they get without your having connected with them.

## Cookies and local storage

Deload uses one essential cookie to keep you signed in, set by Supabase Auth. We don't use tracking or advertising cookies. Your light/dark theme preference is saved in your browser's local storage, not a cookie, and never leaves your device.

## Data retention and deletion

We keep your information for as long as your account is active. To delete your account and associated data, email support@deloadhq.com — we currently handle deletion requests manually rather than through a self-service control, and we'll confirm once it's done. Some information may be retained where we're required to by law, or where it's needed to resolve disputes or enforce our agreements.

## Your choices

You can review and update most of your profile and training information directly from your Deload profile page at any time. For anything you can't change yourself, or to request a copy of your data, email support@deloadhq.com.

## Children's privacy

Deload is not directed at, and is not intended for use by, anyone under 16. We don't knowingly collect information from children under 16. If you believe a child has provided us with personal information, contact us and we'll remove it.

## Security

We rely on our infrastructure providers' security practices (Supabase, Vercel) and our own access controls to protect your information, including row-level security rules that limit who can read or change data at the database level. No method of storing or transmitting data is completely secure, and we can't guarantee absolute security.

## Changes to this policy

We may update this policy as Deload changes. If we make a material change, we'll update the date below and, where appropriate, let you know more directly (for example, by email).

## Contact us

Questions about this policy or your data? Email support@deloadhq.com.
`.trim();

export default function PrivacyPolicyPage() {
  return (
    <article className="px-6 py-12">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 pb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated {LAST_UPDATED}</p>
      </div>
      <ArticleBody markdown={CONTENT} />
    </article>
  );
}
