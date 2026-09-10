# Phase 26 — adversarial evidence

Checkpoint G: all fifteen authoritative master §142 cases pass. The older acceptance count of
fourteen was corrected; missing phone and missing email remain separate. Run
`npm run test:adversarial` to execute the exact committed regression titles and regenerate fresh
JSON/Markdown under `.review/adversarial`. A missing/skipped/ambiguous/failed assertion fails the
harness; no static success is used. Complete local CI and GitHub Checks both run this harness.
Provider calls are controlled transports against local test storage; spend $0. No production
learner data or migrations. These observed results do not replace physical/human acceptance,
real provider quality evaluation or independent INF-015 audit.

## ADV-01 — offline mid-exercise

- Setup: Complete a real objective attempt without network; reconnect two isolated local databases.
- Expected: Attempt/evidence queues locally, syncs once and yields matching mastery on the second device.
- Observed: PASS; a device that works offline syncs its attempt, and the other device agrees → passed
- Regression: `apps/web/src/exercise/exercise.test.tsx`
- Limit: Controlled fixture; not physical-device or live-provider certification.

## ADV-02 — refresh mid-simulation

- Setup: Save an advanced run with a pending event, then load fresh state and continue.
- Expected: Clock, history, random state and pending queue survive; scheduled events fire once.
- Observed: PASS; brings back the run, its history, its clock and its queue → passed; does not fire an event twice merely because the page reloaded → passed
- Regression: `apps/web/src/simulator/simulator.test.ts`
- Limit: Controlled fixture; not physical-device or live-provider certification.

## ADV-03 — duplicate events

- Setup: Repeat a tag-add and an active workflow enrolment with re-entry disabled.
- Expected: No duplicate tag or active enrolment; explicit skip/exit reason. Distinct completed bookings remain distinct events.
- Observed: PASS; TAG-001 executes real simulator behaviour → passed; ENROLL-001 executes real simulator behaviour → passed
- Regression: `packages/simulator-core/test/regression.test.ts`
- Limit: Domain duplicate boundaries, not a claim that all separate legitimate events are globally deduplicated.

## ADV-04 — missing phone

- Setup: Send an SMS to the phone-less fixture contact.
- Expected: No outbound message; action_skipped records missing_phone.
- Observed: PASS; MSG-001 executes real simulator behaviour → passed
- Regression: `packages/simulator-core/test/regression.test.ts`
- Limit: Controlled fixture; not physical-device or live-provider certification.

## ADV-05 — missing email

- Setup: Create a contact with a phone but no email, then send email.
- Expected: No conversation/message or sent-count increment; explicit missing_email.
- Observed: PASS; MSG-EMAIL-MISSING executes real simulator behaviour → passed
- Regression: `packages/simulator-core/test/regression.test.ts`
- Limit: Controlled fixture; not physical-device or live-provider certification.

## ADV-06 — cancelled appointment during wait

- Setup: Cancel an appointment while its appointment-scoped reminder is waiting.
- Expected: Exit the reminder before starting cancellation recovery, preserving the cancelled appointment and trigger attribution.
- Observed: PASS; enrols the cancellation workflow on APPOINTMENT_CANCELLED and exits the reminder → passed
- Regression: `packages/simulator-core/test/calendar.test.ts`
- Limit: Controlled fixture; not physical-device or live-provider certification.

## ADV-07 — timezone change

- Setup: Render the authored instant in Tokyo; advance over Chicago DST; supply an invalid zone.
- Expected: Preserve the absolute instant and intended local-day semantics; reject invalid zones instead of silently using the device.
- Observed: PASS; ignores the machine timezone: the same scenario reads the same anywhere → passed; adds a day as a calendar day, keeping the wall-clock reading across a DST change → passed; refuses an unknown timezone rather than falling back to the device → passed
- Regression: `packages/simulator-core/test/clock.test.ts`
- Limit: Controlled fixture; not physical-device or live-provider certification.

