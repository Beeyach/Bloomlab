# Phase 25 — Advanced Curriculum handoff

Branch: `codex/phase-25-advanced-curriculum`
Base: audited Phase 24 head `60305ad7b207fd7d6f77ddc2f0fdaca2213f485d`
Stack: main → PR #24 Phase 22 → PR #25 Phase 23 → PR #26 Phase 24 → this Phase 25 branch

Do not merge any stacked PR. Open the Phase 25 draft PR against `codex/phase-24-field-ready`, never `main`.

## Operating rules

Before changing code, read completely:

- `CLAUDE.md`
- `BLOOMLAB_MASTER_SPEC.md`
- `REQUIREMENTS_MATRIX.md`
- `IMPLEMENTATION_STATUS.md`
- `ACCEPTANCE_TESTS.md`
- `KNOWN_LIMITATIONS.md`
- `docs/reference/BLOOMLAB_TECHNICAL_ARCHITECTURE_v1.md`
- `docs/reviews/phase-24-field-ready.md`
- this handoff

Preserve the Phase 22/24 human-acceptance boundaries. In particular, do not promote `FLD-001`, `EXR-020`, `PRD-005`, `CUR-015`, or `CUR-031` merely because advanced curriculum is technically present. Do not alter the seven Phase 21 human-unverified rows without new direct evidence. Do not merge PR #24, #25, #26, or the Phase 25 PR.

Use current official HighLevel documentation where the product can change. Do not teach stale YouTube-era names or invented native functionality. Any simulated/taught HighLevel feature still needs a valid registry record with truthful `status`, `simulation_fidelity`, source, verification date, and limitations.

No production GHL credentials, OAuth, scraping, public secrets, or automatic GHL verification. Phase 25 does not erase the manual-real-GHL boundary from Phase 22/24.

## Phase 25 requirements in scope

Primary P1 acceptance:

- **CUR-023** — CONNECT curriculum with practical exercises for DNS, JSON, HTTP, webhooks, current GHL API practice, Git/GitHub, Cloudflare Workers, Google Cloud, and JavaScript for operator work. Marketplace/App extension work is specialist-only.

Other requirements explicitly assigned to Phase 25 in the current matrix:

- **CRM-002** — companies and custom objects, including schemas, records, associations, workflows, limitations, and when custom objects are excessive.
- **CRM-005** — smart list segmentation.
- **CAL-002** — advanced resource/class/complex scheduling rules.
- **PAY-001** — Payments Lab: product, price, one-time, subscription, payment link, invoice, failed payment, refund; payment events feed the shared simulator/workflow system where supported.
- **SAL-015** — retention: reporting, maintenance, retainer, expansion, referral, account strategy.
- **CUR-026** — SCALE curriculum: templates, naming standards, deployment checklist, snapshots, reusable vertical systems and agency architecture; SaaS/white-label/Marketplace remain specialist-only.
- **CUR-027** — GHL AI curriculum only after deterministic understanding: workflow-vs-AI judgment, Conversation AI, Voice AI, workflow AI actions, agents, knowledge bases, tools/MCP/external tools, escalation, permissions, hallucination risk, cost, logs, irreversible actions. Product names must be current and sourced.
- **CUR-028** — supporting GHL specialties represented in the full graph: reputation/reviews, Social Planner, courses, memberships, communities, client portal, affiliates, ecommerce, blogs, SEO, IVR/phone, prospecting tool, ad reporting, rentals, services, resources, contracts, estimates, invoices, payment links, subscriptions, advanced reporting. This requirement says present in the full graph, not that every specialty needs a full standalone Lab.
- **CUR-032** — post-Field-Ready paths: Automation Specialist, Funnel & Conversion Specialist, Sales Operator, Technical GHL Specialist, Agency Systems, GHL AI Specialist, plus recommended Bloomwired Operator Path.

Do not promote unrelated existing partials such as `PRI-001`, `PRI-002`, or `NEG-003` unless this phase creates direct new acceptance evidence for their full requirement.

## Implementation checkpoints

Work through these in order. Keep commits focused and conventional. Run focused tests at each checkpoint before continuing.

### Checkpoint A — inventory and advanced graph contract

1. Inspect the current master skill graph, `future_boundaries` added in Phase 24, feature registry, existing Lab domain models, content compiler/coverage matrix, projects, and post-Field-Ready navigation.
2. Produce a short baseline in `docs/reviews/phase-25-advanced-curriculum.md` showing what already exists vs what is actually missing for every in-scope ID above.
3. Extend schemas only where the current architecture cannot truthfully represent the advanced material. Avoid parallel stores and one-off React pages.
4. Add/extend content compiler checks so advanced skills/topics cannot silently exist without the required learning/practical coverage.

### Checkpoint B — CONNECT curriculum, P1 first

Implement CUR-023 completely before broadening scope.

Required CONNECT topic groups:

- DNS: records, propagation, subdomains, verification, common failure reasoning.
- JSON: objects/arrays/types, payload inspection, safe editing, malformed input diagnosis.
- HTTP: methods, status codes, headers, request/response reasoning, auth concepts without exposing secrets.
- Webhooks: payloads, signatures/auth concepts, retries, idempotency, failure diagnosis.
- Current GHL API practice: current supported API concepts/patterns only; no obsolete API doctrine, no real production credential dependency.
- Git/GitHub: branch/commit/PR/review/recovery concepts useful to an operator, not a software-engineering degree.
- Cloudflare Workers: request/response, environment bindings, safe backend glue, deployment boundaries.
- Google Cloud: service/account/project concepts relevant to Bloomlab/operator integrations, permissions and debugging, without leaking credentials.
- JavaScript for operator work: reading/modifying payloads, transforms, conditions, small utilities, defensive handling.

