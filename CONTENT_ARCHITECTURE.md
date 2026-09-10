# CONTENT ARCHITECTURE

Derived from `BLOOMLAB_MASTER_SPEC.md` §25–§26, §38–§39, §98–§101, §137–§138, §151 and TA§28–§31, §52–§56, §82–§83. Requirement IDs: CNT-*, GHL-*, CUR-033, INF-013.

## 1. Principles

- **Git = what Bloomlab teaches. D1 = what the learner has done.** (DATA-004)
- Curriculum is never hardcoded in JSX (CNT-001). A new exercise usually means adding content data, not building a new React page (EXR-001).
- YAML for structured definitions; Markdown/MDX for learning prose and interactive embeds (CNT-003).
- Every content type has a Zod schema; the build fails on any broken reference (CNT-004, CNT-005).
- Content is compiled at build time; the giant content folder is never parsed at runtime (CNT-006).
- Every release stamps a `content_version`; historical attempts are never mutated (CNT-007, DATA-011).

## 2. Tree (CNT-002)

```text
content/
├── skills/            one YAML per skill; the master graph
├── ghl-features/      GHL capability registry (§25)
├── campaigns/         FIELD_READY, ADVANCED_AUTOMATION, …; reference skill IDs only
├── learning-units/    Academy units: YAML metadata + MDX body with inline simulation embeds
├── exercises/         data-driven exercise definitions (§27, TA§31)
├── scenarios/         simulator starting states, seeds, injected events, hidden facts
├── clients/           persistent fictional clients (§37–§39)
├── rubrics/           versioned AI/deterministic rubrics (TA§42)
├── projects/          starter and capstone project definitions (§154–§155)
├── portfolio/         portfolio item templates (§35–§36)
└── glossary/          terms for search and Academy
```

## 3. Schemas (CNT-004)

Package: `packages/content-schema`. Field lists below are the minimum the spec requires; Phase 5 finalises exact shapes.

### SkillSchema

`id` · `title` · `territory` (STRATEGIZE | BUILD | AUTOMATE | ARCHITECT | DIAGNOSE | CONNECT | SELL | DELIVER | SCALE | JUDGMENT) · `tier` (field_ready | practitioner | advanced | specialist) · `prerequisites[]` (skill IDs) · `ghl_features[]` (registry IDs) · `judgment_competencies[]` · `mastery_requirements` (independent evidence count, pressure test, fieldwork required?) · `description`.

### GHLFeatureSchema (GHL-001 … GHL-004)

Required: `id` · `official_name` · `area` · `feature_type` · `implementation_type` (native_ghl | integration | custom_code | external_service) · `status` (current | needs_review | deprecated | removed) · `simulation_fidelity` (A | B | C | REAL_GHL) · `last_verified` (date) · `source_url` · `known_limitations[]` · `skills[]`. Plus `supported_configs` (TA§29) so the Workflow Lab can derive available actions.

Rules: no supposed native GHL feature is exposed without a registry entry (GHL-005). Names are verified against official current GHL documentation before entry (GHL-006). Fidelity meanings — **A** close behavioral reproduction (fields, tags, pipeline state, simple workflow logic); **B** training-equivalent with simplified internals; **C** conceptual demonstration; **REAL_GHL** not simulated, learner practices in actual GHL. Approximations are clearly labelled; fictional native functionality is never taught.

### CampaignSchema

`id` · `title` · `pace_hint` (e.g. "Suggested pace: ~30 days at 3–5 hours/day") · `gates[]` (`id`, `name`, `skills[]`, `pass_criteria`) · `projects[]`. Skill IDs only — no duplicated skill definitions (CUR-001).

### LearningUnitSchema

`id` · `title` · `skills[]` · `territory` · `body` (MDX) · `embeds[]` (inline simulation references) · `estimated_minutes` · `depth_sections[]`.

### ExerciseSchema (EXR-001)

`exercise_id` · `type` (BUILD_IT | FIX_IT | RUN_THE_LEAD | EDGE_CASE | WHAT_WOULD_YOU_BUILD | ARCHITECTURE_DECISION | FUNNEL_AUTOPSY | FUNNEL_ASSEMBLY | PROSPECT_IT | AUDIT_IT | WRITE_IT | SAY_IT | PRICE_IT | NEGOTIATE_IT | EXPLAIN_IT | REBUILD_BLIND | FIELDWORK | BOSS_CLIENT) · `title` · `skills[]` · `scenario` (scenario ID) · `instructions` · `allowed_features[]` (registry IDs) · `starting_state` · `expected_outcomes[]` · `critical_failures[]` · `grading` (assertions + rubric tiers, see `EXERCISE_ENGINE.md`) · `hints[]` (nudge | concept_reminder | worked_example) · `fieldwork` · `portfolio`.