## ADV-08 — AI timeout

- Setup: Hold a controlled transport until the abort deadline; simulate unknown provider billing.
- Expected: Bounded sanitized timeout and conservative reservation, without invented success or blind retry.
- Observed: PASS; provider timeout is bounded and sanitized → passed; preserves conservative reservation when provider outcome is unknown → passed
- Regression: `worker/src/ai/gateway.test.ts`
- Limit: Controlled fixture; not physical-device or live-provider certification.

## ADV-09 — AI budget exhausted

- Setup: Reserve the remaining budget while a controlled first request is pending; try a second request and AI Off.
- Expected: Refuse the over-budget request before provider invocation; Off remains protected.
- Observed: PASS; atomic reservations refuse concurrent over-budget calls → passed; protects Off and missing-secret routes without invoking provider → passed
- Regression: `worker/src/ai/gateway.test.ts`
- Limit: Controlled fixture; not physical-device or live-provider certification.

## ADV-10 — ElevenLabs failure

- Setup: Controlled ElevenLabs 503, never-resolving response and absent configuration.
- Expected: Sanitized failure, bounded timeout and no automatic repeat purchase or false ready asset.
- Observed: PASS; sanitizes provider HTTP 503 → passed; sanitizes timeouts without retrying → passed; fails cleanly without a secret when the asset is absent → passed
- Regression: `worker/src/voice/voice.test.ts`
- Limit: Controlled fixture; not physical-device or live-provider certification.

## ADV-11 — transcription failure

- Setup: Reopen local recording storage; transcription returns controlled 503, then succeeds on explicit retry.
- Expected: Keep the recovery Blob; retry transcription without uploading again, and do not invent a transcript.
- Observed: PASS; retries uploaded audio without uploading again, keeps failures recoverable and survives database reopen → passed
- Regression: `apps/web/src/call/pipeline.test.ts`
- Limit: Controlled fixture; not physical-device or live-provider certification.

## ADV-12 — sync conflict

- Setup: Two devices edit one synchronized note differently.
- Expected: Preserve both versions pending a choice; explicit local or server selection converges.
- Observed: PASS; stores divergent snapshot edits as a conflict and resolves either way (SYNC-009) → passed; can also keep the server version of a conflict → passed
- Regression: `apps/web/src/data/sync/engine.test.ts`
- Limit: Controlled fixture; not physical-device or live-provider certification.

## ADV-13 — second device

- Setup: Link two databases and make separate real attempts; exchange multiple sync rounds.
- Expected: Keep both immutable attempts/evidence and stable counts instead of overwriting or duplicating facts.
- Observed: PASS; two attempts made on two devices are two facts, never merged → passed
- Regression: `apps/web/src/exercise/exercise.test.tsx`
- Limit: Controlled fixture; not physical-device or live-provider certification.

## ADV-14 — extreme values

- Setup: Submit negative, zero, fractional, NaN, Infinity and out-of-range price values, repeated checkout and invalid references.
- Expected: Refuse invalid values/duplicates without manufactured revenue or mutated accepted prices.
- Observed: PASS; refuses malformed amounts, mutable prices, dangling references, disabled links and repeated attempts → passed
- Regression: `packages/simulator-core/test/advanced-labs.test.ts`
- Limit: Controlled fixture; not physical-device or live-provider certification.

## ADV-15 — malformed scenario data

- Setup: Supply duplicate identities, dangling references, impossible time/zone and a multi-error scenario.
- Expected: Structured validation rejects the scenario before simulation; no skipped errors or fake runnable state.
- Observed: PASS; rejects duplicate entity ids → passed; rejects a dangling contact reference → passed; rejects an impossible timestamp → passed; rejects an invalid timezone → passed; throws with every problem listed, rather than skipping the bad ones → passed
- Regression: `packages/simulator-core/test/workflow.test.ts`
- Limit: Controlled fixture; not physical-device or live-provider certification.

