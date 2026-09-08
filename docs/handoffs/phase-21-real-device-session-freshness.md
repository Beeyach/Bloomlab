# Phase 21 — real-device session freshness and clean restart

Implementation follow-up for draft/open PR #23 on `codex/phase-21-call-room`.

Model: Codex Astra High.

Do not merge. ChatGPT performs the independent audit and merge decision.

## Why this exists

The user performed physical iPhone 14 Pro Max Safari acceptance after the Phase 21 final UX polish deployment. Two real-device observations invalidate further acceptance on that session:

1. The Northwind call was already off-path from earlier random replies. The user then used the intended four happy-path replies, but the call reached turn 7 and continued looping. This does **not** yet prove the authored phrase/routing rules are wrong, because `ExerciseRunner` deliberately resumes an unfinished active attempt and the current node was already a fallback/clarification node. There is no obvious clean-start control for an unfinished call.
2. The user saw **no new loading animation/text** despite exact-head `219e2efc326b93b48f7930398c8e45f98d2e73d5` deploying and automated Preview browser probes verifying immediate spinner/text/live-status behavior. Bloomlab is a PWA whose service worker precaches the app shell. The physical Safari session was therefore very likely still running an older loaded bundle/session. Do not count that device interaction as verification of the `219e2ef` UX.

The user has already done enough manual testing. The goal of this follow-up is to make one future fresh physical-device run unambiguous, not to ask them to clear browser storage or repeat long calls blindly.

## Source of truth to inspect first

Read current live code and docs before editing:

- `apps/web/src/exercise/ExerciseRunner.tsx`
- `apps/web/src/exercise/attempt.ts`
- `apps/web/src/call/CallRoom.tsx`
- `apps/web/src/call/local.ts`
- `apps/web/src/call/pipeline.ts`
- `apps/web/src/call/Recordings.tsx`
- `apps/web/vite.config.ts`
- current PWA registration/generated update behavior
- `worker/src/call/*`
- migrations `0004` and `0005`
- `docs/operations/call-room.md`
- `docs/reviews/phase-21-final-ux-polish.md`
- `docs/reviews/phase-21-feedback-reliability.md`
- current Northwind content and conversation engine/routing rules

Do not change the conversation engine merely because the resumed turn-7 attempt looped. First distinguish session/attempt freshness from routing correctness.

## A. Add an obvious safe way to start a fresh call

A learner must be able to intentionally abandon/restart an unfinished SAY IT call without browser-storage surgery.

Requirements:

- Present a clear secondary action such as `Start fresh call` / `Restart call` for an active unfinished call.
- Require an explicit confirmation when the call already has saved turns/recordings.
- Copy must honestly explain what happens to the unfinished attempt and raw audio.
- Never silently lose a locally saved recording needed for recovery.
- Before discarding the local active attempt, clean up non-retained local and remote raw audio for that attempt through existing authenticated deletion paths wherever safely possible.
- If cleanup cannot complete, do not lie. Preserve enough state to retry cleanup or clearly state what remains private/pending.
- Explicitly retained raw recordings must not be silently destroyed unless the confirmation clearly says restart will delete them and the user agrees.
- Do not write an abandoned attempt as mastery evidence or a completed exercise attempt.
- A fresh restart must create a genuinely new attempt ID and reset the call to turn 0/current opening node.
- The old attempt must not be resumed after the restart.
- Do not weaken local-first or private R2 guarantees.

Inspect whether a small additive server-side abandon/cleanup endpoint or metadata state is warranted. If existing authenticated recording cleanup plus local discard is sufficient and honest, prefer the simpler design. If server attempt metadata must remain orphaned, document that explicitly rather than pretending it was deleted. Do not edit old migrations.

Add focused tests for:

- restart from turn 0 before audio
- restart with confirmed turns
- restart with local unsent Blob
- restart with uploaded unretained audio
- retained-audio confirmation semantics
- cleanup failure/retry
- new attempt ID and turn 0
- no mastery/evidence write
- no old-attempt resume

## B. Make deployed-version freshness visible and safe

The user should not unknowingly test an old PWA bundle after Preview deploys.

Implement a reliable PWA update UX appropriate to Bloomlab rather than relying on the user to clear Safari data.

Requirements:

