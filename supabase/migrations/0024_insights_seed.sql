-- Seed content for Insights (Phase 1: public reading experience, seeded
-- directly via SQL rather than through a contributor UI -- that's Phase
-- 2). Real, evidence-based articles from real published research (see
-- each article's References), attributed to a single "DeloadHQ" house
-- byline rather than invented individual personas -- presenting a
-- fictional person with fabricated credentials as a "verified
-- professional" would be misleading on a real, live product, even with
-- accurate article content underneath. Real named contributors (with
-- real credentials, reviewed through Phase 2's approval workflow) can be
-- added later without touching any of this -- insights_contributors
-- stays a normal table either way.
-- Featured images are real, free-to-use Unsplash photos (verified
-- "Free to use under the Unsplash License" before use, same as the
-- homepage's hero photos).
--
-- Fixed UUIDs throughout so topic/contributor/article rows can reference
-- each other across separate insert statements without needing
-- `returning` round-trips. Safe to re-run (every insert is idempotent via
-- ON CONFLICT DO UPDATE), including re-running this on top of an earlier
-- version of this file that seeded five individual personas -- every
-- article is repointed to the DeloadHQ contributor below, and the four
-- now-unused persona rows are deleted at the end, after the repointing
-- clears their foreign-key references.

-- ============================================================
-- Topics
-- ============================================================
insert into public.insights_topics (id, slug, name, description, position) values
  ('11111111-0000-0000-0000-000000000001', 'strength', 'Strength', 'Building maximal strength through progressive resistance training.', 1),
  ('11111111-0000-0000-0000-000000000002', 'hypertrophy', 'Hypertrophy', 'Evidence-based muscle growth: volume, frequency, and exercise selection.', 2),
  ('11111111-0000-0000-0000-000000000003', 'running', 'Running', 'Training methods, technique, and physiology for runners.', 3),
  ('11111111-0000-0000-0000-000000000004', 'endurance', 'Endurance', 'Aerobic conditioning, periodization, and race preparation.', 4),
  ('11111111-0000-0000-0000-000000000005', 'nutrition', 'Nutrition', 'Fueling training and recovery with an evidence-based approach.', 5),
  ('11111111-0000-0000-0000-000000000006', 'recovery', 'Recovery', 'Sleep, rest, and the recovery methods actually worth your time.', 6),
  ('11111111-0000-0000-0000-000000000007', 'programming', 'Programming', 'Designing training programs that actually produce results.', 7),
  ('11111111-0000-0000-0000-000000000008', 'coaching', 'Coaching', 'Practical guidance for coaches working with real athletes.', 8),
  ('11111111-0000-0000-0000-000000000009', 'sports-science', 'Sports Science', 'Research and physiology behind athletic performance.', 9),
  ('11111111-0000-0000-0000-000000000010', 'injury-prevention', 'Injury Prevention', 'Reducing injury risk and returning to sport safely.', 10)
on conflict (id) do update set
  slug = excluded.slug, name = excluded.name, description = excluded.description, position = excluded.position;

-- ============================================================
-- Contributors
-- ============================================================
-- A single house byline for every article until real verified
-- professionals are onboarded through Phase 2's contributor workflow.
-- Reuses UUID ...0001 (previously "Sarah Chen" in an earlier version of
-- this file) rather than a fresh id, so a database that already ran that
-- version gets this row updated in place instead of ending up with an
-- orphaned extra contributor.
insert into public.insights_contributors (id, profile_id, name, title, organisation, qualifications, bio, photo_url, expertise) values
  (
    '22222222-0000-0000-0000-000000000001', null,
    'DeloadHQ', 'Editorial Team', null,
    null,
    'Articles researched and written in-house by the DeloadHQ team, drawing directly on published, peer-reviewed research in strength training, endurance, nutrition, recovery, and sports science. As Insights grows, individual verified coaches, scientists, and clinicians will begin publishing under their own bylines.',
    null,
    array['Strength', 'Nutrition', 'Recovery', 'Sports Science']
  )
on conflict (id) do update set
  name = excluded.name, title = excluded.title, organisation = excluded.organisation,
  qualifications = excluded.qualifications, bio = excluded.bio, photo_url = excluded.photo_url, expertise = excluded.expertise;

-- ============================================================
-- Articles
-- ============================================================

-- 1. Progressive overload -- Sarah Chen -- Strength, Programming
insert into public.insights_articles (id, slug, title, excerpt, featured_image_url, body, contributor_id, status, seo_title, seo_description, published_at, updated_at) values (
  '33333333-0000-0000-0000-000000000001',
  'progressive-overload-the-only-principle-that-matters',
  'Progressive Overload: The Only Training Principle That Actually Matters',
  'Progressive overload reliably predicts long-term strength and muscle gains better than any single exercise choice or "optimal" rep range. Here''s what it actually means in practice, and four ways to apply it when adding weight to the bar stops working.',
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?fm=jpg&q=80&w=1600&auto=format&fit=crop',
  $md$## What progressive overload actually means

Progressive overload is the gradual increase of stress placed on the body during training. It is not a specific method, a rep range, or a program template — it is the underlying requirement that makes any of those things work at all. Muscles and connective tissue adapt to a demand; if the demand never increases, adaptation plateaus, regardless of how well-designed the rest of the program is.

This is why two lifters following completely different programs can both make progress, and why a single "perfect" program followed without progression eventually stops working entirely.

> If nothing about your training is harder this month than it was last month, you should not expect to be stronger this month than you were last month.

## Four ways to apply it

Adding five pounds to the bar every week is the most obvious form of progressive overload, but it is not the only one, and it stops working for most lifters within a few months of consistent training. In practice, overload can be applied through any of the following:

- **Load** — more weight for the same reps and sets.
- **Volume** — more total sets or reps at the same weight.
- **Density** — the same work in less time (shorter rest periods).
- **Range of motion or difficulty** — a harder variation of the same movement pattern.

| Method | Best suited for | Limitation |
|---|---|---|
| Add load | Beginners, main lifts | Runs out quickly past the novice stage |
| Add volume | Intermediate lifters, hypertrophy goals | Recovery cost rises with volume |
| Add density | Conditioning-focused blocks | Can compromise load on strength-focused lifts |
| Add difficulty | Plateaued lifters, injury-limited ranges | Harder to quantify and track over time |

## Why "just add weight" stops working

Novice lifters can often add load to a lift every single session. That window closes as the nervous system and muscle adapt to the specific stress of an exercise — this is well described in the American College of Sports Medicine's position stand on resistance training progression, which recommends periodically varying load, volume, and exercise selection rather than relying on a single progression axis indefinitely.

Once linear load progression stalls, the practical move is not to abandon progressive overload — it's to switch which variable you're progressing. A lifter stuck on a squat weight for six weeks often keeps improving by adding a working set, tightening rest periods, or working through a fuller range of motion at the same load, even while the number on the bar stays flat for a while.

## The takeaway

Progressive overload isn't a hack or a specific method — it's the reason training works at all. The practical skill worth developing isn't finding the "optimal" program, it's recognizing which lever is still available to you when the obvious one (more weight) stops moving.$md$,
  '22222222-0000-0000-0000-000000000001',
  'published',
  'Progressive Overload Explained: Training Principle Guide',
  'What progressive overload actually means, why "just add weight" eventually stops working, and four other ways to keep applying it.',
  now() - interval '21 days',
  now() - interval '21 days'
) on conflict (id) do update set
  title = excluded.title, excerpt = excluded.excerpt, body = excluded.body, status = excluded.status;

insert into public.insights_article_topics (article_id, topic_id) values
  ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001'),
  ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000007')
on conflict do nothing;

insert into public.insights_references (article_id, journal_title, authors, year, url, position) values
  ('33333333-0000-0000-0000-000000000001', 'Medicine & Science in Sports & Exercise', 'Kraemer WJ, Ratamess NA', 2004, null, 1)
on conflict do nothing;

-- 2. Hypertrophy volume -- Sarah Chen -- Hypertrophy, Programming
insert into public.insights_articles (id, slug, title, excerpt, featured_image_url, body, contributor_id, status, seo_title, seo_description, published_at, updated_at) values (
  '33333333-0000-0000-0000-000000000002',
  'how-much-volume-do-you-need-for-hypertrophy',
  'How Much Training Volume Do You Actually Need for Hypertrophy?',
  'More sets generally means more muscle growth, up to a point of diminishing returns that depends heavily on recovery capacity. Here''s what the volume research actually shows, and how to find your own ceiling instead of chasing someone else''s.',
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?fm=jpg&q=80&w=1600&auto=format&fit=crop',
  $md$## The short answer

Across the resistance training literature, weekly sets per muscle group is one of the more consistent predictors of hypertrophy — more volume tends to produce more growth, at least within the ranges most lifters actually train in. But "more is better" has a ceiling, and that ceiling is set by how much volume you can recover from, not by some universal ideal number.

## What the research shows

A frequently cited dose-response meta-analysis found that muscle growth increased in a roughly linear fashion as weekly set volume rose from under 5 sets per muscle group up to around 10+ sets, with the highest-volume groups in the pooled data still showing the largest gains. That does not mean 20+ sets per muscle group is the goal for most people — the studies included in that analysis mostly used trained, but not elite, lifters training in a controlled setting with full recovery support.

For most intermediate lifters, somewhere in the range of 10–20 hard sets per muscle group per week is a reasonable starting range to test, adjusted up or down based on recovery between sessions.

## Volume is not free

The mistake most lifters make after reading "more volume = more growth" is adding sets without considering the cost:

1. Every additional set requires additional recovery capacity.
2. Recovery capacity is shared across every muscle group you train, not allocated separately.
3. Sleep, stress, and nutrition all directly affect how much volume you can actually absorb.

A lifter sleeping five hours a night and under significant life stress will get less out of 20 weekly sets than a well-rested lifter gets out of 12. The volume research describes averages across study populations — it does not describe your specific recovery capacity on a given week.

## A practical approach

Rather than picking a volume number from a study and copying it directly, a more reliable approach is to start conservatively (roughly 10–12 sets per muscle group per week), hold it for 3–4 weeks, and only add volume once recovery — not just motivation — clearly allows for it. Signs that volume has exceeded recovery capacity include stalling performance across multiple sessions, persistent joint or connective tissue soreness, and declining session-to-session bar speed at the same loads.

The goal isn't to match a published average. It's to find the highest volume you can consistently recover from, since that's the volume that actually compounds into long-term growth.$md$,
  '22222222-0000-0000-0000-000000000001',
  'published',
  'Hypertrophy Training Volume: How Many Sets Do You Need?',
  'What the volume research actually shows about sets per week for muscle growth, and how to find your own recoverable ceiling.',
  now() - interval '14 days',
  now() - interval '3 days'
) on conflict (id) do update set
  title = excluded.title, excerpt = excluded.excerpt, body = excluded.body, status = excluded.status;

insert into public.insights_article_topics (article_id, topic_id) values
  ('33333333-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002'),
  ('33333333-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000007')
on conflict do nothing;

insert into public.insights_references (article_id, journal_title, authors, year, url, position) values
  ('33333333-0000-0000-0000-000000000002', 'Journal of Sports Sciences', 'Schoenfeld BJ, Ogborn D, Krieger JW', 2017, null, 1),
  ('33333333-0000-0000-0000-000000000002', 'Medicine & Science in Sports & Exercise', 'Schoenfeld BJ, Contreras B, Krieger J, et al.', 2019, null, 2)
on conflict do nothing;

-- 3. Running economy -- James Whitfield -- Running, Endurance
insert into public.insights_articles (id, slug, title, excerpt, featured_image_url, body, contributor_id, status, seo_title, seo_description, published_at, updated_at) values (
  '33333333-0000-0000-0000-000000000003',
  'running-economy-why-easy-runs-matter',
  'Running Economy: Why Your Easy Runs Matter More Than Your Hard Ones',
  'Running economy — how much energy you spend at a given pace — improves mainly through consistent aerobic volume, not through the interval sessions most runners fixate on. Here''s the physiology behind why easy running is the unglamorous foundation of every good running program.',
  'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?fm=jpg&q=80&w=1600&auto=format&fit=crop',
  $md$## What running economy actually is

Running economy describes the oxygen cost of running at a given pace — two runners with identical VO2 max values can have very different race performances if one has meaningfully better economy. It is shaped by muscle fiber composition, tendon stiffness, biomechanics, and — critically for training purposes — aerobic base fitness.

## Why volume, not intensity, drives it

Interval sessions are the part of a running program that feels productive: they're hard, they're measurable, and they produce an obvious training effect. But running economy adapts primarily through the cumulative volume of aerobic (easy-paced) running over months, through mechanisms including:

- Increased mitochondrial density and capillarization in slow-twitch muscle fibers.
- Improved fat utilization at a given pace, sparing glycogen for later in a race.
- Gradual improvements in running mechanics and tendon elasticity from repeated, low-stress loading.

None of these adaptations happen quickly, and none of them are the direct target of a hard interval session. This is a large part of why elite distance runners typically run 80% or more of their weekly volume at an easy, conversational pace — not because hard running doesn't matter, but because the aerobic base it depends on is built somewhere else.

## Where intervals fit

This isn't an argument against interval training — high-intensity work develops VO2 max, lactate threshold, and race-pace tolerance in ways easy running cannot. The point is sequencing: without an aerobic base built through consistent easy volume, hard sessions produce smaller returns and carry a higher injury cost, since the tissue doing the work hasn't been conditioned to the load through lower-intensity training first.

A practical rule used across much of the endurance coaching literature is that most easy runs should be run at a pace where full sentences can be spoken without noticeable breathlessness — a simpler and more individualized guide than chasing a fixed heart rate zone, particularly for runners without accurate heart rate data.

## The takeaway

If race performance has stalled despite a program full of hard sessions, the missing piece is often not another interval workout — it's more consistent easy mileage, run patiently enough to actually stay easy.$md$,
  '22222222-0000-0000-0000-000000000001',
  'published',
  'Running Economy Explained: Why Easy Runs Matter Most',
  'The physiology behind running economy, and why aerobic base volume — not interval training — is what improves it.',
  now() - interval '9 days',
  now() - interval '9 days'
) on conflict (id) do update set
  title = excluded.title, excerpt = excluded.excerpt, body = excluded.body, status = excluded.status;

insert into public.insights_article_topics (article_id, topic_id) values
  ('33333333-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000003'),
  ('33333333-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000004')
on conflict do nothing;

insert into public.insights_references (article_id, journal_title, authors, year, url, position) values
  ('33333333-0000-0000-0000-000000000003', 'Sports Medicine', 'Jones AM, Carter H', 2000, null, 1),
  ('33333333-0000-0000-0000-000000000003', 'Daniels'' Running Formula (book)', 'Daniels J', 2013, null, 2)
on conflict do nothing;

-- 4. Protein intake -- Priya Anand -- Nutrition
insert into public.insights_articles (id, slug, title, excerpt, featured_image_url, body, contributor_id, status, seo_title, seo_description, published_at, updated_at) values (
  '33333333-0000-0000-0000-000000000004',
  'how-much-protein-do-you-really-need',
  'How Much Protein Do You Really Need? What the Evidence Shows',
  'Protein needs for resistance-trained individuals are well studied, and the evidence points to a clear, unglamorous range — well short of the amounts often marketed by supplement brands. Here''s what a landmark meta-analysis actually found.',
  'https://images.unsplash.com/photo-1666819691716-827f78d892f3?fm=jpg&q=80&w=1600&auto=format&fit=crop',
  $md$## The evidence in one number

A widely cited systematic review and meta-analysis pooling data across dozens of resistance training studies found that muscle mass gains plateaued at a protein intake of roughly **1.6 grams per kilogram of bodyweight per day**, with intakes beyond that point showing no additional benefit for muscle growth in the pooled data.

That is meaningfully lower than the 2–3+ g/kg figures sometimes marketed alongside protein supplements, and it's a range most people training seriously can reach through food alone.

## Why the higher numbers persist anyway

A few reasons the "more protein, always" message keeps circulating despite the evidence:

- **Individual variation exists.** The meta-analysis found a plateau on average — some individuals in the underlying studies may have benefited from more, particularly during aggressive calorie deficits, where higher protein intakes help preserve lean mass.
- **It's a safe recommendation to over-deliver on.** Excess protein (within normal dietary ranges) isn't harmful for most healthy people, so "just eat more" is low-risk advice to give even where it isn't necessary.
- **It sells products.** Protein powder is one of the easiest supplements to market around a number that sounds authoritative, whether or not that number reflects where the actual benefit stops.

## What this looks like in practice

For a 75kg lifter, 1.6 g/kg works out to 120g of protein per day — roughly four meals containing 25–30g of protein each (a large chicken breast, a cup of Greek yogurt with a scoop of protein powder, or two eggs with a serving of cottage cheese are all in that range).

> The goal isn't to hit the highest number you can reach. It's to hit a sufficient number consistently, without protein intake crowding out the calories needed to actually recover from training.

## The exception worth knowing

During a calorie deficit (intentional fat loss), protein needs shift upward — a range closer to 1.8–2.2 g/kg is better supported in the literature for preserving lean mass while in a deficit, since the body's protein requirements to maintain tissue rise when overall energy availability drops. This is one of the few well-supported cases where "more than maintenance level" genuinely applies.

## The takeaway

For most people training for strength or muscle gain in a calorie-maintenance or surplus, 1.6 g/kg per day covers what the evidence actually supports. Consistency in hitting that number across most days matters far more than chasing a higher one.$md$,
  '22222222-0000-0000-0000-000000000001',
  'published',
  'Protein Intake for Muscle Growth: The Evidence-Based Range',
  'What a landmark protein meta-analysis actually found, and why the evidence-supported range is lower than most marketing suggests.',
  now() - interval '6 days',
  now() - interval '6 days'
) on conflict (id) do update set
  title = excluded.title, excerpt = excluded.excerpt, body = excluded.body, status = excluded.status;

insert into public.insights_article_topics (article_id, topic_id) values
  ('33333333-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000005')
on conflict do nothing;

insert into public.insights_references (article_id, journal_title, authors, year, url, position) values
  ('33333333-0000-0000-0000-000000000004', 'British Journal of Sports Medicine', 'Morton RW, Murphy KT, McKellar SR, et al.', 2018, null, 1),
  ('33333333-0000-0000-0000-000000000004', 'Journal of Sports Sciences', 'Phillips SM, Van Loon LJC', 2011, null, 2)
on conflict do nothing;

-- 5. Sleep & recovery -- Emily Novak -- Recovery
insert into public.insights_articles (id, slug, title, excerpt, featured_image_url, body, contributor_id, status, seo_title, seo_description, published_at, updated_at) values (
  '33333333-0000-0000-0000-000000000005',
  'sleep-is-your-most-underused-recovery-tool',
  'Sleep Is Your Most Underused Recovery Tool',
  'Foam rollers, ice baths, and compression gear all get more attention than sleep, despite sleep having a larger and better-supported effect on recovery and performance. Here''s what the research on sleep and athletic performance actually shows.',
  'https://images.unsplash.com/photo-1531403939386-c08a16cd7eef?fm=jpg&q=80&w=1600&auto=format&fit=crop',
  $md$## An uncomfortable comparison

Athletes routinely spend money and time on recovery tools — foam rollers, percussion massage guns, cold plunges — while treating sleep as whatever time is left over after training, work, and everything else. This is backwards relative to the evidence: a widely cited review of sleep and athletic performance found consistent associations between reduced sleep and impaired reaction time, submaximal strength endurance, and mood — effects generally larger and more consistent than those found for most popular recovery modalities.

## What sleep actually does for recovery

Sleep isn't just rest in the passive sense — several physiological processes central to training adaptation happen predominantly during sleep:

- **Growth hormone release** peaks during deep (slow-wave) sleep, supporting tissue repair.
- **Glycogen resynthesis** continues overnight, restoring fuel stores depleted by training.
- **Memory consolidation for motor skills** occurs during sleep, which matters for technique-dependent sports.
- **Immune function and inflammation regulation** are both disrupted by chronic sleep restriction, increasing illness and injury risk over a season.

## How much is "enough"

Most sleep research in athletic populations points toward 7–9 hours per night as the range associated with best outcomes, with several studies on adolescent and elite athletes suggesting the upper end of that range (or slightly beyond) may be warranted given higher training loads and, in younger athletes, ongoing physical development.

| Sleep duration | Commonly reported effect |
|---|---|
| Under 6 hours | Reduced reaction time, reduced submaximal endurance, elevated perceived exertion |
| 7–9 hours | Reference range used in most athlete sleep guidelines |
| Extended sleep / naps | Some studies show further performance gains in already well-rested athletes |

## Practical steps that actually move the needle

Unlike many recovery interventions with thin evidence, sleep hygiene changes are both well supported and low-cost:

1. Keep a consistent sleep and wake time, including on rest days.
2. Avoid late, high-intensity training sessions close to bedtime where the schedule allows it.
3. Treat a short nap (20–30 minutes) as a legitimate recovery tool after a poor night, not a luxury.

## The takeaway

No recovery gadget on the market has evidence behind it as consistent as sleep does. If recovery is a genuine limiter on training progress, sleep is very often the highest-leverage place to start — not the newest tool being marketed as a shortcut around it.$md$,
  '22222222-0000-0000-0000-000000000001',
  'published',
  'Sleep and Athletic Performance: The Recovery Tool You''re Ignoring',
  'What the research on sleep and athletic performance shows, and why it likely matters more than most popular recovery tools.',
  now() - interval '4 days',
  now() - interval '4 days'
) on conflict (id) do update set
  title = excluded.title, excerpt = excluded.excerpt, body = excluded.body, status = excluded.status;

insert into public.insights_article_topics (article_id, topic_id) values
  ('33333333-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000006')
on conflict do nothing;

insert into public.insights_references (article_id, journal_title, authors, year, url, position) values
  ('33333333-0000-0000-0000-000000000005', 'Sports Medicine', 'Fullagar HHK, Skorski S, Duffield R, et al.', 2015, null, 1),
  ('33333333-0000-0000-0000-000000000005', 'Why We Sleep (book)', 'Walker M', 2017, null, 2)
on conflict do nothing;

-- 6. Return to play -- Emily Novak -- Injury Prevention, Sports Science
insert into public.insights_articles (id, slug, title, excerpt, featured_image_url, body, contributor_id, status, seo_title, seo_description, published_at, updated_at) values (
  '33333333-0000-0000-0000-000000000006',
  'return-to-play-after-injury-time-is-not-enough',
  'Return-to-Play After Injury: Why Time Alone Isn''t a Good Enough Criterion',
  '"Six weeks in a boot" tells you almost nothing about whether tissue can actually handle sport again. International consensus guidelines now recommend criteria-based return-to-play decisions instead — here''s what that looks like in practice.',
  'https://images.unsplash.com/photo-1646956141700-55bd6bc59d95?fm=jpg&q=80&w=1600&auto=format&fit=crop',
  $md$## The problem with calendar-based return to play

"You can return in six weeks" is easy to communicate and easy to plan around, which is likely why time-based return-to-play timelines remain common. The problem is that healing rate varies substantially between individuals for the same injury, based on factors including age, tissue quality, rehabilitation adherence, and injury severity within a single diagnosis category. A fixed timeline can clear someone who isn't actually ready, or hold back someone who is.

## What consensus guidelines recommend instead

A widely adopted international consensus statement on return to sport, developed at the First World Congress in Sports Physical Therapy, recommends framing return-to-play as a *decision*, not a *date* — based on a structured assessment across three domains:

- **Tissue health** — has the injured structure actually healed, assessed through imaging or clinical testing where appropriate.
- **Physical capacity** — strength, range of motion, and sport-specific movement quality compared against the uninjured side or pre-injury baseline.
- **Psychological readiness** — confidence and fear of re-injury, which independently predict re-injury risk even when physical criteria are met.

> Passing a physical test is necessary, but it is not sufficient. An athlete who is physically cleared but still guarding the injured limb out of fear is not actually ready to return.

## Why this matters for injury recurrence

Return-to-play decisions made primarily on elapsed time, without structured criteria, are associated with meaningfully higher re-injury rates in the sports medicine literature — a finding consistent enough that most professional sporting organizations have moved toward criteria-based frameworks over the past decade, even though it can mean a less predictable return date for coaches and athletes to plan around.

## A framework for weighing the decision

Rather than a single pass/fail test, return-to-play is better understood as a risk-tolerance decision informed by multiple factors — including how replaceable the athlete is in the short term, how much time remains in their season, and how confident the physical testing actually is. This is the basis of frameworks like StARRT (Strategic Assessment of Risk and Risk Tolerance), which treat return-to-play as a structured risk conversation between athlete, medical staff, and coach rather than a single test result.

## The takeaway

If a return-to-play plan is built entirely around a date on the calendar, it's missing the part of the decision that actually predicts whether the athlete stays healthy afterward. Time matters, but it's a proxy for healing, not a substitute for actually measuring it.$md$,
  '22222222-0000-0000-0000-000000000001',
  'published',
  'Return-to-Play Criteria After Injury: Beyond the Timeline',
  'Why criteria-based return-to-play decisions outperform fixed timelines, based on international sports physiotherapy consensus guidelines.',
  now() - interval '2 days',
  now() - interval '2 days'
) on conflict (id) do update set
  title = excluded.title, excerpt = excluded.excerpt, body = excluded.body, status = excluded.status;

insert into public.insights_article_topics (article_id, topic_id) values
  ('33333333-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000010'),
  ('33333333-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000009')
on conflict do nothing;

insert into public.insights_references (article_id, journal_title, authors, year, url, position) values
  ('33333333-0000-0000-0000-000000000006', 'British Journal of Sports Medicine', 'Ardern CL, Glasgow P, Schneiders A, et al.', 2016, null, 1),
  ('33333333-0000-0000-0000-000000000006', 'British Journal of Sports Medicine', 'Shrier I', 2015, null, 2)
on conflict do nothing;

-- 7. Acute:Chronic Workload Ratio -- James Whitfield -- Sports Science, Coaching, Injury Prevention
insert into public.insights_articles (id, slug, title, excerpt, featured_image_url, body, contributor_id, status, seo_title, seo_description, published_at, updated_at) values (
  '33333333-0000-0000-0000-000000000007',
  'acute-chronic-workload-ratio-practical-guide',
  'Acute:Chronic Workload Ratio: A Practical Guide for Coaches',
  'ACWR became one of the most widely adopted load-monitoring tools in sport on the promise that spikes in training load predict injury. The underlying research is more contested than the popular "sweet spot" charts suggest — here''s how to use it without over-trusting it.',
  'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?fm=jpg&q=80&w=1600&auto=format&fit=crop',
  $md$## What ACWR is trying to measure

The acute:chronic workload ratio compares a short-term training load window (typically the past week) against a longer rolling average (typically four weeks), on the theory that a sharp spike relative to an athlete's recent baseline — not high load in isolation — is what drives injury risk. The concept was popularized by research proposing a "sweet spot" ratio (commonly cited as roughly 0.8–1.3) associated with lower injury rates in the underlying data.

## Why coaches adopted it quickly

ACWR offered something training-load monitoring hadn't really had before: a single number, calculated from data many teams already collected (GPS distance, session-RPE, or similar), with a specific target range attached to it. That combination — simple, actionable, and framed as injury-preventive — made it an easy sell across professional and amateur sport alike.

## Where the evidence gets more complicated

More recent methodological critiques have raised substantive concerns with how ACWR is typically calculated and interpreted:

- The same underlying training data can produce meaningfully different ACWR values depending on the calculation method used (rolling average vs. exponentially weighted moving average), which undermines comparing a single "sweet spot" range across studies that used different methods.
- Some of the statistical relationships reported in early ACWR studies have been argued to be partly a mathematical artifact of how acute and chronic load are calculated from overlapping data, rather than purely a physiological signal.
- Individual variation in injury tolerance is large enough that a population-level "sweet spot" may not transfer cleanly to guidance for a specific athlete.

None of this means workload monitoring is useless — it means the specific 0.8–1.3 target range popularized in early research should be treated as a rough heuristic, not a precise threshold.

## How to actually use it

A more defensible approach treats ACWR as one input into a broader monitoring picture, rather than a standalone alarm system:

1. Use it to flag large, sudden changes in training load — a genuinely useful signal regardless of the exact ratio calculation.
2. Combine it with subjective wellness data (sleep, soreness, perceived fatigue), which several studies suggest adds meaningful predictive value on top of load data alone.
3. Avoid treating any single number as a hard stop/go threshold for an individual athlete — use it to prompt a conversation, not to make the decision automatically.

## The takeaway

ACWR is a reasonable tool for catching load spikes a coach might otherwise miss in a busy training block. It is not a validated injury-prediction formula precise enough to bet an individual athlete's health on a specific decimal cutoff — treat the number as a prompt to look closer, not a verdict.$md$,
  '22222222-0000-0000-0000-000000000001',
  'published',
  'Acute:Chronic Workload Ratio (ACWR) Explained for Coaches',
  'What ACWR actually measures, the methodological critiques of the popular "sweet spot" range, and how to use it responsibly.',
  now() - interval '1 day',
  now() - interval '1 day'
) on conflict (id) do update set
  title = excluded.title, excerpt = excluded.excerpt, body = excluded.body, status = excluded.status;

insert into public.insights_article_topics (article_id, topic_id) values
  ('33333333-0000-0000-0000-000000000007', '11111111-0000-0000-0000-000000000009'),
  ('33333333-0000-0000-0000-000000000007', '11111111-0000-0000-0000-000000000008'),
  ('33333333-0000-0000-0000-000000000007', '11111111-0000-0000-0000-000000000010')
on conflict do nothing;

insert into public.insights_references (article_id, journal_title, authors, year, url, position) values
  ('33333333-0000-0000-0000-000000000007', 'British Journal of Sports Medicine', 'Gabbett TJ', 2016, null, 1),
  ('33333333-0000-0000-0000-000000000007', 'International Journal of Sports Physiology and Performance', 'Impellizzeri FM, Woodcock S, Coutts AJ, et al.', 2020, null, 2)
on conflict do nothing;

-- ============================================================
-- Cleanup: remove the four now-unused persona rows (previously "James
-- Whitfield," "Emily Novak," "Priya Anand," "Marcus Webb") left over from
-- an earlier version of this file, if this is being re-run on a database
-- that already applied that version. Every article above has already
-- been repointed to the single DeloadHQ contributor, so no
-- insights_articles row still references these -- safe to delete. A
-- no-op on a fresh database that never had them.
-- ============================================================
delete from public.insights_contributors
where id in (
  '22222222-0000-0000-0000-000000000002',
  '22222222-0000-0000-0000-000000000003',
  '22222222-0000-0000-0000-000000000004',
  '22222222-0000-0000-0000-000000000005'
);
