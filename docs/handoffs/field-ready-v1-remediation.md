# Field Ready v1 remediation handoff

> Navigation follow-up: D-202 and [the navigation redesign review](../reviews/navigation-shell-redesign.md) supersede this document’s fixed-104 px/containment contract. Historical PASS evidence is preserved, but the learner’s contradictory real-use report requires fresh two-state genuine-input verification. All unrelated acceptance remains unchanged.


Branch: `codex/field-ready-v1-remediation`

Base: independent audit commit `a2466d3651ac5544f6baa113c46ae472385fa8f5` on `audit/field-ready-v1`, which itself is exact Phase 26 head `6b58d3c54bae3c7759ac238dc9dc9651ae5298ee` plus `AUDIT_REPORT.md` only.

Read first, completely:

- `AUDIT_REPORT.md`
- `BLOOMLAB_MASTER_SPEC.md`
- `CLAUDE.md`
- `REQUIREMENTS_MATRIX.md`
- `ACCEPTANCE_TESTS.md`
- `IMPLEMENTATION_STATUS.md`
- `KNOWN_LIMITATIONS.md`
- `docs/reviews/phase-26-polish.md`

## Objective

Implement only the code-fixable or repository-audit-fixable P0/P1 release blockers identified in section **Release blockers grouped by remediation type / A** of `AUDIT_REPORT.md`.

Do not re-audit the product from scratch and do not reinterpret the independent findings to broaden scope. The audit report is the authoritative remediation input.

## Hard boundaries

Do not modify, fake, auto-promote or work around human/real-environment acceptance rows listed in `AUDIT_REPORT.md` group B:

- PRD-005
- CUR-015
- CUR-031
- FLD-001
- EXR-020
- CALL-002
- CALL-005
- CALL-006
- EXR-015
- VOI-006
- VOI-007
- SEC-005

Those statuses must remain unchanged.

Do not implement P2/P3/later scope just because it is visible in the audit. In particular do not expand PORT-003, INF-018, FLD-003 or SEC-006 unless a required P0/P1 fix absolutely depends on a narrow change. If that happens, document it before changing anything.

Do not merge PR #24, #25, #26, #27, #28, #29 or the remediation PR.

Do not use production learner data. Do not add GHL API credentials. Do not add new provider spend unless a required acceptance criterion literally cannot be established otherwise, and stop first if spend would be needed.

## Work order

Proceed in checkpoints. After each checkpoint run focused tests before continuing.

### R1 — Control-document and negative-constraint reconciliation

Audit exact acceptance criteria and close rows that are already objectively satisfied without gratuitous code changes.

Priority rows:

- PRD-001 personal-first exclusion
- PRD-004 whole-product AI-Off usability
- PRD-009 architecture avoids rewrite dead ends
- INF-006 no Durable Objects
- INF-007 no Queues
- INF-008 no Redis/Supabase/Firebase/separate Node server/Kubernetes/microservices/vector DB
- SEC-002 dev/preview never points to production data
- SEC-003 learner screenshots/fieldwork media never public
- GHL-005 registry coverage
- GHL-009 approximation/known-limitations coverage
- GHL-010 exact GHL terminology

For INF-006/007/008 specifically, the independent audit already found no such bindings/dependencies in the Worker configuration or package manifests. Re-run the exact acceptance checks and update statuses only if current head proves them.

`INF-015` may be reconciled to PASSED now because `AUDIT_REPORT.md` exists and covers all ten §141 categories. This is the only status the independent auditor explicitly decided as PASS. Update `REQUIREMENTS_MATRIX.md` and `IMPLEMENTATION_STATUS.md` consistently.

### R2 — No-stub / fake/static-replacement closure

Target `EXR-024` and any directly coupled P0 issue.

Run a whole-repo learner-facing inventory for:

- `TODO` / `FIXME` tied to required behavior
- placeholder / coming-soon surfaces
- hardcoded success
- console-only actions
- nonfunctional modals
- screenshot-only or static substitutes for required interaction
- fake analytics / fabricated learner outcomes

Do not delete honest limitation labels just to make the scan green. If a surface is intentionally partial, either implement the required interaction or leave the requirement PARTIAL with exact evidence.

Add regression coverage for any actual defect fixed.

### R3 — Responsive, design and Command Center gaps

Work only on objective gaps needed for:

- DES-006
- DES-008
- DES-010
- DES-017
- DES-018
- RSP-002
- RSP-003
- RSP-004
- PRD-014 where objectively code-reviewable

Use the existing five required widths: 1440, 1024, 768, 390, 320. Include short-height coverage where navigation/sheets can overflow.

Do not redesign the visual language. Preserve the 104 px independently scrolling desktop/tablet rail and phone four-plus-More composition.

