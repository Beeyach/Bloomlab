# Phase 24 - Field Ready completion

## Operating state

This is a stacked implementation branch.

- Phase 21 is merged and production-green at `59ec678910cb51559d84af3c4200590f9c7e29ec`.
- Phase 22 is parked on draft PR #24 because Ary is deferring the required real-GHL human acceptance. Its current implementation head is `fa53d72ecdd9cdb276338d4abd2c1d699ab37ff5`.
- Phase 23 is independently audited and clean as a stacked delta on draft PR #25. Its head is `593e79409f2eb34a5854cf4a2688441f39561ad8`.
- This branch, `codex/phase-24-field-ready`, starts exactly from that Phase 23 head.

Do not merge PR #24, PR #25, or the Phase 24 PR. Do not retarget earlier PRs. Phase 24 must target `codex/phase-23-portfolio` while the stack is parked.

Do not promote Phase 22 human-acceptance statuses. In particular, `FLD-001` / `EXR-020` stay `IMPLEMENTED_UNVERIFIED` until Ary eventually performs the actual GHL fieldwork run. The fact that Phase 24 can consume synthetic or fixture fieldwork evidence for automated end-to-end tests does not replace that human acceptance.

## Read before coding

Read completely:

1. `CLAUDE.md`
2. `BLOOMLAB_MASTER_SPEC.md`, especially sections 4-24, 27-36, 123-124, 137, 144, 154-156, 158-163, and the Phase 24 build plan
3. `REQUIREMENTS_MATRIX.md`
4. `ACCEPTANCE_TESTS.md`, especially `## Phase 24 - Field Ready content`
5. `IMPLEMENTATION_STATUS.md`
6. `KNOWN_LIMITATIONS.md`
7. `docs/reference/BLOOMLAB_TECHNICAL_ARCHITECTURE_v1.md`
8. Phase 22 and Phase 23 review docs and their handoffs
9. Existing campaign, mastery, session-builder, content compiler, exercise runner, simulator/labs, pricing, negotiation, Call Room, Fieldwork and Portfolio implementations and tests

Inspect the current content coverage before authoring anything. Reuse existing skills, scenarios, clients, projects, exercises and learning units where they genuinely satisfy Phase 24. Do not duplicate working content just to raise counts.

## Phase goal

Finish the complete Field Ready learning path from placement through capstone using Bloomlab's existing mastery-driven architecture.

This is not a request to add a large pile of shallow lessons. The finished system must be a coherent, completable path that develops real decision-making and practical capability across funnel strategy, GHL implementation, automation, CRM architecture, troubleshooting, selling, pricing, negotiation, client explanation and real-GHL fieldwork.

No Phase 25 advanced curriculum in this PR except metadata/tier tags that clearly mark future content boundaries.

## Hard boundaries

### No fake implementation

`EXR-024` remains authoritative.

No static placeholder pretending to be an exercise, no "coming soon" modal standing in for a required flow, no fake success state, no hardcoded completion flag, no diagram replacing a practical system, and no synthetic client outcome claims.

If a required interaction is not implemented, leave its requirement honest rather than faking it.

### No GHL API dependency

Do not add GHL OAuth, Private Integration, API verification, credentials, browser scraping or automated inspection. Phase 22 manual fieldwork remains the v1 real-GHL boundary.

### AI remains optional

The full Field Ready path must be substantially usable with AI Off. Use the existing AI gateway only for exercise families that already legitimately use rubric/classifier evaluation. Do not call AI for campaign selection, progression, mastery, normal deterministic grading, session generation, content routing or Field Ready evaluation.

Higher-tier copy exercises should deliberately require the learner to write without automatic AI drafting. Runtime critique can remain optional where already architecturally appropriate.

### Preserve all existing safeguards

Do not weaken:

- deterministic simulator invariants
- critical-failure authority
- evidence versioning
- assistance/mastery rules
- private fieldwork media
- Call Room privacy/provider boundaries
- pricing/negotiation hidden-state rules
- local-first IndexedDB and sync behavior
- no secret/provider code in browser bundles
- truthful Portfolio labels and no fabricated outcomes

### Content-driven, not React-driven

New curriculum, clients, projects, scenarios, judgments and exercises belong in the content system. React may render generic content-driven behavior, but do not add exercise-ID special cases to product screens.

## Acceptance scope

Implement and verify the Phase 24 acceptance rows in `ACCEPTANCE_TESTS.md`.

