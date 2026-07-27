import Image from "next/image";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders an article's Markdown body — the seeded content's source of
 * truth is always plain Markdown (see 0023_insights.sql's comment on the
 * `body` column), never raw HTML, so there's no injection surface even
 * though every article here is public. react-markdown parses to a React
 * element tree itself (it never calls dangerouslySetInnerHTML), which is
 * what makes that safe.
 *
 * No @tailwindcss/typography plugin in this app (per its general
 * preference for hand-styled elements over heavy plugins — see the
 * codebase's existing component conventions) — every element below is
 * styled explicitly instead, tuned for "excellent typography, comfortable
 * reading width" per the Insights spec. The comfortable-width part is the
 * caller's job (wrap this in a `max-w-2xl`/`prose`-width container on the
 * article page); this component only owns type rhythm and spacing.
 */
const markdownComponents: Components = {
  h1: ({ children }) => <h2 className="mb-4 mt-10 text-2xl font-bold tracking-tight text-foreground first:mt-0">{children}</h2>,
  h2: ({ children }) => <h2 className="mb-4 mt-10 text-2xl font-bold tracking-tight text-foreground first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-3 mt-8 text-xl font-semibold tracking-tight text-foreground">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-2 mt-6 text-lg font-semibold text-foreground">{children}</h4>,
  p: ({ children }) => <p className="mb-5 text-base leading-relaxed text-foreground/90">{children}</p>,
  ul: ({ children }) => <ul className="mb-5 ml-5 list-disc space-y-1.5 text-base leading-relaxed text-foreground/90">{children}</ul>,
  ol: ({ children }) => <ol className="mb-5 ml-5 list-decimal space-y-1.5 text-base leading-relaxed text-foreground/90">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-6 border-l-4 border-primary/40 bg-primary/5 py-3 pl-5 pr-4 text-base italic text-foreground/80">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a href={href} className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary" target={href?.startsWith("http") ? "_blank" : undefined} rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}>
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  code: ({ children }) => <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.875em] text-foreground">{children}</code>,
  pre: ({ children }) => <pre className="mb-5 overflow-x-auto rounded-xl bg-muted p-4 text-sm">{children}</pre>,
  hr: () => <hr className="my-8 border-border" />,
  img: ({ src, alt }) =>
    typeof src === "string" ? (
      <span className="mb-6 block overflow-hidden rounded-xl">
        <Image src={src} alt={alt ?? ""} width={1200} height={675} sizes="(min-width: 768px) 700px, 100vw" className="h-auto w-full object-cover" />
      </span>
    ) : null,
  table: ({ children }) => (
    <div className="mb-6 overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
  th: ({ children }) => <th className="border-b border-border px-4 py-2.5 font-semibold text-foreground">{children}</th>,
  td: ({ children }) => <td className="border-b border-border px-4 py-2.5 text-foreground/90 last:border-b-0">{children}</td>,
};

export function ArticleBody({ markdown }: { markdown: string }) {
  return (
    <div className="mx-auto max-w-2xl">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