A major screen may not be called complete if a required desktop capability disappears on mobile. Fill the Screen × Desktop / Tablet / Mobile / Empty / Loading / Error / Keyboard / Touch evidence matrix honestly.

### R4 — Accessibility objective failures

Target only objective code/test defects under `A11Y-001` found during the core keyboard-flow audit.

Required keyboard-only flows include:

- start session
- open exercise
- submit
- navigate Labs

Preserve visible focus, reduced motion, non-drag alternatives and 44 px touch targets.

Do not promote A11Y-001 solely from axe/Chromium automation if physical/manual acceptance is still required by the repo's criterion. Fix code defects and leave evidence boundaries honest.

### R5 — Local-first, sync and recovery gaps

Target:

- DATA-001
- DATA-006
- SYNC-007
- INF-011 where directly related

Do not create a second persistence architecture. Preserve Dexie as working state and existing sync semantics.

Verify normal interaction never waits for the server where DATA-001 requires local-first behavior. Verify only meaningful state syncs and all synced entities carry required metadata for SYNC-007.

DATA-006 remains PARTIAL unless the actual R2 recovery-backup/scenario-attachment contract is implemented and tested. Do not pretend metadata-only export/restore satisfies binary backup.

### R6 — Security and infrastructure hardening

Target:

- INF-001
- INF-004
- INF-011
- SEC-001
- SEC-002
- SEC-003

Run source and built-browser secret scans. Never print secret values.

Verify local/preview/production bindings stay correctly separated and no local/preview path can casually target production D1. Verify private learner media remains authenticated/private with no public R2 URL/route.

Do not touch SEC-005 human acceptance.

### R7 — GHL fidelity and terminology closure

Target `GHL-005`, `GHL-009`, `GHL-010` only after registry/source/limitations coverage is exact.

Do not make new live-GHL claims. Do not treat the Phase 26 90-day freshness queue as a fresh manual verification of every feature.

Current webhook learner guidance must remain post-2026-09-01 Ed25519 / `X-GHL-Signature` only; RSA may appear only as historical/deprecated context.

Any feature-like UI label that represents real GHL must resolve to a registry record and use the official current name.

### R8 — Performance/precache

Target `PERF-001`.

The known blocker is that Academy route isolation is undermined by Workbox all-asset offline precaching of Workflow JS/CSS. Preserve installability/offline shell behavior while changing precache strategy so only stable shell/curriculum/assets and likely-next content are prefetched as required.

Do not remove offline capability to make network evidence look smaller.

Prove route-level splitting and that reading Academy does not load or background-precache the heavy Workflow Lab chunk unless it is actually likely-next under the intended policy.

### R9 — Partial exercise, pricing and negotiation breadth

Target only concrete acceptance gaps for:

- EXR-006
- EXR-007
- EXR-008
- EXR-009
- PRI-001
- PRI-002
- NEG-003

Prefer deterministic/authored coverage. Use runtime AI only where the existing architecture already requires semantic evaluation.

Do not spend provider budget simply to force a status promotion. If broad natural-language quality or human judgment cannot be established without human/provider acceptance, preserve PARTIAL and document the boundary.

Do not modify the human-gated EXR-015.

### R10 — Final reconciliation

After all fixable work:

1. Re-read every changed requirement's exact acceptance criterion.
2. Promote only rows fully proved by current-head evidence.
3. Keep all group-B human rows unchanged.
4. Update `REQUIREMENTS_MATRIX.md`, `IMPLEMENTATION_STATUS.md`, `KNOWN_LIMITATIONS.md`, `CHANGELOG.md`, review evidence and any coverage matrices consistently.
5. Never change a priority or weaken wording to manufacture completion.
6. Run control-document validation.

## Required verification

Use Node 22 matching the repo.

Run complete:

- typecheck
- lint
- format check
- all unit/integration tests
- simulator regressions
- content validation and freshness
- adversarial suite
- accessibility CI
- production browser-secret scan/build checks
- full build

Then run the relevant browser/Preview probes, including all five required widths, keyboard/touch/reduced-motion, offline/reload, sync/conflict, Search, restore, rail and every surface changed by remediation.

Deploy Preview only. Production must remain skipped.

Browser and Worker build IDs must match the exact remediation head.

Record intermittent/failing evidence honestly. Never relabel a failed run as passing because a later unrelated run passed.

## PR / stop condition

Open one draft PR from `codex/field-ready-v1-remediation` against **`audit/field-ready-v1`**, not main and not `codex/phase-26-polish`. This keeps the remediation diff focused on top of the independent audit.

The PR description must state:

- exact head
- exact base audit commit
- status promotions with evidence
- remaining P0/P1 rows
- human rows preserved
- complete test counts
- Preview identity/version
- provider spend
- migrations, if any
- known limitations that remain

Then stop for independent ChatGPT re-audit. Do not merge.
