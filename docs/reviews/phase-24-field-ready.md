# Phase 24 — Field Ready implementation record

This is the third stacked delta, targeting `codex/phase-23-portfolio`. PRs #24 and #25 remain parked. No merge is authorized. Phase 22 human acceptance and the seven Phase 21 human-unverified rows remain unchanged.

## Checkpoint 1 — foundations

The pre-authoring machine-readable audit is `phase-24-baseline.json`, captured from content hash `ff28e95f24c6` at branch head `6735ee1`. The campaign has 20 skills, six placement mappings, empty Gates 6 and 12, and two projects. The full graph has five learning units, 35 exercises and five client industries. Custom values has no practical exercise.

The compiler now emits `coverage-field-ready.json`. Coverage cites authored learning units and exercises for each acceptance topic, counts each relevant item's estimated duration once, and derives scenario relevance from the referenced client's industry. The ratio tolerance is explicitly **±10 percentage points** around 20/60/20. Retrieval time includes authored retrieval, explanation, selling and review work; classification is content data, not fabricated analytics. Topic citations remain subject to substantive editorial review; merely adding a tag is not evidence that the teaching is adequate.

`coverage_enforced` is false during the ordered authoring checkpoints, so gaps are visible warnings. The final campaign must enable it before completion. Invalid topic tokens always fail schema validation; non-current Funnel Builder references always fail compilation.

MAS-010 checks ten domains independently against valid, owned, unassisted canonical evidence. Placement and retrieval cannot substitute for later independent application. Fieldwork needs a passed manual real-GHL evidence record with proof references. This evaluator is only the domain check; campaign and capstone completion must also pass. Automated fixtures do not establish Ary's human acceptance.

No schema migration or provider call is introduced by this checkpoint. No requirement is promoted from foundations alone.

## Checkpoint 2 — placement and Gates 1–7

Eight dedicated placement assessments run through the existing runner and save canonical evidence with `source.type: placement`. They are excluded from normal session selection. Strong funnel placement unlocks different work ahead and selects practical work instead of the beginner unit; weak placement keeps the unit, and later pressure/fieldwork criteria remain required. The eight areas include written prospect response and spoken discovery. Provider-dependent critique retains the existing pending/error behavior; no provider is purchased for verification.

The curriculum now adds customer-path decisions, eleven funnel-family briefs, lead handover, veterinary data modeling, workflow contracts, booking, conversion copy and the nineteen-area QA protocol. Existing repair/autopsy exercises now serve pressure assessments with no instructional hints; historical evidence is unchanged. The native core Fieldwork exercise requires manual configuration, screenshots, test observations and reasoning. It does not verify GHL through an API. No Phase 22 acceptance status changes.

QA is a structured nineteen-test record with passed/failed/blocked statuses, observations and a release decision. An unresolved test cannot be released. A responsible hold can satisfy the deterministic checks while written judgment remains pending. The new lead handover and calendar capacity exercises are tested through real simulator commands, including note events and the complete booking/reschedule/cancellation lifecycle.

Verification: 510 tests in 39 files passed across content/compiler, mastery, placement, QA and the relevant Labs. Full workspace typechecking, scoped lint and a local production build were run; the build's browser provider-code scan passed. The placement/QA browser probe covers exactly 1440/1024/768/390/320, numeric submission and persisted result. Existing CRM, Funnel and Calendar probes pass. Workflow passes every functional section but fails the pre-existing container frame-time section for 500 events; the same limitation is recorded in earlier phase reviews. Exact-head CI and Preview verification remain checkpoint 6 work.

