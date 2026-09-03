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
| UI | `screens/SyncScreen.tsx`, `app/ConflictChooser.tsx` | Create or enter a key, recovery warning, copy / download / QR / "I saved it", connected devices with revoke, show key; "Two versions were changed" chooser (closing it postpones; "Choose now" on `/sync` reopens it; nothing is discarded until a choice); indicator links to `/sync`. |
| Secrets | Cloudflare | `SYNC_KEY_PEPPER` set per environment from random bytes, never printed (D-034); `worker/.dev.vars` locally. |

## Tests

| Suite | Count | Runs in |
|---|---|---|
| Shared: sync key, merge rules | 10 | Node |
| Worker: link, hashing, sessions, push/pull, conflict + force, rejections, devices/revoke/label, schema | 16 | workerd with the real migration (`@cloudflare/vitest-pool-workers`) |
| Web: link re-keying, push/pull, pending-edit precedence, conflict both ways, offline failure, revoked session | 10 | jsdom + fake-indexeddb against an in-memory server using `decideMerge` |
| Web: Phase 3 store, queue, device, status, UI | 27 | jsdom |

Total across the repository: 130 tests, all green; typecheck, lint, Prettier, docs validator and build green.

## Two-context test log (SYNC-011) — `npm run review:sync`

Two separate headless Chrome profiles (A and B) driven over the DevTools protocol against the built app, in the order required for Phase 4: A creates or changes learner data → the local write succeeds → the queue syncs to the Worker and D1 → B links with the key → B receives the synced state. Run against the local preview (`vite preview`, local D1) and against the deployed preview Worker with the remote `bloomlab-dev` database.

| Step | A | B | Result |
|---|---|---|---|
| A creates a key on `/sync` | key shown as `BLM-` + 13 groups, warning, Copy / Download / QR, "I saved my sync key" gate | — | linked, "Connected devices" shown |
| A adds a note in `/system` | Dexie row and outbox row appear before any network call (`notes 1`, `sync_queue 1`) | — | "Sync now" drains the queue; indicator "Synced" |
| B enters the key (lower-case, pasted) | — | "I already have a key" → link | linked; both devices listed, B tagged "This device" |
| B syncs | — | pulls | B shows A's note; indicator "Synced" |
| Both go offline, both edit the same note | "Edited on device A", `sync_queue 1` | "Edited on device B", `sync_queue 1` | both indicators "Offline · saved on this device" |
| A reconnects and syncs | applied (server revision 2) | — | — |
| B reconnects | — | the scheduler's `online` sync pushes → `conflict` | chooser "Two versions were changed." opens on its own with both texts; B's local text untouched |
| B keeps its version | pulls | forced push accepted (revision 3) | both devices show "Edited on device B", both "Synced" |
| A removes the note | "No notes yet." locally, then synced | pulls | B shows "No notes yet."; the tombstone row stays (`notes 1`) |
| A revokes B | Revoke on B's row | next request | B's session refused (401); B unlinks itself ("not linked") and keeps its outbox |

Captures: `.review/sync-a-key.png`, `.review/sync-b-unlinked-390.png`, `.review/sync-b-linked-390.png`, `.review/sync-b-linked.png`, `.review/sync-b-conflict.png`.

## Idempotency, retries and deletions

- **Duplicate pushes.** A retry after a lost response carries the exact state the server already holds; the Worker recognises it (same device, `updated_at`, `deleted_at` and fields) and answers `applied` with the existing revision without a new `sync_operations` row (Worker test "confirms a replayed push"; engine test "retries a push whose response was lost": the fake server applies then drops the response, the client's row returns to `pending`, the retry completes, the server log holds one entry and both devices converge).
- **Offline queue recovery.** With the server unreachable the outbox rows go back to `pending`, `sync_state.last_error` records why, the indicator reads "Saved on this device", and the next successful round trip drains them (engine test; probe step "both edited offline").
- **Soft deletes.** `remove` writes `deleted_at` and a new revision; the row travels like any write, the other device stores the tombstone and hides it from lists (`useNotes` filters), and a stale edit of a deleted snapshot record from another device is a conflict rather than a resurrection (Worker test "propagates a soft delete"; engine test; probe step "deletion propagated").
- **Revocation.** Revoke clears the device's token hash and marks its sessions; the next request answers 401 and the client unlinks itself while keeping its outbox for after re-linking.

## Secret handling audit

- The raw sync key is sent once, in the body of `POST /api/sync/link`, over HTTPS; the Worker hashes it with the pepper and stores only the hash (`learners.key_hash`). The Worker test reads the learner row back and asserts it contains the hash and not the key.
- Session tokens are returned once by `link` and stored hashed (`devices.token_hash`, `sync_sessions.token_hash`); the Worker test asserts the stored value differs from the token.
- Logging: the Worker's only log statement records an error *message* on unexpected failures, never the request, headers, body or bound values; the client has no log statements in the data layer or screens. Workers observability captures `console` output and invocation metadata (method, URL, status), not headers or bodies; the key never appears in a URL.
- The pepper lives only in the Worker secret binding (`SYNC_KEY_PEPPER`) and `worker/.dev.vars` (git-ignored); it was generated and uploaded without being displayed (D-034). `link` refuses to run without it (503).
- Client storage: the device keeps the session token and its own sync key in IndexedDB (D-031) so the learner can re-show the key; the recovery file is written only when the learner asks for it.

## Not done in this phase

- DATA-001 and SYNC-007 remain PARTIAL: their acceptance criteria name a workflow-node drag and a deterministic exercise, which arrive with Phases 12 and 9. The note interaction and the coalescing rule pass today.
- Only `notes` syncs today; the other entity kinds are declared and their tables exist. A later phase that adds a local table must reset the pull cursor once.
- No per-IP rate limit on `link` yet (256-bit keys; a rate-limit binding is the planned addition).
- Verified in headless browser contexts, not on physical phones; the install prompt and persistent storage remain to be confirmed on a device.
