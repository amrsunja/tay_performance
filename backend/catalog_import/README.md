# Catalog import

Generates `supabase/migrations/0011_world_catalog.sql` (123 makes · ~4 900 models · ~5 300 generations).

Sources (`sources.tgz`, extract next to this file):
- `wiki/<make>.json` — model lists extracted from Wikipedia "List of <Make> vehicles" pages (110 makes)
- `us/<year>.csv` — US model-year data 1992–2026 with body styles (github.com/abhionlyone/us-car-models-data)
- `curated_generations.py` — hand-curated generations + body styles for the models most common in France

```
mkdir -p sources && tar xzf sources.tgz -C sources && python3 build_catalog.py
```

Model rows that already exist (0007 seed) are left untouched (`on conflict do nothing`); re-running is safe.
`makes.logo_url` is left empty on purpose — set it from the admin/SQL editor.
