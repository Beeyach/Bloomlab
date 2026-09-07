# Phase 19 independent audit fixes

Starting audited branch head before this handoff commit: `a144bd4dccb78e00ebcb6b7cee776a2ec4e9f462`.

PR: #21
Branch: `codex/phase-19-ai-gateway`
Base: `154a00a73d659b92f0cc871f636462a9cb094f4b`

Use Codex Astra High.

Do not merge this PR. Push fixes to the existing branch and leave PR #21 open for ChatGPT's independent exact-head re-audit.

## 1. Fix the current exact-head CI regression

CI run `34102610967` reached the full test suite after typecheck, lint and format passed, then failed only in `worker/src/ai/provider.test.ts`.

The test reuses the same mocked `Response` instance for the Sonnet call and the Haiku call. The first provider call consumes its body. The second call then fails while reading the already-consumed body and is sanitized as `provider_unavailable`.

Fix the test fixture so each transport invocation receives a fresh response body. Keep the actual provider behavior unchanged unless a separate real defect is found.

The test must still prove:
- Sonnet 5 sends `thinking: { type: 'disabled' }`.
- Sonnet 5 keeps `max_tokens: 2048`.
- Haiku 4.5 does not send a `thinking` field.

Run the relevant Worker tests, then the full suite.

## 2. Fix AI-002 canonical-setting drift across devices

Independent audit found a real behavior bug in the browser client.

Current behavior:
- `setAiSettings()` caches `ai.mode` locally.
- `evaluateSubmission()` refuses locally when cached `ai.mode === 'Off'` before contacting the Worker.
- `classifyLanguage()` also returns fallback immediately when cached `ai.mode === 'Off'`.
- `getAiSettings()` fetches the canonical learner setting from the Worker but does not reconcile the local `ai.mode` cache.
- `AiSettingsScreen` displays the fetched server mode but also does not reconcile that cache.

Failure case:
1. Device A has local `ai.mode = Off`.
2. The canonical learner setting is later changed to Limited or Full on another linked device.
3. Device A fetches settings and visibly shows Limited/Full.
4. Device A's stale local cache remains Off.
5. Rubric evaluation still refuses locally and negotiation language still silently falls back.

The UI can therefore say Limited/Full while behavior remains Off.

That contradicts the Phase 19 claim that the learner-level Worker setting is canonical.

### Required behavior

Design one clear source-of-truth rule and pin it with tests:
- The Worker learner setting remains canonical for linked devices.
- Selecting Off locally should still suppress accidental AI requests immediately, including while a settings write is in flight or the network is unavailable.
- Once a linked device successfully learns a newer canonical Limited/Full value from the Worker, a stale local Off value must no longer keep AI disabled.
- A device must not require the user to press Save again merely to reconcile a canonical mode it already fetched.
- The Settings UI and `evaluateSubmission` / `classifyLanguage` must agree on the effective mode.
- Keep the server-side Off gate. Do not replace it with a browser-only gate.

Do not solve this by blindly deleting all local protection unless the resulting offline/in-flight Off behavior is still correct. A small cache-provenance or reconciliation mechanism is acceptable if needed.

### Regression coverage

Add focused browser/client tests for at least:
- locally cached Off + canonical Limited fetched -> effective mode becomes Limited and evaluation is no longer locally refused;
- locally cached Off + canonical Full fetched -> classification/evaluation no longer behaves as Off;
- selecting Off takes local effect immediately;
- server-side Off remains authoritative even if a client cache is stale the other direction;
- settings UI cannot display one mode while the AI client uses another after a successful canonical refresh.

Use the existing local-first data conventions. Do not create a second settings store.

## 3. Preserve the audited Phase 19 boundaries

Do not regress these already-audited properties:
- Worker-only Anthropic access and secret isolation.
- Exact authored rubric binding.
- Finalized exercise attempts/evidence remain append-only facts.
- Submitted rubric work is checkpointed before the network call and finalized only after valid evaluation.
- Existing per-attempt queued-write protection remains intact.
- Deterministic critical failures, required gates, objective thresholds and missing runtime assertions remain authoritative over AI.
- One repair retry maximum.
- Negotiation AI can classify only to an existing authored strategy. It must not create price, scope, concessions, hidden-state deltas or client reactions.
- Explicit negotiation actions win over language interpretation.
- Conservative reservations for uncertain potentially billed provider outcomes must not be released merely to make the displayed budget look better.

## 4. Required-secret deployment change is valid

The post-report `worker/wrangler.jsonc` change declaring `SYNC_KEY_PEPPER` and `ANTHROPIC_API_KEY` as required secrets for preview and production is intentional. Do not remove it just to make deployment green.

Preview cannot complete deployment until `ANTHROPIC_API_KEY` exists in the preview Cloudflare Worker environment. Production should also have the secret configured before merge, otherwise main's required-secret deployment is expected to fail.

Do not put secret values in the repo, logs, PR body, test fixtures or handoff.

## 5. Verification

After fixes:
- run Prettier/format check;
- run relevant AI client + Worker tests;
- run full Node 22 suite;
- run typecheck, lint, format, docs validation, content check, production build;
- re-run affected AI, exercise, negotiation, keyboard and touch probes if executable behavior changed;
- update Phase 19 review evidence only with results actually observed.

Do not claim exact-head green from an older commit.

If CI cannot deploy preview solely because the required preview `ANTHROPIC_API_KEY` is absent, report that plainly and stop with PR #21 open. Do not weaken the required-secret declaration.

Final response must include the new exact head SHA, CI run ID/status, tests, the canonical-setting fix, and whether preview live Anthropic verification remains blocked by secret configuration.
