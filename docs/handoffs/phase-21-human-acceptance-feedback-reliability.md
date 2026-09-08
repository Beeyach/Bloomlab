# Phase 21 human acceptance follow-up: feedback reliability

> Historical record. Phase 21 PR #23 was merged on 2026-09-08 as `59ec678910cb51559d84af3c4200590f9c7e29ec`. Main CI `34267608095` Checks and Production deploy succeeded; production migrations `0004`/`0005`, 40 voice metadata rows and Worker `291517ab-8f2b-44d3-96aa-6dd7a615cc6c` were verified. Draft/unmerged instructions below describe the earlier review stage. All acceptance limitations and seven unverified rows are preserved.

PR: #23
Branch: `codex/phase-21-call-room`
Current audited head before this handoff: `82a0d33010e99077870732fb0d2e7cf0e424cba2`

Model: Codex Astra High.

Do not merge. ChatGPT will independently audit the exact final head and decide merge/production readiness.

## Human acceptance evidence just observed

Phone:
- Device: iPhone 14 Pro Max
- Browser: Safari
- Real microphone recording works.
- Call flow works, but feels somewhat slow.
- Transcription is manual after local save. This is expected by the current product contract and should not be changed merely to imitate auto-transcription unless the architecture can preserve the local-first checkpoint and explicit review requirement.
- Safari asks for microphone permission on every recording. Record this as a UX annoyance. Do not keep an always-open microphone merely to suppress the prompt.

Desktop:
- Mac Safari Private Browsing failed the local-first Blob checkpoint with: `Error preparing Blob/File data to be stored in object store` / `UnknownError`. Record this as a real Safari Private Browsing limitation unless a safe implementation fix is straightforward. Do not weaken local-first recovery to make private mode pass.
- Mac Chrome normal window completed a real-microphone Summit proposal call with four confirmed turns.
- Real Google transcription returned visible editable transcripts.
- User made/was able to make transcript corrections.
- Transcript history persisted.
- Client TTS was unavailable on a later turn and the text fallback allowed the call to continue.
- Call reached Closing successfully.
- Final call feedback failed with `AI evaluation is unavailable. Your submitted work is saved.`
- User pressed `Retry call feedback` exactly once. It failed again with the same message. Do not ask the user to keep retrying or spend further provider calls until the defect is diagnosed.
- User also reported the authored call feels noticeably scripted / not like a normal conversational back-and-forth. Preserve this as a UX limitation; Phase 21 v1 is intentionally turn-based and deterministic, but do not overclaim realism.

## Main blocker to fix

The Summit proposal call has a repeatable live final-feedback failure after a successful real-microphone four-turn call. This is now a Phase 21 merge blocker.

Investigate the exact saved attempt/rubric run and server-side failure state using sanitized IDs/metadata only. Do not inspect or print Sync Keys, session tokens, provider credentials, or raw recordings.

Determine whether the repeat failure is caused by:
- schema/validation failure after the single repair,
- provider timeout/deadline,
- output length/cap,
- speaker-evidence validation rejecting an otherwise useful response,
- request-size/envelope mismatch,
- a stuck/replayed failed `rubric_runs` row,
- budget reservation/governor behavior,
- or another exact runtime defect.

Use the user-completed Summit proposal attempt if it can be identified safely from the latest learner-scoped metadata. Do not repurchase repeatedly while guessing.

## Required remediation behavior

1. Preserve exact server-confirmed call reconstruction. Never grade arbitrary browser submission text.
2. Preserve the eight CALL-003 dimensions and deterministic critical/required gates.
3. Preserve strict speaker attribution. Do not loosen the client-vs-learner evidence validation just to make the provider response pass.
4. Preserve one bounded repair maximum. Do not create an unbounded retry loop.
5. Improve the provider prompt/schema/envelope or validation boundary so a normal completed proposal call has a reliable chance of producing accepted feedback.
6. Failed feedback must remain recoverable/idempotent without creating duplicate provider spend for the same successful result.
7. If a failed rubric run needs a fresh provider attempt, ensure budget reservation accounting is conservative and traceable. Do not silently release unknown prior billing.
8. Add focused regression tests reproducing the proposal-shaped transcript and the exact failure mechanism found.
9. Keep production calls disabled.

## Live verification after fix

After code/tests are green and Preview is deployed:

- Use a fresh synthetic/prerecorded proposal attempt first to prove accepted eight-dimension grading with correct attribution and bounded cost.
- Then determine whether the existing human-completed proposal attempt can safely retry feedback on the fixed code without asking the user to redo the whole call. Prefer reusing the saved human attempt if the current idempotency contract permits it.
- If the existing failed run identity intentionally pins the old request/prompt and cannot be retried under the fixed contract, document why and ask for the minimum new human action only after machine verification succeeds.
- Do not ask the user to repeat four real microphone turns unless technically necessary.

## Human-evidence status guidance

Do not promote all remaining rows just because the mechanics worked once. Record honestly:

- Real iPhone Safari microphone capture: observed working.
- Mac Chrome real microphone + local save + Google transcript + correction + four-turn completion + TTS text fallback: observed working.
- Mac Safari Private local Blob persistence: failed, limitation unless fixed.
- Final proposal AI feedback: failed twice, blocker until remediated and live-verified.
- Conversation realism: functional authored branching, noticeably scripted according to user; preserve as limitation rather than acceptance failure unless a requirement explicitly demands free-form realism.

After remediation, update the review/evidence/status files only to the extent supported by real evidence. Push all changes, run exact-head CI and Preview deploy, then stop. Leave PR #23 draft/open and unmerged.
