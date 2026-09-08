# Phase 21 final acceptance remediation

> Historical record. Phase 21 PR #23 was merged on 2026-09-08 as `59ec678910cb51559d84af3c4200590f9c7e29ec`. Main CI `34267608095` Checks and Production deploy succeeded; production migrations `0004`/`0005`, 40 voice metadata rows and Worker `291517ab-8f2b-44d3-96aa-6dd7a615cc6c` were verified. Draft/unmerged instructions below describe the earlier review stage. All acceptance limitations and seven unverified rows are preserved.

Independent audit follow-up for PR #23.

Model: Codex Astra High.

Do not merge. Leave PR #23 draft/open until ChatGPT independently verifies exact-head CI, live acceptance, production-secret readiness and final production gate changes.

## Exact starting point

Current audited PR head before this handoff:

`6e88c499989474d1efda19e0e9933c299d3c3933`

Exact-head CI `34191556108` is SUCCESS: Checks and Preview deploy passed, Production skipped, 1,743 tests / 106 files.

Preview Google recognition is real and working: seven deployed `us/chirp_3/en-US` requests succeeded against the installed `GOOGLE_CLOUD_CREDENTIAL` Worker secret. Private R2/D1, deletion, 401/403/revocation, retry-from-existing-object and server-confirmed call grading paths have live evidence. Do not repeat or weaken those controls unnecessarily.

The PR is not merge-ready. Three substantive acceptance gates remain.

## 1. Fix CALL-003 speaker attribution before buying another grading run

A real Anthropic call returned all eight rubric items and score 82, but one `questions` reason credited a question spoken by the client to the learner. This is a real grading-quality defect, not an evidence-label issue.

The server already rebuilds call grading input from the owner-verified completed call. Preserve that security boundary.

### Required correction

Strengthen the call-specific grading contract so speaker roles cannot be casually conflated:

- Keep client utterances because listening/objection handling need context.
- Make the serialized structure explicitly role-safe, for example numbered turns with separate fields such as `client_context` and `learner_confirmed` rather than an ambiguous conversational blob.
- In the stable call-grading instruction, state unambiguously that **only `learner_confirmed` text is evidence of what the learner said or did**. `client_context` is context only and must never be credited to the learner.
- Require every rubric explanation to evaluate learner behavior against the corresponding client context rather than attributing client wording to the learner.
- Preserve the existing rule that original STT text, raw audio, notes and arbitrary browser submission text never reach Anthropic.
- Accent/pronunciation remain excluded.
- Deterministic critical/required failures remain authoritative.

Add focused regression coverage that inspects the exact call grading provider input/instructions. Include a deliberately distinctive client-only sentence and learner-only sentence so the test proves the two roles remain separately represented and the provider instruction forbids treating client-only text as learner evidence.

Do not solve this by deleting client context from the model input; that would make listening and objection handling less grounded.

After deployment, run fresh live grading on a **new** completed call attempt. Do not reuse the previous attempt because rubric-run idempotency correctly returns its saved result. Review all eight explanations manually for role attribution and factual support. One clean call is the minimum; two materially different fresh calls are preferable if total AI cost remains small. Record actual cost and no residual reservation.

## 2. Make VOI-003 dynamic speech reliably reachable without relaxing authorization

Live attempts reached authored fallback twice, so no authorized dynamic line reached ElevenLabs. Do not force database state and do not loosen quote validation just to manufacture evidence.

The architecture should follow Bloomlab's hierarchy: code/deterministic behavior before optional strong AI.

The current `open_response` contract already authorizes exactly one question on an authored node. It is safe to make quote selection deterministic when possible rather than requiring a strong-model success merely to select a contiguous learner quote.

Preferred direction:

- For an authored `call.open_response` node, derive a short contiguous quote deterministically from the **confirmed learner transcript** using a small pure helper.
- Normalize whitespace/control characters, enforce the existing short length bound, reject unsafe markup/control content, and select only text that is literally present in the confirmed transcript.
- Compose exactly the already-authorized response shape: `You mentioned “<verified literal quote>”. <authored question>`.
- The helper must not invent facts, economics, commitments, hidden state, concessions or a new question.
- If no safe literal quote exists, use the existing authored fallback.
- Strong Claude quote selection may be removed from this path if deterministic selection fully covers the need. This is preferable to spending a strong request for a bounded extraction problem.
- Preserve explicit/authored move classification and the existing scenario engine as the only owner of consequences.

Add pure tests for deterministic quote selection, unsafe/empty input fallback, exact literal containment and no state/economic mutation.

Then on deployed Preview, drive a normal authorized call into that `open_response` node. Request client audio twice for the same saved dynamic line:

1. first request must produce a real ElevenLabs dynamic asset (`source: dynamic`, `cached: false`), with private R2/D1 metadata and a small provider billing/usage delta;
2. second identical request must return the same private asset as `source: dynamic`, `cached: true`, with **zero second synthesis purchase**.

Verify another learner receives 403 and anonymous/revoked access receives 401. Delete/revoke disposable review state as appropriate. Do not regenerate the 40 Phase 20 authored assets.

If ElevenLabs fails, text fallback must remain usable. Do not mark VOI-003 passed without one successful real synthesis plus cache reuse.