### A. Placement and Field Ready progression

#### PRD-006 / CUR-003 - Gate 0 Placement

Gate 0 must assess all eight areas:

1. funnel reasoning
2. lead capture
3. workflow basics
4. fields vs values
5. pipeline basics
6. basic pricing
7. written prospect response
8. short spoken discovery

Strong placement evidence must actually clear mapped early requirements. Do not merely display a score. Use the existing campaign/mastery evidence architecture. A weak area remains required. A strong area may skip the mapped beginner requirement while later independent/mastery requirements still behave normally.

Placement must not treat Ary as a novice by default.

Add deterministic tests proving distinct strong/weak profiles map to different work ahead.

#### PRD-005

Make the entire placement-to-capstone route technically runnable and testable. Add an automated controlled end-to-end evidence fixture that proves the path can advance through all gates when valid evidence is present.

Do not mark the human-transfer statement PASSED merely from a synthetic fixture. If the acceptance wording requires an actual learner full run, leave `PRD-005` `IMPLEMENTED_UNVERIFIED` and say exactly what remains.

#### PRD-008

Add the Field Ready completion/certificate copy. It must describe capable-not-expert competence and list the nine Field Ready capabilities from the product definition. Never use "expert" or imply guaranteed client outcomes.

Keep the completion treatment restrained and consistent with Bloomlab's design system. Phase 26 owns final cinematic polish.

#### MAS-010 - Field Ready evaluation

Implement a deterministic Field Ready evaluator that checks the ten evidence areas independently:

- funnel strategy
- GHL implementation
- automation
- CRM architecture
- troubleshooting
- sales
- pricing
- negotiation
- fieldwork
- client explanation

A high average may not compensate for an empty required area. Return explicit missing areas and evidence basis. No AI.

Pin this with tests including a high-average-but-one-empty failure.

### B. Four identities and curriculum ratios

#### PRD-010

Tag every Field Ready skill to at least one of the four identities:

- Funnel Strategist
- GHL Systems Builder
- Conversion & Sales Operator
- Technical GHL Specialist

Prefer schema/content data rather than title heuristics. Add compiler validation/coverage reporting.

#### PRD-011

Extend the content compiler/reporting so the `FIELD_READY` campaign reports instruction / practical / retrieval time and remains within +/-10% of the intended 20 / 60 / 20 ratio.

Use authored/derived estimated minutes, not fake analytics.

### C. Bloomwired relevance and scenario mix

#### PRD-017 / PRD-018

At least 70% of Field Ready scenarios must use Bloomwired-bias industries from the spec. Add compiler coverage that proves the percentage from content data.

Field Ready must contain Bloomwired-specific material for:

- ICP
- offer structure/positioning
- pricing
- audits
- outreach
- proposals

Do not turn the course into generic agency-guru doctrine.

### D. Complete Gates 1-11

Use existing material wherever valid, then author only the missing pieces. Every required topic must have real learn/practical coverage according to the Phase 24 acceptance matrix.

#### CUR-004 - Gate 1 Funnel Thinking

Cover:

- customer journey
- funnel purpose
- traffic intent
- offers
- friction
- CTA
- conversion
- funnel math
- bottleneck thinking

Every topic must appear in the generated coverage matrix with actual learning and practical work.

#### CUR-005 - Gate 2 Lead Systems

Cover:

- lead capture
- forms
- confirmation
- follow-up
- CRM capture
- pipeline
- next action

Include a real Lead Capture starter build exercise/project flow.

#### CUR-006 - Gate 3 GHL Data Foundations

Cover:

- contacts
- tags
- custom fields
- custom values
- opportunities
- pipelines
- assignments
- correct architecture decisions

Include `ARCHITECTURE DECISION` practical work. Do not reduce architecture to multiple choice at the higher level.

#### CUR-007 - Gate 4 Workflow Foundations

Cover:

- triggers
- filters
- actions
- waits
- If/Else
- re-entry
- timing
- communications
- pipeline automation

Use the real Workflow Lab with BUILD IT and FIX IT exercises.

#### CUR-008 - Gate 5 Booking and Qualification

Cover:

- forms
- surveys
- qualification
- calendars
- routing
- reminders
- cancellations
- reschedules
- no-shows

Include a completable Consultation Booking starter project/build.

#### CUR-009 - Gate 6 Conversion and Copy

Cover:

