# Phase 5 review — Content Engine

Date: 2026-09-02 · Branch `feat/content-engine` (stacked on `feat/d1-sync`) · Spec §98–§101, §137–§138, §151; TA§52–§56, §82–§83.

Git = what Bloomlab teaches. D1 = what the learner has done. Phase 5 makes the first half real: a typed, validated, compiled curriculum that the app and the Worker consume as one bundle, never by reading `content/` at runtime.

## What was built

| Layer | Where | What |
|---|---|---|
| Schemas | `packages/content-schema/src/schemas/` | Strict Zod objects (unknown keys are errors) for Skill, GHLFeature, Campaign, LearningUnit front matter, Exercise (six assertion types, hints, fieldwork, grading), Scenario (account state, events, hidden facts, pricing economics), Client (fifteen §38 fields + §39 hidden state), Rubric, Project, Portfolio, Glossary, WorkflowDefinition (SIM-016), Manifest and Lock. |
| IDs | `src/ids.ts` | One pattern per type; the file name must equal the record `id` (D-035); skill territory and exercise family are encoded in the ID and checked against the record (D-036). |
| Compiler | `src/compile/` | `classifySources` (folders, formats) → `parseAndValidateFiles` (YAML / MDX + schema, duplicates) → `crossValidate` (references, prerequisite graph and cycles, campaign order, feature use, embeds) → `buildIndexes`, `buildCampaignPaths`, `buildContentCoverage`, `buildGhlCoverage`, `buildFreshness`, `buildSearchIndex` → `ContentBundle`. `validateSources` returns every issue; `compileSources` throws `ContentBuildError`. |
| Node entry | `src/node.ts`, `scripts/content.mjs` | `readContentDir`, `compileContentDir`, `writeLock`, `writeReports`; `npm run content:build | check | lock`. Runs on Node 22.18's type stripping (D-042). |
| Vite plugin | `src/vite.ts` | Compiles once per build, fails `vite build` on content errors, serves `virtual:bloomlab-content` (app) and `virtual:bloomlab-content/version` (Worker), rebuilds and reloads on edits under `content/` in `vite dev` (D-037). |
| Versioning | `content/content.yaml`, `content/content.lock.yaml` | Date-based `content_version`; the lock records the SHA-256 of every source; `content:check` (CI) refuses an unbumped change (D-038). The bundle carries `content_version`, `content_hash`, `schema_version`. |
| App / Worker | `apps/web/src/content/bundle.ts`, `ContentDiagnostics.tsx`, `worker/src/index.ts` | The app's single door to content; `/system` Content section; `/api/health` reports the compiled content version; `CONTENT_VERSION` left `@bloomlab/shared`. |
| CI | `.github/workflows/ci.yml` | `npm run content:check` after the docs validator, before the build (CNT-011). |

## Seed content (representative, not curriculum)

| Type | Count | Notes |
|---|---|---|
| skills | 22 | every one of the ten territories populated; longest prerequisite chain 4 |
| ghl-features | 34 | 11 triggers, 12 actions, 10 entities/capabilities, 1 product (Snapshots, REAL_GHL) |
| campaigns | 2 | Field Ready (13 gates, placement gate assesses six skills, 20 skills in path) · Advanced Automation (requires Field Ready, inherits 20 skills) |
| learning-units | 3 | MDX with `<Simulation>`, `<Exercise>`, `<Feature>`, `<Depth>`, `<Callout>` embeds |
| exercises | 16 | 13 of 18 families: BUILD IT, FIX IT, RUN THE LEAD, EDGE CASE ×2, REBUILD BLIND, ARCHITECTURE DECISION, WHAT WOULD YOU BUILD, AUDIT IT, PROSPECT IT, PRICE IT, NEGOTIATE IT, SAY IT, WRITE IT, EXPLAIN IT, FIELDWORK |
| scenarios | 4 | no-show, double reminder (broken system), Summit discovery (economics), Northwind audit |
| clients | 3 | med spa, coach, HVAC — fifteen fields and hidden state each |
| rubrics | 5 | `_V1` each; applies_to enforced against exercise family |
| projects | 2 | Consultation Booking System (fieldwork), Application Funnel Proposal |
| portfolio | 2 | positions 2 and 3 of the §36 progression |
| glossary | 8 | |

