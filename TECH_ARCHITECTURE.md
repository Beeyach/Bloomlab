# TECH ARCHITECTURE

Normative working architecture for Bloomlab, derived from `BLOOMLAB_MASTER_SPEC.md` §85–§112, §132–§134, §148–§152 and `docs/reference/BLOOMLAB_TECHNICAL_ARCHITECTURE_v1.md` (preserved verbatim as rationale; see D-002). Where the two differ, the master spec governs (D-003). Requirement IDs: INF-*, DATA-*, SYNC-*, AI-*, VOI-*, SEC-*, PERF-*.

## 1. Goals (TA§1)

Bloomlab should behave like a serious installed application even though it runs on the web. Priorities, in order: instant-feeling interaction · reliable cross-device progress sync · offline-tolerant study · deterministic simulator behavior · very limited AI dependency · low recurring cost · clean content/version management · easy GitHub development · mobile, tablet and desktop from one codebase · ability to commercialise later without rewriting everything.

If every AI API stopped working tomorrow, the curriculum, simulator, progression, projects, exercises, CRM Lab, Workflow Lab, Funnel Lab, pricing drills, deterministic grading, portfolio and saved progress still work (PRD-004).

## 2. Locked stack (INF-001, INF-009)

| Concern | Choice |
|---|---|
| Client | React + TypeScript + Vite |
| Hosting / API | Cloudflare Workers + Static Assets (not legacy Workers Sites) |
| Local persistence | IndexedDB via Dexie (or similarly small wrapper) |
| Synced relational persistence | Cloudflare D1 |
| File / audio storage | Cloudflare R2 |
| State architecture | Local-first + checkpoint sync |
| Simulator | Deterministic TypeScript event engine; Web Worker where workloads justify it |
| Learning content | Git-tracked YAML + Markdown/MDX, validated by Zod, compiled at build |
| AI | Claude API behind the Worker; limited and budget-controlled |
| Voice generation | ElevenLabs |
| Speech recognition | Google Cloud Speech-to-Text V2 |
| Source control / CI | GitHub / GitHub Actions |
| Auth | None initially — Bloomlab Sync Key + device sessions |
| Realtime infrastructure | None initially |
| Durable Objects / Queues | Future options only |
| Real GHL | Required for selected practical projects, not everyday simulator exercises |
| Language | TypeScript everywhere; no untyped JS for application logic |

This is the default architecture unless implementation testing exposes a concrete reason to change it.

## 3. Topology (TA§5)

```text
Browser
  ├── Static Bloomlab application (React, PWA)
  │     ├── local state → IndexedDB → sync queue
  │     └── Web Worker: simulator execution
  └── /api/*
        ▼
Cloudflare Worker
  ├── D1   (learner-specific synced data)
  ├── R2   (audio, screenshots, media, backups)
  ├── Claude API      (behind budget governor)
  ├── ElevenLabs API
  └── Google Cloud Speech-to-Text V2
```

Frontend assets and the Worker deploy together through the Workers + Vite setup.

## 4. Repository layout (INF-002)

```text
bloomlab/
├── apps/web/                 React application
├── worker/                   Cloudflare Worker (API, AI gateway, sync)
├── packages/
│   ├── simulator-core/       deterministic simulation engine
│   ├── exercise-engine/      exercise runner + deterministic grading
│   ├── mastery-engine/       mastery states, evidence, review scheduler, session builder
│   ├── content-schema/       Zod schemas + content compiler
│   ├── design-system/        tokens, primitives, HoloMaterial
│   └── shared/               shared types/utilities
├── content/                  curriculum (see CONTENT_ARCHITECTURE.md)
├── migrations/               D1 migrations
├── tests/                    cross-package, scenario and regression suites
├── scripts/
├── docs/
├── public/
├── CLAUDE.md · PRODUCT_VISION.md · CURRICULUM_MASTER_MAP.md · DESIGN_SYSTEM.md
├── TECH_ARCHITECTURE.md · CONTENT_ARCHITECTURE.md · SIMULATOR_SPEC.md · EXERCISE_ENGINE.md
└── REQUIREMENTS_MATRIX.md · ACCEPTANCE_TESTS.md · IMPLEMENTATION_STATUS.md · KNOWN_LIMITATIONS.md · CHANGELOG.md
```

## 5. Application structure (TA§4)

One application, several environments that are different views over shared data: Command Center · Campaigns · Skill Map · Academy · Simulator (Workflow Lab, CRM Lab, Funnel Lab, Calendar Lab, Conversations Lab, Payments Lab, Reporting Lab) · Clients · Exercises · Call Room · Pricing Arena · Fieldwork · Portfolio · Playground · Settings.