- page hierarchy
- message match
- CTA placement
- conversion copy
- proof
- qualification friction
- mobile conversion design

Use FUNNEL ASSEMBLY and WRITE IT. Higher-tier work should increasingly require learner-authored copy without AI drafting.

#### CUR-010 - Gate 7 Diagnosis and QA

Cover:

- workflow troubleshooting
- funnel troubleshooting
- logs
- edge cases
- metrics
- pre-launch QA
- bottleneck diagnosis

Use FIX IT, EDGE CASE and FUNNEL AUTOPSY.

Create the full Bloomwired 19-area QA protocol as actual checklist/practical content, not just prose.

#### CUR-011 - Gate 8 Prospecting and Audits

Cover:

- ICP
- prospect selection
- evidence
- research
- outreach
- cold email
- follow-up
- audit quality

Use PROSPECT IT, AUDIT IT and WRITE IT. Preserve VERIFIED / LIKELY / UNKNOWN evidence discipline.

#### CUR-012 - Gate 9 Discovery and Selling

Cover:

- cold calls
- discovery
- Zoom-style calls
- listening
- questions
- diagnosis
- explaining systems
- pitching outcomes

Use SAY IT and EXPLAIN IT plus the already-built sales exercise families. Phase 21's seven human-unverified call rows remain unchanged; content coverage does not promote them.

#### CUR-013 - Gate 10 Pricing and Negotiation

Cover:

- scope
- fixed pricing
- recurring pricing
- deposits
- revisions
- exclusions
- risk
- negotiation
- reducing scope
- walking away

Use PRICE IT and NEGOTIATE IT. Preserve the fact that there is no one universal price and a lost deal can still be a correct decision.

Do not silently promote `PRI-001`, `PRI-002` or `NEG-003` beyond their existing evidence.

#### CUR-014 - Gate 11 Proposal and Delivery

Cover:

- proposal
- acceptance
- onboarding
- dependencies/build order
- client updates
- QA
- handoff

Use proposal/client-communication WRITE IT exercises plus new delivery exercises as needed.

Implement these explicit sales/delivery acceptance rows:

##### SAL-010 - change requests

A change-request scenario must require the learner to hold scope, re-scope or re-price. Accepting unpaid scope creep must be penalized.

##### SAL-011 - onboarding

The onboarding exercise must require all nine items:

- access
- credentials
- domains
- calendars
- users
- branding
- copy
- payment
- expectations

##### SAL-012 - build order

Implement a practical build-order exercise that rejects orderings violating:

`data -> pipeline -> calendar -> forms -> workflows -> funnel -> tracking -> QA`

Do not make it a trivial memorization quiz if an architecture/sequence interaction can use existing exercise machinery.

##### SAL-014 - handoff

Require all four:

- documentation
- training
- ownership
- support

Missing any must leave the attempt `Needs another run`.

### E. Territory curriculum completeness

#### CUR-018 - STRATEGIZE

Every Field Ready STRATEGIZE topic and all eleven core funnel families from the spec need at least one real unit and one practical exercise.

Tag Practitioner / Advanced / Specialist material for Phase 25 rather than implementing it now.

#### CUR-019 - BUILD

Every Field Ready BUILD topic needs learning + practical work:

- conversion layout
- copy
- GHL Funnel Builder
- Websites
- Forms
- Surveys
- Calendars
- Payments basics

Funnel Builder content may reference only GHL registry features currently marked `current`. Do not teach fictional or stale native functionality.

#### CUR-020 - AUTOMATE

Every Field Ready AUTOMATE topic needs learning + Workflow Lab practice:

- foundations
- core triggers
- core actions
- wait logic
- branching
- re-entry
- common systems

Tag advanced automation topics for Phase 25.

#### CUR-021 - ARCHITECT

Every Field Ready ARCHITECT topic needs learning + practical work:

- contacts
- tags
- custom fields
- custom values
- pipelines
- opportunities
- smart lists
- companies
- data modeling

Include a veterinary-clinic-style data modeling problem that forces a realistic architecture choice.

#### CUR-022 - DIAGNOSE

Every Field Ready DIAGNOSE topic needs learning + practical work:

- Bloomwired QA protocol
- workflow troubleshooting
- funnel troubleshooting
- deliverability
- SMS reliability
- analytics
- experimentation

#### CUR-024 - SELL

Every SELL Field Ready topic must have at least one unit and one practical exercise across the existing selling families.

