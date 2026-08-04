-- Meal-plan counterparts to programs' set_active_program (0010/0013/0017)
-- and remove_assigned_program (0018) — the two athlete-side management
-- actions that were deliberately deferred when the Nutrition feature first
-- shipped (see MealPlanCard's "no setActiveMealPlan yet" comment). Both
-- functions below are the final, already-widened shape those programs
-- migrations converged on after three incremental passes; there's no
-- earlier nutrition version to widen from, so this goes straight there.
--
-- Why SECURITY DEFINER instead of RLS: nutrition_plans' own UPDATE policy
-- (migration 0058) is scoped to `auth.uid() = owner_id` only. Deactivating
-- "whatever was active before" has to touch rows by athlete_id, which for a
-- coach-assigned plan the athlete doesn't own — under plain RLS that
-- deactivation UPDATE would silently match zero rows (not an error),
-- leaving two plans marked active for that athlete. Making the function
-- security definer and doing its own explicit auth.uid() check up front
-- (same pattern nutrition's other SECURITY DEFINER-adjacent trigger,
-- enforce_meal_update_permissions, already uses) sidesteps that gap.
-- `set search_path = public` is required on every SECURITY DEFINER
-- function to avoid search-path hijacking.

create or replace function public.set_active_meal_plan(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete_id uuid;
  v_owner_id uuid;
begin
  select athlete_id, owner_id into v_athlete_id, v_owner_id
  from public.nutrition_plans
  where id = p_plan_id;

  if v_athlete_id is null then
    raise exception 'Meal plan not found';
  end if;

  -- Either the owner (a coach activating one of their client's plans) or
  -- the assigned athlete themselves (switching which of their own or
  -- coach-assigned plans is active) may call this — mirrors
  -- set_active_program's own widened check (migration 0017).
  if v_owner_id <> auth.uid() and v_athlete_id <> auth.uid() then
    raise exception 'Not allowed to activate this meal plan';
  end if;

  update public.nutrition_plans
    set is_active = false
    where athlete_id = v_athlete_id and is_active = true and id <> p_plan_id;

  update public.nutrition_plans
    set is_active = true, updated_at = now()
    where id = p_plan_id;
end;
$$;

grant execute on function public.set_active_meal_plan(uuid) to authenticated;

-- The athlete-side counterpart to deleteMealPlan: soft-removes their own
-- copy of a coach-assigned meal plan instead of deleting the row, so it
-- disappears from *their* own list (getMealPlanSummaries already filters
-- removed_by_athlete_at the same way it does for programs) while the coach
-- still sees it, now with a "removed by client" note — same reasoning as
-- remove_assigned_program (migration 0018). removed_by_athlete_at already
-- exists on nutrition_plans (migration 0058), so no column change needed
-- here, just the function.
create or replace function public.remove_assigned_meal_plan(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete_id uuid;
begin
  select athlete_id into v_athlete_id
  from public.nutrition_plans
  where id = p_plan_id;

  if v_athlete_id is null then
    raise exception 'Meal plan not found';
  end if;

  if v_athlete_id <> auth.uid() then
    raise exception 'Not allowed to remove this meal plan';
  end if;

  -- Also deactivates it — a plan the athlete just removed shouldn't keep
  -- driving their dashboard as their "active" meal plan.
  update public.nutrition_plans
    set removed_by_athlete_at = now(),
        is_active = false,
        updated_at = now()
    where id = p_plan_id;
end;
$$;

grant execute on function public.remove_assigned_meal_plan(uuid) to authenticated;
