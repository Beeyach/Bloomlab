# Phase 21 — proposal feedback reliability

Execution of the complete [human acceptance follow-up](../handoffs/phase-21-human-acceptance-feedback-reliability.md) on draft/open [PR #23](https://github.com/Beeyach/Bloomlab/pull/23). Starting head: `085cad9d8bc6f69c21fddf19946da022aa27f884`. Production calls stay disabled; no merge or production deployment is authorized.

## Human evidence and initial diagnosis

The user reports working real microphone capture on iPhone 14 Pro Max Safari. Mac Chrome normal browsing completed four Summit proposal turns, including local save, real Google transcription, visible corrections, persisted history and a later TTS text fallback. Final feedback failed twice, the second time after one explicit retry. Mac Safari Private Browsing failed the local Blob checkpoint (`UnknownError`, Blob/File preparation); repeated iPhone microphone permission prompts, slow interaction and noticeably scripted conversation remain observed limitations. These observations do not complete every human acceptance criterion.

Read-only, content-free Preview metadata identifies completed proposal attempt `107cd1ba-c63f-4cdb-8274-b4a02637e202`, created at `2026-09-08T07:48:10.733Z`, completed at `08:01:45.247Z`, revision 4 / four turns. Its rubric run `f0e714ad-1d43-4650-85ee-538cdc7f81fc` is `failed`, with no saved successful result. The learner's existing policy is Limited / $20.

Both feedback requests reached two accounted Sonnet responses, at 08:02 and 08:05 UTC. Output counts were 1,159 / 1,171 and 1,336 / 1,122, below the 2,048-token cap. Known feedback cost is **$0.0693503**; the two reservation rows are failed with **$0 remaining reservation**. Thus these requests exhausted output acceptance and the one repair; they did not stop at the request envelope, budget governor or a stuck active/replayed failed run, and both responses in each request were accounted rather than timing out. The old gateway discarded the precise validation/stop reason, so the historical subtype cannot be asserted from these rows.

The existing identity contract permits a failed run to be claimed again using the same immutable, server-reconstructed call. A successful result replays without repurchase. No human Sync Key, session token, provider credential, raw recording or transcript was inspected for this diagnosis. No human retry has been purchased during this investigation.

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

Focused regressions: **97 passed**, including a completed proposal that fails twice, safely retries with the same run/hash, rejects concurrent retry, and replays accepted feedback without another provider/STT call. Another regression preserves unknown prior billing even after a subsequent retry succeeds. Tests also verify all eight required provider properties, public result order, missing/extra item refusal, critical mismatch, score bounds, citation rejection, format diagnostics, sanitization and bounded deadlines. Full Node 22 `npm run ci` passed: **1,782 tests / 108 files**, typechecking, lint, formatting, control-doc validation, content/voice checks and production build including the browser-secret scan. Deployed corrected-contract acceptance is pending.

Source guidance: [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) documents supported required object properties and local validation, and explains that refusals and token limits may still yield invalid output. Its schema retention guidance is why no private transcript is inserted into the schema. [Cloudflare D1 commands](https://developers.cloudflare.com/d1/wrangler-commands/) informed scoped metadata reads and additive Preview-first migration.

## Saved human attempt and remaining acceptance

The completed human proposal can retry on the new contract without changing its run/hash or re-recording. No authenticated human session is available in this Codespace, and no key/token is requested or inspected. After machine verification passes, the minimum human action is one **Retry call feedback** in the original normal Chrome window. This exercises the authenticated saved attempt and preserves its local transcript/history. It does not require a new call or four fresh microphone turns.

CALL-003 returns from PASSED to PARTIAL while the actual human feedback blocker is unresolved. The seven broader human rows remain IMPLEMENTED_UNVERIFIED; CALL-001/CALL-004/VOI-003 retain their existing supported results. The old unrelated $5.04096 unknown-billing reservation remains untouched. PR #23 remains draft/open; production stays disabled.