#### CUR-025 - DELIVER

Every DELIVER Field Ready topic must have at least one unit and one practical exercise:

- proposal
- change requests
- onboarding
- build-order dependencies
- client communication
- handoff

### F. Judgment completeness

#### CUR-017

Author judgment items for every decision required by the spec, including:

- whether a funnel is needed
- whether automation is needed
- whether GHL is appropriate
- tag vs field/value/object decisions
- whether custom code is needed
- whether to contact a prospect
- whether evidence supports an audit claim
- whether to accept a project
- realistic scope
- realistic price
- realistic complexity
- admitting uncertainty
- what could break
- what is missing / how to verify

Coverage must include all fourteen decisions called out by the Phase 24 acceptance test.

Rubrics/content must reward verified uncertainty such as "I don't know yet, but this is how I would verify it" over invented certainty.

### G. Starter projects

#### CUR-030

All five starter projects must exist and be completable:

1. Lead Capture System
2. Consultation Booking
3. Application Funnel
4. Reactivation
5. Full Capstone

Use serious multi-step projects, not one-screen wrappers.

Portfolio integration may reference Phase 23 templates/records, but do not fabricate missing artifacts or client outcomes.

### H. Boss Client

#### EXR-021

Implement a persistent Boss Client engagement with the eleven stages:

`audit -> discovery -> architecture -> pricing -> negotiation -> proposal -> implementation -> QA -> launch -> reporting -> change request`

Earlier decisions must alter later consequences. Pin at least one deterministic regression where an early choice changes a later stage.

Reuse existing sales, pricing, negotiation, simulator and delivery engines where sensible. Do not create a second parallel copy of those systems.

Boss Client state must be durable/local-first and sync safely if it is learner state. Do not expose hidden client state numerically.

### I. Persistent clients

#### CNT-009

Field Ready/full graph must have at least 20 persistent fictional clients across the listed industries:

- med spa
- coach
- consultant
- therapist
- photographer
- realtor
- gym/fitness
- pet service
- HVAC
- roofing
- cleaning
- remodeling
- dentist
- chiropractor
- law firm
- accounting
- recruiting
- course creator
- wedding vendor
- B2B service

Use the existing client schema and persistent relationship/history model. Clients need useful authored differences, not 20 name-swapped clones. No stock photos required.

### J. Capstone / Gate 12

#### CUR-015 / CUR-031

Implement the Field Ready Capstone with no normal instructional handholding.

The learner receives all nine input categories required by the spec:

- business
- offers
- staff
- metrics
- current systems
- problems
- hidden edge cases
- client communications
- budget constraints

The learner must perform all nine actions:

- diagnose
- architect
- build
- test
- troubleshoot
- price
- negotiate
- propose
- explain

Ask all eight authored reasoning questions from the acceptance definition, including why a custom field, why the pipeline, late booking, second location, missing phone, reschedule behavior, why this price, and what would be removed for a lower budget.

A real-GHL Fieldwork step is required. Reuse the Phase 22 Fieldwork system. Do not add API verification.

No normal hint controls in capstone. Preserve assistance/evidence semantics.

The capstone may use the Boss Client but must not become one giant React special case. Compose existing content-driven exercise/stage mechanisms.

### K. Field Ready coverage and completion

#### CUR-034

The generated coverage matrix must show practical work for every Field Ready core skill and must include retrieval, pricing, negotiation, calls, written sales, proposals, prospecting and fieldwork.

#### CUR-035

The Field Ready campaign must be technically completable end-to-end before any Phase 25 curriculum is added.

Create an automated deterministic campaign/evidence walkthrough that proves no impossible gate/dependency cycle exists. Where physical human or real-GHL acceptance is still required, distinguish "technical path is completable" from "Ary has personally completed it."

### L. Design/responsive/accessibility

Everything Phase 24 adds is a major product surface and must follow the existing design rules:

- no eyebrows/kickers
- no user-facing monospace
- no generic card-everything layout
- no fake stats
- no childish gamification
- no giant SaaS gradient/glassmorphism patterns
- responsive review at exactly 1440 / 1024 / 768 / 390 / 320
- tablet first-class
- no critical mobile feature removed
- keyboard operability
- visible focus
- accessible labels
- status not color-only
- approximately 44px touch targets
- reduced motion respected

The Portfolio, Clients/Boss Client and Field Ready completion surfaces should feel premium and collectible only where meaningful. Keep the surrounding interface quiet.

