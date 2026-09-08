# Phase 21 — proposal feedback reliability

Execution of the complete [human acceptance follow-up](../handoffs/phase-21-human-acceptance-feedback-reliability.md) on draft/open [PR #23](https://github.com/Beeyach/Bloomlab/pull/23). Starting head: `085cad9d8bc6f69c21fddf19946da022aa27f884`. Production calls stay disabled; no merge or production deployment is authorized.

## Human evidence and initial diagnosis

The user reports working real microphone capture on iPhone 14 Pro Max Safari. Mac Chrome normal browsing completed four Summit proposal turns, including local save, real Google transcription, visible corrections, persisted history and a later TTS text fallback. Final feedback failed twice, the second time after one explicit retry. Mac Safari Private Browsing failed the local Blob checkpoint (`UnknownError`, Blob/File preparation); repeated iPhone microphone permission prompts, slow interaction and noticeably scripted conversation remain observed limitations. These observations do not complete every human acceptance criterion.

Read-only, content-free Preview metadata identifies completed proposal attempt `107cd1ba-c63f-4cdb-8274-b4a02637e202`, created at `2026-09-08T07:48:10.733Z`, completed at `08:01:45.247Z`, revision 4 / four turns. Its rubric run `f0e714ad-1d43-4650-85ee-538cdc7f81fc` is `failed`, with no saved successful result. The learner's existing policy is Limited / $20.

Both feedback requests reached two accounted Sonnet responses, at 08:02 and 08:05 UTC. Output counts were 1,159 / 1,171 and 1,336 / 1,122, below the 2,048-token cap. Known feedback cost is **$0.0693503**; the two reservation rows are failed with **$0 remaining reservation**. Thus these requests exhausted output acceptance and the one repair; they did not stop at the request envelope, budget governor or a stuck active/replayed failed run, and both responses in each request were accounted rather than timing out. The old gateway discarded the precise validation/stop reason, so the historical subtype cannot be asserted from these rows.

The existing identity contract permits a failed run to be claimed again using the same immutable, server-reconstructed call. A successful result replays without repurchase. No human Sync Key, session token, provider credential, raw recording or transcript was inspected for this diagnosis. No human retry has been purchased during this investigation.

## Diagnostic boundary

Migration `0005_grading_diagnostics.sql` adds optional content-free metadata to the existing AI usage ledger. Each response records the contract version, initial/repair phase, fixed provider-format and validation codes, request byte count and reservation ID in the same transaction as its usage. Unknown outcomes retain their conservative reservations. Error messages, Zod issues, rejected output, request headers and transcript text are excluded. Prompt, schema, grading requirements, deadline, output cap and one-repair limit are unchanged in this diagnostic checkpoint.

Focused provider/gateway/call/citation tests: **91 passed**; Worker typecheck passed. A bounded fictional proposal reproduction on deployed Preview is pending. The feedback blocker is not yet resolved; no new acceptance promotion is claimed.