Each major environment has its own error boundary (INF-011): Claude failure never breaks Workflow Lab; Call Room failure never breaks CRM Lab; sync failure never destroys local state; TTS failure shows text; transcription failure preserves audio for retry.

## 6. Local-first data (DATA-001 … DATA-003)

```text
user action → local state updates immediately → IndexedDB checkpoint → sync queue → quiet server sync
```

Normal interaction never waits on the server. If internet disappears, Bloomlab keeps working for ordinary non-AI learning; a small indicator shows "Saved on this device", then "Synced" when connection returns. No modal interruption.

IndexedDB (Dexie) holds: current simulator session · unfinished exercise · node positions · current client workspace · notes · cached curriculum · cached asset metadata · offline progress changes · pending sync operations · audio metadata · recent execution logs. localStorage is never the main datastore. No custom IndexedDB ORM.

PWA: installable; service worker caches app shell, stable curriculum, stable assets, offline fallback. API responses are not cached blindly. Progress lives in IndexedDB.

## 7. Bloomlab Sync Key and device sessions (SYNC-001 … SYNC-011)

No conventional login in v1.

- First device generates ≥ 256 bits of cryptographically secure random data. Display uses a friendly encoding, e.g. `BLM-K8XR-3PVQ-…`.
- Worker receives the secret over HTTPS and stores only `SHA-256(secret + server-side pepper)` in D1. The pepper (`SYNC_KEY_PEPPER`) lives only in a Worker secret. The raw secret is never stored server-side.
- After verification each device gets its own revocable session token; the master key is not sent with every request. D1 `devices`: `device_id, learner_id, token_hash, created_at, last_seen_at, revoked_at, device_label`. Later UI: Connected devices (`Ary's Android`, `Desktop Chrome`, `Tablet`) with Revoke.
- Recovery: state clearly that losing every device and the key means server recovery is impossible without future account authentication. Offer copy key, download recovery file, QR display, confirm-saved. Never force account creation.

### Sync model

Every syncable entity: `id, learner_id, updated_at, revision, device_id, deleted_at`. Optimistic sync of meaningful state only (not every drag coordinate). Simple progress records: latest valid revision wins. Append-only evidence: merge. Complex simulator work: explicit project snapshots. Conflicting simultaneous edits of the same active project are never silently resolved — show "Two versions were changed. Choose which version to keep."

## 8. D1 (DATA-004, DATA-005, DATA-010, DATA-011)

Rule: **Git = what Bloomlab teaches. D1 = what the learner has done.** Static curriculum is not mirrored into D1. D1 does not receive a write when a node moves three pixels.

| Domain | Tables |
|---|---|
| Identity | learners · devices · sync_sessions |
| Learning | skill_progress · skill_evidence · campaign_progress · exercise_attempts · review_queue · fieldwork |
| Simulation | sim_projects · sim_snapshots · sim_events · client_progress |
| Portfolio | portfolio_projects · portfolio_assets |
| AI | ai_usage · ai_feedback · rubric_runs |
| System | content_versions · sync_operations · feature_flags |

Separate `bloomlab-dev` and `bloomlab-prod`. Migrations are never tested against production first. Completed historical attempts are never mutated when content or GHL features change.

## 9. R2 (DATA-006, DATA-007)

R2 stores ElevenLabs audio, scenario voice assets, fieldwork screenshots, portfolio screenshots, generated certificates, recovery backups, scenario attachments, optional recordings, large scenario datasets. D1 stores metadata only; no huge binaries or giant JSON blobs in D1. Buckets with learner data stay private; access via Worker authorisation, short-lived signed access or controlled routes. Inherently public static assets may be handled separately.

## 10. Not in v1 (INF-006, INF-007, INF-008)

No Durable Objects (future: multiplayer, mentor observation, collaborative sessions). No Queues (future: AI batch jobs, long audio processing, exports, delayed tasks). No Redis, Supabase, Firebase, separate Node server, Kubernetes, microservices, or vector database unless a real feature proves necessity.

v1 infrastructure is exactly: GitHub · Cloudflare Worker · Static Assets · D1 · R2 · browser IndexedDB · Claude API · ElevenLabs · Google Speech-to-Text.

## 11. Simulator execution (SIM-002, SIM-014)

