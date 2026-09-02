# Phase 3 review — local-first data

Date: 2026-09-02 · Build: `feat/local-first-data` (production bundle, preview environment).

Implements spec §86 (local-first), §87 (PWA), §91 (sync envelope) and the Phase 3 line of §163: IndexedDB, data services, local state persistence, sync queue primitives. Requirement evidence lives in `IMPLEMENTATION_STATUS.md`; this is the log behind it.

## What was built

| Piece | Where | Notes |
|---|---|---|
| Database | `apps/web/src/data/db.ts` | Dexie 4, schema v1: `device`, `notes`, `workspace`, `sync_queue`, `sync_state`. No ORM; localStorage unused. |
| Envelope | `envelope.ts`, `types.ts` | `id, learner_id, created_at, updated_at, revision, device_id, deleted_at` on every syncable record (SYNC-007). |
| Write path | `stores.ts` | `createSyncableStore(entity)`: create / patch / remove stamp the envelope and commit the row and its outbox operation in one transaction; deletes are soft. |
| Outbox | `syncQueue.ts` | One pending row per record (later changes coalesce into it); in-flight rows are left alone; `take / complete / fail / reset` for the Phase 4 transport. |
| Device | `device.ts` | First-run device id, provisional `local:` learner id, friendly default label, rename, persistent-storage request. |
| Checkpoints | `workspace.ts` | Local-only key/value for in-progress work. |
| Status | `syncStatus.ts`, `app/SyncStatusIndicator.tsx` | Offline · saved on this device → Saved on this device → Syncing… → Synced; polite live region. |
| UI | `screens/DeviceIdentity.tsx`, `screens/LocalDataDiagnostics.tsx` | "This device" tile with rename on the home; "Local data" section on `/system` with test-note actions. |
| PWA | `apps/web/vite.config.ts`, `public/icons/`, `scripts/make-icons.mjs` | Workbox precache of the shell and stable assets; `/api/*` NetworkOnly; `/content/*` stale-while-revalidate; manifest + icons; auto-update. |

## Verification (`npm run review:offline`, production bundle)

| Check | Result |
|---|---|
| Service worker | registered at `/`, controlling the page after first load; one precache with 40 entries |
| Manifest | parsed without errors; `Page.getInstallabilityErrors` → none |
| Database | `bloomlab@10` open (Dexie v1); `localStorage` keys: none |
| Offline (page + worker emulated) | indicator "Offline · saved on this device"; reload renders the shell (h1 present); `fetch('/api/health')` → `Failed to fetch` (not served from cache) |
| Offline write | Rename → Save updates the tile; offline reload still shows the new name; IndexedDB `device` row holds it |
| Back online | `/api/health` → `preview`; indicator "Saved on this device" |

Unit tests (jsdom + fake-indexeddb): schema, device identity and label rules, store stamping / coalescing / in-flight isolation / soft delete / ordering, queue claim-complete-fail-reset, workspace round trip, status derivation and live hook, indicator live region, device rename UI (37 tests in the web project).

Layout: home and `/system` captured and audited at 320 / 390 / 768 / 1024 / 1440 (`REVIEW_OUT=.review/phase3 PAGES=home,system npm run review:capture`): no overflow or clipping; the new tile and indicator recompose cleanly; small buttons are 36 px on fine pointers and 44 px on touch as designed.

## Not done in this phase

- No transport: the queue is never drained and "Synced" never shows (Phase 4).
- The install prompt itself was not observed (headless Chrome shows none); Chrome's installability criteria pass.
- The three DATA-001 acceptance interactions (note, workflow node, exercise) belong to later phases; the same path is exercised by the device rename and the diagnostics test note.
