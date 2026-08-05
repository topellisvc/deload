-- Seeds the meal/plan template library (schema: migration 0062) with 12
-- researched, balanced meal templates (3 each of breakfast/lunch/dinner/
-- snack — real protein-anchored, produce-inclusive combinations a nutrition
-- coach would actually build, not just "a protein and a carb") and 3
-- starter full plans built entirely from those same 12 templates, so the
-- Templates tab (meal builder) and "Start from a template" (new plan
-- dialog) are backed by one shared, consistent set of content.
--
-- Every food_id referenced here already exists — either from the original
-- USDA import (task #106) or migration 0061's whole-food staple backfill,
-- which this content was specifically designed around (it's why 0061 had
-- to happen first: there was no plain broccoli/spinach/avocado/etc. to
-- build a genuinely balanced plate from before that).
--
-- Ids are fixed literals rather than gen_random_uuid() defaults, since
-- plan_template_meals needs to reference the exact same meal_templates and
-- plan_template_days rows created earlier in this same script.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run (upsert on id).

-- ============================================================
-- meal_templates + meal_template_items
-- ============================================================

insert into public.meal_templates (id, name, description, category, tags, position) values
  ('00000000-0000-4000-8000-000000000b01', 'Greek Yogurt & Berries Bowl', 'Nonfat Greek yogurt, blueberries, and almonds — a fast, high-protein breakfast with no cooking required.', 'breakfast', '{high_protein,quick,vegetarian}', 1),
  ('00000000-0000-4000-8000-000000000b02', 'Veggie Egg Scramble with Toast', 'Scrambled eggs with wilted spinach, whole-wheat toast, and avocado.', 'breakfast', '{balanced,vegetarian}', 2),
  ('00000000-0000-4000-8000-000000000b03', 'Protein Oats', 'Oats cooked in milk with banana and peanut butter — a hearty pre- or post-workout breakfast.', 'breakfast', '{high_carb,pre_workout,vegetarian}', 3),
  ('00000000-0000-4000-8000-000000000c01', 'Grilled Chicken & Quinoa Bowl', 'Chicken breast, quinoa, and broccoli finished with olive oil — the everyday balanced-lunch template.', 'lunch', '{balanced,high_protein}', 1),
  ('00000000-0000-4000-8000-000000000c02', 'Turkey & Veggie Sandwich', 'Roasted turkey breast on whole-wheat with spinach, tomato, and avocado.', 'lunch', '{lean,quick}', 2),
  ('00000000-0000-4000-8000-000000000c03', 'Tuna Salad Bowl', 'Canned tuna over romaine, cucumber, and bell pepper with olive oil and feta — light and high-protein.', 'lunch', '{low_carb,high_protein}', 3),
  ('00000000-0000-4000-8000-000000000d01', 'Salmon, Sweet Potato & Asparagus', 'Baked salmon with roasted sweet potato and asparagus — omega-3s alongside a clean complex carb.', 'dinner', '{balanced,high_protein}', 1),
  ('00000000-0000-4000-8000-000000000d02', 'Lean Beef Stir-Fry', 'Lean ground beef with brown rice, broccoli, bell pepper, and onion.', 'dinner', '{balanced,high_protein}', 2),
  ('00000000-0000-4000-8000-000000000d03', 'Black Bean & Chicken Bowl', 'Chicken breast with black beans, brown rice, tomato, and avocado — fiber-rich and filling.', 'dinner', '{high_fiber,high_protein}', 3),
  ('00000000-0000-4000-8000-000000000e01', 'Cottage Cheese & Fruit', 'Lowfat cottage cheese with strawberries and walnuts.', 'snack', '{high_protein,quick,vegetarian}', 1),
  ('00000000-0000-4000-8000-000000000e02', 'Apple & Peanut Butter', 'Sliced apple with peanut butter — a simple, portable snack.', 'snack', '{quick,vegetarian}', 2),
  ('00000000-0000-4000-8000-000000000e03', 'Protein Yogurt Cup', 'Nonfat Greek yogurt with blueberries and chia seeds.', 'snack', '{high_protein,quick,vegetarian}', 3)
on conflict (id) do update set
  name = excluded.name, description = excluded.description, category = excluded.category, tags = excluded.tags, position = excluded.position;

-- Clear out any previous run's items before re-inserting (keeps this script
-- idempotent without needing per-item upsert keys).
delete from public.meal_template_items where template_id in (
  '00000000-0000-4000-8000-000000000b01', '00000000-0000-4000-8000-000000000b02', '00000000-0000-4000-8000-000000000b03',
  '00000000-0000-4000-8000-000000000c01', '00000000-0000-4000-8000-000000000c02', '00000000-0000-4000-8000-000000000c03',
  '00000000-0000-4000-8000-000000000d01', '00000000-0000-4000-8000-000000000d02', '00000000-0000-4000-8000-000000000d03',
  '00000000-0000-4000-8000-000000000e01', '00000000-0000-4000-8000-000000000e02', '00000000-0000-4000-8000-000000000e03'
);

