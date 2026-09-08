# Phase 22 - Fieldwork

Branch: `codex/phase-22-fieldwork`

Base: `main` at `59ec678910cb51559d84af3c4200590f9c7e29ec`

Implementation agent: Codex Astra High

Do not merge this branch yourself. Build the phase, open or update a draft PR, run exact-head CI and Preview verification, then stop for independent audit and the required human real-GHL acceptance.

## Baseline

Phase 21 is merged and production-green.

- PR #23 squash merge: `59ec678910cb51559d84af3c4200590f9c7e29ec`
- main CI: `34267608095`, Checks SUCCESS, Production deploy SUCCESS, Preview skipped
- production migrations applied successfully: `0004_call_room.sql`, `0005_grading_diagnostics.sql`
- production voice index: 40 metadata rows verified
- production Worker Version ID: `291517ab-8f2b-44d3-96aa-6dd7a615cc6c`
- Phase 21 accepted rows remain honest. `CALL-002`, `CALL-005`, `CALL-006`, `EXR-015`, `VOI-006`, `VOI-007`, `SEC-005` remain `IMPLEMENTED_UNVERIFIED`. Do not promote them as part of Phase 22.

Before substantial implementation, update historical status text that still says PR #23 is draft/open/unmerged. Record the merge/main-production facts above, but preserve every documented Phase 21 limitation and every unverified row.

## Authoritative Phase 22 requirements

Implement exactly the Phase 22 Fieldwork slice. Do not pull Phase 23 Portfolio or Phase 24 Field Ready content into this PR.

### FLD-001 - Real-GHL proof flow

A FIELDWORK exercise represents actual work performed manually in the learner's real GHL training/subaccount.

The flow must collect, as authored by content:

1. screenshots where helpful
2. configuration answers
3. an explanation
4. test results
5. then, only after the work/proof checkpoint, reasoning answers

The exercise must be real and usable. A static checklist, fake success state, nonfunctional upload modal, or screenshot-only mock does not satisfy EXR-024.

### FLD-002 - no GHL credentials or API dependency in v1

This is P0 and cross-cutting.

- Do not request, collect, store or proxy GHL passwords, session cookies, API keys, Private Integration tokens, location tokens or production credentials.
- Do not add a GHL API connector in Phase 22.
- Do not make completion depend on a live GHL API request.
- The learner manually performs the task in a dedicated training/subaccount and returns to Bloomlab with evidence.
- An ordinary fieldwork flow must work with AI Off.

### FLD-003 - deferred

Do not implement optional GHL API verification. It remains `DEFERRED` for a later approved integration phase.

### FLD-004 - real-GHL mastery gate

A skill whose mastery requirements include `fieldwork_required: true` must not reach `MASTERED` without a valid fieldwork pass carrying provided real-GHL evidence.

The mastery engine already contains the intended gate. Preserve and integrate it instead of rewriting mastery.

### EXR-020 - FIELDWORK exercise family

FIELDWORK remains a normal data-driven exercise family rendered through the existing exercise runner. Do not create one React page per fieldwork task.

## Existing architecture you must preserve

Inspect the current source before changing it. Important existing pieces:

- `packages/content-schema/src/schemas/exercise.ts` already has a nullable `fieldwork` block with `required`, `tasks`, evidence kinds and `reasoning_questions`, and already refuses a `FIELDWORK` exercise without required real-GHL fieldwork.
- `packages/mastery-engine/src/evidence.ts` already supports `source.type = fieldwork`, evidence kinds `fieldwork` / `real_ghl`, and `real_ghl { required, provided, evidence }`.
- `packages/mastery-engine/src/mastery.ts` already refuses `MASTERED` when `fieldwork_required` is true and `fieldwork_passes` is zero.
- `ExerciseAttemptRecord` / `skill_evidence` / the local-first outbox are the existing learning path. Do not create a competing second source of truth without a strong reason.
- Dexie is currently version 5. Any new local tables require a new additive version. Never edit old Dexie versions in place.
- D1 migrations are additive. Never edit `0001` through `0005`.
- R2 is private. Keep fieldwork screenshots private as well.

## Phase 22 product shape

### 1. Content-driven fieldwork contract

Evolve the current fieldwork content schema only as much as needed to author a real reusable flow.

The UI must not know exercise IDs or hardcode prompts.

A fieldwork definition needs enough authored structure to express:

- task instructions
- required vs optional screenshot requests, because the spec says screenshots "where helpful", not always mandatory
- configuration questions
- explanation prompt(s)
- test cases/results to record
- post-proof reasoning questions

