# Phase 4 review — D1 and sync

Date: 2026-09-02 · Build: `feat/d1-sync` (production bundle, preview environment).

Implements spec §88–§93 and §146 and the Phase 4 line of §163: learner, sync key, hashing, device sessions, sync, conflicts, offline recovery, verified across two device contexts. Requirement evidence lives in `IMPLEMENTATION_STATUS.md`; this is the log behind it, including the SYNC-011 test log.

## What was built

| Piece | Where | Notes |
|---|---|---|
| Schema | `migrations/0001_init.sql` | The six §93 domains plus `notes` (D-029); envelope columns + `payload` JSON on learner-data tables; `sync_operations` is the per-learner change log. |
| Databases | `worker/wrangler.jsonc` | `bloomlab-dev` (local, preview) and `bloomlab-prod` (production), binding `DB`; CI migrates dev on PRs and prod on `main` before deploying (D-033). |
| Sync key | `packages/shared/src/syncKey.ts` | 256 random bits, Crockford base32, `BLM-XXXX-…` (13 groups); tolerant normalisation. |
| Contract | `packages/shared/src/sync.ts`, `syncMerge.ts` | Entity kinds (simple / append / snapshot), envelope, API types, `decideMerge` (D-030). |
| Worker | `worker/src/sync/` | `link` (key → `SHA-256(secret + pepper)`, device + session token), `push`, `pull`, `devices`, `revoke`, `label`; bearer sessions matched by hash; 503 without a pepper. |
| Client | `apps/web/src/data/sync/` | `linkThisDevice` (re-keys local records), `syncNow` (push → pull, shadows, conflicts), `resolveConflict`, `startSyncScheduler`; Dexie v2 (`sync_shadow`, `sync_conflicts`). |
| UI | `screens/SyncScreen.tsx`, `app/ConflictChooser.tsx` | Create or enter a key, recovery warning, copy / download / QR / "I saved it", connected devices with revoke, show key; "Two versions were changed" chooser; indicator links to `/sync`. |
| Secrets | Cloudflare | `SYNC_KEY_PEPPER` set per environment from random bytes, never printed (D-034); `worker/.dev.vars` locally. |

## Tests

| Suite | Count | Runs in |
|---|---|---|
| Shared: sync key, merge rules | 10 | Node |
| Worker: link, hashing, sessions, push/pull, conflict + force, rejections, devices/revoke/label, schema | 16 | workerd with the real migration (`@cloudflare/vitest-pool-workers`) |
| Web: link re-keying, push/pull, pending-edit precedence, conflict both ways, offline failure, revoked session | 10 | jsdom + fake-indexeddb against an in-memory server using `decideMerge` |
| Web: Phase 3 store, queue, device, status, UI | 27 | jsdom |

Total across the repository: 126 tests, all green; typecheck, lint, Prettier, docs validator and build green.

## Two-context test log (SYNC-011) — `npm run review:sync`

Two separate headless Chrome profiles (A and B) driven over the DevTools protocol against the built app. Results below are from the local preview (`vite preview`, local D1) and were repeated against the deployed preview Worker.

| Step | A | B | Result |
|---|---|---|---|
| A creates a key on `/sync` | key shown as `BLM-` + 13 groups, warning, Copy / Download / QR, "I saved my sync key" gate | — | linked, "Connected devices" shown |
| B enters the key (lower-case, pasted) | — | "I already have a key" → link | linked; both devices listed, B tagged "This device" |
| A adds a note in `/system`, syncs | note pushed | "Sync now" pulls it | B shows A's note; both indicators "Synced" |
| Both go offline, both edit the same note | "Edited on device A" | "Edited on device B" | both indicators "Offline · saved on this device" |
| A reconnects and syncs | applied (server revision 2) | — | — |
| B reconnects and syncs | — | push → `conflict` | chooser "Two versions were changed." with both texts; B's local text untouched |
| B keeps its version | pulls | forced push accepted (revision 3) | both devices show "Edited on device B", both "Synced" |
| A revokes B | Revoke on B's row | next request | B's session refused (401); B unlinks itself and keeps its outbox |

Captures: `.review/sync-a-key.png`, `.review/sync-b-linked.png`, `.review/sync-b-conflict.png`.

## Not done in this phase

- Only `notes` syncs today; the other entity kinds are declared and their tables exist. A later phase that adds a local table must reset the pull cursor once.
- No per-IP rate limit on `link` yet (256-bit keys; a rate-limit binding is the planned addition).
- Verified in headless browser contexts, not on physical phones; the install prompt and persistent storage remain to be confirmed on a device.