Every listed CONNECT topic needs at least one authored learning unit and one practical exercise. Prefer deterministic exercises/safe local sandboxes. Reuse the exercise engine. Do not build a fake terminal or pretend network calls happened. If real external calls are unnecessary, use authored fixtures and deterministic request/response data.

Acceptance must prove the coverage from content data, not a handwritten checklist.

### Checkpoint C — advanced GHL Labs and data model

Implement only the actual requirement boundaries, integrated with the shared simulated GHL account.

- CRM-002: companies/custom objects with realistic records/associations and explicit teaching of when custom objects are overkill. Poor-but-technically-valid modeling may be allowed where the lesson depends on later consequences.
- CRM-005: smart list segmentation using real account data/projections, not fake counts.
- CAL-002: classes/resources/advanced scheduling constraints without regressing ordinary calendars.
- PAY-001: products/prices, one-time/subscription concepts, payment links/invoices, failed payment/refund behavior, and relevant payment events through the shared simulator/workflow path. No real charge provider integration is required.

Preserve simulator determinism: no semantic `Date.now()`, uncontrolled randomness, or React-owned business logic.

### Checkpoint D — SCALE, retention, vertical systems

Implement CUR-026 and SAL-015 as advanced content/practical work, not generic agency-guru prose.

Cover:

- naming standards and reusable templates
- deployment/checklist discipline
- snapshots and portability beyond the Field Ready starter
- agency architecture boundaries
- maintenance/reporting/retainer/expansion/referral/account strategy
- the named reusable Bloomwired vertical systems: Med Spa Core, Coach Lead Path, Home Services Follow-Up, Photographer Inquiry System

Each vertical system must be explicit demonstration/training work. Never fabricate client outcomes.

### Checkpoint E — GHL AI and supporting specialties

For CUR-027:

- teach deterministic-first judgment before AI
- verify current product names from official HighLevel sources
- distinguish automation/workflows from AI clearly
- teach permissions, escalation, hallucination/incorrect-action risk, cost/logging, and irreversible-action boundaries
- do not make runtime AI required for curriculum completion
- do not add a costly live-provider requirement just to prove the lesson exists

For CUR-028:

- ensure every named specialty is represented in the master graph/content architecture with truthful status/tier/coverage
- add practical work where the spec/content architecture requires it, but do not manufacture a full Lab for each specialty unless the existing product requirements demand one
- keep specialist-only features out of the Field Ready path

### Checkpoint F — post-Field-Ready paths

Implement CUR-032 as real curated paths over the one master graph, never duplicate skills:

- Automation Specialist
- Funnel & Conversion Specialist
- Sales Operator
- Technical GHL Specialist
- Agency Systems
- GHL AI Specialist
- recommended Bloomwired Operator Path

The UI must make clear these are post-Field-Ready paths and must not imply Ary has earned Field Ready while the required personal acceptance remains outstanding.

## UX, responsive, accessibility

Any new major surface or material Lab expansion must be reviewed at exactly:

- 1440
- 1024
- 768
- 390
- 320

Also cover empty/loading/error states where applicable, keyboard, touch, visible focus, reduced motion, and no horizontal page overflow. Preserve the Phase 24 independently-scrollable rail regression, including short-height behavior.

Do not introduce generic SaaS cards, fake analytics, monospace UI, eyebrows/kickers, neon-hacker visuals, or placeholder/stub success states. No `coming soon` presented as completion.

## Data, security, provider boundaries

- Keep curriculum in Git and learner state in Dexie/D1.
- Do not store secrets in content/D1/client Vite variables.
- Do not add GHL credentials as a requirement.
- Any new private media remains Worker-authorized/private.
- No public learner screenshots.
- AI Off must still leave curriculum, deterministic exercises, Labs, portfolio and progress usable.
- Reuse existing sync semantics and conflict handling; do not create a second progress/store system.

## Verification

Before stopping:

1. Run complete pinned Node 22 `npm run ci`.
2. Run focused simulator/Lab/content/mastery regressions for every new domain.
3. Validate requirements/control docs and content lock.
4. Build production and Preview bundles and preserve browser provider/secret scans.
5. Run committed browser probes at the five required widths for every major new/changed surface.
6. For Preview, confirm browser + Worker build IDs match the exact source head.
7. Use controlled/synthetic data only. No paid provider call is required unless a requirement genuinely cannot be verified otherwise; if any paid call becomes necessary, keep it minimal and report exact spend.
8. Production deploy must remain skipped for this stacked draft.
9. Update `docs/reviews/phase-25-advanced-curriculum.md`, `REQUIREMENTS_MATRIX.md`, `IMPLEMENTATION_STATUS.md`, `KNOWN_LIMITATIONS.md`, `CHANGELOG.md`, and `ACCEPTANCE_TESTS.md` truthfully.
10. Open/update a **draft PR against `codex/phase-24-field-ready`**.
11. Stop for independent audit. Do not self-merge.

## Status discipline

`PASSED` requires direct acceptance evidence for the full requirement. If only part is implemented, use `PARTIAL` or `IMPLEMENTED_UNVERIFIED` as appropriate. Do not promote Phase 22/24 personal transfer requirements based on controlled fixtures. Do not claim physical Safari/device acceptance from Chromium emulation.

At completion, report:

- final source SHA
- exact-head CI run
- test/file counts
- Preview Worker version and build identity
- requirements promoted and requirements intentionally left partial/unverified
- migrations, if any
- provider spend, if any
- known limitations
- confirmation that PR #24/#25/#26 and the Phase 25 PR remain unmerged
