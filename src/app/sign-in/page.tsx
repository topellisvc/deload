import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  searchParams,
}: {
  // Every protected page redirects here as `/sign-in?redirect_to=<page>`
  // (see e.g. src/app/history/page.tsx) so signing in lands back where the
  // visitor actually wanted to go — this was previously read nowhere, so
  // every one of those redirects silently landed on /programs instead.
  searchParams: Promise<{ redirect_to?: string }>;
}) {
  const { redirect_to } = await searchParams;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-6 py-16">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Save your progress and build training programs.
        </p>
      </div>
      <SignInForm redirectTo={redirect_to || "/programs"} />
    </div>
  );
}