insert into public.meal_template_items (template_id, position, food_id, quantity_g, display_label) values
  -- Greek Yogurt & Berries Bowl (~291 cal, 25p/26c/11f)
  ('00000000-0000-4000-8000-000000000b01', 1, 'usda:01256', 200, 'Greek yogurt, plain, nonfat'),
  ('00000000-0000-4000-8000-000000000b01', 2, 'usda:staple-blueberries-raw', 100, 'Blueberries'),
  ('00000000-0000-4000-8000-000000000b01', 3, 'usda:12061', 20, 'Almonds'),

  -- Veggie Egg Scramble with Toast (~466 cal, 25p/34c/26f)
  ('00000000-0000-4000-8000-000000000b02', 1, 'usda:01132', 150, 'Eggs, scrambled (about 3)'),
  ('00000000-0000-4000-8000-000000000b02', 2, 'usda:staple-spinach-raw', 50, 'Spinach'),
  ('00000000-0000-4000-8000-000000000b02', 3, 'usda:18075', 60, 'Whole-wheat toast (2 slices)'),
  ('00000000-0000-4000-8000-000000000b02', 4, 'usda:staple-avocado-raw', 50, 'Avocado'),

  -- Protein Oats (~616 cal, 26p/91c/19f)
  ('00000000-0000-4000-8000-000000000b03', 1, 'usda:20038', 80, 'Oats (dry)'),
  ('00000000-0000-4000-8000-000000000b03', 2, 'usda:01079', 240, 'Milk, 2% reduced fat'),
  ('00000000-0000-4000-8000-000000000b03', 3, 'usda:09040', 100, 'Banana'),
  ('00000000-0000-4000-8000-000000000b03', 4, 'usda:16098', 16, 'Peanut butter'),

  -- Grilled Chicken & Quinoa Bowl (~551 cal, 56p/39c/19f)
  ('00000000-0000-4000-8000-000000000c01', 1, 'usda:05064', 150, 'Chicken breast, roasted, skinless'),
  ('00000000-0000-4000-8000-000000000c01', 2, 'usda:20137', 150, 'Quinoa, cooked'),
  ('00000000-0000-4000-8000-000000000c01', 3, 'usda:staple-broccoli-cooked', 100, 'Broccoli'),
  ('00000000-0000-4000-8000-000000000c01', 4, 'usda:04053', 10, 'Olive oil'),

  -- Turkey & Veggie Sandwich (~377 cal, 46p/31c/8f)
  ('00000000-0000-4000-8000-000000000c02', 1, 'usda:staple-turkey-breast-roasted', 120, 'Turkey breast, roasted'),
  ('00000000-0000-4000-8000-000000000c02', 2, 'usda:18075', 60, 'Whole-wheat bread (2 slices)'),
  ('00000000-0000-4000-8000-000000000c02', 3, 'usda:staple-spinach-raw', 30, 'Spinach'),
  ('00000000-0000-4000-8000-000000000c02', 4, 'usda:staple-tomato-raw', 50, 'Tomato'),
  ('00000000-0000-4000-8000-000000000c02', 5, 'usda:staple-avocado-raw', 30, 'Avocado'),

  -- Tuna Salad Bowl (~334 cal, 36p/12c/16f)
  ('00000000-0000-4000-8000-000000000c03', 1, 'usda:15184', 120, 'Tuna, canned in water, drained'),
  ('00000000-0000-4000-8000-000000000c03', 2, 'usda:staple-romaine-lettuce-raw', 100, 'Romaine lettuce'),
  ('00000000-0000-4000-8000-000000000c03', 3, 'usda:staple-cucumber-raw', 80, 'Cucumber'),
  ('00000000-0000-4000-8000-000000000c03', 4, 'usda:staple-bell-pepper-red-raw', 80, 'Red bell pepper'),
  ('00000000-0000-4000-8000-000000000c03', 5, 'usda:04053', 10, 'Olive oil'),
  ('00000000-0000-4000-8000-000000000c03', 6, 'usda:staple-feta-cheese', 20, 'Feta cheese'),

  -- Salmon, Sweet Potato & Asparagus (~519 cal, 45p/46c/18f)
  ('00000000-0000-4000-8000-000000000d01', 1, 'usda:15209', 150, 'Salmon, Atlantic, wild, cooked'),
  ('00000000-0000-4000-8000-000000000d01', 2, 'usda:11508', 200, 'Sweet potato, baked'),
  ('00000000-0000-4000-8000-000000000d01', 3, 'usda:staple-asparagus-cooked', 100, 'Asparagus'),
  ('00000000-0000-4000-8000-000000000d01', 4, 'usda:04053', 5, 'Olive oil'),

  -- Lean Beef Stir-Fry (~508 cal, 47p/51c/12f)
  ('00000000-0000-4000-8000-000000000d02', 1, 'usda:23558', 150, 'Ground beef, 95% lean, cooked'),
  ('00000000-0000-4000-8000-000000000d02', 2, 'usda:20037', 150, 'Brown rice, cooked'),
  ('00000000-0000-4000-8000-000000000d02', 3, 'usda:staple-broccoli-cooked', 100, 'Broccoli'),
  ('00000000-0000-4000-8000-000000000d02', 4, 'usda:staple-bell-pepper-red-raw', 50, 'Red bell pepper'),
  ('00000000-0000-4000-8000-000000000d02', 5, 'usda:staple-onion-raw', 30, 'Onion'),

  -- Black Bean & Chicken Bowl (~567 cal, 54p/60c/12f)
  ('00000000-0000-4000-8000-000000000d03', 1, 'usda:05064', 130, 'Chicken breast, roasted, skinless'),
  ('00000000-0000-4000-8000-000000000d03', 2, 'usda:staple-black-beans-cooked', 100, 'Black beans'),
  ('00000000-0000-4000-8000-000000000d03', 3, 'usda:20037', 120, 'Brown rice, cooked'),
  ('00000000-0000-4000-8000-000000000d03', 4, 'usda:staple-tomato-raw', 50, 'Tomato'),
  ('00000000-0000-4000-8000-000000000d03', 5, 'usda:staple-avocado-raw', 40, 'Avocado'),

  -- Cottage Cheese & Fruit (~252 cal, 19p/17c/14f)
  ('00000000-0000-4000-8000-000000000e01', 1, 'usda:01015', 150, 'Cottage cheese, lowfat 2%'),
  ('00000000-0000-4000-8000-000000000e01', 2, 'usda:staple-strawberries-raw', 100, 'Strawberries'),
  ('00000000-0000-4000-8000-000000000e01', 3, 'usda:12155', 15, 'Walnuts'),

  -- Apple & Peanut Butter (~198 cal, 5p/25c/11f)
  ('00000000-0000-4000-8000-000000000e02', 1, 'usda:09003', 150, 'Apple'),
  ('00000000-0000-4000-8000-000000000e02', 2, 'usda:16098', 20, 'Peanut butter'),

  -- Protein Yogurt Cup (~177 cal, 19p/18c/4f)
  ('00000000-0000-4000-8000-000000000e03', 1, 'usda:01256', 170, 'Greek yogurt, plain, nonfat'),
  ('00000000-0000-4000-8000-000000000e03', 2, 'usda:staple-blueberries-raw', 50, 'Blueberries'),
  ('00000000-0000-4000-8000-000000000e03', 3, 'usda:12006', 10, 'Chia seeds');