Prefer stable keys for every authored response so drafts survive reload and future content changes can be handled deliberately.

The current simple enum/string-list shape may be enriched if necessary. First verify whether any existing content already authors non-null fieldwork. Preserve compatibility if there is existing authored data.

Do not add fields just because they might be useful someday.

### 2. Learner flow

A FIELDWORK exercise should feel like a serious practical handoff, not a survey form dumped on one screen.

Use clear phases while retaining the existing ExerciseRunner shell:

1. **Build in GHL** - task/objective, what must exist, what to test. Make it explicit this is the learner's training/subaccount, not a production account requirement.
2. **Capture proof** - authored screenshots/configuration/explanation/test results.
3. **Proof checkpoint** - validate that required proof is locally durable before revealing the final reasoning section.
4. **Reasoning** - show the authored reasoning questions after proof is complete. This ordering matters. Do not reveal hidden answer keys or future grader criteria.
5. **Complete** - finalize the exercise and emit the correct mastery evidence once, idempotently.

Draft text and local screenshot blobs must survive reload. A network/upload failure must not erase the learner's work.

If a required test result is recorded as failed, do not call the fieldwork a pass. Tell the learner to fix/retest, preserving all other evidence.

The implementation must make it obvious what remains incomplete without inventing fake automated verification.

### 3. Screenshot evidence

Screenshots are actual evidence, not decorative previews.

Implement a private, recoverable upload path suitable for Phase 22 and not hostile to Phase 23 reuse.

Requirements:

- accepted image types only, prefer PNG/JPEG/WebP
- bounded file size and bounded image dimensions where practical
- validate type server-side, never trust filename/extension alone
- save the local Blob/checkpoint before remote upload so a failed request can be retried
- private R2 object storage only
- owner-scoped authenticated read and delete
- another learner/session cannot read or delete the asset
- anonymous/revoked session cannot read or delete the asset
- do not expose public R2 URLs
- no OCR
- no computer vision provider
- no Anthropic image input
- no Google/ElevenLabs involvement
- never send screenshot bytes to unrelated services
- do not log screenshot bytes, image content, extracted text, GHL URLs containing sensitive identifiers, or credentials
- give the learner a visible delete/replace path before final submission, and preserve truthful deletion state afterward

Display a concise privacy note asking the learner to crop or redact customer PII when possible. Do not make the UI alarmist.

If a small reusable private evidence-asset primitive cleanly avoids duplicating the same upload plumbing in Phase 23, that is acceptable. Do not build Portfolio UI, portfolio records, a generic media manager, or public asset sharing in this phase.

### 4. Configuration answers, explanation and test results

These are structured proof, not one giant textarea.

- configuration questions are content-authored and stored by stable key
- explanation is content-authored and saved separately from configuration facts
- each authored test result should record enough to know what was tested, the observed result, and pass/fail status
- do not pretend Bloomlab verified the GHL configuration automatically
- the learner's own recorded test result is manual proof in v1
- a failed required test prevents a fieldwork pass

Keep the v1 answer types intentionally small. Do not build a form-builder product.

### 5. Reasoning questions

The spec says Bloomlab collects the practical proof and **then questions reasoning**.

- reasoning prompts are authored content
- reveal them after the proof checkpoint, not before
- save answers locally as the learner writes
- do not require runtime AI merely to finish fieldwork
- do not fabricate semantic certainty about the answer if no deterministic rule can judge it

If the existing exercise/rubric path can safely give optional coaching after a submitted reasoning answer, keep it secondary and AI-Off compatible. Do not make AI a Phase 22 blocker.

### 6. Passing and evidence semantics

A fieldwork pass must mean at minimum:

- this is an authored FIELDWORK exercise with `fieldwork.required: true`
- all required proof fields are complete
- every required test result is passing
- required reasoning questions are answered
- the learner explicitly confirms the work was performed in their GHL training/subaccount
- any screenshot required by the authored content is durably stored and references a live private asset

Do not claim that Bloomlab independently inspected GHL. The evidence is manual proof in v1.

On finalization, emit valid mastery evidence through the existing learning pipeline.

For each skill the exercise demonstrates, the fieldwork evidence should carry:

- `kind: fieldwork` unless the existing rules require the equivalent real-GHL kind for a specific reason
- `source.type: fieldwork`
- the exercise/attempt IDs
- result and score consistent with the exercise result
- assistance/mode using the existing rules
- current app/content/simulator/rules versions
- `real_ghl.required: true`
- `real_ghl.provided: true` only for a genuinely completed proof set
- a bounded list of sanitized evidence references, such as asset IDs, proof item keys, and completed test IDs, never screenshot contents or credentials

