-- Insights: a public, SEO-focused editorial section, distinct from the
-- authenticated app (programs/coaching/tools) -- verified professionals
-- publish evidence-based articles that anyone, including signed-out
-- visitors and search engines, can read. This migration lays down the
-- full content model (topics, contributors, articles, article-topic
-- tags, references) with RLS that already supports the eventual
-- draft -> in_review -> changes_requested -> approved -> published
-- workflow, even though Phase 1 only ships the public reading
-- experience -- content is seeded directly via SQL (see
-- 0024_insights_seed.sql) rather than through a contributor UI, which is
-- Phase 2. The contributor editor and review workflow can be built
-- purely additively on top of this schema later.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

-- ============================================================
-- Topics -- a small, growable taxonomy. "Design this so additional
-- topics can easily be added later" means a table row, not a code
-- change -- adding a topic is one insert, no migration needed.
-- ============================================================
create table if not exists public.insights_topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Contributors -- public professional profiles, the identity the
-- section's whole trust story rests on. profile_id links to a real
-- signed-in account (nullable so a contributor row can exist before or
-- without ever needing app login, though every contributor who actually
-- publishes through Phase 2's workflow will have one).
-- ============================================================
create table if not exists public.insights_contributors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  title text not null,
  organisation text,
  qualifications text,
  bio text not null,
  photo_url text,
  expertise text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists insights_contributors_profile_id_idx on public.insights_contributors(profile_id);

-- ============================================================
-- Articles
-- ============================================================
create table if not exists public.insights_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null,
  featured_image_url text,
  -- Markdown source -- rendered client-side via react-markdown, never
  -- stored/rendered as raw HTML (see ArticleBody), so there's no
  -- injection surface even though this is public-facing content.
  body text not null,
  contributor_id uuid not null references public.insights_contributors(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'changes_requested', 'approved', 'published')),
  seo_title text,
  seo_description text,
  -- Future-ready hook for "Most Popular" filtering/sorting (spec) --
  -- starts at 0 for every seeded article; nothing increments it yet in
  -- Phase 1, but the column exists so a view-tracking feature can start
  -- writing to it later without a schema change.
  view_count int not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists insights_articles_status_published_idx on public.insights_articles(status, published_at desc);
create index if not exists insights_articles_contributor_id_idx on public.insights_articles(contributor_id);

-- Full-text search across title/excerpt/body (spec: search titles,
-- content, topics, authors) -- a generated, indexed tsvector column
-- computed once per write rather than re-scanned per query, using
-- Postgres's own search instead of standing up a separate search
-- service for a content volume this is nowhere near yet.
alter table public.insights_articles add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'C')
  ) stored;

create index if not exists insights_articles_search_idx on public.insights_articles using gin(search_vector);

-- ============================================================
-- Article <-> Topic tags (many-to-many, normalized rather than a text[]
-- column on articles, so a topic can be renamed/described in one place).
-- ============================================================
create table if not exists public.insights_article_topics (
  article_id uuid not null references public.insights_articles(id) on delete cascade,
  topic_id uuid not null references public.insights_topics(id) on delete cascade,
  primary key (article_id, topic_id)
);

create index if not exists insights_article_topics_topic_id_idx on public.insights_article_topics(topic_id);

-- ============================================================
-- References -- scientific citations per article, ordered. One row per
-- citation (not a single text blob) is what "design this so citation
-- formats can improve later" actually requires: a future formatter
-- (APA/Vancouver/etc.) can read these structured fields without a data
-- migration.
-- ============================================================
create table if not exists public.insights_references (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.insights_articles(id) on delete cascade,
  journal_title text not null,
  authors text not null,
  year int,
  url text,
  position int not null default 0
);

create index if not exists insights_references_article_id_idx on public.insights_references(article_id);

-- ============================================================
-- RLS
-- ============================================================
alter table public.insights_topics enable row level security;
alter table public.insights_contributors enable row level security;
alter table public.insights_articles enable row level security;
alter table public.insights_article_topics enable row level security;
alter table public.insights_references enable row level security;

-- Topics and contributors are always-public taxonomy/showcase data --
-- Insights explicitly needs to be readable by signed-out visitors
-- (including search engines), so neither is gated behind auth.
drop policy if exists "anyone can read topics" on public.insights_topics;
create policy "anyone can read topics"
  on public.insights_topics for select
  using (true);