### ScenarioSchema

`id` · `client` (client ID) · `initial_account_state` · `simulation_time` · `timezone` · `seed` · `scheduled_events[]` · `injectable_events[]` · `hidden_facts` · `failure_modes[]` (§49).

### ClientSchema (CNT-008, NEG-001)

`id` · `business_name` · `industry` · `locations` · `team` · `offers` · `lead_sources` · `current_systems` · `metrics` · `problems` · `relationship_state` · `assets` · `hidden_facts` · `voice` (voice character registry reference) · `history`.

Hidden roleplay state (never shown numerically to the learner): trust · urgency · price_sensitivity · frustration · technical_sophistication · actual_budget · stated_budget · decision_authority · fear · previous_bad_experience · alternative_provider_strength.

### RubricSchema (AI-011)

`id` (includes version, e.g. `SALES_DISCOVERY_RUBRIC_V3`) · `version` · `tiers` (critical | required | quality | bonus) · `items[]` · `model_class` (none | cheap | strong) · `output_schema`.

### ProjectSchema · PortfolioSchema · GlossarySchema

Project: `id` · `title` · `brief` · `client` · `stages[]` · `fieldwork_required` · `skills[]`. Portfolio: `id` · `project` · `label` (Simulation Project | Demonstration Build) · `artifacts[]`. Glossary: `id` · `term` · `definition` · `related_skills[]` · `ghl_features[]`.

### Workflow definition (SIM-016)

Stored as data, never as UI-only state:

```text
workflow: id, name, trigger, trigger_filters, nodes[], edges[], settings
node:     id, type, ghl_feature_id, config, position
```

Layout (`position`) is separate from behavior. Moving a node never changes automation.

**Phase 12 additions (`packages/content-schema/src/schemas/workflow.ts`):** `trigger.filters[] { field, operator, value }`; node `type` from `trigger · action · wait · branch · end · goal`; a Wait config `{ wait_type: period | date | appointment | reply | condition, … }` validated per type; an If/Else config `{ branches[] { name, groups[] { conditions[] { field, operator, value } } } }` with operators `is · is_not · contains · not_contains · exists · not_exists · gt · lt`; `settings.time_window { days[1..7], start, end }` and `settings.timezone`; edges may name a `branch`. The compiler builds the scenario's initial account and runs `validateWorkflowGraph` over every authored workflow, so a graph the engine could not walk fails the build (`WORKFLOW_GRAPH_INVALID`). Exercise assertions may carry `dimension` (EXR-023).

## 4. Validation rules (CNT-005, CNT-011)

The compiler fails the build when any of the following is violated:

- duplicate ID within any content type
- prerequisite references a missing skill, or a cycle exists
- exercise, unit, campaign or project references a missing skill
- any content references a GHL feature not in the registry
- any exercise references a missing scenario or client
- any campaign references a missing skill, gate skill or project
- any rubric reference is missing or unversioned
- a registry record lacks any required field, or uses a value outside its enum
- a feature with `simulation_fidelity: REAL_GHL` is referenced as a simulator action

Content tests run in CI on every PR and main push.

## 5. Compilation (CNT-006)

```text
source content → validate (Zod) → resolve relationships → compile → optimized curriculum bundle
```

The application receives indexed data (skill graph, campaign paths, exercise index, registry, glossary, search index). The content compiler also emits the derived matrices:

- **Content coverage** — Skill × Learn / Guided / Practice / Fix / Independent / Pressure / Fieldwork / Sales Use (CUR-033)
- **GHL coverage** — GHL Feature × Skill / Simulator / Fidelity / Exercise / Fieldwork / Last Verified (GHL-007)
- **Freshness review list** — registry entries whose `last_verified` is stale (GHL-008)

## 6. Versioning (CNT-007, INF-013)

Each release records `app_version`, `content_version` (e.g. `2026.09.17`), `simulator_version`. Attempts store all three. When GHL changes later, new exercises reference the updated registry version; old attempts keep the version they were completed against. Completed historical exercises are never mutated (DATA-011).