A failed/incomplete fieldwork attempt must not create a passing real-GHL evidence record.

Finalization and reload/retry must be idempotent. Never mint duplicate fieldwork mastery passes for the same completed attempt.

### 7. FLD-004 regression

Add a direct mastery regression that proves the requirement independently of UI.

Construct a skill with `fieldwork_required: true` and enough independent/pressure/sales evidence to satisfy every other mastery condition.

Assert:

- without a valid fieldwork pass, it is not `MASTERED` and reports `real_ghl_fieldwork` missing
- a fieldwork-shaped row with `real_ghl.provided: false` still does not satisfy the gate
- a failed fieldwork row does not satisfy the gate
- a valid passed fieldwork row with provided proof satisfies the fieldwork requirement and allows `MASTERED` when all other requirements are met

Do not weaken existing proof validation.

### 8. At least one real authored FIELDWORK exercise

This phase needs a learner-facing exercise, not only framework code.

Audit:

- all skills with `mastery_requirements.fieldwork_required: true`
- all GHL feature registry entries with `simulation_fidelity: REAL_GHL`
- current Field Ready skill/content relationships

Author the smallest serious Phase 22 fieldwork exercise that uses existing current GHL concepts and can be completed safely in a dedicated training/subaccount.

Do not invent native GHL features. Do not change a registry feature to REAL_GHL merely to manufacture a test case.

If no suitable existing REAL_GHL + fieldwork-required pairing exists, document that finding before choosing the smallest spec-consistent addition. Any GHL registry change must follow the existing freshness/source rules and use current official GHL documentation where possible.

The exercise should be useful enough for Ary to actually perform during Preview acceptance. It should not require a production client's data.

### 9. Local-first and recovery

Follow Bloomlab's existing local-first behavior.

At minimum verify:

- typed proof survives reload
- local screenshot Blob survives reload before upload
- failed upload leaves the same Blob retryable
- successful upload can be resumed without repurchasing/re-uploading needlessly
- reasoning answers survive reload
- final submission survives reload
- no screenshot bytes enter the normal sync JSON/outbox
- sync contains metadata/references only

Do not put Blob/base64 screenshot data in D1, the sync queue, localStorage or Git.

### 10. Storage and migrations

Choose one canonical fieldwork record ownership model after inspecting the existing attempt/sync code.

The technical architecture lists `fieldwork` in the Learning domain, but do not duplicate the full exercise attempt just to match a table name. If the exercise attempt response is already the correct canonical state, keep it canonical and add only the durable server metadata actually required for private assets/proof.

If a dedicated synced fieldwork entity is warranted, it must use the same revision/device/tombstone conventions as existing sync entities and must not create conflicting ownership with `exercise_attempts`.

Any D1 additions start at `0006_...` or later. Any Dexie additions use version 6 or later. Additive only.

### 11. Security boundary

Phase 22 must have an explicit source/test boundary proving:

```text
real GHL training/subaccount
    ^ learner manually works there
    |
Bloomlab browser
    -> local IndexedDB proof/drafts
    -> Bloomlab Worker authenticated evidence endpoints
    -> private R2 screenshots + D1 metadata
```

There is **no Bloomlab -> GHL API** arrow in v1.

There is **no screenshot -> AI/provider** arrow.

Add source/browser tests that fail if the fieldwork client introduces direct requests to GHL API hosts, public R2, Anthropic, Google, ElevenLabs or other unrelated services.

Do not collect GHL credentials in any field, query string, local preference, D1 row or log.

### 12. UX and responsive acceptance

Fieldwork is practical work, so the page can be denser than Call Room but must remain calm and clear.

Preserve design rules:

- no generic card-everything layout
- no fake analytics
- no eyebrows/kickers/overlines
- no monospace learner UI
- no childish reward language
- status is not color-only
- visible focus
- keyboard operability
- touch targets appropriate on phone
- reduced motion respected

Review at exactly:

- 1440
- 1024
- 768
- 390
- 320

Phone must support selecting a screenshot from Photos/files, replacing/deleting it, filling all proof fields, completing reasoning and submitting without a desktop-only control disappearing.

### 13. Human Preview acceptance boundary

Automated/browser tests do not satisfy FLD-001 by themselves because the requirement is real GHL fieldwork.

After exact-head CI + Preview are green, stop and provide a short human acceptance checklist for Ary.

The checklist should require one actual run in her **GHL training/subaccount**, never production credentials:

