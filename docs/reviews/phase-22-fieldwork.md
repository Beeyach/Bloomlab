# Phase 22 Fieldwork implementation evidence

Implementation scope is the [complete handoff](../handoffs/phase-22-fieldwork.md). The [operations guide](../operations/fieldwork.md) supplies recovery behavior and the required human acceptance. Exact final-head CI/Preview IDs and deployed build identity are maintained in the draft PR body so recording deployment evidence does not change the commit being verified.

## Content audit and decision

The eight existing fieldwork-required skills are lead-capture form, consultation calendar, pipeline design, workflow foundations, appointment reminders, no-show recovery, webhook payloads and snapshot portability. Only `GHL-SNAP-SNAPSHOTS` has REAL_GHL fidelity. Its existing pairing is `SK-SCALE-snapshot-portability` and `EX-FIELDWORK-snapshot-no-show-system`; therefore no registry fidelity change or new skill was needed.

Field Ready references the first six skills in gates 2–5 (and assesses form/pipeline foundations at placement). Webhooks and snapshot portability are in Advanced Automation, which follows Field Ready. The consultation-booking project already references the snapshot exercise. This phase makes that existing exercise usable; it does not author the missing Field Ready capstone, fill the other seven fieldwork gaps, or implement Portfolio.

The pre-existing exercise had a non-null legacy fieldwork block and unsupported `answers.*` assertions. The schema retains legacy evidence enums and reasoning strings and adds a bounded keyed proof contract. The updated exercise uses the reserved deterministic completeness projection. This checks manual proof completeness, not semantic truth of GHL configuration or reasoning. Required failed tests cannot pass; the result states this distinction explicitly.

Current feature grounding: the [official HighLevel Snapshots overview](https://help.gohighlevel.com/support/solutions/articles/48000982511-snapshots-overview), checked 2026-09-08, supports selecting source configuration assets and loading them into another subaccount. It distinguishes reusable configuration from live customer records and notes destination configuration dependencies. The exercise asks for manual inspection in two training subaccounts and keeps workflows in Draft. The existing registry source/fidelity is preserved. Worker storage implementation was checked against the [Cloudflare R2 binding reference](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/) and [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/).

## Evidence boundary

```text
Real GHL training/subaccounts
    ^ learner works there manually
    |
Bloomlab browser
    -> IndexedDB attempt draft + local screenshot Blob
    -> authenticated same-origin Worker evidence endpoints
    -> private R2 screenshot + D1 metadata

Final exercise_attempts + skill_evidence -> existing metadata/JSON sync
```

There is no Bloomlab-to-GHL API arrow and no screenshot-to-provider arrow. Screenshot input asks for images only; configuration answers ask for descriptions rather than credentials or sensitive URLs. No screenshot bytes, filenames, image content, credential or account URL is logged. Source tests restrict the fieldwork transport to the relative evidence endpoint with redirects refused. Browser fixtures reject external origins and never count as real-GHL proof acceptance.

## Tests and browser review

- Content-schema tests: legacy compatibility, stable keys, duplicate-key rejection, required reasoning and required real-GHL contract.
- FLD-004 direct engine regression: every other independent/pressure/sales gate satisfied; absent proof, provided=false and failed fieldwork remain blocked; valid passed proof permits MASTERED. Existing engine gate is unchanged.
- Local/UI tests: queued proof persistence, required failed tests, screenshot-free AI-Off completion, post-proof reasoning ordering, changed contracts, final-save recovery, fresh attempts do not inherit completed proof, concurrent/replayed finalization, sanitized evidence references and two-device sync without Blobs.
- Migration regression: v5 workspaces and call recording metadata survive the additive v6 upgrade.
- Worker tests use workerd's real local D1/R2: type/dimension/size rejection, checksum identity, repeat upload, private metadata/bytes, foreign/anonymous/revoked access, lost-object refusal, failed put retry, tombstone-before-upload, failed deletion and retry. No provider fetch.
- `review:fieldwork`: controlled screenshot selection through the browser file input, real IndexedDB Blob reload before upload, held/failed upload, same-Blob retry, private asset metadata, replacement/deletion, failed required test, checkpoint-only reasoning reveal, reasoning reload, final attempt/evidence counts, persisted deletion, keyboard/touch, reduced motion, input sizes and overflow at exactly 1440/1024/768/390/320.

Browser screenshots and JSON reports are local `.review/` artifacts. The final PR distinguishes controlled fixtures from actual Preview storage verification. Neither substitutes for Ary's manual GHL run. The full canonical Node 22 `npm run ci` includes typecheck, lint, formatting, all tests/simulator regressions, docs validation, content check, voice check and build.

Local controlled browser verification completed at all five widths with real IndexedDB and the full proof/reasoning/finalization flow. Review caught and fixed a fresh-attempt fallback that inherited earlier completed proof; a regression now ensures reasoning stays hidden on every new attempt. A final-write failure regression also keeps the draft editable/retryable. Desktop/tablet and phone captures were inspected for form readability, action availability, focus and overflow.

`fieldwork-live-storage.mjs` independently verifies the deployed build, private bytes, immutable replay, foreign/anonymous/revoked denial and owner deletion using isolated synthetic learners. Its exact-head result is recorded with CI/Preview in the PR. It never calls GHL or any image/voice/AI provider.

## Boundaries retained

FLD-001 / EXR-020 remain IMPLEMENTED_UNVERIFIED pending the human GHL run. FLD-003 stays DEFERRED. FLD-002 and FLD-004 are supported by the focused source/runtime and deterministic tests once the final verification is green. Independent audit remains outstanding; the PR stays draft/open/unmerged. Production deployment is not part of this branch's verification.

The Phase 21 merge facts are recorded without promoting CALL-002, CALL-005, CALL-006, EXR-015, VOI-006, VOI-007 or SEC-005. Safari Private Browsing Blob failures, repeated iPhone permission prompts and scripted roleplay limitations remain documented. Header validation is not image-content interpretation; no OCR, AI visual grading, credential integration or GHL API verification was added.
