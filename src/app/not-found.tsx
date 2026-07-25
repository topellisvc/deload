import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/**
 * Renders inside the root layout (still gets SiteHeader/SiteFooter) for
 * any unmatched route — replaces Next's unstyled default 404. Links home
 * rather than trying to guess signed-in-vs-out here: middleware already
 * sends a signed-in visitor from "/" to /dashboard, so this works either
 * way without duplicating that check.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link href="/" className={buttonVariants({ size: "lg", className: "mt-2" })}>
        Back home
      </Link>
    </div>
  );
}