`packages/simulator-core` is a deterministic TypeScript engine completely separate from React (see `SIMULATOR_SPEC.md`). Heavy execution — workflow runs, traffic simulation, timeline replay, analytics — runs in a Web Worker so the holographic interface never stutters.

## 12. AI gateway (AI-001 … AI-013)

```text
browser → Worker → budget check → request normalisation → Claude → schema validation → result stored
```

- Claude is never called from the browser; `ANTHROPIC_API_KEY` never reaches the bundle.
- Preference order: code → deterministic rules → authored branches → lightweight classifier → full LLM judgment. AI is the coach, not the course engine.
- Setting: **AI Coaching Off / Limited / Full**; default Limited; core Bloomlab works with Off.
- Model routing: deterministic tasks use no model; a cheaper Claude model handles classification, extraction, rubric-mention checks, feedback normalisation; a stronger model handles sales critique, open-ended diagnosis, proposal review, negotiation, discovery-call evaluation, explanation quality, hard client reasoning. The most expensive model is never the runtime default (it is the build-time model in Claude Code).
- Budget governor (server-side, configurable, monthly limit default $20):

| Spend | Behavior |
|---|---|
| $0–12 | normal limited AI use |
| $12–16 | prefer cheaper models; reduce optional coaching |
| $16–19 | AI reserved for important assessments and roleplay |
| $19+ | optional requests blocked; only explicitly permitted essentials |

Never silently exceed the limit. `ai_usage` records model, input_tokens, cached_input_tokens, output_tokens, estimated_cost, exercise_id, request_type, created_at.
- Structured output only (`score, rubric_results[], critical_issue, strengths[], improvements[], next_probe, confidence`), schema-validated; one repair-prompt retry; then save the learner's work and report evaluation failure. Never parse free-form prose.
- AI never overrides deterministic failure (expected SMS 1, actual 2 → failed).
- Prompt caching for stable context (grading philosophy, rubrics, negotiation rules, client profile, skill criteria). The whole curriculum is never sent per call.
- Every rubric is versioned (`SALES_DISCOVERY_RUBRIC_V3`); attempts stay bound to their version. Feedback storage: submission, rubric version, model, result, cost, timestamp — not giant prompts forever.
- Settings show "AI this month $6.83 / $20" with a breakdown; cost is not displayed obsessively during learning.
- On AI failure: save submission, preserve transcript and deterministic state, offer retry, allow other non-AI study. Never lose work.

## 13. Voice and speech (VOI-001 … VOI-007, CALL-002)

- **Mode A — pre-generated assets (preferred):** greetings, scripted objections, common responses, voicemail, interruptions, scenario lines, recurring dialogue generated with ElevenLabs and stored in R2. No runtime TTS cost, immediate playback. While the ~128k expiring credits remain, deliberately build a reusable library; never make functionality depend on those credits.
- **Mode B — dynamic speech:** advanced negotiation, unpredictable roleplay, open-ended discovery, Boss Client. `Claude chooses response → Worker → ElevenLabs stream → audio`. Cache reusable lines.
- **Voice character registry:** client_id, voice_id, speech_rate, style, stability, allowed_emotion_range, language. Recurring clients keep consistent voices.
- **Speech-to-text:** Google Cloud Speech-to-Text V2, turn-based v1: record locally → upload via backend → transcribe → show transcript → evaluate → optionally delete raw audio. No live streaming or full-duplex telephony in v1.
- **Recording policy:** transcript saved by default; raw audio temporary, optional to retain, user-deletable. Consent/privacy pass before commercial launch (SEC-006, deferred).

## 14. Environments and secrets (INF-004, SEC-001 … SEC-005, FLD-002)

Environments: local · preview · production. Separate D1 (`bloomlab-dev`, `bloomlab-prod`) and, where practical, separate R2 buckets.

