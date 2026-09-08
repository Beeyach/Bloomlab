# Phase 21 final remediation — human acceptance pending

> Historical record. Phase 21 PR #23 was merged on 2026-09-08 as `59ec678910cb51559d84af3c4200590f9c7e29ec`. Main CI `34267608095` Checks and Production deploy succeeded; production migrations `0004`/`0005`, 40 voice metadata rows and Worker `291517ab-8f2b-44d3-96aa-6dd7a615cc6c` were verified. Draft/unmerged instructions below describe the earlier review stage. All acceptance limitations and seven unverified rows are preserved.

PR [#23](https://github.com/Beeyach/Bloomlab/pull/23) remains draft/open and unmerged. Execution follows the complete [final remediation handoff](../handoffs/phase-21-final-acceptance-remediation.md), starting from handoff head `28e52583b76d8ddf4058aaa923ffe8fba16feb65`. Production calls remain disabled. Google/ElevenLabs credentials were used only inside the deployed Worker; no values were inspected.

## Changes and validation

- `worker/src/ai/handlers.ts` rebuilds new grading input as numbered `client_context` / `learner_confirmed` turns and `closing_client_context`. Raw audio, original STT, notes and arbitrary browser text remain excluded. The historical server-owned request identity remains stable, so old saved rubric results replay without a new purchase.
- `worker/src/call/grading.ts` defines the speaker contract and verifies that quotations in rubric explanations, strengths and critical claims literally occur in confirmed learner text. Unsupported quotations enter the existing single repair path before persistence. This guard verifies citations, not every unquoted semantic claim; manual live review remains necessary.
- `worker/src/call/response.ts` selects a safe 3–100-character contiguous literal quote without AI, then adds exactly the authored question. Whitespace selection preserves literal containment; unsafe markup/control/surrogate content retains the authored fallback. Existing engines still own scenario/economic consequences. `intelligence.ts` keeps bounded cheap classification and removes strong-model quote extraction; `turns.ts` applies the deterministic response after the authored transition.
- `worker/src/call/voice.ts` records CV-scoped provider attempts/request IDs/billed characters in the existing generation ledger and private R2 recovery metadata. Identical requests and interrupted D1 completion reuse the original purchase. No new migration, arbitrary-text endpoint or regeneration of the 40 authored assets.
- Focused tests inspect actual provider input/instructions, citation rejection/repair, literal quote bounds/unsafe fallback/state preservation, synthesis receipts/recovery and uncertain-purchase text fallback. The full run exposed an existing AI-settings test race; `apps/web/src/ai/client.test.tsx` now waits for loaded canonical usage before checking the persisted mode.

Runtime `1154e4a47749b89f4abfc962a1b5c637f9eb64e8`: [CI 34193906133](https://github.com/Beeyach/Bloomlab/actions/runs/34193906133) passed **1,758 tests / 107 files**, Checks and Preview deploy. Production deploy was SKIPPED; no development migrations were pending. Preview Worker: `2ea207fd-f5f2-4b41-9604-54e884407a68`.

The subsequent citation correction is `44d346b3e7ce93b9ae6e0e36022dee990ae31f17`, [CI 34195038400](https://github.com/Beeyach/Bloomlab/actions/runs/34195038400). Focused citation/call/AI tests: **81 passed**, with Worker typecheck, lint and formatting passed. Exact-head CI passed **1,767 tests / 108 files**, Checks and Preview deployment, with Production SKIPPED and no pending development migrations. Preview Worker: `e0ab2cbb-7aa8-49cd-98c5-5efac604c4cd`. Renewed deployed grading results are recorded below.

## Live dynamic ElevenLabs acceptance

A fresh owner-authorized Northwind call entered the authored open-response node through a normal confirmed API turn with AI Off. The deterministic line quoted confirmed fictional test text and kept the authored question. Switching the disposable learner to Limited allowed exactly one synthesis request.

- First audio request: HTTP 200, `source: dynamic`, `cached: false`.
- ElevenLabs receipt: **69 billed characters**, **1 provider attempt**, request `KMNzZcaPGGzqi5mfKmeX`. This is the actual response-header usage unit; no dollar invoice total is inferred.
- Private asset: `CV-0452196de51bc80f05dd048a3066b60d28e5eb4035e8cc1a3db874376c7b0e19`. D1/R2 matched **112,475 bytes**, SHA-256 `c4d8be400c64efb6930acb42b164e27acbf3d4e97079fc53447f83b42a01b0f6`; browser decoding/playback succeeded for **6.966 seconds**.
- Identical second audio request: same URL, `source: dynamic`, `cached: true`. The complete receipt was unchanged: **0 additional provider attempts / 0 additional billed characters**.
- Anonymous and revoked access: **401**. Other learner playback and generation: **403**. Arbitrary caller text in an audio request: **400**.
- Disposable dynamic audio was then deleted from private R2; playback returned 404. The billing receipt and durable purchase claim remain, preventing repurchase of the deleted review asset. Both review devices were revoked. Authored Phase 20 assets were not regenerated.

## Fresh grading and the follow-up correction

The first two fresh completed calls used eight real Google STT requests on browser-reencoded prerecorded fictional speech, followed by explicitly confirmed non-sensitive test text. They did not exercise a real human microphone or the Call Room's local confirmation queue. All eight diagnostic raw objects were deleted and confirmed transcript/history survived.

| Sample | Result | Actual AI cost | Manual attribution review |
| --- | --- | --- | --- |
| Northwind `0ad9fa3c-1381-414b-bf00-6060f8a94dc3` | 82; eight rubric items | $0.007083 | FAILED: jargon credited client-only ServiceTitan wording to the learner. Other seven explanations reviewed. |
| Summit proposal `69b91c1a-d23d-4e1a-b5da-6a2e1466b0ae` | 88; eight rubric items | $0.007642 | All eight explanations reviewed with roles/factual support intact. Does not erase the first sample's defect. |

Both were real Haiku rubric requests; total **$0.014725**, **$0 residual reservation**, and identical rubric retries returned their saved result. No classification or strong extraction was purchased. The ServiceTitan failure is the regression for `validateLearnerQuotations`, which now rejects it and invokes the existing single repair. Those historical results remain immutable; renewed acceptance uses new attempt IDs.

## Validation and timeout follow-ups

On `44d346b`, a fresh $1-budget call (`d166bc60-8852-4059-870e-cb4f25491ed2`) used the governor's Haiku downgrade and returned `502 evaluation_invalid` after two responses. Cost **$0.014441**, residual reservation **$0**; no successful feedback was stored. The exact rejected provider text was not logged, so this report does not invent its precise invalid quotation or schema failure. All four raw objects were deleted and the device revoked.

A separate fresh call at the normal $10 budget (`0867e8d1-dcf3-4437-b52b-f54132f5bcec`) routed the authored strong rubric to Sonnet 5 but hit the shared **30-second deadline**. The provider billing outcome is unknown. Its **$5.04096 conservative reservation remains** on that disposable review learner; it is not reported as actual spend or silently released. Raw objects were deleted and its device revoked.

`5ad85acdb149d2990edfa8705e330583a0233bd4` gives call grading a speaker-aware provider envelope and a **90-second deadline per response**, while retaining the 2,048-token cap, one repair and existing budget/unknown-purchase rules. The body is identified as call evidence, preserving speaker labels, rather than labeling all context a learner submission. Fake-timer regressions prove a 35-second response completes and both the call-specific 90-second and existing generic 30-second deadlines still abort with sanitized errors. Focused provider/call/grading/AI tests: **85 passed**, Worker typecheck/lint/formatting passed. [Exact-head CI 34196331756](https://github.com/Beeyach/Bloomlab/actions/runs/34196331756) passed **1,770 tests / 108 files**, Checks and Preview deployment; Production was SKIPPED, with no pending dev migration. Worker: `26afa02e-278c-4160-b22d-493688fa474e`.

[Anthropic's structured-output documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) documents additional latency for first schema compilation. This is context for retaining a bounded longer grading deadline, not proof of what caused the observed timeout.

## Accepted fresh grading on the final runtime

Northwind attempt **`aafff962-0afa-4bb8-b0c5-17f60f7d714c`**, run **`32319f5d-b428-4125-9c8e-05f6240be243`**, returned HTTP 200, **score 78 and all eight rubric items** from real Sonnet 5. Manual review compared every explanation with the separately labeled server-confirmed turns:

| Dimension | Attribution and factual-support review |
| --- | --- |
| Questions | The quoted ownership/follow-up question is exactly the learner's turn 2. |
| Listening | The learner reflects Tina and unanswered quotes from the preceding client context. |
| Diagnosis | The learner asks whether that is the gap, then the client confirms before the proposed review. |
| Clarity | The process-review/one-quote inspection quote is literal learner text and contains no build promise. |
| Jargon | Both cited phrases are learner wording. ServiceTitan is correctly identified as **absent** from learner speech in improvements. |
| Pitch timing | The review request follows diagnosis agreement; no premature solution is invented. |
| Objection handling | No explicit objection in this sample; no defensive or unsupported learner response credited. |
| Next step | The learner proposes the review; the client's agenda request is explicitly context only. |

Accent/pronunciation are excluded. Existing deterministic critical/required gates remain authoritative in the full suite. Actual accepted grading cost: **$0.018342**, **$0 residual reservation**, one provider response. The identical rubric retry reused the saved result. This meets the handoff's minimum of one clean fresh call; it does not claim all future model explanations are infallible.

The materially different proposal attempt **`7e49ddb6-218f-4e1c-b3e1-e0f2dcea9a65`** returned `502 evaluation_invalid` after two responses, costing **$0.0196305**, **$0 residual reservation**. Its rubric run is failed, with no successful grade saved. It is not a second accepted sample, and its unlogged rejected content is not guessed. Further acceptance comes from the required human calls.

Known Anthropic spend across **all** remediation diagnostics is **$0.0671385**. The older timeout's actual bill is unknown and excluded from that known total; its **$5.04096 reservation remains**. ElevenLabs reported **69 billed characters**, one purchase, zero additional synthesis on reuse. Google returned **24 successful prerecorded diagnostic recognitions** during these fresh-attempt checks; every disposable raw object was deleted and transcript/history survived. None of those 24 recordings is a human microphone acceptance result.

## Deployed browser and privacy checks

The final-runtime browser probe passes at **1440 / 1024 / 768 / 390 / 320**: no page overflow, 16px notes inputs, controls at least 44px tall, all six room elements, and advanced-mode anchors absent. Phone and desktop captures were visually inspected. A controlled browser transport failure before the audio request shows client text and **Continue with client text** advances; keyboard focus is visible on **Record reply**. Native microphone requests count 0 before Record and 1 after, but this Codespace still exposes **zero actual audio inputs**. This is not a completed physical microphone call.

The first probe tried to focus Replay before the asynchronous save finished rendering it; the corrected probe waits for that enabled control. Both probe devices were revoked. Actual browser requests remain on the Bloomlab origin; the production build's provider/credential scan passes. The dynamic asset separately proves 401/403/revocation and arbitrary-text rejection. No credentials, keys, tokens, raw audio or real learner speech are committed. Private recording controls already verified in the prior independent audit remain in place.

## Exact requirement decisions

- **IMPLEMENTED_UNVERIFIED → PASSED:** CALL-003 (the minimum fresh eight-dimension role-correct sample plus regression/security gates); VOI-003 (real authorized dynamic synthesis, private playback and zero-second-purchase cache reuse).
- **Remain IMPLEMENTED_UNVERIFIED:** CALL-002, CALL-005, CALL-006, EXR-015, VOI-006, VOI-007, SEC-005. They require the actual human microphone/local Blob/visible correction and full touch/keyboard flow, including real-recording retention/recovery/privacy observations.
- **Remain PASSED:** CALL-001, CALL-004. No unrelated promotion; DATA-007 remains PASSED, and PRI-001, PRI-002, NEG-003, EXR-024 and broader infrastructure/privacy carryovers keep their prior status.
- Roll-up: **313 total; 193 PASSED, 8 IN_PROGRESS, 23 PARTIAL, 7 IMPLEMENTED_UNVERIFIED, 2 DEFERRED, 80 NOT_STARTED.** Phase 21 is not complete or production-ready.

## Remaining human step

**Mobile touch microphone: PENDING. Desktop keyboard microphone: PENDING.** Stop for the user after the fixes deploy and renewed provider checks finish. The exact Preview links and steps are in [the human microphone checklist](../operations/call-room.md#remaining-human-microphone-acceptance). Required observations include native permission only after Record, local saved checkpoint before upload, real STT, visible original/corrected text, confirmation and complete calls, retry without losing saved audio, default cleanup plus retained replay/explicit deletion, feedback and device revocation.

Physical Safari/iOS remains unverified unless it is the phone actually used. Abandoned raw recordings still have no timed expiry sweep; browser eviction, unfinished in-memory capture, uncertain provider reconciliation, no full-duplex/background STT and no active-call cross-device resume remain documented limits. Production secret readiness and reviewed production gates require later independent coordination; no merge or production deployment has been performed.

Sanitized source evidence: [phase-21-final-remediation-evidence.json](phase-21-final-remediation-evidence.json). The detailed historical [Phase 21 review](phase-21-call-room.md) preserves earlier controlled/prerecorded evidence and its limits.
