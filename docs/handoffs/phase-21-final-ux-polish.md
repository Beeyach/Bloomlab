# Phase 21 — final UX polish before closeout

PR #23 remains draft/open and unmerged. Do not merge your own PR.

Current independently audited runtime baseline before this UX pass: `62f9ebbf5255e62f8c876537909a58037f785fc9`.

Human acceptance produced two important UX findings that should be fixed before Phase 21 is closed:

1. Guided Northwind can feel repetitive when the learner answers with unrelated/random sentences and falls into authored clarification loops. The intended happy path is four learner turns, but `max_turns: 12` allows recovery loops. The product should make off-path state and the next useful action clearer without turning advanced calls into answer sheets or weakening deterministic conversation logic.
2. Long-running call actions currently rely too much on disabled/greyed controls. The user explicitly reported that this is not enough. Transcribe, confirm/evaluate, retry feedback and other network/provider waits need obvious, immediate loading/progress feedback.

## Required UX changes

### A. Visible asynchronous action state

Use the existing explicit Call Room phases as the source of truth. Do not add a second ad-hoc loading state machine.

At minimum:

- `Transcribe recording` becomes a visible loading state such as spinner + `Transcribing…` while uploading/transcribing.
- `Confirm transcript and continue` becomes spinner + clear status such as `Saving turn…` / `Evaluating…` as appropriate.
- `Retry call feedback` and initial feedback submission show spinner + `Getting feedback…` / `Retrying feedback…`.
- Any other button that can remain disabled for a perceptible remote operation should explain why, not simply turn grey.
- Preserve the existing room-level audio/status text, but make the action-level state visible at the exact control the learner used.
- Use an accessible live status (`aria-live` / status semantics where appropriate) so the state change is not purely visual.
- Prevent duplicate submission while loading, but keep the label/state understandable.
- Respect reduced motion. A spinner may animate normally, but reduced-motion users still need a clear non-motion busy indicator/text.
- No full-screen blocking loader unless the current operation truly blocks the whole Call Room.

### B. Guided off-path recovery clarity

Northwind is guided, so when the authored engine resolves a response to fallback/clarify or the learner is looping, make the guidance clearer without inventing client facts or changing the engine's authority.

Preferred behavior:

- In guided/practice modes only, when the current state is an authored clarification/fallback caused by an unrecognized/off-path response, show a concise secondary cue tied to the authored objective/anchors. Example style: `Try to move the call forward by asking about the current quote follow-up process.`
- Derive this from content that already exists (anchors, move labels, current authored node/moves). Do not hardcode Northwind exercise IDs or exact learner answers in React.
- Do not expose hidden state, correct scores, economics, or exact future client lines.
- Do not show these recovery cues in independent/pressure calls. Existing advanced-aid absence from the DOM must remain true.
- If the learner is on the intended authored path, do not clutter the room with extra coaching.
- Preserve deterministic branch selection and max-turn behavior. This is explanatory UX, not a new conversation engine.

### C. Keep existing human findings honest

Do not claim that this pass makes the roleplay fully natural. The user explicitly observed that the conversation still feels scripted. Preserve that as a known limitation unless the implementation materially changes conversation generation and receives new acceptance.

Do not change the deliberate local-first privacy order merely to make transcription feel automatic. Recording still needs to be locally checkpointed before provider upload. The current manual `Transcribe recording` action is acceptable; improve feedback around it rather than silently auto-sending microphone data.

Repeated iPhone Safari microphone permission prompts and Mac Safari Private Blob persistence failure remain separate browser observations. Do not broaden this UX pass into risky microphone-lifecycle or IndexedDB architecture changes unless a small, well-supported fix is obvious and fully regression-tested.

## Tests / acceptance

Add focused UI tests and update the browser call probe so it proves:

- visible busy label/spinner appears immediately after Transcribe, Confirm, feedback and Retry actions;
- duplicate action is prevented while busy;
- completion/error restores an understandable actionable state;
- reduced motion still has clear busy text;
- guided fallback displays a content-derived recovery cue;
- independent/pressure exercises do not render recovery coaching in the DOM;
- no regression to five widths, keyboard focus, 390px touch layout, transcript correction, TTS text fallback, local recording persistence, privacy/provider boundaries or the repaired grading flow.

Run the full pinned Node 22 CI suite, exact-head GitHub CI and Preview deployment. Production must remain disabled/skipped. Update the relevant Phase 21 review/limitations docs with the user's UX findings and what this pass actually changes.

Leave PR #23 draft/open and unmerged for independent audit.