- Detect when a new service worker/app shell is available or has taken control while an older page bundle is still running.
- Provide a visible, accessible `Update available` / `Reload to update` indication, or safely auto-reload only when doing so cannot destroy an in-memory recording or an unsaved/pending call action.
- Never auto-reload during microphone recording, before a captured Blob is safely stored, during upload/transcription, while a transcript confirmation is pending, or during final feedback submission.
- If update activation occurs during unsafe state, defer reload and tell the learner that the update will be available after the current saved step.
- Preserve offline/PWA behavior and `/api/*` NetworkOnly behavior.
- Do not disable the service worker just to make Preview tests easier.
- Add a lightweight non-secret runtime/build identifier visible in internal diagnostics or another appropriate developer surface so a reviewer can prove which browser bundle is loaded. Prefer CI/deploy-provided immutable identity if already available; do not invent a secret or expose provider config.
- Preview verification must be able to compare deployed Worker/build identity with the loaded browser identity without relying on cache-clearing guesses.

Add tests/probes for:

- update available in idle Call Room
- update discovered while recording/pending local save -> no destructive reload
- update while transcript review/pending turn -> deferred safely
- update after safe checkpoint -> reload/update path
- reduced motion/accessibility for update notification
- old bundle cannot silently remain the only user-visible state after the update check completes

## C. Fresh Northwind routing verification only after A/B

After the new runtime is deployed and a truly fresh attempt is proven:

- Start a new `EX-SAY_IT-northwind-cold-call` at turn 0.
- Use the authored intended phrases through the normal transcript-confirmation flow:
  1. `Do you have a minute to ask about unanswered quotes?`
  2. `Who handles quote follow-up today?`
  3. `The gap is unanswered quotes, not replacing dispatch. Is that right?`
  4. `Could we arrange a short process review with Tina?`
- Controlled browser/provider tests may normalize predictable STT punctuation/casing, but do not rewrite learner semantics.
- Prove the intended fresh path reaches `done` in four learner turns.
- If a **fresh** real/provider-backed transcription still misses authored intent due normal STT variation, then diagnose the language-matching layer and fix narrowly. Favor deterministic text normalization or authored-phrase robustness before adding broader LLM dependence.
- Do not weaken fallback safety or let fuzzy matching map unrelated speech into a consequential move.
- Keep the authored recovery ceiling separate from the intended-path length.

Do not claim the user's previous turn-7 run as evidence of a routing defect; it was not a fresh attempt.

## D. Loading UX must be proven on the actually loaded bundle

The previous exact-head implementation already added visible progress. Do not redesign it unless a fresh loaded bundle still fails.

After PWA freshness handling:

- prove physical/deployed browser is actually running the current build identity
- verify visible `Transcribing…`, confirmation/evaluation/saving progress, and `Getting feedback…`
- preserve accessible live status and duplicate prevention

If the fresh current bundle shows the loading UI, close this as stale-session/PWA freshness rather than changing the loading component again.

## E. Existing human findings remain documented

Do not erase or over-promote:

- iPhone 14 Pro Max Safari real microphone capture works
- offline transcription retry from the same saved recording passed
- retained recording was deleted and replay became disabled, but the user did not hear retained replay audio on iPhone Safari
- Mac Chrome real microphone proposal mechanics completed, transcript correction/history/TTS fallback worked, and saved feedback later recovered after the grading fix
- Mac Safari Private Browsing Blob persistence failed
- repeated iPhone microphone permission prompts remain an annoyance
- perceived slowness and noticeably scripted roleplay remain product limitations

These observations remain honest evidence boundaries.

## F. Verification and PR behavior

Run the full pinned Node 22 suite and relevant browser probes. Verify at 1440/1024/768/390/320. Re-run browser secret/provider-boundary scans and existing call/AI/voice regressions.

Deploy Preview only. Production calls remain disabled and Production deploy must remain skipped.

Update:

- `docs/reviews/...` with sanitized evidence
- `docs/operations/call-room.md`
- `KNOWN_LIMITATIONS.md`
- `IMPLEMENTATION_STATUS.md`
- acceptance/status docs only where evidence supports changes

Do not promote CALL-005 or the remaining broader human rows solely from automated fixtures. The point is to make the next physical test unambiguous and short.

Push the branch and update PR #23, but keep it draft/open and unmerged. Stop before asking the user for another physical run. Report the exact new head, exact-head CI, Preview version/build identity, what restart does to recordings, and how the PWA freshness UX works.