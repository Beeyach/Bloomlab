# Phase 21 — final UX polish

Execution of the complete [UX handoff](../handoffs/phase-21-final-ux-polish.md) on draft/open [PR #23](https://github.com/Beeyach/Bloomlab/pull/23). Audited runtime baseline: `62f9ebbf5255e62f8c876537909a58037f785fc9`; starting handoff commit: `2bfcd47010b480252cb8afcefca94bcdebeda606`. This pass changes presentation, guards against stale restoration in the UI, and updates tests/probe. It does not change content, scenario engines, shared phase contracts, grading/provider code, microphone lifecycle, IndexedDB architecture or production gates.

## Human findings and resulting behavior

The user found disabled/grey controls insufficient during long actions. Guided Northwind also felt repetitive when unrelated sentences repeatedly took the authored clarification branch. Its intended path has four learner turns; `max_turns: 12` allows recovery. The turn limit and deterministic branching remain authoritative.

Call controls now reuse the design-system loading button: a visible spinner, explicit action text, full busy opacity, duplicate prevention and a polite live status outside the busy subtree. Reduced motion stops the spinner animation while retaining a static indicator and text. Progress derives from existing Call Room phases and the existing final-submission state; the wrapper owns no state. Saved-recording playback/deletion reuse that component's existing request state and distinguish which operation is active.

| Action | Visible progress |
| --- | --- |
| Availability / Start | Checking call availability… / Starting call… |
| Microphone permission | Waiting for microphone… |
| Transcribe / retry | Transcribing… during upload and recognition; room status still distinguishes those phases |
| Confirm / retry confirmed turn | Evaluating… then Saving turn…; the same control and confirmed text remain visible |
| Initial / retry feedback | Getting feedback…; failure restores Retry call feedback |
| Client replay | Loading client audio…; Continue with client text still permits cancellation/fallback |
| Saved recording replay / delete | Loading recording… / Deleting audio… |
| Retention / cleanup | Updating saved audio… |

Transcription paints its existing uploading phase before the first local read; actual upload still requires the saved recording/checkpoint. Confirmation retains immutable pending text on failure and the same retry identity. Completed feedback still uses the repaired gateway and saved-result replay. The manual Transcribe action remains explicit.

The full suite exposed a restore race: a delayed saved-recording response could replace a newer local confirmation and remove its retry control. A checkpoint revision guard now prevents a late restore from overwriting newer local edits or pending submissions. The focused regression deliberately holds that response through confirmation and verifies that the original confirmed text and exact retry identity survive.

Guided/practice calls show a secondary recovery cue only when the latest saved response took the current authored fallback without a recognized move. The cue uses a current non-looping question/clarification/reflection move label, otherwise an existing anchor/objective. It reads no hidden values, scores, economics or future client lines. It disappears after advancing, is absent on the intended path and at completion/turn limit, and is never mounted in independent/pressure modes. No exercise ID or learner answer is hardcoded in React. Recognized but unhelpful moves are not reclassified by the UI.

## Verification

- **21 focused UI/persistence tests passed across three files**, covering immediate progress before delayed responses, disabled duplicate activation, late-restore protection and exact confirmed-turn retry, initial/retry feedback, error/completion restoration, saved-recording request states, guided/practice fallbacks/loops, intended-path/limit silence and advanced-aid DOM absence. Web typecheck and targeted lint passed.
- Updated `scripts/review/call-probe.mjs` passed with real browser IndexedDB/MediaRecorder, a virtual microphone and explicit controlled HTTP fixtures. Both full four-turn calls still reach eight-dimension feedback: 390px touch and desktop keyboard. Delayed upload, recognition, confirmation, cleanup, feedback and replay exercise immediate spinner/text/live status and bounded request counts.
- The browser probe deliberately fails transcription, confirmation and initial feedback once, then verifies understandable retry and exact saved confirmation. A retained Blob survives reload and is deleted explicitly; unretained raw audio is absent after completion, transcript correction/history remain, and no raw audio enters the sync queue. Client TTS failure/cancellation retains text fallback. All fetch origins are the app origin; these fixtures make no paid provider requests.
- Two guided fallback turns display current authored recovery guidance. Selecting the current authored move advances and removes it. The controlled server does not pretend to classify arbitrary speech. Real independent/pressure exercises are taken off path and still contain no recovery cue or anchors in the DOM.
- Automated layout/font checks and manual screenshot review passed at **1440, 1024, 768, 390 and 320**. Phone transcript, move and notes inputs remain 16px. Busy controls stay legible; normal and reduced motion are checked. Keyboard focus and touch activation remain functional.
- Full local `npm run ci` passed under Node **22.22.1**: **1,791 tests / 109 files**, typecheck, lint, formatting, control-doc/content/voice validation and build. Lint retains the existing unrelated `ExerciseRunner.tsx` effect-dependency warning; no lint errors. Final-head GitHub CI, Preview deployment/version and post-deployment verification are recorded in the final PR checks/description. See [sanitized local evidence](phase-21-final-ux-polish-evidence.json). Deployed UI verification uses the same controlled probe; the prior successful real proposal grading/human recovery evidence remains separately recorded in [the reliability review](phase-21-feedback-reliability.md).

## Acceptance and limits

CALL-001/CALL-004 gain supporting UX evidence; CALL-003 and VOI-003 retain their existing supported results. No broader human row is promoted. These checks cannot substitute for remaining physical phone/keyboard, retention/recovery and privacy acceptance. No further human proposal or paid feedback retry is required for this UI pass.

The roleplay remains authored, turn-based and noticeably scripted according to the user. Recovery guidance clarifies a next useful action; it does not make conversation generation natural or expand recognized language. Manual local-first transcription, repeated iPhone Safari microphone permission prompts and the Mac Safari Private Blob persistence failure remain documented browser/product observations. Production stays disabled/skipped. PR #23 stays draft/open and unmerged for independent audit.