-- ============================================================
-- plan_templates + plan_template_days + plan_template_meals
-- ============================================================

insert into public.plan_templates (id, name, description, goal, position) values
  ('00000000-0000-4000-9000-000000000001', 'Balanced Maintenance', 'A straightforward three-day rotation through all 12 meal templates — even protein/produce coverage with no particular calorie skew. A solid default starting point for a client with no specific goal yet.', 'maintenance', 1),
  ('00000000-0000-4000-9000-000000000002', 'High-Protein Cut', 'Leans on the leaner, higher-protein templates (egg scramble, tuna bowl, black bean & chicken) across three days — built for a fat-loss phase where protein needs to stay high while calories come down.', 'cut', 2),
  ('00000000-0000-4000-9000-000000000003', 'Higher-Calorie Muscle Gain', 'Leans on the more calorie-dense templates (protein oats, beef stir-fry) across three days — a starting point for a lean-bulk phase. Portions in every template are a baseline; scale them up to hit an individual client''s actual target.', 'bulk', 3)
on conflict (id) do update set
  name = excluded.name, description = excluded.description, goal = excluded.goal, position = excluded.position;

delete from public.plan_template_days where template_id in (
  '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-9000-000000000002', '00000000-0000-4000-9000-000000000003'
);

insert into public.plan_template_days (id, template_id, position, label) values
  ('00000000-0000-4000-9000-000000009001', '00000000-0000-4000-9000-000000000001', 1, 'Day 1'),
  ('00000000-0000-4000-9000-000000009002', '00000000-0000-4000-9000-000000000001', 2, 'Day 2'),
  ('00000000-0000-4000-9000-000000009003', '00000000-0000-4000-9000-000000000001', 3, 'Day 3'),
  ('00000000-0000-4000-9000-000000009004', '00000000-0000-4000-9000-000000000002', 1, 'Day 1'),
  ('00000000-0000-4000-9000-000000009005', '00000000-0000-4000-9000-000000000002', 2, 'Day 2'),
  ('00000000-0000-4000-9000-000000009006', '00000000-0000-4000-9000-000000000002', 3, 'Day 3'),
  ('00000000-0000-4000-9000-000000009007', '00000000-0000-4000-9000-000000000003', 1, 'Day 1'),
  ('00000000-0000-4000-9000-000000009008', '00000000-0000-4000-9000-000000000003', 2, 'Day 2'),
  ('00000000-0000-4000-9000-000000009009', '00000000-0000-4000-9000-000000000003', 3, 'Day 3');