1. open the exact Preview FIELDWORK exercise
2. perform the authored task manually in GHL
3. upload/capture the required proof
4. fill configuration answers and explanation
5. perform the authored tests and record results
6. pass the proof checkpoint
7. answer the newly revealed reasoning questions
8. submit
9. reload and confirm result/evidence persisted
10. inspect Skill Map / capability state and verify real-GHL fieldwork is no longer the missing requirement for the targeted skill

Keep this checklist as short as the exercise permits. Do not make Ary repeat unrelated Phase 21 testing.

Until that real human run succeeds, FLD-001 / EXR-020 should be `IMPLEMENTED_UNVERIFIED`, not `PASSED`.

FLD-004 may become `PASSED` from deterministic mastery tests if the full gate is proven, but do not use that to claim FLD-001 is live-accepted.

FLD-002 may become `PASSED` only with source/runtime evidence that the v1 fieldwork path never asks for or sends GHL credentials/API requests.

### 14. Review automation

Add a focused Phase 22 browser review/probe instead of relying only on unit tests.

It should exercise with controlled app-origin fixtures:

- new FIELDWORK attempt
- typed proof persistence
- local screenshot selection/checkpoint
- failed upload and same-Blob retry
- successful private asset metadata
- replace/delete
- evidence checkpoint
- reasoning reveal only after checkpoint
- failed required test blocks completion
- corrected test result permits completion
- final fieldwork attempt/evidence written once
- reload/resume
- 5 widths
- keyboard + touch
- loading/error states
- no direct provider/GHL/public-R2 browser egress

The automated probe must not impersonate the real-GHL human acceptance. Label it controlled/browser evidence.

## Phase 21 closure docs to update on this branch

Correct stale historical wording where needed:

- PR #23 is merged
- merge SHA `59ec678910cb51559d84af3c4200590f9c7e29ec`
- main CI `34267608095` success
- migrations `0004` and `0005` production success
- production voice metadata 40 rows verified
- production Worker Version ID `291517ab-8f2b-44d3-96aa-6dd7a615cc6c`

Do not rewrite the Phase 21 review evidence. Do not erase the Safari/private-browsing/scripted-roleplay limitations. Do not promote the seven unverified Phase 21 rows.

## Required Phase 22 verification before handing back

Run the complete pinned Node 22 project checks, not only focused tests.

At minimum:

- relevant content-schema tests
- content compiler/check
- mastery-engine tests including FLD-004 direct regression
- fieldwork UI tests
- local persistence/Dexie tests
- Worker asset auth/storage tests
- sync tests affected by metadata/reference changes
- browser security/egress assertions
- fieldwork browser probe at all five widths
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run validate:docs`
- `npm run content:check`
- `npm run voice:check`
- `npm run build`
- the repo's canonical `npm run ci`

Preview deployment must be green on the exact final head.

Do not deploy Phase 22 to production yourself. Production happens only after independent audit and merge.

## Requirement/status discipline

Expected Phase 22 target rows:

- `FLD-001` - implement, keep `IMPLEMENTED_UNVERIFIED` until real human GHL acceptance, then candidate for PASSED
- `FLD-002` - candidate for PASSED with no-credential/no-GHL-API proof
- `FLD-003` - remain DEFERRED
- `FLD-004` - candidate for PASSED when mastery regression and real evidence path are correct
- `EXR-020` - same live-acceptance boundary as FLD-001

Do not opportunistically mark unrelated cross-cutting rows PASSED.

Update:

- `REQUIREMENTS_MATRIX.md`
- `ACCEPTANCE_TESTS.md`
- `IMPLEMENTATION_STATUS.md`
- `KNOWN_LIMITATIONS.md`
- `CHANGELOG.md`
- relevant decisions/operations/review docs

Only claim what evidence supports.

## Explicit non-goals

Do not implement in Phase 22:

- GHL API verification
- GHL Private Integration setup
- storing GHL credentials
- browser/computer automation of the user's GHL account
- OCR or screenshot semantic verification
- public screenshot links
- portfolio UI or portfolio publishing
- Field Ready capstone
- Boss Client
- placement assessment
- Phase 24 curriculum completion
- Phase 25 specialist paths
- automatic client outcome claims

## Stop condition

When implementation is complete:

1. open/update a **draft** Phase 22 PR to `main`
2. make the PR body a factual evidence summary with exact final head and CI/Preview run IDs
3. leave the PR open, draft and unmerged
4. do not ask Ary to paste credentials or secrets
5. stop with the exact Preview URL + exact FIELDWORK exercise URL + the minimal real-GHL human acceptance checklist
6. wait for independent audit/human acceptance
