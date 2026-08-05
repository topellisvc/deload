-- The USDA seed import (task #106) pulled ~1000 rows, but it's heavily
-- weighted toward branded/processed/prepared items (ground beef by fat %,
-- peanut butter by brand, etc.) and is missing plain raw vegetables, fruit,
-- and a few other whole-food staples entirely — there's no "Broccoli",
-- "Spinach", "Avocado", "Black beans", or "Blueberries" anywhere in the
-- catalog. That's a real gap for building genuinely healthy meal templates
-- (migration 0062/0063): a coach can't put together a balanced plate
-- without produce. This backfills ~26 whole-food staples a coach would
-- reach for constantly, at accepted standard reference values per 100g
-- (USDA FoodData Central / SR Legacy figures for these common raw and
-- simply-cooked whole foods are well established).
--
-- These aren't literally re-exported FDC rows (no fdc_id on hand), so they
-- don't fit the 'usda:<fdc_id>' id convention migration 0058 describes for
-- imported rows — using a readable 'usda:staple-<slug>' id instead, still
-- source='usda' (global, trustworthy reference data) rather than 'custom'
-- (which foods' RLS and searchFoods' sort both treat as coach-owned).
--
-- Run this once in the Supabase SQL Editor. Safe to re-run (upsert on id).

insert into public.foods (id, name, source, calories, protein_g, carbs_g, fat_g, fiber_g, default_serving_g, default_serving_label)
values
  ('usda:staple-broccoli-raw', 'Broccoli, raw', 'usda', 34, 2.82, 6.64, 0.37, 2.6, 100, '100 g'),
  ('usda:staple-broccoli-cooked', 'Broccoli, cooked, boiled, drained', 'usda', 35, 2.38, 7.18, 0.41, 3.3, 100, '100 g'),
  ('usda:staple-spinach-raw', 'Spinach, raw', 'usda', 23, 2.86, 3.63, 0.39, 2.2, 100, '100 g'),
  ('usda:staple-spinach-cooked', 'Spinach, cooked, boiled, drained', 'usda', 23, 2.97, 3.75, 0.26, 2.4, 100, '100 g'),
  ('usda:staple-kale-raw', 'Kale, raw', 'usda', 49, 4.28, 8.75, 0.93, 3.6, 100, '100 g'),
  ('usda:staple-blueberries-raw', 'Blueberries, raw', 'usda', 57, 0.74, 14.49, 0.33, 2.4, 100, '100 g'),
  ('usda:staple-strawberries-raw', 'Strawberries, raw', 'usda', 32, 0.67, 7.68, 0.30, 2.0, 100, '100 g'),
  ('usda:staple-avocado-raw', 'Avocado, raw', 'usda', 160, 2.00, 8.53, 14.66, 6.7, 100, '100 g'),
  ('usda:staple-black-beans-cooked', 'Black beans, cooked, boiled', 'usda', 132, 8.86, 23.71, 0.54, 8.7, 100, '100 g'),
  ('usda:staple-chickpeas-cooked', 'Chickpeas (garbanzo beans), cooked, boiled', 'usda', 164, 8.86, 27.42, 2.59, 7.6, 100, '100 g'),
  ('usda:staple-asparagus-raw', 'Asparagus, raw', 'usda', 20, 2.20, 3.88, 0.12, 2.1, 100, '100 g'),
  ('usda:staple-asparagus-cooked', 'Asparagus, cooked, boiled, drained', 'usda', 22, 2.40, 4.11, 0.22, 2.0, 100, '100 g'),
  ('usda:staple-cucumber-raw', 'Cucumber, raw, with peel', 'usda', 15, 0.65, 3.63, 0.11, 0.5, 100, '100 g'),
  ('usda:staple-bell-pepper-red-raw', 'Bell pepper, red, raw', 'usda', 31, 1.00, 6.03, 0.30, 2.1, 100, '100 g'),
  ('usda:staple-tomato-raw', 'Tomato, raw', 'usda', 18, 0.88, 3.89, 0.20, 1.2, 100, '100 g'),
  ('usda:staple-carrots-raw', 'Carrots, raw', 'usda', 41, 0.93, 9.58, 0.24, 2.8, 100, '100 g'),
  ('usda:staple-onion-raw', 'Onion, raw', 'usda', 40, 1.10, 9.34, 0.10, 1.7, 100, '100 g'),
  ('usda:staple-garlic-raw', 'Garlic, raw', 'usda', 149, 6.36, 33.06, 0.50, 2.1, 100, '100 g'),
  ('usda:staple-zucchini-raw', 'Zucchini, raw', 'usda', 17, 1.21, 3.11, 0.32, 1.0, 100, '100 g'),
  ('usda:staple-cauliflower-raw', 'Cauliflower, raw', 'usda', 25, 1.92, 4.97, 0.28, 2.0, 100, '100 g'),
  ('usda:staple-romaine-lettuce-raw', 'Romaine lettuce, raw', 'usda', 17, 1.23, 3.29, 0.30, 2.1, 100, '100 g'),
  ('usda:staple-edamame-cooked', 'Edamame, cooked', 'usda', 121, 11.91, 8.91, 5.20, 5.2, 100, '100 g'),
  ('usda:staple-orange-raw', 'Orange, raw', 'usda', 47, 0.94, 11.75, 0.12, 2.4, 100, '100 g'),
  ('usda:staple-turkey-breast-roasted', 'Turkey breast, roasted, skinless', 'usda', 135, 30.10, 0.00, 0.70, 0.0, 100, '100 g'),
  ('usda:staple-feta-cheese', 'Cheese, feta', 'usda', 264, 14.21, 4.09, 21.28, 0.0, 100, '100 g'),
  ('usda:staple-mozzarella-part-skim', 'Cheese, mozzarella, part-skim', 'usda', 254, 24.26, 2.77, 15.94, 0.0, 100, '100 g')
on conflict (id) do update set
  name = excluded.name,
  source = excluded.source,
  calories = excluded.calories,
  protein_g = excluded.protein_g,
  carbs_g = excluded.carbs_g,
  fat_g = excluded.fat_g,
  fiber_g = excluded.fiber_g,
  default_serving_g = excluded.default_serving_g,
  default_serving_label = excluded.default_serving_label;