insert into public.plan_template_meals (day_id, position, name, meal_template_id) values
  -- Balanced Maintenance
  ('00000000-0000-4000-9000-000000009001', 1, 'Breakfast', '00000000-0000-4000-8000-000000000b01'),
  ('00000000-0000-4000-9000-000000009001', 2, 'Lunch', '00000000-0000-4000-8000-000000000c01'),
  ('00000000-0000-4000-9000-000000009001', 3, 'Dinner', '00000000-0000-4000-8000-000000000d01'),
  ('00000000-0000-4000-9000-000000009001', 4, 'Snack', '00000000-0000-4000-8000-000000000e01'),
  ('00000000-0000-4000-9000-000000009002', 1, 'Breakfast', '00000000-0000-4000-8000-000000000b03'),
  ('00000000-0000-4000-9000-000000009002', 2, 'Lunch', '00000000-0000-4000-8000-000000000c02'),
  ('00000000-0000-4000-9000-000000009002', 3, 'Dinner', '00000000-0000-4000-8000-000000000d02'),
  ('00000000-0000-4000-9000-000000009002', 4, 'Snack', '00000000-0000-4000-8000-000000000e02'),
  ('00000000-0000-4000-9000-000000009003', 1, 'Breakfast', '00000000-0000-4000-8000-000000000b02'),
  ('00000000-0000-4000-9000-000000009003', 2, 'Lunch', '00000000-0000-4000-8000-000000000c03'),
  ('00000000-0000-4000-9000-000000009003', 3, 'Dinner', '00000000-0000-4000-8000-000000000d03'),
  ('00000000-0000-4000-9000-000000009003', 4, 'Snack', '00000000-0000-4000-8000-000000000e03'),

  -- High-Protein Cut
  ('00000000-0000-4000-9000-000000009004', 1, 'Breakfast', '00000000-0000-4000-8000-000000000b02'),
  ('00000000-0000-4000-9000-000000009004', 2, 'Lunch', '00000000-0000-4000-8000-000000000c01'),
  ('00000000-0000-4000-9000-000000009004', 3, 'Dinner', '00000000-0000-4000-8000-000000000d01'),
  ('00000000-0000-4000-9000-000000009004', 4, 'Snack', '00000000-0000-4000-8000-000000000e01'),
  ('00000000-0000-4000-9000-000000009005', 1, 'Breakfast', '00000000-0000-4000-8000-000000000b03'),
  ('00000000-0000-4000-9000-000000009005', 2, 'Lunch', '00000000-0000-4000-8000-000000000c03'),
  ('00000000-0000-4000-9000-000000009005', 3, 'Dinner', '00000000-0000-4000-8000-000000000d03'),
  ('00000000-0000-4000-9000-000000009005', 4, 'Snack', '00000000-0000-4000-8000-000000000e03'),
  ('00000000-0000-4000-9000-000000009006', 1, 'Breakfast', '00000000-0000-4000-8000-000000000b01'),
  ('00000000-0000-4000-9000-000000009006', 2, 'Lunch', '00000000-0000-4000-8000-000000000c02'),
  ('00000000-0000-4000-9000-000000009006', 3, 'Dinner', '00000000-0000-4000-8000-000000000d02'),
  ('00000000-0000-4000-9000-000000009006', 4, 'Snack', '00000000-0000-4000-8000-000000000e02'),

  -- Higher-Calorie Muscle Gain
  ('00000000-0000-4000-9000-000000009007', 1, 'Breakfast', '00000000-0000-4000-8000-000000000b03'),
  ('00000000-0000-4000-9000-000000009007', 2, 'Lunch', '00000000-0000-4000-8000-000000000c01'),
  ('00000000-0000-4000-9000-000000009007', 3, 'Dinner', '00000000-0000-4000-8000-000000000d03'),
  ('00000000-0000-4000-9000-000000009007', 4, 'Snack', '00000000-0000-4000-8000-000000000e02'),
  ('00000000-0000-4000-9000-000000009008', 1, 'Breakfast', '00000000-0000-4000-8000-000000000b01'),
  ('00000000-0000-4000-9000-000000009008', 2, 'Lunch', '00000000-0000-4000-8000-000000000c02'),
  ('00000000-0000-4000-9000-000000009008', 3, 'Dinner', '00000000-0000-4000-8000-000000000d02'),
  ('00000000-0000-4000-9000-000000009008', 4, 'Snack', '00000000-0000-4000-8000-000000000e01'),
  ('00000000-0000-4000-9000-000000009009', 1, 'Breakfast', '00000000-0000-4000-8000-000000000b02'),
  ('00000000-0000-4000-9000-000000009009', 2, 'Lunch', '00000000-0000-4000-8000-000000000c03'),
  ('00000000-0000-4000-9000-000000009009', 3, 'Dinner', '00000000-0000-4000-8000-000000000d01'),
  ('00000000-0000-4000-9000-000000009009', 4, 'Snack', '00000000-0000-4000-8000-000000000e03');
