# Phase 21 — proposal feedback reliability

Execution of the complete [human acceptance follow-up](../handoffs/phase-21-human-acceptance-feedback-reliability.md) on draft/open [PR #23](https://github.com/Beeyach/Bloomlab/pull/23). Starting head: `085cad9d8bc6f69c21fddf19946da022aa27f884`. Production calls stay disabled; no merge or production deployment is authorized.

## Human evidence and initial diagnosis

The user reports working real microphone capture on iPhone 14 Pro Max Safari. Mac Chrome normal browsing completed four Summit proposal turns, including local save, real Google transcription, visible corrections, persisted history and a later TTS text fallback. Final feedback failed twice, the second time after one explicit retry. Mac Safari Private Browsing failed the local Blob checkpoint (`UnknownError`, Blob/File preparation); repeated iPhone microphone permission prompts, slow interaction and noticeably scripted conversation remain observed limitations. These observations do not complete every human acceptance criterion.

Read-only, content-free Preview metadata identifies completed proposal attempt `107cd1ba-c63f-4cdb-8274-b4a02637e202`, created at `2026-09-08T07:48:10.733Z`, completed at `08:01:45.247Z`, revision 4 / four turns. Its rubric run `f0e714ad-1d43-4650-85ee-538cdc7f81fc` is `failed`, with no saved successful result. The learner's existing policy is Limited / $20.

Both feedback requests reached two accounted Sonnet responses, at 08:02 and 08:05 UTC. Output counts were 1,159 / 1,171 and 1,336 / 1,122, below the 2,048-token cap. Known feedback cost is **$0.0693503**; the two reservation rows are failed with **$0 remaining reservation**. Thus these requests exhausted output acceptance and the one repair; they did not stop at the request envelope, budget governor or a stuck active/replayed failed run, and both responses in each request were accounted rather than timing out. The old gateway discarded the precise validation/stop reason, so the historical subtype cannot be asserted from these rows.

The existing identity contract permits a failed run to be claimed again using the same immutable, server-reconstructed call. A successful result replays without repurchase. No human Sync Key, session token, provider credential, raw recording or transcript was inspected for this diagnosis. The original attempt was left untouched until corrected machine acceptance passed; the user's subsequent successful retry is recorded below.

## Diagnostic boundary

Migration `0005_grading_diagnostics.sql` adds optional content-free metadata to the existing AI usage ledger. Each response records the contract version, initial/repair phase, fixed provider-format and validation codes, request byte count and reservation ID in the same transaction as its usage. Unknown outcomes retain their conservative reservations. Error messages, Zod issues, rejected output, request headers and transcript text are excluded. Prompt, schema, grading requirements, deadline, output cap and one-repair limit are unchanged in this diagnostic checkpoint.

Diagnostic checkpoint `5809eccf14eb71955e6b07cca4be522bee4df592` passed [CI 34204901474](https://github.com/Beeyach/Bloomlab/actions/runs/34204901474), including Checks and Preview deploy; Production was skipped. Focused provider/gateway/call/citation tests: **91 passed**; Worker typecheck passed.

## Reproduced failure and correction

One fresh fictional proposal (`1c53cd25-7282-4907-93e5-d6c9ff6a2e61`) completed through four real Google transcriptions and explicit fictional confirmations. The unchanged provider contract reproduced HTTP 502 `evaluation_invalid`:

| Response | Format | Rejection | Output tokens | Cost |
| --- | --- | --- | --- | --- |
| Initial | Valid JSON | `rubric_items_mismatch` | 92 | $0.0096855 |
| Single repair | Valid JSON | `learner_quotation_mismatch` | 1,069 | $0.019695 |

Total **$0.0293805**, remaining reservation **$0**. The provider input was 1,824 bytes. Neither response hit the cap or deadline or was a refusal. The generic schema permitted an incomplete rubric array, consuming the only repair; that repair then failed the strict learner-citation check. No rejected prose was retained. All four temporary recordings were deleted and the disposable device revoked. This is an observed reproduction of the same proposal failure path; the exact subtype of each historical human response remains unavailable because those responses predated diagnostics.

The corrected `call-speakers-v2` contract requires every authored dimension as a named property, prohibiting missing, duplicate or substituted dimensions at the provider schema boundary. The gateway converts the result to the unchanged public/saved array in authored order, then runs the full existing field, item, critical-consistency and learner-quotation validators. The prompt favors precise numbered-turn paraphrases, and the one repair receives its actual fixed validation cause. No quotation is stripped, silently accepted or treated as client evidence belonging to the learner. The output cap, deadlines, speaker reconstruction, deterministic gates, identity hash and budget reservations are unchanged. The schema contains authored rubric material only, never private learner text.

Focused regressions: **97 passed**, including a completed proposal that fails twice, safely retries with the same run/hash, rejects concurrent retry, and replays accepted feedback without another provider/STT call. Another regression preserves unknown prior billing even after a subsequent retry succeeds. Tests also verify all eight required provider properties, public result order, missing/extra item refusal, critical mismatch, score bounds, citation rejection, format diagnostics, sanitization and bounded deadlines. Full Node 22 `npm run ci` passed: **1,782 tests / 108 files**, typechecking, lint, formatting, control-doc validation, content/voice checks and production build including the browser-secret scan.

Source guidance: [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) documents supported required object properties and local validation, and explains that refusals and token limits may still yield invalid output. Its schema retention guidance is why no private transcript is inserted into the schema. [Cloudflare D1 commands](https://developers.cloudflare.com/d1/wrangler-commands/) informed scoped metadata reads and additive Preview-first migration.

## Corrected Preview acceptance

Code head `0fc2f17883a5ccd4b0b5320a62ec197927c214a3` passed [CI 34208024016](https://github.com/Beeyach/Bloomlab/actions/runs/34208024016): Checks and Preview deploy SUCCESS, Production SKIPPED, no development migrations pending. The live run used Preview Worker `e79b4673-1c80-4fbe-ba9a-940f3f543ec1` deployed at 09:11 UTC. Subsequent review-script and evidence edits do not change the Worker/browser runtime; the final head's CI and deployment are recorded on the PR.

Fresh proposal `9567c977-ddf1-4c88-bd2d-dc6420b740b6` completed four real Google transcriptions and the same explicit fictional confirmations as the diagnostic reproduction. Final feedback returned HTTP 200 on the **initial response, with no repair**: all eight dimensions, score 88, `critical_issue: null`, contract `call-speakers-v2`, 1,051 output tokens, 1,824 submission bytes. Actual Anthropic cost **$0.022658**, remaining reservation **$0**. Replaying the same attempt with changed arbitrary browser submission text returned the identical saved result/run and left the usage totals unchanged: **$0 additional spend**. All four raw recordings were deleted and the disposable device was revoked.

Manual attribution review compared every explanation against the fictional confirmed turns and saved deterministic projection:

| Dimension | Grounding reviewed |
| --- | --- |
| Questions | Turn 4 actually proposes joint scope review, sample testing, applicant reply and owner handover checks. |
| Listening | Turns 2 and 3 address the competing quote and phased postponement raised by the client. |
| Diagnosis | The explanation explicitly identifies already-agreed diagnosis as deterministic context; it credits the learner only for the scope/restatement behavior in turns 1 and 3. |
| Clarity | Turn 3 names postponed routes/sequences and the written agreement needed to add them. |
| Jargon | Qualification routing and applicant reply occur in learner turn 1; they are not borrowed from client-only terminology. |
| Pitch timing | The explanation explicitly relies on saved `pitched_before_diagnosis: false` / `diagnosis_agreed: true`, consistent with this proposal stage. |
| Objection handling | Turn 2 proposes a scope comparison and declines to promise equivalence with an unknown scope. |
| Next step | Turn 4 supplies the concrete review/testing/handover proposal and the saved projection records agreement. |

The three strengths are grounded in turns 2–4. Improvements and next probe are clearly future suggestions. No client-only words or behavior are credited as learner evidence; no accent or transcript-correction penalty appears. This is one accepted proposal sample and a replay check, not a measured population failure rate or blanket human acceptance.

An earlier setup attempt (`0617f2b6-3e33-443b-a5a5-27e67d167420`) stopped during the first transcription before any confirmed turn. Its precise API error was not captured, so no subtype is asserted. Scoped D1 metadata confirms revision 0, no original/confirmed transcript, **zero rubric runs and zero Anthropic usage rows**; its single recording was deleted and device revoked. Google billing for that unsuccessful request is not known. The probe now records fixed stage and allowlisted speech failure codes without transcript/error-body logging. It never automatically repurchases feedback after a failure.

This follow-up used **eight successful Google recognitions plus the one unsuccessful setup request**, all prerecorded fictional speech. Known Anthropic spend for the diagnostic reproduction and corrected synthetic acceptance totals **$0.0520385**. The subsequent human retry adds **$0.0154112**, bringing this follow-up's known Anthropic total to **$0.0674497**. The earlier failed human feedback spend and the older unknown reservation are separate. Sanitized evidence is in [the evidence file](phase-21-feedback-reliability-evidence.json).

## Saved human attempt and remaining acceptance

After corrected machine acceptance, the user reopened the saved proposal and confirmed that results appeared. The initial access concern was clarified by the visible **No local audio · Server audio deleted** labels on four turns: those labels describe expected audio cleanup, not loss of confirmed transcripts. No new microphone turn, transcription purchase, Sync Key or token was needed.

Read-only metadata confirms that original attempt `107cd1ba-c63f-4cdb-8274-b4a02637e202` is still revision 4, complete, four turns, with its original `08:01:45.247Z` update time. Original rubric run `f0e714ad-1d43-4650-85ee-538cdc7f81fc` is now **complete**, with all eight authored dimension IDs in the saved result. The retry began at `09:20:11.615Z`; the **initial response was accepted at `09:21:05.595Z`**, contract `call-speakers-v2`, valid JSON, 1,331 output tokens and 1,783 submission bytes. **No repair was needed.** Actual retry cost **$0.0154112**, remaining reservation **$0**. Historical failed purchases remain recorded; total known feedback cost for this human run is **$0.0847615**. All four recordings remain deleted with original and confirmed transcript fields present. The human feedback prose and transcripts were not read or copied into evidence; semantic attribution review above concerns the fictional sample.

CALL-003 was temporarily PARTIAL during the blocker and returns to PASSED on the combination of focused safeguards, deployed eight-dimension attribution review, zero-cost replay, and actual recovery of the saved human run. The seven broader human rows remain IMPLEMENTED_UNVERIFIED; CALL-001/CALL-004/VOI-003 retain their existing supported results. This does not establish every phone/keyboard, retained replay, recovery or privacy acceptance criterion. The old unrelated $5.04096 unknown-billing reservation remains untouched. PR #23 remains draft/open; production stays disabled.
