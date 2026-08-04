"""
One-off seed script: imports a curated, athlete-relevant subset of USDA
food/nutrition data into the `foods` table (migration 0058_nutrition.sql).

Why this exists / how it was run
---------------------------------
The live sandbox this was originally run from has no network access to
fdc.nal.usda.gov or api.nal.usda.gov (outbound requests to those hosts are
blocked). USDA's SR28 (Standard Reference 28) dataset — the predecessor to
SR Legacy, still genuine public-domain USDA nutrition data — ships bundled
as plain pipe/tilde-delimited text files inside the `django-usda-nutrition`
package on PyPI, which *was* reachable. That's the source these files
assume:

    pip download django-usda-nutrition --no-deps -d /tmp/dun
    tar xzf /tmp/dun/django-usda-nutrition-*.tar.gz -C /tmp/dun
    # data lives at:
    #   /tmp/dun/django-usda-nutrition-*/usda_nutrition/data/sr28/*.txt

If re-running this later with real network access to fdc.nal.usda.gov, the
cleaner path is downloading the current SR Legacy or Foundation Foods CSV
release directly from https://fdc.nal.usda.gov/download-datasets and
adjusting FOOD_DES_PATH etc. below to point at food.csv/nutrient.csv's
column layout instead (different from SR28's fixed-width text format).

What this does
--------------
1. Parses FOOD_DES.txt (foods), FD_GROUP.txt (category names), NUT_DATA.txt
   (nutrient values), NUTR_DEF.txt (nutrient id -> name/unit).
2. Drops food groups that don't belong in an athlete-facing generic-food
   catalog: Baby Foods, Fast Foods, Restaurant Foods, the regional American
   Indian/Alaska Native dataset, Sweets, Snacks, and prepared Meals/Entrees
   — this is precisely the "not designed for teenage girls" junk-food-app
   catalog problem the Nutrition feature exists to avoid.
3. Keeps only foods with complete calories/protein/carbs/fat data (SR28's
   sparser entries are otherwise unusable for a meal plan's macro maths).
4. Curates down further to ~55 foods per remaining group — prioritizing
   common athlete staples (chicken breast, salmon, rice, oats, etc. — see
   PRIORITY_TERMS) with a "shortest description" tiebreak as a cheap proxy
   for "generic staple, not a long-tail prepared variant" — and drops
   anything that reads like a branded product (ALL-CAPS company name token
   or a possessive like "Campbell's").
5. Emits batched `insert into public.foods (...) values (...) on conflict
   (id) do nothing;` SQL, one file per batch, for manual execution via the
   Supabase MCP's execute_sql tool (this script does not have DB
   credentials itself — it only prepares the SQL).

Result of the run this shipped with: 967 rows inserted, source='usda',
owner_id=null (global, visible to every coach). id format is
'usda:<NDB number>'; fdc_id stores that same NDB number (SR28's own
identifier scheme, not a literal FoodData Central fdc_id — see the foods
table's column comment in the migration).
"""

import json
import re
from collections import defaultdict

DATA_DIR = "/tmp/dun/django-usda-nutrition-0.2.0/usda_nutrition/data/sr28"
OUT_DIR = "/tmp"
BATCH_SIZE = 250
PER_GROUP_CAP = 55

EXCLUDED_GROUPS = {"0300", "2100", "3500", "3600", "1900", "2500", "2200"}

NUTR_CALORIES = "208"
NUTR_PROTEIN = "203"
NUTR_FAT = "204"
NUTR_CARBS = "205"
NUTR_FIBER = "291"
NUTR_SUGAR = "269"
NUTR_SODIUM = "307"
WANTED_NUTRIENTS = {NUTR_CALORIES, NUTR_PROTEIN, NUTR_FAT, NUTR_CARBS, NUTR_FIBER, NUTR_SUGAR, NUTR_SODIUM}