## 7. ID conventions (finalised in Phase 5, D-036)

The file name is the record's `id` (D-035). Patterns are enforced by `packages/content-schema/src/ids.ts`.

| Type | Pattern | Example |
|---|---|---|
| Skill | `SK-<TERRITORY>-<slug>` (territory must match the record) | `SK-AUTOMATE-appointment-reminders` |
| GHL feature | `GHL-<AREA>-<NAME>` (upper case) | `GHL-WF-WAIT` |
| Campaign | `CAMP-<NAME>` | `CAMP-FIELD_READY` |
| Learning unit | `LU-<slug>` (`.mdx`) | `LU-funnel-math-basics` |
| Exercise | `EX-<TYPE>-<slug>` (type must match the record) | `EX-FIX_IT-double-reminder` |
| Scenario | `SC-<slug>` | `SC-glowhaus-no-show` |
| Client | `CL-<slug>` | `CL-glowhaus-medspa` |
| Rubric | `<NAME>_RUBRIC_V<n>` (`version` must equal *n*) | `SALES_DISCOVERY_RUBRIC_V1` |
| Project | `PRJ-<slug>` | `PRJ-consultation-booking-system` |
| Portfolio item | `PF-<slug>` | `PF-consultation-booking-system` |
| Glossary | `GL-<slug>` | `GL-custom-value` |
| Simulator fixture | `<AREA>-<nnn>` | `WAIT-003` (Phase 10) |

## 8. Implementation (Phase 5)

- **Package** `packages/content-schema`: `src/schemas/` (Zod, strict objects), `src/ids.ts`, `src/bundle.ts` (bundle types, issue codes), `src/compile/` (sources, parse, validate, graph, resolve, coverage, compile, reports), `src/node.ts` (disk loader, lock, reports), `src/vite.ts` (plugin). Browser code imports only the root entry.
- **Pipeline**: `readContentDir` → `classifySources` (folder + extension rules) → `parseAndValidateFiles` (YAML / MDX front matter → schema; file name = id; duplicates) → `crossValidate` (references, graph, campaign order, feature use, embeds) → indexes, campaign paths, coverage, freshness, search → `ContentBundle`. `validateSources` never throws and returns every issue; `compileSources` throws `ContentBuildError`.
- **Delivery**: the Vite plugin compiles once per build and serves `virtual:bloomlab-content` (app) and `virtual:bloomlab-content/version` (Worker); `vite dev` watches `content/` and reloads. The client bundle contains no YAML or MDX parser.
- **Versioning**: `content/content.yaml` + generated `content/content.lock.yaml`; `npm run content:build | check | lock` (`scripts/content.mjs`); CI runs `content:check`. The bundle carries `content_version`, `content_hash`, `schema_version`.
- **Reports**: `.content/coverage-content.md`, `.content/coverage-ghl.md`, `.content/freshness.md`, `.content/bundle.json`, `.content/summary.txt` (git-ignored, regenerated on every build). The `/system` screen shows the same numbers from the bundle.
- **Warnings (non-fatal)**: `ORPHAN_SKILL`, `SKILL_NO_UNIT`, `SKILL_NO_PRACTICE`, `GATE_WITHOUT_SKILLS`, `GATE_WITHOUT_PROJECT`, `UNIT_NO_EMBEDS`, `FEATURE_NEEDS_REVIEW_USED`, `DEPRECATED_FEATURE_USED`, `FEATURE_STALE`.

## 9. Registry maintenance (Phase 26, GHL-008)

Run `npm run content:freshness -- --as-of YYYY-MM-DD` for reproducible JSON/Markdown reports at
`.content/freshness-review.{json,md}`. Omit `--as-of` to use today's UTC date; optionally set
`--stale-days N` (positive whole days). CI uses the default **more than 90 whole UTC days**.
Current-but-stale, needs_review, deprecated, removed and future verification dates remain distinct;
the source status is preserved. Each review item retains its official source, verification date,
fidelity, approximation, limitations and verification context. Recent current records are counted,
not listed as needing review. Deterministic sort: age descending, then feature ID.

The command validates content and its lock, never calls a provider or rewrites source records.
Review findings are advisory warnings under existing authoring policy. Invalid schemas/dates,
unsupported options or a broken lock fail. A maintainer must inspect the official source and make
an evidence-backed content/version/lock change; generating a report never verifies a feature.