## 3. Human microphone acceptance is mandatory and cannot be substituted by Codespaces

The Codespace exposes zero microphone inputs. Prerecorded fictional WebM successfully proved Google STT and storage/provider plumbing, but it does not satisfy the remaining browser recording acceptance.

After the fixes above deploy cleanly, stop and give the user a concise human-test instruction with the exact Preview URL and exercise(s). Do not ask for secrets.

### Mobile touch acceptance

Use a real phone browser at approximately the 390px-class layout and complete a full SAY IT call using touch only:

- open Preview and link a disposable/current review device normally;
- start a SAY IT call;
- tap Record and grant microphone permission only after that action;
- speak a short real reply;
- prove local checkpoint exists before upload (the UI/state should reach locally saved before transcription);
- transcribe through real Google STT;
- display original transcript;
- make at least one harmless visible correction so original and confirmed text differ;
- confirm and advance;
- complete the whole authored call by microphone;
- verify no page-level overflow, 16px inputs, usable controls/focus and client text fallback;
- default raw audio cleanup must preserve transcript/history.

A retained recording may be used once to prove replay, then explicitly delete it and verify playback is unavailable.

### Desktop keyboard acceptance

Complete a second full microphone call on a desktop browser using keyboard navigation for the controls wherever keyboard operation is expected. Confirm visible focus and transcript editing/confirmation. This call can be a different SAY IT mode so grading is not a duplicate sample.

### Evidence collection

After the human calls, inspect only sanitized server evidence:

- recording/attempt IDs, MIME, byte counts, checksums and statuses;
- Google recognition status/model/location/language;
- original vs confirmed transcript distinction (avoid committing sensitive spoken content; redact or summarize text if needed);
- branch/turn completion;
- default deletion/retention state;
- final grading result/cost and speaker-attribution review;
- device revocation.

Never commit raw microphone audio, Sync Keys, session tokens, provider credentials or private keys.

If physical Safari/iOS is the phone used, record that as extra evidence. If not, leave Safari/iOS as a known limitation rather than pretending it was covered.

## 4. Requirement promotion rules

Do not bulk-promote because the implementation exists.

Promote only after the exact evidence supports each row:

- `CALL-002`: real human microphone turn-based loop end to end.
- `CALL-003`: fresh live call grading is role-correct across all eight dimensions; no accent criterion; deterministic gates remain authoritative.
- `CALL-005`: complete real microphone call at phone width with touch only.
- `CALL-006`: transcript persists; default audio cleanup and explicit retain/delete proven on real recording.
- `EXR-015`: all five modes remain implemented; at least the live runtime path is proven on real human calls and controlled coverage still verifies all five modes.
- `VOI-003`: successful real authorized dynamic ElevenLabs synthesis plus identical-request cache reuse, no arbitrary-text endpoint.
- `VOI-006`: real microphone -> local Blob -> authenticated Worker/private R2 -> real Google STT V2 -> visible transcript -> confirmation.
- `VOI-007`: TTS text fallback and STT/recovery behavior remain verified; human/browser flow must not lose the recording on a recoverable failure.
- `SEC-005`: raw learner audio remains limited to browser/Bloomlab/private R2/Google STT; Anthropic gets confirmed text only; ElevenLabs gets authorized client-response text only; browser provider egress remains Bloomlab-only.

`CALL-001` and `CALL-004` are already PASSED and should remain so.

Do not promote unrelated rows. Preserve PRI-001, PRI-002, NEG-003, EXR-024 and broader infrastructure/privacy limitations unless separately proven.

## 5. Production readiness comes only after Preview acceptance

Do not enable Production yet while the three gates above remain open.

After all nine Phase 21 rows are genuinely accepted, report back without merging. ChatGPT will independently verify the exact head and then coordinate the final production-readiness step.

Expected later production work includes:

- install `GOOGLE_CLOUD_CREDENTIAL` as a **production Worker secret**;
- install the current rotated `ELEVENLABS_API_KEY` as a **production Worker secret** because dynamic client speech now needs it;
- declare required secret names only, never values;
- change the Worker/browser production call gates in a reviewed commit so Production can enable calls intentionally rather than through preview-style accidental settings;
- preserve a regression proving Production refuses calls when the explicit production gate/secrets are absent;
- exact-head CI/Preview must be green again before merge;
- ChatGPT performs squash merge and watches main through `0004_call_room.sql` and production deployment.

Do not install secrets into source, vars, Git, D1, R2 metadata, logs or screenshots.

## 6. Final report

Return:

1. pushed head SHA;
2. exact-head CI run and job conclusions;
3. files changed and why;
4. fresh live grading evidence and costs;
5. dynamic ElevenLabs first-purchase/cache-reuse evidence and usage delta;
6. human mobile-touch microphone result;
7. human desktop-keyboard microphone result;
8. Google STT evidence and recording cleanup/retention evidence;
9. authorization/egress/device-revocation evidence;
10. exact requirement status changes;
11. remaining limitations;
12. confirmation PR #23 remains draft/open and unmerged.

If human microphone testing has not happened yet, stop after deploying the fixes and ask the user to perform it. Do not mark those rows PASSED from prerecorded/virtual input.
