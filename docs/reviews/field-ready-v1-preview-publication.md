# Field-Ready v1 verified Preview publication

Rechecked: 2026-10-12, America/Los_Angeles. CI timestamps remain UTC.

## Source and immutable verification

Draft [PR #32](https://github.com/Beeyach/Bloomlab/pull/32) remains open and
unmerged at `18f112f8710766462a18256d72bba5034410973b`, based on
`codex/navigation-shell-redesign` at
`6a1ea64081e42a0dd6ea7efd3b78c0ee4abbd685`. Main remains
`59ec678910cb51559d84af3c4200590f9c7e29ec`. GitHub PR metadata, main and
the completed CI jobs were read again for this record. The preceding verified
stack capture preserves all nine draft PR bases; no stack mutation was performed.

[CI 38096748142](https://github.com/Beeyach/Bloomlab/actions/runs/38096748142),
attempt 1, completed at `2026-10-11T00:42:53Z`: **Checks PASSED, Preview
PASSED, Production SKIPPED**. Node: `v22.23.3`. Preview Worker version:
`c09f3a84-436a-46e6-8abd-84c58cabe4b7`. The retained full-suite browser
and Worker identities match the exact published head before and after execution.
The public Preview health endpoint was also read on 2026-10-12 and returned
the same full build ID with `environment: preview`; no learner API was queried.
This is verification of that publication, not a new deployment or a promise
that the shared Preview cannot later be redeployed by another PR.

Checks passed 2,205 tests / 181 files, 59 evidence/composition controls,
15 adversarial cases with zero provider spend and 89 axe scans with zero
reported violations. Axe retained 173 incomplete-node occurrences across
21 scans; those still need judgment.

All seven Preview stages passed: browser, AI-Off, binary recovery, failure
isolation, terminology, exact states and joined screen states. Evidence includes
35 browser probes, 16 AI-Off paths with a detected negative control, five
binary-recovery checks, five held failure modes and navigation's 44 cases /
5,582 assertions with zero browser errors.

The exact collector contains 253 cells: 251 browser-observed and two reviewed
directory N/A. The joined matrix also retains five lifecycle N/A cells. All
physical screenshot digests were verified, including 43 keyboard and 43 touch
cases. Joined coverage: 43 screens, 215 layout cells, 301 state/input cells,
seven N/A cells, zero shared-contract cells and **zero unverified state cells**.
All **43 human visual rows remain required**. The earlier 216-cell automation
gap is a historical snapshot, not a current missing-evidence count.

## Complete artifact verification

Each complete downloaded ZIP's size and SHA-256 match GitHub's metadata.
Underlying stage reports, joined outcomes and screenshot files were checked;
a successful upload alone is not the evidence claim.

| Artifact | ID | Bytes | SHA-256 |
| --- | --- | --- | --- |
| Preview | 11687059279 | 222895593 | `2ec7e78e9cd1b5ef6a7a0ca77f4e4d7be688dfe9d3d128671d4bbae7f8362991` |
| Adversarial | 11686405525 | 5720 | `62c16ce07f03f272271e37e68dbd278634365f457e1d2ae1243c26d83950c9fc` |
| Accessibility | 11686350714 | 12923 | `1963a06f2374f439c0e1b03ece714d3a00556f77142c39bf7bc94ae3d6ce981b` |

The recognized-pattern scan of 108 extracted report/log texts found zero
credential/private-key candidates. Four current key/link/conflict screenshots
were visually inspected, with no visible sync key. The prior failed C5 image
was reviewed separately. The successful current C5 case has its original report
and timing log, with no dedicated screenshot. This does not certify every image,
unrecognized secret format, removed artifact, claimed owner authorization or
private backup. Repository visibility was not changed.

## Retained failure boundary

CI `38092996980` at `a662b19ec0f3d3191d328a5d1bb5bb92ed7aaac2`
remains Checks PASSED / Preview FAILED / Production SKIPPED. Its stale sidebar,
Workflow Add and date/time test-driver expectations were reproduced and fixed
in the follow-up; application/Worker/content/dependency bytes were unchanged
by the follow-up. No timeout or assertion was weakened. The original failed
joined matrix remains failed despite its collector completing.

The failed C5 push and first pull consumed 10,119ms before the following pull.
Current C5 passed the original gate with a 5,009ms push, 1,731ms first pull and
544ms following pull. Historical cloud/D1/network cause, earlier supplemental
large-burst timing failure and canceled navigation modules remain unexplained.
The current pass does not convert earlier failures into passes.

## Recovery-storage retention gap

Source `worker/src/recovery/handlers.ts` creates private archive objects under
`recovery/stages/v1/` and a D1 stage with a 24-hour confirmation expiry.
`readStage` refuses an expired confirmation with HTTP 410. Successful confirm
and explicit cancel delete the staged R2 object. No scheduled handler or
configured source sweep deletes abandoned/expired stages. Expiry rejection is
therefore different evidence from physical byte deletion. Actual cloud lifecycle
configuration and abandoned-byte removal remain unverified.

[Cloudflare's lifecycle documentation](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
supports prefix-scoped expiration, with asynchronous deletion rather than an
exact application-expiry deadline. The next operational step is read-only
inspection of existing rules, followed by an approved retention policy scoped
to `recovery/stages/v1/`. Preserve canonical attachments, recordings and other
media; preserve existing rules; verify a disposable synthetic stage's deletion
and an unrelated sentinel's retention. Any strict deletion deadline also needs
an application cleanup design and failure/retry evidence. No lifecycle setting,
learner object, D1 record or credential was changed in this continuation.

## Dependency warning disposition

A fresh read-only `npm audit --json` on 2026-10-12 reports ten affected package
entries: five high, four moderate, one low, zero critical. Its nonzero exit
indicates findings, not a passing security gate. No dependency was installed,
upgraded or downgraded. An initial sandbox DNS failure was followed by a
successful network-enabled read; the failed refresh is not clean audit evidence.

Current installed dependency ancestry was inspected with `npm explain`:

| Package | Installed versions | Observed path |
| --- | --- | --- |
| source-map-js | 1.2.1 | PostCSS/Vite and css-tree/jsdom; Vite is also a content-schema workspace peer. |
| sharp | 0.35.2 | Miniflare image tooling. |
| undici | 8.10.1; 7.29.0 in two nested locations | jsdom and Miniflare. |
| brace-expansion | 5.0.9; 2.1.4 | minimatch, including filelist's nested copy. |
| fast-uri | 3.1.7 | AJV validation tooling. |
| serialize-javascript | 7.1.1 | Rollup's Terser plugin. |

The other affected entries are Cloudflare Vite/Worker-test integrations,
Miniflare and Wrangler through those transitive warnings. The previous
omit-dev report retained source-map-js, but its flag alone does not prove a
deployed vulnerable call path: the observed roots above are build/test tooling.
No direct application or Worker import of these packages was found. This bounded
ancestry/import review neither demonstrates a deployed exploit nor certifies
bundle absence or safe build handling of all untrusted inputs. Tooling findings
remain actionable even when no deployed exposure is established.

Next dependency work requires an approved upgrade scope: keep runtime contracts,
inspect maintainer fixes, regenerate only affected locked dependencies and run
Node 22 Checks plus exact-head Preview. Do not apply the audit's suggested
semver-major Worker-test downgrade automatically or weaken audit/test gates.

## Requirement and release boundary

313 registered: **284 PASSED, 8 IN_PROGRESS, 5 PARTIAL,
12 IMPLEMENTED_UNVERIFIED, 2 DEFERRED, 2 NOT_STARTED**; **24 open P0/P1**.
No status promotion. Seven previously promoted rows retain their evidence.

- PARTIAL: EXR-008, PRI-002, NEG-003, GHL-005, GHL-010.
- IN_PROGRESS: DES-006, DES-008, DES-009, DES-012, DES-017, DES-018,
  RSP-002, RSP-003. DES-012 is P2.
- Human/real-GHL IMPLEMENTED_UNVERIFIED: PRD-005, CUR-015, CUR-031,
  EXR-015, EXR-020, CALL-002, CALL-005, CALL-006, FLD-001, VOI-006,
  VOI-007, SEC-005.
- NOT_STARTED P2: PORT-003, INF-018. DEFERRED P3: FLD-003, SEC-006.

Engineering publication is verified. Broad semantic/rubric judgment, exhaustive
contextual native terminology, human design and capability equivalence,
physical-device/accessibility/microphone acceptance and real-GHL evidence remain
open. Public exposure/backup evidence, recovery retention and dependency decisions
are also retained release concerns. No merge, Production deployment, real-GHL
activity, new provider spend, status promotion or stack restructuring occurred.

This documentation correction is local until separately committed/published.
The passing CI above belongs to the exact 18f112f source, not a future commit.
