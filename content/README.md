# content/

Curriculum lives here as Git-tracked YAML + MDX (spec §98, `CONTENT_ARCHITECTURE.md`). **Git = what Bloomlab teaches. D1 = what the learner has done.**

## Layout

One record per file; the file name is the record's `id`.

| Folder | Format | Records |
|---|---|---|
| `skills/` | YAML | the master skill graph (`SK-<TERRITORY>-<slug>`) |
| `ghl-features/` | YAML | GHL capability registry (`GHL-<AREA>-<NAME>`), verified against official documentation |
| `campaigns/` | YAML | curated paths through the graph (`CAMP-<NAME>`); skill IDs only |
| `learning-units/` | MDX + front matter | Academy units (`LU-<slug>`) with inline `<Simulation>`, `<Exercise>`, `<Feature>`, `<Depth>`, `<Callout>` embeds |
| `exercises/` | YAML | data-driven exercises (`EX-<TYPE>-<slug>`) |
| `scenarios/` | YAML | simulator starting states (`SC-<slug>`) |
| `clients/` | YAML | persistent fictional clients (`CL-<slug>`) |
| `rubrics/` | YAML | versioned rubrics (`<NAME>_RUBRIC_V<n>`) |
| `projects/` | YAML | starter and capstone projects (`PRJ-<slug>`) |
| `portfolio/` | YAML | portfolio item templates (`PF-<slug>`) |
| `glossary/` | YAML | terms (`GL-<slug>`) |

`content.yaml` is the release stamp (`content_version`, `schema_version`). `content.lock.yaml` records which sources that version describes; it is generated, never edited.

## Commands

```bash
npm run content:build   # compile, write .content/ (bundle + coverage + review list); fails on any broken reference
npm run content:check   # the same, plus the lock must match the sources (CI)
npm run content:lock    # after bumping content_version: record the current sources
```

Changing any file here requires bumping `content_version` in `content.yaml` and running `content:lock`; `content:check` refuses an unbumped change.

## Rules the compiler enforces

Schemas in `packages/content-schema/src/schemas/` (Zod, strict — unknown keys are errors). Cross-reference checks: every skill, GHL feature, client, scenario, campaign, project, exercise, rubric and portfolio reference resolves; prerequisites are acyclic and taught in campaign order; a REAL_GHL feature is never offered to the simulator; removed features are never referenced; rubrics apply to the exercise family that uses them; learning-unit embeds point at real records. Warnings (never fatal) list coverage gaps: skills without a unit or exercise, gates without skills or projects.

The GHL registry only contains features verified on `help.gohighlevel.com` (see each record's `source_url`, `last_verified`, `verification_note`). Anything unverified is `status: needs_review`. Never invent native GHL behaviour.