drop policy if exists "anyone can read contributors" on public.insights_contributors;
create policy "anyone can read contributors"
  on public.insights_contributors for select
  using (true);

-- Published articles are public. A contributor can also read their own
-- not-yet-published articles (drafts/in-review/etc., for Phase 2's
-- editor), and admins can read everything (reuses is_admin() from
-- 0022_fix_admin_policy_recursion.sql rather than redefining the same
-- SECURITY DEFINER check).
drop policy if exists "anyone can read published articles" on public.insights_articles;
create policy "anyone can read published articles"
  on public.insights_articles for select
  using (status = 'published');

drop policy if exists "contributors can read their own articles" on public.insights_articles;
create policy "contributors can read their own articles"
  on public.insights_articles for select
  using (contributor_id in (select id from public.insights_contributors where profile_id = auth.uid()));

drop policy if exists "admins can read all articles" on public.insights_articles;
create policy "admins can read all articles"
  on public.insights_articles for select
  using (public.is_admin(auth.uid()));

-- Write access -- not exercised by any Phase 1 UI (seed data is
-- inserted directly via SQL, which runs as the table owner and bypasses
-- RLS), but defined now so Phase 2's contributor editor and admin
-- review queue are pure additive UI work with no schema/policy changes.
drop policy if exists "contributors can insert their own articles" on public.insights_articles;
create policy "contributors can insert their own articles"
  on public.insights_articles for insert
  with check (contributor_id in (select id from public.insights_contributors where profile_id = auth.uid()));

drop policy if exists "contributors can update their own articles" on public.insights_articles;
create policy "contributors can update their own articles"
  on public.insights_articles for update
  using (contributor_id in (select id from public.insights_contributors where profile_id = auth.uid()))
  with check (contributor_id in (select id from public.insights_contributors where profile_id = auth.uid()));

drop policy if exists "contributors can delete their own draft articles" on public.insights_articles;
create policy "contributors can delete their own draft articles"
  on public.insights_articles for delete
  using (
    status = 'draft'
    and contributor_id in (select id from public.insights_contributors where profile_id = auth.uid())
  );

drop policy if exists "admins can insert articles" on public.insights_articles;
create policy "admins can insert articles"
  on public.insights_articles for insert
  with check (public.is_admin(auth.uid()));

drop policy if exists "admins can update all articles" on public.insights_articles;
create policy "admins can update all articles"
  on public.insights_articles for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "admins can delete any article" on public.insights_articles;
create policy "admins can delete any article"
  on public.insights_articles for delete
  using (public.is_admin(auth.uid()));

-- Tags/references follow their parent article's visibility -- readable
-- whenever the article itself is (published, owned by the reader, or
-- the reader is an admin), writable by the same contributor/admin rule.
drop policy if exists "article topics follow article visibility" on public.insights_article_topics;
create policy "article topics follow article visibility"
  on public.insights_article_topics for select
  using (exists (
    select 1 from public.insights_articles a
    where a.id = article_id
      and (
        a.status = 'published'
        or a.contributor_id in (select id from public.insights_contributors where profile_id = auth.uid())
        or public.is_admin(auth.uid())
      )
  ));

drop policy if exists "contributors can manage their article topics" on public.insights_article_topics;
create policy "contributors can manage their article topics"
  on public.insights_article_topics for all
  using (exists (
    select 1 from public.insights_articles a
    where a.id = article_id
      and (
        a.contributor_id in (select id from public.insights_contributors where profile_id = auth.uid())
        or public.is_admin(auth.uid())
      )
  ));

drop policy if exists "references follow article visibility" on public.insights_references;
create policy "references follow article visibility"
  on public.insights_references for select
  using (exists (
    select 1 from public.insights_articles a
    where a.id = article_id
      and (
        a.status = 'published'
        or a.contributor_id in (select id from public.insights_contributors where profile_id = auth.uid())
        or public.is_admin(auth.uid())
      )
  ));

drop policy if exists "contributors can manage their references" on public.insights_references;
create policy "contributors can manage their references"
  on public.insights_references for all
  using (exists (
    select 1 from public.insights_articles a
    where a.id = article_id
      and (
        a.contributor_id in (select id from public.insights_contributors where profile_id = auth.uid())
        or public.is_admin(auth.uid())
      )
  ));
