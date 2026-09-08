# Phase 20 independent audit closeout

PR #22 independent audit instructions. Do not merge this PR yourself.

Model: Codex Astra High.

## Audited implementation head

The independent code audit was performed against implementation head:

`86567b0aefb8507513e610ce3a9f6ecc5ae64835`

At that head:

- PR #22 was open and mergeable.
- Exact-head CI run `34173187380` completed successfully.
- Checks passed, including typecheck, lint, format, 1,692 tests across 100 files, docs validation, content check, `voice:check`, and build.
- Preview deploy passed with `bloomlab-media-dev` bound as R2.
- Production deploy correctly skipped.
- No runtime-code blocker was found in the independent audit of registry compilation, provider boundary, immutable identity, D1 claims, R2 storage, metadata-only D1, authenticated playback, range responses, production generation denial, exact-byte promotion, production indexing, browser secret scans, and requirement status discipline.

Do not reinterpret this as permission to merge. ChatGPT owns the final merge decision.

## One required security closeout

The Phase 20 review records that the real `ELEVENLABS_API_KEY` was briefly entered as a Cloudflare plain-text Worker variable before the active preview binding was converted to a Worker secret.

Treat rotation as required before merge, not optional cleanup.

Reason: Cloudflare documents that ordinary text/JSON Worker environment variables are not encrypted and must not be used for sensitive information. Cloudflare also documents that a Worker version captures the complete Worker state at that point, including bindings. Therefore a historical saved Worker version can retain the previous plain-text binding value even when the active deployment later uses `secret_text`.

The safe remediation is credential rotation. Do not try to rewrite or delete historical versions as the primary remediation.

### User action

The user must:

1. revoke/delete the ElevenLabs API key value that was ever entered as a plain Cloudflare variable;
2. create a replacement ElevenLabs API key;
3. update only the preview Worker secret with the replacement value, without putting the value in chat, Git, logs, D1, screenshots, or PR text.

Expected secure Codespaces command after the replacement key exists:

```bash
cd /workspaces/Bloomlab/worker
npx wrangler secret put ELEVENLABS_API_KEY --env preview
```

Phase 20 does not need a production `ELEVENLABS_API_KEY`, because production only serves pre-generated R2 audio. Do not add one merely for this closeout.

No audio should be regenerated. Do not spend ElevenLabs credits to prove rotation. Existing 40 immutable assets and production R2 promotion remain valid because playback is provider-free.

## After the user confirms rotation

Update documentation/evidence only where necessary so the repository no longer describes rotation as merely recommended or outstanding. Record only that:

- the previously exposed credential was revoked/rotated;
- the replacement preview binding is a Worker secret;
- no secret value is committed or printed;
- production still does not require ElevenLabs for Phase 20 playback.

Do not claim that historical Worker versions were deleted unless that was actually verified.

Do not move `SEC-001` to PASSED. It remains a broader all-phase requirement and should stay PARTIAL unless its full matrix acceptance is independently proven.

Do not change the already-honest Phase 20 statuses unless new evidence genuinely requires it:

- VOI-001 PASSED
- VOI-002 PASSED
- VOI-004 PASSED
- VOI-005 PASSED
- DATA-007 PASSED
- DATA-006 PARTIAL
- SEC-001 PARTIAL
- VOI-003 NOT_STARTED
- VOI-006 NOT_STARTED
- VOI-007 NOT_STARTED
- CALL-* NOT_STARTED
- EXR-015 NOT_STARTED

`voice_calls` must remain off.

## Reverification after documentation change

Because the closeout should not modify runtime behavior:

1. run the normal required checks;
2. push the branch;
3. ensure exact-head CI passes;
4. ensure Preview deploy still passes;
5. do not run production Worker/D1 deployment from the PR branch;
6. leave PR #22 open.

Final report back to ChatGPT should contain only:

- new exact head SHA;
- confirmation the old ElevenLabs key was revoked/rotated by the user;
- confirmation the replacement preview binding is stored as a Worker secret, without showing the value;
- files changed for closeout;
- exact-head CI run and result;
- whether any new blocker appeared.

Do not merge.