## Implementation checkpoints

Do not try to solve this as one unstructured patch. Use focused commits and verify between checkpoints.

### Checkpoint 1 - Coverage audit and schema/compiler foundations

Before adding lots of content:

- generate a machine-readable Phase 24 gap report from current content
- add/extend schema fields needed for identities, Field Ready topic coverage, tier boundaries and any Boss Client/project metadata
- add compiler validation/reporting for identities, coverage, 20/60/20 ratio, Bloomwired scenario percentage and GHL-current references
- add MAS-010 deterministic Field Ready evaluator and tests

Commit this foundation separately.

### Checkpoint 2 - Placement + Gates 1-7

Complete placement and content/practical gaps through Diagnosis/QA. Reuse existing units/exercises first.

Run focused content/compiler/mastery tests and the relevant existing Lab probes.

### Checkpoint 3 - Gates 8-11 + Delivery

Complete prospecting/sales/pricing/negotiation/proposal/delivery coverage including SAL-010/011/012/014.

Run focused sales/pricing/negotiation/content tests.

### Checkpoint 4 - clients + Boss Client + starter projects

Add/complete the persistent client set, Boss Client state/stages and the five starter projects.

Run persistence, branching and sync tests. Verify no client outcome claims.

### Checkpoint 5 - Capstone + Field Ready completion

Build Gate 12, capstone composition, certificate/completion view and end-to-end technical campaign walkthrough.

Keep human/real-GHL acceptance statuses honest.

### Checkpoint 6 - full audit and Preview

Run the full required verification and fix every regression before stopping.

## Required verification before handoff back

At minimum:

1. pinned Node 22 full `npm run ci`
2. typecheck, lint, format, all tests
3. content validation and content lock regeneration
4. simulator regression suite
5. mastery/campaign/Field Ready evaluator regressions
6. coverage compiler/report tests
7. placement skip tests
8. SAL-010/011/012/014 tests
9. Boss Client persistence and early-choice-later-consequence test
10. all five starter projects validated/completable through controlled fixtures
11. capstone no-hints/all-inputs/all-actions/all-reasoning validation
12. 20-client industry coverage test
13. Bloomwired scenario >=70% test
14. identity coverage test
15. 20/60/20 ratio test
16. five-width browser review for every new major screen/state
17. keyboard/touch/reduced-motion/error/empty/loading coverage
18. offline/reload persistence for new learner state
19. sync test for new synced state, including conflict behavior where mutable state can diverge
20. browser secret/provider boundary scan
21. exact-head GitHub CI
22. Preview deployment and build identity verification
23. Production deploy skipped

Do not spend real provider money merely to prove Phase 24 content. Reuse already accepted AI/call/provider paths and controlled fixtures unless a new provider path is actually introduced, which it should not be.

## Requirement status rules

Never mass-promote requirements from existence alone.

A requirement may move to PASSED only when its exact acceptance is evidenced.

Important honesty rules for this stacked phase:

- `FLD-001` / `EXR-020` remain `IMPLEMENTED_UNVERIFIED` until Ary performs the actual Phase 22 GHL run.
- Phase 21 human-unverified Call Room rows remain unchanged.
- `PRI-001`, `PRI-002`, `NEG-003` keep their existing statuses unless Phase 24 produces direct new evidence for those exact requirements. Content coverage alone does not promote them.
- `PORT-003` is Phase 24 and may be implemented if the §36 progression requirements are fully authored and tested. Do not claim Phase 23's two templates already satisfy it.
- `PRD-005` should remain `IMPLEMENTED_UNVERIFIED` if its acceptance genuinely requires Ary's own full placement-to-capstone run.
- Any capstone/Field Ready requirement depending on real GHL human work must clearly separate implemented/completable from personally accepted.
- Do not modify Phase 22 human acceptance evidence to manufacture a full pass.

## Pull request behavior

Open one draft PR:

- head: `codex/phase-24-field-ready`
- base: `codex/phase-23-portfolio`

The PR must clearly state it is the third stacked PR and that PR #24 and #25 remain parked/unmerged.

Do not merge any PR.

At the end, report:

- final head SHA
- exact-head CI run
- test count and file count
- Preview Worker/version identity
- every requirement promoted, with evidence
- every requirement still unverified/partial and why
- new migrations, if any
- any real-provider spend, expected to be zero
- exact human acceptance still required later

Then stop for independent audit.
