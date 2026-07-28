import type { Metadata } from "next";
import { ArticleBody } from "@/components/insights/article-body";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of Deload.",
  alternates: {
    canonical: "/terms",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const LAST_UPDATED = "July 28, 2026";

// See privacy/page.tsx's doc comment — same reasoning for reusing
// ArticleBody and keeping this content in version control rather than
// the database.
const CONTENT = `
These terms govern your use of Deload (deloadhq.com and, where offered, its corresponding mobile app). By creating an account or using Deload, you agree to them. If you don't agree, please don't use Deload.

We are not lawyers, and this document is a good-faith effort to set out fair, plain-language terms for a small, still-growing product — not a substitute for legal advice tailored to your situation.

## Not medical or professional advice

Deload's programs, calculators, and Insights articles are educational and provide estimates, not medical or professional coaching advice. They're built on published research, but every body is different. Consult a qualified coach or medical professional for guidance specific to you, especially if you have an existing injury, medical condition, or are new to exercise. You're responsible for exercising within your own limits and judgment.

## Your account

You need an account to use most of Deload. You're responsible for:

- Providing accurate information and keeping your email address up to date
- Any activity that happens under your account
- Being at least 16 years old — Deload isn't designed for, and isn't intended to be used by, children

If you're using Deload as part of a coaching relationship (as a coach or an athlete), you're responsible for having a real, mutually understood relationship with the other person before connecting your accounts — Deload doesn't verify that relationship for you.

## Acceptable use

You agree not to:

- Use Deload for anything illegal, or in a way that violates someone else's rights
- Attempt to access another user's account or data without authorization
- Scrape, reverse-engineer, or interfere with Deload's normal operation
- Impersonate a coach, athlete, or contributor you aren't
- Use the coaching-invite or messaging features to contact people who haven't agreed to hear from you (i.e., no spam)
- Upload content you don't have the right to use

We can suspend or terminate accounts that violate these terms.

## Your content

You own the training data, programs, and messages you create in Deload. By using Deload, you give us the license we need to store, process, and display that content back to you (and, where you've set it up that way, to your coach or athlete) in order to provide the service.

If you contribute an Insights article, you retain ownership of it, and grant Deload a license to publish, edit for clarity, and distribute it on the site. You confirm that anything you submit is your own work (or you have the right to submit it) and doesn't infringe anyone else's rights.

## The service itself

Deload is currently offered free of charge while it's under active development. We may introduce paid plans or change what's included in the free tier in the future — if we do, we'll give existing users reasonable notice before anything you're already using starts requiring payment.

We aim to keep Deload available and reliable, but we don't guarantee uninterrupted access. Features may change, and we may discontinue parts of the service, with notice where reasonably possible.

## Disclaimers and limitation of liability

Deload is provided "as is," without warranties of any kind, express or implied. To the fullest extent the law allows, Deload and its creators aren't liable for any indirect, incidental, or consequential damages arising from your use of the service, including any injury resulting from a training program, calculator estimate, or article — see "Not medical or professional advice" above.

## Termination

You can stop using Deload and request account deletion at any time (see the Privacy Policy for how). We may suspend or terminate access for violating these terms, or discontinue the service, with notice where reasonably possible.

## Changes to these terms

We may update these terms as Deload changes. If we make a material change, we'll update the date below and, where appropriate, let you know more directly.

## Contact us

Questions about these terms? Email support@deloadhq.com.
`.trim();

export default function TermsOfServicePage() {
  return (
    <article className="px-6 py-12">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 pb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated {LAST_UPDATED}</p>
      </div>
      <ArticleBody markdown={CONTENT} />
    </article>
  );
}