New registry entries are limited to architecture/native-practice boundaries, verified by directly reading [HighLevel Companies](https://help.gohighlevel.com/support/solutions/articles/155000004430-getting-started-with-companies) and [Websites Overview](https://help.gohighlevel.com/support/solutions/articles/155000001633). No company editor or native page-builder simulation is claimed.

## Checkpoint 3 — Gates 8–11 and delivery

Added substantive Bloomwired prospecting, discovery, pricing/boundary, delivery and fourteen-decision judgment units, linked to existing practical engines and the missing social-writing practical. Required topic coverage now has no missing learning/practical citations; authored minutes currently report 470 instruction / 1117 practical / 392 retrieval (23.75 / 56.44 / 19.81 percent). Final coverage enforcement and completion remain later checkpoints.

Delivery adds a replayed scope-change branch, nine mandatory onboarding sections, a dependency-order workbench and four mandatory handoff sections. Unpaid scope, invalid dependency order and each individually missing handoff/onboarding section trigger deterministic failures. Complete writing retains the existing optional rubric-quality boundary; structural completeness does not fabricate a quality pass. Branch consequences are authored content, not exercise-ID UI cases.

Verification: Node 22 typecheck and scoped lint passed. The sales/pricing/negotiation/content suite passed 504 of 505 tests; its one failure identified missing sales-use metadata on the new conversion-copy/written-response skills. After correcting that metadata, all 55 targeted tests in three affected files passed, including delivery grading and Gates 8–11 vehicle checks. New sequence schema tests reject cycles, unknown dependencies and duplicate steps. No provider calls or Phase 22/21 acceptance status changes.

## Checkpoint 4 — clients and project engagements

Twenty fictional clients now cover all twenty industries. New briefs distinguish operating constraints, system boundaries, qualification, access and ownership. The fifteen new characters are explicitly text-only; existing accepted audio remains unchanged and no generation is requested. A `client_progress` snapshot record stores relationship journal entries and project attempt references. IndexedDB migration 8 adds the table and resets pull cursors to replay previously skipped records. The existing D1 client table is reused, with strict payload validation; no new D1 migration.

Five multi-stage starter projects now have an operational entry point through Clients. Application includes an actual connected qualification funnel and new/repeat form submissions. Reactivation includes an actual tag-triggered workflow trial with missing-phone fallback, opt-out/booked exclusions and duplicate prevention. Boss Client composes eleven stages. An earlier two-location choice adds four required QA tests; changing the early selection clears later selections, and chronological checks reject reuse of work begun before the revised decision. All selections resolve to owned, current canonical attempt/evidence records. No score or relationship note substitutes for project evidence.

Checkpoint 4 verification: client persistence, branch invalidation, five-project controlled walkthrough, migration and two-device conflict tests passed. The initial persistence/Portfolio/export/sync run had 61 passing tests and four Portfolio failures caused by a fixture selecting the first exercise of a type after content expansion. Pinning that fixture to its intended original exercises corrected all four; the final affected suite passed 30 tests in three files. Actual Application/Reactivation command-layer builds plus D1 strict-sync regressions passed 16 tests in two files. Existing voice manifest check passed without network generation. Scoped lint passed after removing an unused final counter mutation; final typecheck is recorded in the checkpoint log.

## Checkpoint 5 — capstone and Field Ready completion

Gate 12 is a required project-evidence gate: it references all five starter projects rather than duplicating skills already assessed in Gates 1–11. The mastery engine receives a set of projects derived from canonical saved attempt/evidence selections; an empty or unrelated completion set cannot pass it. The completion view also requires all ten independent Field Ready areas. No average or single high score can replace a missing domain or project.

The capstone contains nine input categories, nine performed actions, eleven Boss stages, a real-GHL manual proof exercise and an independent submission answering all eight reasoning questions. Compiler enforcement rejects missing inputs/actions/reasoning, hint-bearing capstone exercises and undefined branch choices. The proposal's inherited nudge was caught and removed. Completion copy lists the nine bounded capabilities without claiming expertise, real client outcomes or automatic GHL inspection. Mastery rules version advances to `2026.09.09-r5`; historical records retain their recorded versions.

The controlled IndexedDB walkthrough advances through Gates 1–12, completes all five projects, refuses completion when projects are absent despite complete domain evidence, and refuses a missing negotiation domain after project completion. This proves technical path completion only; it is not Ary's personal run or real-GHL acceptance. New text-only character metadata is rejected at the audio-generation boundary; five accepted audio characters and forty saved manifest assets retain their existing guarantees.

Checkpoint 5 verification: workspace typechecking and scoped lint passed. The initial 128-test suite found an outdated first-unit expectation and a retrieval estimate slightly outside the stricter relative tolerance used by the test; both were corrected. All 34 tests in the affected suites passed, followed by eight final compiler/boundary tests and 31 voice boundary tests. Coverage enforcement is now enabled with no missing topics, practical citations or identities. Future STRATEGIZE/AUTOMATE tiers are metadata boundaries only.
