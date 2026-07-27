-- Insights: a Storage bucket for contributor-uploaded featured images —
-- until now every image in Insights was a hotlinked external URL (the
-- seeded articles' Unsplash photos); the article editor needs contributors
-- to actually upload a file instead of pasting a URL. Public read (article
-- images are shown on public pages), write restricted to approved
-- contributors (mirrors insights_articles' own write policies from
-- 0025), with an admin override for moderation.
--
-- Run this once in the Supabase SQL Editor, after 0025. Safe to re-run.

insert into storage.buckets (id, name, public)
values ('insights-images', 'insights-images', true)
on conflict (id) do nothing;

drop policy if exists "anyone can read insights images" on storage.objects;
create policy "anyone can read insights images"
  on storage.objects for select
  using (bucket_id = 'insights-images');

-- Same "approved" gate insights_articles' own write policies use — a
-- pending applicant can't upload images any more than they can write
-- articles.
drop policy if exists "approved contributors can upload insights images" on storage.objects;
create policy "approved contributors can upload insights images"
  on storage.objects for insert
  with check (
    bucket_id = 'insights-images'
    and exists (
      select 1 from public.insights_contributors
      where profile_id = auth.uid() and status = 'approved'
    )
  );

-- `owner` is set automatically by Supabase Storage to the uploading
-- user's id -- scoping update/delete to it means a contributor can
-- replace/remove their own uploads without needing a fresh
-- insights_contributors lookup on every call.
drop policy if exists "owners can update their own insights images" on storage.objects;
create policy "owners can update their own insights images"
  on storage.objects for update
  using (bucket_id = 'insights-images' and owner = auth.uid())
  with check (bucket_id = 'insights-images' and owner = auth.uid());

drop policy if exists "owners can delete their own insights images" on storage.objects;
create policy "owners can delete their own insights images"
  on storage.objects for delete
  using (bucket_id = 'insights-images' and owner = auth.uid());

drop policy if exists "admins can manage all insights images" on storage.objects;
create policy "admins can manage all insights images"
  on storage.objects for all
  using (bucket_id = 'insights-images' and public.is_admin(auth.uid()))
  with check (bucket_id = 'insights-images' and public.is_admin(auth.uid()));
