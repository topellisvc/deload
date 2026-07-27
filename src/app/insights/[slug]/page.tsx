import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getArticleBySlug, getRelatedArticles } from "@/lib/insights/queries";
import { ArticleBody } from "@/components/insights/article-body";
import { ArticleReferences } from "@/components/insights/article-references";
import { RelatedContent } from "@/components/insights/related-content";
import { ContributorAvatar } from "@/components/insights/contributor-avatar";
import { TopicBadge } from "@/components/insights/topic-badge";
import { formatArticleDate, wasUpdatedAfterPublishing } from "@/lib/insights/format-date";

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const article = await getArticleBySlug(supabase, slug);
  if (!article) return { title: "Article not found" };

  const title = article.seoTitle || article.title;
  const description = article.seoDescription || article.excerpt;

  return {
    title,
    description,
    alternates: {
      canonical: `/insights/${article.slug}`,
    },
    openGraph: {
      type: "article",
      title: `${title} | Deload`,
      description,
      url: `/insights/${article.slug}`,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: [article.contributor.name],
      ...(article.featuredImageUrl ? { images: [{ url: article.featuredImageUrl }] } : {}),
    },
  };
}

/**
 * A single published article — title/hero image/author/dates/reading
 * time/tags, the Markdown body, references, and related content, per the
 * spec's "Article Page" section. `notFound()` (rather than a redirect or
 * an error message) covers both a genuinely missing slug and a
 * draft/unpublished one, since getArticleBySlug only ever returns
 * `published` rows (Phase 1 has no reviewer UI to preview a draft's page
 * through anyway) — from a visitor's perspective those two cases should
 * look identical.
 */
export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const article = await getArticleBySlug(supabase, slug);
  if (!article) notFound();

  const related = await getRelatedArticles(supabase, article);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt,
    image: article.featuredImageUrl ?? undefined,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: {
      "@type": "Person",
      name: article.contributor.name,
      jobTitle: article.contributor.title,
    },
    publisher: {
      "@type": "Organization",
      name: "Deload",
      logo: { "@type": "ImageObject", url: "https://deloadhq.com/icon" },
    },
    mainEntityOfPage: `https://deloadhq.com/insights/${article.slug}`,
  };

  const showUpdated = wasUpdatedAfterPublishing(article.publishedAt, article.updatedAt);

  return (
    <article className="px-6 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />

      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        {article.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {article.topics.map((topic) => (
              <TopicBadge key={topic.id} topic={topic} />
            ))}
          </div>
        )}

        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{article.title}</h1>
        <p className="text-lg text-muted-foreground">{article.excerpt}</p>

        <div className="flex items-center gap-3 border-y border-border py-4">
          <Link href={`/insights/contributors/${article.contributor.id}`} className="shrink-0">
            <ContributorAvatar name={article.contributor.name} photoUrl={article.contributor.photoUrl} />
          </Link>
          <div className="flex min-w-0 flex-col">
            <Link href={`/insights/contributors/${article.contributor.id}`} className="truncate text-sm font-semibold text-foreground hover:text-primary">
              {article.contributor.name}
            </Link>
            <span className="text-xs text-muted-foreground">{article.contributor.title}</span>
          </div>
          <div className="ml-auto flex flex-col items-end gap-0.5 text-right text-xs text-muted-foreground">
            <span>
              Published {formatArticleDate(article.publishedAt)}
              {showUpdated && <> · Updated {formatArticleDate(article.updatedAt)}</>}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {article.readingTimeMinutes} min read
            </span>
          </div>
        </div>
      </div>

      {article.featuredImageUrl && (
        <div className="relative mx-auto my-8 aspect-[16/9] max-w-3xl overflow-hidden rounded-2xl">
          <Image src={article.featuredImageUrl} alt="" fill sizes="(min-width: 768px) 768px, 100vw" className="object-cover" priority />
        </div>
      )}

      <ArticleBody markdown={article.body} />
      <ArticleReferences references={article.references} />
      <RelatedContent articles={related} />
    </article>
  );
}
