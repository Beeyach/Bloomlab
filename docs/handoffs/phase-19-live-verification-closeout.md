# Phase 19 live verification closeout

PR: #21
Branch: `codex/phase-19-ai-gateway`
Audited implementation head before this handoff: `264794eb8f2cf9efec252f782394c951c9a004d0`

This is a documentation/evidence closeout only. Do not change runtime behavior unless the repository proves a factual inconsistency that requires it. Do not merge the PR.

## Verified live evidence to record

The deployed preview was verified against real Anthropic through the Worker, not the fixture transport.

- CI run `34105051578`, attempt 3: Checks SUCCESS and Preview deploy SUCCESS.
- Preview health returned HTTP 200.
- One real cheap-model rubric evaluation returned HTTP 200 for exact `WRITTEN_COMMUNICATION_RUBRIC_V2`, rubric version `2`.
- Bloomlab structured-output validation passed.
- D1 contained matching `ai_feedback`, completed `rubric_runs`, and non-zero real token usage.
- Exactly one permitted repair retry occurred.
- Evaluation cost was `$0.013323`.
- One real negotiation language classification returned authored strategy `hold` at confidence `0.95`.
- The existing deterministic negotiation engine still owned authored consequences and explicit structured actions retained precedence.
- Total live verification cost was `$0.013774`.
- Reservations returned to `$0` after completion.
- The disposable verification device was revoked and later access returned HTTP 401.

Detailed local evidence was produced under `.review/phase19-live/report.md` and `.review/phase19-live/evidence.json`. Do not commit secrets, tokens, disposable sync keys, raw auth headers, or any sensitive verification material.

## Required status changes

1. `AI-009` is now `PASSED`. The live Worker-only Claude path, secret isolation, real provider request, structured validation, D1 persistence, usage accounting and revoked-session behavior have now been demonstrated on deployed preview.
2. `NEG-003` remains `PARTIAL`. One real `hold` classification at confidence 0.95 proves the runtime path works, but one sample is not broad enough evidence for general language interpretation quality.
3. Do not promote adjacent requirements such as `PRI-001`, `PRI-002`, `EXR-008`, `EXR-009`, `PRD-004`, voice/Call Room requirements, or any later Boss Client requirement unless their own acceptance is independently satisfied.

## Update these truthfully

- `REQUIREMENTS_MATRIX.md`: move AI-009 from PARTIAL to PASSED and add concise live evidence where the matrix style allows. Keep NEG-003 PARTIAL with updated wording that acknowledges one live sample but says broad language quality is not established.
- `ACCEPTANCE_TESTS.md`: append concrete Phase 19 live-provider evidence for AI-009. Keep NEG-003 wording honest.
- `IMPLEMENTATION_STATUS.md`: move AI-009 into PASSED and remove its stale live-provider blocker language. Keep NEG-003 PARTIAL.
- `CHANGELOG.md`: record the live Anthropic preview verification, exact rubric/version, one repair retry, real usage/cost, real negotiation classifier sample, zero remaining reservation, and revoked disposable device. Do not call NEG-003 fully passed.
- `docs/reviews/phase-19-ai-gateway.md`: replace the old "live provider not verified" boundary with the exact live evidence above. Preserve remaining limitations and explicitly keep NEG-003 PARTIAL.
- Update the PR body if it still claims the final head is `70ffded...`, claims 1,634 tests, says live Anthropic is unverified, or otherwise contains stale Phase 19 handoff facts. Use the actual final head only after your docs commit is pushed and CI begins.

Do not change grader/content/simulator/mastery/app versions for this evidence-only closeout.

## Production secret gate

Do NOT merge. Production declares `ANTHROPIC_API_KEY` as required. The user is configuring it separately and the independent ChatGPT audit will verify production readiness after your docs-only commit.

## Verification

After docs edits:

- run docs/requirements validation and formatting checks at minimum;
- run the normal full checks if practical under Node 22;
- push the docs-only commit to the existing branch;
- leave PR #21 open;
- report the new exact head, files changed, exact statuses, and CI run if started.

No merge.