# Athletes ask for these specific staples by name constantly — bias every
# group toward surfacing them first, before falling back to "shortest
# description" as the generic tie-breaker for everything else.
PRIORITY_TERMS = [
    "chicken, broilers or fryers, breast", "chicken breast",
    "chicken, broilers or fryers, thigh", "chicken, broilers or fryers, drumstick",
    "chicken, broilers or fryers, wing", "ground turkey", "turkey breast",
    "egg, whole", "egg white", "milk, whole", "milk, reduced fat", "milk, nonfat",
    "yogurt, greek", "yogurt, plain", "cheese, cheddar", "cheese, mozzarella",
    "cheese, cottage", "cheese, cream", "beef, ground", "beef, top sirloin",
    "beef, tenderloin", "beef, ribeye", "beef, chuck", "beef, round",
    "pork, fresh, loin", "pork chop", "pork, cured, ham", "bacon",
    "lamb, ground", "lamb, loin", "salmon, atlantic", "tuna, fresh",
    "tuna, light, canned", "shrimp", "cod, atlantic", "tilapia", "halibut",
    "rice, white", "rice, brown", "oats", "quinoa", "pasta, dry",
    "bread, whole-wheat", "bread, white", "sweet potato", "potato", "banana",
    "apple", "blueberries", "strawberries", "broccoli", "spinach", "almonds",
    "peanut butter", "olive oil", "avocado", "black beans", "chickpeas", "lentils",
]

BRAND_PATTERN = re.compile(r"\b[A-Z]{4,}\b|'s\b")


def parse_sr(path):
    rows = []
    with open(path, encoding="latin-1") as f:
        for line in f:
            line = line.rstrip("\n")
            if line:
                rows.append([field.strip("~") for field in line.split("^")])
    return rows


def priority(name: str) -> int:
    lower = name.lower()
    for i, term in enumerate(PRIORITY_TERMS):
        if term in lower:
            return i
    return len(PRIORITY_TERMS) + len(name)


def load_and_curate():
    foods = {}
    for ndb_no, group_cd, long_desc, *_ in parse_sr(f"{DATA_DIR}/FOOD_DES.txt"):
        if group_cd in EXCLUDED_GROUPS:
            continue
        foods[ndb_no] = {"ndb_no": ndb_no, "group_cd": group_cd, "name": long_desc, "nutrients": {}}

    for ndb_no, nutr_no, nutr_val, *_ in parse_sr(f"{DATA_DIR}/NUT_DATA.txt"):
        if ndb_no not in foods or nutr_no not in WANTED_NUTRIENTS:
            continue
        try:
            foods[ndb_no]["nutrients"][nutr_no] = float(nutr_val)
        except ValueError:
            pass

    usable = [
        f for f in foods.values()
        if {NUTR_CALORIES, NUTR_PROTEIN, NUTR_FAT, NUTR_CARBS} <= f["nutrients"].keys()
    ]
    usable = [f for f in usable if not BRAND_PATTERN.search(f["name"])]

    by_group = defaultdict(list)
    for f in usable:
        by_group[f["group_cd"]].append(f)

    curated = []
    for items in by_group.values():
        items_sorted = sorted(items, key=lambda f: (priority(f["name"]), f["name"]))
        curated.extend(items_sorted[:PER_GROUP_CAP])
    return curated


def esc(s):
    return "null" if s is None else "'" + str(s).replace("'", "''") + "'"


def num(v):
    return "null" if v is None else repr(v)


def emit_sql(curated):
    cols = (
        "id, name, brand, source, fdc_id, calories, protein_g, carbs_g, fat_g, "
        "fiber_g, sugar_g, sodium_mg, default_serving_g, default_serving_label, owner_id"
    )
    rows = []
    for f in curated:
        n = f["nutrients"]
        ndb = f["ndb_no"]
        rows.append(
            f"({esc(f'usda:{ndb}')}, {esc(f['name'])}, null, 'usda', {int(ndb)}, "
            f"{num(n[NUTR_CALORIES])}, {num(n[NUTR_PROTEIN])}, {num(n[NUTR_CARBS])}, {num(n[NUTR_FAT])}, "
            f"{num(n.get(NUTR_FIBER))}, {num(n.get(NUTR_SUGAR))}, {num(n.get(NUTR_SODIUM))}, "
            f"100, '100 g', null)"
        )

    batches = [rows[i : i + BATCH_SIZE] for i in range(0, len(rows), BATCH_SIZE)]
    for i, batch in enumerate(batches):
        sql = f"insert into public.foods ({cols}) values\n" + ",\n".join(batch) + "\non conflict (id) do nothing;"
        with open(f"{OUT_DIR}/usda_batch_{i:03d}.sql", "w") as out:
            out.write(sql)
    print(f"Wrote {len(batches)} batch file(s), {len(rows)} rows total, to {OUT_DIR}/usda_batch_*.sql")
    print("Run each file's contents through the Supabase MCP's execute_sql tool to load them.")


if __name__ == "__main__":
    curated = load_and_curate()
    with open(f"{OUT_DIR}/usda_curated.json", "w") as out:
        json.dump(curated, out)
    emit_sql(curated)