Secrets (`ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `GOOGLE_CLOUD_CREDENTIAL`, `SYNC_KEY_PEPPER`, future GHL credentials) live only in platform secret storage. Never committed, never in client-side Vite variables, never in curriculum files, never in D1. Production data is never used casually for development. Learner screenshots are never published. Private recordings are never silently sent to unrelated services.

Bloomlab never requires the user's GHL credentials for ordinary training. Real-GHL fieldwork is manual in v1. Optional Private Integration verification is a separate, deferred phase (FLD-003).

## 15. Versioning (INF-013, CNT-007, SIM-019)

Every release carries `app_version`, `content_version`, `simulator_version` (e.g. `app 0.8.3 · content 2026.09.17 · simulator 0.5`). Saved attempts record all three so old evidence remains historically valid when GHL or content changes.

## 16. Feature flags, search, analytics (INF-010, INF-017, INF-018)

Simple flags (`voice_calls`, `workflow_lab_v2`, `ai_negotiation`, `custom_objects`, `ghl_verification`) keep half-finished interfaces hidden. Global search uses a client-side index over skills, GHL features, lessons, glossary, clients, past exercises — no external search service. Analytics track learning events only (exercise attempted/passed, skill demonstrated, hint used, critical failure, fieldwork completed, gate completed, AI request, session duration).

## 17. Backup and restore (DATA-008, DATA-009)

**Export Bloomlab Data** produces a versioned structured (optionally encrypted) backup: progress, evidence, projects, notes, simulator saves, portfolio metadata; large R2 files referenced or optionally bundled later. **Restore Backup** validates backup version and schema, requires confirmation, never silently overwrites.

## 18. Testing and CI (INF-005, SIM-017, CNT-011, A11Y-010)

Layers: unit (simulator transitions, grading, mastery, session selection, pricing math, sync) · scenario (end-to-end simulation cases such as "cancelled appointment must not receive reminder") · content (all IDs valid, no missing prerequisites, no unknown GHL features) · UI (core workflows) · responsive (1440/1024/768/390/320) · accessibility (keyboard, touch, reduced motion) · visual review (Design Bible) · real GHL (selected manual field validation).

Simulator regression suite is mandatory: every simulated GHL behavior gets fixtures (`WAIT-001` fixed wait, `WAIT-002` appointment-relative, `WAIT-003` late enrollment, `WAIT-004` cancellation during wait, …). Bug fixes add fixtures. If a change breaks `WAIT-003`, CI fails.

GitHub Actions runs typecheck · lint · unit · simulator · content validation · build on PRs and main pushes. Deployment only after checks pass. Substantial branches/PRs get preview deployments inspectable on a phone (RSP-005).

## 19. Performance (PERF-001 … PERF-003)

Fast app shell · route-level code splitting · lazy-load heavy simulators · preload only likely next content · stop animations off-screen · CSS transforms/composited layers · Web Worker simulator · local-first interaction. Workflow Lab does not load while reading an Academy lesson. Simulator interaction targets 60 fps where feasible.

## 20. Architecture anti-patterns (TA§84)

Never: store everything in one giant React state object · put simulator logic inside components · call Claude directly from the browser · store API secrets client-side · hardcode lessons into pages · duplicate GHL feature definitions · make separate fake databases per lab · use AI to calculate deterministic answers · use localStorage for all state · make server connection mandatory for ordinary exercises · put huge JSON blobs into one D1 row · rebuild curriculum relationships at runtime · silently resolve sync conflicts · introduce infrastructure just because Cloudflare offers it · add realtime infrastructure before Bloomlab needs realtime behavior.

## 21. Build order (§163 phases ↔ TA§86 steps)

| Master spec phase | TA§86 steps used as intra-phase order |
|---|---|
| 1 Repository Foundation | 1 repo · 2 React/Vite/Workers · 4 routing |
| 2 Design System | 3 design tokens |
| 3 Local-First Data | 7 IndexedDB |
| 4 D1 + Sync | 5 D1 · 6 sync key |
| 5 Content Engine | 8 content schemas · 9 content compiler |
| 6 Learning Engine | 10 skills · 11 campaign · 12 evidence · 13 mastery · 15 session builder |
| 9 Exercise Runner | 14 exercise runner · 21 grading engine |
| 10 Simulator Core | 16 data model · 17 event engine · 18 clock · 19 contact engine |
| 11–14 Labs | 22 Workflow Lab · 23 CRM Lab · 24 Funnel Lab · 25 client workspace · 36 calendars |
| 16–18 Commercial skills | 26 pricing · 27 inbox simulation · 28 negotiation |
| 19 AI Gateway | 29 Claude gateway · 30 rubric evaluation · 31 budget governor |
| 20–21 Voice | 32 ElevenLabs assets · 33 recording · 34 Google transcription · 35 Call Room |
| 15, 23, 25 | 37 payments · 38 reporting · 39 portfolio · 40 advanced GHL |

## 22. Open items for Phase 1

- Package manager and workspace tooling (D-007): Node 22.18 and npm 10.9.3 available; pnpm not installed. Decide in Phase 1.
- Cloudflare account resources (Worker, D1 dev/prod, R2) and secrets must be created by the user before Phase 1's environment work and Phase 4's sync work can be verified.
- Wrangler configuration for Workers + Static Assets + Vite is Phase 1 scope.
