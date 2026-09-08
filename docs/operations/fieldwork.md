# Phase 22 Fieldwork operations and acceptance

Branch: `codex/phase-22-fieldwork`. Keep the Phase 22 PR draft/open and unmerged for independent audit and the real-GHL human run. Do not deploy production from this branch.

Exercise: `/exercise/EX-FIELDWORK-snapshot-no-show-system`.
Target capability: `/skills/SK-SCALE-snapshot-portability`.

## Ownership and storage

The existing active exercise workspace owns drafts. Finalized `exercise_attempts.response.fieldwork` owns the structured proof, reasoning, confirmation and asset references; `skill_evidence` remains the mastery input. Both finalized records use the existing append-only sync and version envelope. There is no second fieldwork history store. The pre-existing reserved `fieldwork` sync entity is not used.

Dexie v6 adds local-only `evidence_assets`: screenshot Blob, stable ID and recoverable upload/deletion state. Versions 1–5 keep their effective schemas. D1 migration `0006_evidence_assets.sql` adds private asset metadata only. Migrations 0001–0005 are unchanged. R2 uses the existing environment-specific private MEDIA binding under `evidence/<learner>/<asset>`. There is no public R2 URL.

`PUT /api/evidence/assets/<uuid>` accepts a bounded raw PNG/JPEG/WebP body and authored attempt/exercise/item references. `GET` reads metadata, `GET .../image` streams private bytes, and `DELETE` tombstones metadata and deletes R2 bytes. All authenticate a non-revoked Bloomlab device session and scope the asset to its learner. Responses disable caching; image responses also set nosniff. Filename/extension is never authoritative or stored. Limits: 8 MiB, 8192 pixels per side, 32 megapixels. Server validation inspects signatures and encoded dimensions; it does not perform semantic inspection or OCR.

Upload identity is immutable by asset ID + owner + attempt + exercise + proof key + checksum. A ready retry checks the live R2 object and returns its existing metadata. An interrupted upload keeps the local Blob; a server claim can be retried after 60 seconds if the request died. A delete reserves a tombstone even when it overtakes the original upload. R2 deletion failure leaves `deleting`; reads are refused until cleanup is retried. A late uploader checks the tombstone and removes any late bytes.

A linked Bloomlab device is needed to upload/read private screenshots. This is a Bloomlab Sync Key, never a GHL credential. Draft text and selected images remain local while offline or unlinked. A required screenshot must be uploaded and live at checkpoint and finalization. A task authored without required screenshots can be completed locally with AI Off.

Screenshots can be deleted after submission. The immutable attempt records proof present at submission; its image display resolves current tombstone state. Deletion does not rewrite the historical pass or pretend the screenshot still exists. Other linked devices can have previously downloaded local bytes: deleting remote R2 is not a remote wipe of those browsers. Replaced screenshots are deleted before selecting their replacements.

## Recovery

- Reload resumes the same active attempt and its keyed proof/reasoning.
- Upload failure: use **Upload saved screenshot**; the original Blob stays in IndexedDB.
- Selection saved but response-reference write failed: **Recover saved screenshot** reconnects the local image.
- Delete failure: **Retry delete** completes the tombstone/R2 cleanup before replacement.
- Required test failed: fix the GHL configuration, rerun the test, correct the observed result/status, then save the proof checkpoint again.
- Proof edits invalidate the checkpoint/confirmation. Reasoning answers are retained, but another checkpoint is required.
- Content changed: **Review updated task with saved answers** retains the draft, refreshes the contract, and requires proof review again. Old keyed responses are not silently treated as new proof.
- Local final-write failure: retain the draft, free storage if needed, then submit again. Stable attempt and evidence IDs prevent duplicate passes, including concurrent clicks.

## Required human acceptance — Ary

Use the exact Preview build and exercise URL recorded in the draft PR. Automated evidence is controlled test data; it does not satisfy this acceptance.

1. Open the Fieldwork exercise. In GHL, use two dedicated training subaccounts and the agency Snapshot permissions described by the task. Build and transfer the authored system manually; keep both workflows in Draft and use fictional records.
2. Upload the required cropped destination-workflow screenshot. Fill the configuration descriptions and explanation, perform the three inspection tests in GHL, and record their actual observations/statuses.
3. Choose **Save proof checkpoint**. Confirm the reasoning questions appear only now, then answer them and confirm the work was performed in your real training/subaccount.
4. Choose **Complete fieldwork**, reload, and confirm your result and proof persisted.
5. Open Snapshot portability on the Skill Map. Real-GHL fieldwork should no longer be its missing requirement; other independence/prerequisite requirements may still remain.

No production credentials, API tokens, GHL browser automation, or unrelated Phase 21 retest is requested. FLD-001 and EXR-020 remain IMPLEMENTED_UNVERIFIED until this run succeeds. Independent audit is a separate gate. FLD-003 remains DEFERRED.

## Verification commands

Use pinned Node 22.22.1 (or the repository's pinned Node 22 environment):

```sh
npm run ci
npm run review:fieldwork
```

The browser probe accepts `BASE`, `REVIEW_HEAD`, `REVIEW_OUT`, `CHROME`, and `CHROME_FLAGS`. `FIELDWORK_LIVE=1` requires `/api/health.build_id` to match `REVIEW_HEAD` and uses a new isolated test learner with actual Preview private asset endpoints. It never opens GHL or calls an AI/voice provider. Every width creates controlled proof, completes, reloads, and deletes its screenshot. Sync JSON is checked for references only; the unit integration separately proves transport to another device. Keep synthetic learner IDs/artifacts local and exclude all tokens from reports.
