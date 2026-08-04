-- Extends notifications.type to include 'meal_plan_assigned' — the
-- Nutrition feature's counterpart to 'program_assigned' (0019): a coach
-- sends/assigns a meal plan to an athlete. Same trigger site shape as
-- programs (lib/nutrition/mutations.ts's createMealPlan/cloneMealPlan,
-- whenever athlete_id differs from the acting owner), same
-- notifyMealPlanAssigned function (lib/notifications/mutations.ts) as the
-- one place both the in-app row and the email get written. No RLS change
-- needed — the existing "insertable by the actor for a real relationship"
-- policy (0019) already covers any type value; it just gates on
-- actor/recipient/coach_clients, not on what the notification is about.

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array['program_assigned', 'invite_accepted', 'invite_received', 'meal_plan_assigned']));