Compile result: `content 2026.09.02`, 0 errors, 36 warnings (final lock hash `e15441abc7fc`; the `d9f10a7a1f51` quoted in the demonstration and runtime logs below is the same sources before `content/README.md` was excluded from the hash — documentation never moves the content version) — two gates without authored skills (6 Conversion and Copy, 12 Capstone), seven gates without a project, and every seeded skill missing at least one coverage column. They are reported, not hidden (KNOWN_LIMITATIONS).

## Demonstrations (the user's list)

All from one run of the compiler against the real tree with in-memory mutations (script kept in the session scratchpad; every line below is the compiler's own output).

**Successful compilation of valid content**

```
content 2026.09.02 hash d9f10a7a1f51 — skills 22, ghl-features 34, campaigns 2, learning-units 3, exercises 16, scenarios 4, clients 3, rubrics 5, projects 2, portfolio 2, glossary 8
territories: STRATEGIZE=2 BUILD=2 AUTOMATE=4 ARCHITECT=3 DIAGNOSE=1 CONNECT=1 SELL=5 DELIVER=2 SCALE=1 JUDGMENT=1
```

**Prerequisite graph validation**

```
prerequisite order (first 8): SK-ARCHITECT-tags-vs-custom-fields → SK-ARCHITECT-custom-values → SK-ARCHITECT-pipeline-design → SK-AUTOMATE-workflow-foundations → SK-AUTOMATE-reentry-and-duplicates → SK-BUILD-lead-capture-form → SK-BUILD-consultation-calendar → SK-AUTOMATE-appointment-reminders
depth of SK-AUTOMATE-no-show-recovery: 3
### missing prerequisite
ERROR [MISSING_PREREQUISITE] skills/SK-STRATEGIZE-bottleneck-diagnosis.yaml @ prerequisites.0: SK-STRATEGIZE-bottleneck-diagnosis references unknown prerequisite skill SK-STRATEGIZE-funnel-maths
### prerequisite cycle (funnel-math made to require bottleneck-diagnosis)
ERROR [PREREQUISITE_CYCLE] skills/SK-STRATEGIZE-funnel-math.yaml @ prerequisites: SK-STRATEGIZE-funnel-math is part of a prerequisite cycle
(… and the eight skills downstream of the cycle, each named)
```

**Campaign → skill resolution**

```
CAMP-FIELD_READY → 20 skills; GATE-5 = SK-BUILD-consultation-calendar, SK-AUTOMATE-appointment-reminders, SK-AUTOMATE-no-show-recovery
CAMP-ADVANCED_AUTOMATION inherits 20 skills from Field Ready
### campaign references a skill that does not exist
ERROR [MISSING_SKILL] campaigns/CAMP-FIELD_READY.yaml @ gates.7.skills.0: CAMP-FIELD_READY references unknown skill SK-DIAGNOSE-workflow-debugging
### campaign teaches a prerequisite after the skill that needs it
ERROR [CAMPAIGN_PREREQUISITE_ORDER] campaigns/CAMP-FIELD_READY.yaml @ gates.1.skills.0: CAMP-FIELD_READY: SK-STRATEGIZE-bottleneck-diagnosis (GATE-1) requires SK-STRATEGIZE-funnel-math, taught later in GATE-11
```

**Skill → GHL feature resolution**

```
SK-AUTOMATE-workflow-foundations → features: GHL-WF-ADD-CONTACT-TAG, GHL-WF-CONTACT-CREATED, GHL-WF-CUSTOMER-REPLIED, GHL-WF-FORM-SUBMITTED, GHL-WF-IF-ELSE, GHL-WF-PAYMENT-RECEIVED, GHL-WF-SEND-EMAIL, GHL-WF-SEND-SMS, GHL-WF-WAIT
GHL-WF-WAIT → skills: SK-AUTOMATE-appointment-reminders, SK-AUTOMATE-workflow-foundations, SK-DIAGNOSE-workflow-troubleshooting
### missing GHL feature reference
ERROR [MISSING_GHL_FEATURE] exercises/EX-FIX_IT-double-reminder.yaml @ allowed_features.5: EX-FIX_IT-double-reminder references unknown GHL feature GHL-WF-REMOVE-FROM-FLOW
### REAL_GHL feature offered inside a simulator exercise
ERROR [REAL_GHL_AS_SIMULATOR_ACTION] exercises/EX-BUILD_IT-no-show-recovery.yaml @ allowed_features.10: EX-BUILD_IT-no-show-recovery would simulate GHL-SNAP-SNAPSHOTS, which is REAL_GHL (not simulated; learners practise it in real GHL)
### registry record with a value outside its enum
ERROR [SCHEMA] ghl-features/GHL-WF-SEND-SMS.yaml @ status: Invalid option: expected one of "current"|"needs_review"|"deprecated"|"removed"
(… followed by MISSING_GHL_FEATURE for the 13 records that reference GHL-WF-SEND-SMS, each named)
### registry record missing a required field
ERROR [SCHEMA] ghl-features/GHL-WF-SEND-SMS.yaml @ last_verified: Invalid input: expected string, received undefined
```

**Exercise → scenario / client resolution**

```
EX-BUILD_IT-no-show-recovery → SC-glowhaus-no-show → CL-glowhaus-medspa; exercises_by_client[CL-glowhaus-medspa] = 11
### missing scenario
ERROR [MISSING_SCENARIO] exercises/EX-BUILD_IT-no-show-recovery.yaml @ scenario: EX-BUILD_IT-no-show-recovery references unknown scenario SC-glowhaus-ghost
### missing client
ERROR [MISSING_CLIENT] scenarios/SC-summit-discovery.yaml @ client: SC-summit-discovery references unknown client CL-summit-coach
```

**Duplicate IDs, formats, MDX**

```
### duplicate ID (same skill saved as .yaml and .yml)
ERROR [DUPLICATE_ID] skills/SK-STRATEGIZE-funnel-math.yml: Duplicate id SK-STRATEGIZE-funnel-math (also in skills/SK-STRATEGIZE-funnel-math.yaml)
### learning unit embedding a missing exercise
ERROR [MISSING_EXERCISE] learning-units/LU-funnel-math-basics.mdx @ body line 40: LU-funnel-math-basics references unknown exercise EX-WHAT_WOULD_YOU_BUILD-glowhouse-leads
### learning unit with broken MDX
ERROR [MDX_SYNTAX] learning-units/LU-funnel-math-basics.mdx: Expected a closing tag for `<Depth>` (42:1-42:25)
### a JSON file in a YAML folder
ERROR [INVALID_FORMAT] skills/SK-BUILD-thing.json: skills accepts .yaml / .yml files only
```

**Content version propagation**

```
manifest 2026.09.02 → bundle 2026.09.02 (d9f10a7a1f51); manifest 2026.09.03 → bundle 2026.09.03 (26da0ac412f2)
edited a skill without bumping: Content changed since content_version 2026.09.02 was locked: bump content_version in content.yaml and run `npm run content:lock`
```

At runtime (preview build, `vite preview`): `/system` → Client "Content version 2026.09.02", Worker "content version 2026.09.02", Content section "Content hash d9f10a7a1f51"; `GET /api/health` → `{"environment":"preview","ok":true,"versions":{"app":"0.1.0","content":"2026.09.02","simulator":"0.0.0"}}`. The Worker test asserts the same shape inside workerd.

**Generated coverage / reporting primitives**

```
coverage row no-show-recovery: {"skill":"SK-AUTOMATE-no-show-recovery","learn":0,"guided":1,"practice":0,"fix":0,"independent":1,"pressure":0,"fieldwork":0,"sales_use":0,"gaps":["learn","pressure","fieldwork"]}
ghl coverage snapshots: {"feature":"GHL-SNAP-SNAPSHOTS","status":"current","fidelity":"REAL_GHL","skills":["SK-SCALE-snapshot-portability"],"simulator":false,"exercises":["EX-FIELDWORK-snapshot-no-show-system"],"fieldwork":["EX-FIELDWORK-snapshot-no-show-system"],"last_verified":"2026-09-02"}
freshness at 2027-03-01: 34 records to review (first: GHL-CAL-CALENDARS, 180 days, stale)
```

`npm run content:build` writes `.content/coverage-content.md` (Skill × Learn / Guided / Practice / Fix / Independent / Pressure / Fieldwork / Sales Use / Gaps), `.content/coverage-ghl.md` (Feature × Official name / Status / Fidelity / Simulator / Skills / Exercises / Fieldwork / Last verified), `.content/freshness.md`, `.content/bundle.json`, `.content/summary.txt`. The `/system` Content section shows counts, graph by territory, campaign paths, coverage gaps, the review list and the warning count from the bundle.

## GHL registry verification log (GHL-006)

Every record: `status: current`, `last_verified: 2026-09-02`, https `source_url` on `help.gohighlevel.com`, `verification_note`. "Article" = the feature's own help-center article was read; "List" = the name was confirmed on the official "A List of Workflow Triggers" / "A List of Workflow Actions" page and the record says its configs were not individually verified. Nothing was added from memory or from third-party tutorials.

| Record | Official name | Type · fidelity | Basis |
|---|---|---|---|
| GHL-WF-FORM-SUBMITTED | Form Submitted | trigger · A | Article 155000002550 |
| GHL-WF-SURVEY-SUBMITTED | Survey Submitted | trigger · B | List |
| GHL-WF-CONTACT-CREATED | Contact Created | trigger · A | Article 155000002486 |
| GHL-WF-CONTACT-TAG | Contact Tag | trigger · A | Article 155000002482 (Added / Removed) |
| GHL-WF-APPOINTMENT-STATUS | Appointment Status | trigger · A | Article 155000002619 (New, Confirmed, Cancelled, Showed, No-show, Invalid; reschedule = new) |
| GHL-WF-CUSTOMER-BOOKED-APPOINTMENT | Customer Booked Appointment | trigger · A | Article 155000002675 |
| GHL-WF-PIPELINE-STAGE-CHANGED | Pipeline Stage Changed | trigger · A | List |
| GHL-WF-OPPORTUNITY-STATUS-CHANGED | Opportunity Status Changed | trigger · A | List |
| GHL-WF-CUSTOMER-REPLIED | Customer Replied | trigger · B | List |
| GHL-WF-INBOUND-WEBHOOK | Inbound Webhook | trigger · C | Article 48001237383 (premium) |
| GHL-WF-PAYMENT-RECEIVED | Payment Received | trigger · C | List |
| GHL-WF-SEND-SMS | Send SMS | action · A | Article 155000002474 |
| GHL-WF-SEND-EMAIL | Send Email | action · A | List |
| GHL-WF-ADD-CONTACT-TAG | Add Contact Tag | action · A | Article 155000003111 |
| GHL-WF-REMOVE-CONTACT-TAG | Remove Contact Tag | action · A | List |
| GHL-WF-UPDATE-CONTACT-FIELD | Update Contact Field | action · A | Article 48001214441 |
| GHL-WF-ASSIGN-TO-USER | Assign to User | action · A | List |
| GHL-WF-SEND-INTERNAL-NOTIFICATION | Send Internal Notification | action · B | List |
| GHL-WF-WAIT | Wait (alias Wait Step) | action · B | Article 155000002470 (eight wait types) |
| GHL-WF-IF-ELSE | If/Else (alias If Else) | action · A | Article 155000002471 (top-down, None branch) |
| GHL-WF-CREATE-UPDATE-OPPORTUNITY | Create/Update Opportunity | action · A | Article 155000002476 |
| GHL-WF-REMOVE-FROM-WORKFLOW | Remove from Workflow | action · A | List |
| GHL-WF-WEBHOOK | Webhook (alias Custom Webhook) | action · B | Article 155000003299 (POST default, custom data, no files) |
| GHL-WF-GOAL-EVENT | Goal Event | action · C | Article 155000003328 |
| GHL-CRM-CONTACTS | Contacts | entity · A | Article 155000005055 |
| GHL-CRM-TAGS | Tags | entity · A | Article 155000003111 (Add Contact Tag) |
| GHL-CRM-CUSTOM-FIELDS | Custom Fields | entity · A | Article 48001161579 |
| GHL-CRM-CUSTOM-VALUES | Custom Values | entity · A | Article 48001161575 |
| GHL-CRM-PIPELINES | Pipelines | entity · A | Article 155000001982 |
| GHL-CRM-OPPORTUNITIES | Opportunities | entity · A | Article 155000001983 |
| GHL-CRM-SMART-LISTS | Smart Lists | capability · C | Article 48001062094 |
| GHL-CAL-CALENDARS | Calendars | entity · B | Article 155000005061 + availability guide |
| GHL-FORM-FORMS | Forms | entity · B | Article 155000006719 |
| GHL-SNAP-SNAPSHOTS | Snapshots | product · REAL_GHL | Article 48000982511 (included / excluded assets) |

Fidelity B and C records carry an `approximation_note`; A records are all `native_ghl` (schema rule). The freshness list is empty today and lists all 34 after 90 days.

## Tests

| Suite | Count | What |
|---|---|---|
| `test/schemas.test.ts` | 30 | GHL registry fields, enums, official-host rule, approximation label, strictness; Client's fifteen fields and bounded hidden state; territory and self-prerequisite; exercise weights, simulator-family rules, six assertion types, hint rules; rubric version/id; workflow layout vs behaviour and edge validity |
| `test/brokenReferences.test.ts` | 28 | the minimal fixture compiles; the build fails on every broken-reference class listed under CNT-005; `validateSources` reports all errors at once and keeps warnings non-fatal |
| `test/content.test.ts` | 13 | the real tree compiles; all ten territories; prerequisite order and depth; campaign paths with prerequisites satisfied and inherited skills; skill ↔ feature both ways; exercise → scenario → client; hand-checked coverage row; GHL coverage incl. REAL_GHL; freshness; every registry record on official docs; version and hash propagation; lock messages |

Repository total: 201 tests (26 web · 14 Worker in workerd · 71 content · 90 design system, shared and others), all green; typecheck (8 workspaces), lint, Prettier, docs validator, `content:check` and the production build green.

## Runtime and responsive check

Preview build (`CLOUDFLARE_ENV=preview`), `vite preview` on 4173: `/system` renders the Content section from `virtual:bloomlab-content`; Worker and client versions match (the screen would flag a difference); no console errors. Checked at 1440, 390 and 320 px: the definition list wraps its long `·`-joined values; no horizontal overflow.

## Not done / honest gaps

- **CNT-007, DATA-011, INF-013 partial**: attempt records that store `content_version` / `content_hash` do not exist until Phases 6 and 9. The stamping contract (manifest → lock → bundle → app and Worker) is complete.
- **CNT-011 passed** on the branch's first CI run (33718316982: Checks and Preview deploy green, `content:check` included).
- **CNT-009 not started**: three persistent clients, not twenty; the schema and hidden state are complete.
- **Curriculum is a seed**: gates 6 and 12 have no authored skills; every seeded skill has coverage gaps; the compiler reports 36 warnings and the `/system` screen lists them. Authoring is Phase 24.
- **Registry depth**: 10 of 34 records are name-verified from GHL's official list pages only; their `supported_configs` are labelled as not individually verified.
- **Rendering**: MDX is validated and carried raw; the Academy renders it in Phase 8. No Academy, Skill Map or exercise UI reads the bundle yet — only `/system` does, deliberately.
- **PR #4 (Phase 4) is still open**; this branch is stacked on it and re-targets `main` after that merge.
