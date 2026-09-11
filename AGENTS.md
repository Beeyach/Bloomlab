# Bloomlab agent operating policy

These instructions apply to future Codex sessions working in this repository.

## Model and reasoning policy

Quality is the priority, but do not default to the most expensive reasoning setting when a lower setting is sufficient.

- **Astra Medium**: default for substantial, well-specified implementation work.
- **Astra High**: use for difficult debugging, architecture, migrations, sync/data-integrity work, security/privacy, cross-cutting systems changes, or whole-repo reconciliation where the task materially benefits from deeper reasoning.
- **Astra XHigh / Extra High**: escalation only. Use only when High has already failed or missed the root cause, evidence is materially contradictory, the task has unusually high reasoning uncertainty, or the work genuinely pushes model capability. When recommending XHigh, state the concrete reason.
- **Sol High**: use for planning, handoffs, straightforward substantial implementation, and other well-specified work where Astra is unnecessary.
- Lower-cost models may be used for bounded mechanical or repetitive work when they can meet the same acceptance bar.

A task being long, important, whole-repo, or spread across many files does **not** by itself justify XHigh.

Routine repository exploration, test execution, CI waiting, artifact retrieval, log reading, documentation updates, and mechanical edits do not justify XHigh on their own.

## Escalation rule

Start with the lowest model/effort that is appropriate for the task while preserving expected quality.

Escalate only when there is evidence the current level is insufficient, such as:

1. a prior attempt failed or missed the root cause;
2. multiple plausible causes remain after normal investigation;
3. requirements or evidence materially conflict;
4. the change risks persistent-data corruption, security/privacy failure, or cross-system architectural damage and the reasoning is genuinely complex;
5. the task is explicitly an adversarial reasoning pass intended to find issues a lower effort may have missed.

Do not restart or discard valid work merely to change model or reasoning effort. Preserve the worktree and switch at the next clean boundary.

## Verification policy

Model strength never substitutes for evidence.

- Preserve deterministic tests, exact-head CI, Preview verification, and independent audit requirements.
- Never weaken acceptance criteria or assertions merely to obtain a green run.
- Keep human, physical-device, provider, and real-GHL acceptance boundaries distinct from automated evidence.
- Do not promote requirement statuses without the evidence required by the authoritative acceptance criteria.

## Recommendation format

When a meaningful task or handoff needs a model recommendation, give a short practical recommendation in this form:

- **Model:** <model>
- **Reasoning:** <level>
- **Why:** <one short sentence only when escalation above the default is warranted>

If recommending Astra XHigh, the **Why** line is mandatory.
