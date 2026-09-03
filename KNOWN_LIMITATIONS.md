# KNOWN LIMITATIONS

Honest record of approximations, gaps and mismatches (spec §140). Updated at the end of every phase. Once the simulator exists, every approximation versus real GHL is listed here per registry feature.

Last updated: 2026-09-02 (end of Phase 5)

## Current state

- The product has curriculum content compiled in (Phase 5) but no learning engine, simulator or mastery engine yet: nothing teaches from the bundle until Phase 6+. Phases 1–4 delivered the repository foundation, the design system, local-first data and sync.
- The home route is a Phase 1 foundation screen showing the version triplet and environment. It is not the Command Center (DES-010, Phase 7) and makes no claim to be.
- `/system` (diagnostics) and `/design` (gallery) exist only in local and preview environments; both are off in production by flag.
- The semantic components are presentational: they take typed props and will be wired to real engines from Phase 6 onward. Their prop shapes may change when the data models land; they share tokens, so the visual language will not.
- Deployment is live: every push to `main` deploys the `bloomlab` Worker (https://bloomlab.cool-sunset-2169.workers.dev) and every pull request redeploys the single shared `bloomlab-preview` Worker (D-020). Both hosts are public `workers.dev` URLs serving the foundation app with no learner data. D1 databases and R2 buckets do not exist yet (Phase 4).
- The dev machine runs Node 22.18 while `engines.node` is `>=22.22.0` (react-router 8's floor). Everything works locally with npm engine warnings; CI uses the latest 22.x.
- GHL feature names are verified only for the 34 registry records (Phase 5); the gallery samples in `/design` still use illustrative labels and are not wired to the registry (GHL-005 / GHL-010 apply from the screens onward).
- The ~128k ElevenLabs credits have an expiry window; voice asset generation (VOI-005) is scheduled for Phase 20. Risk: credits expire before Phase 20. By design this is not a functional dependency.
- Prettier does not format Markdown (`*.md` is ignored) so the control documents keep their hand-laid tables.

## Phase 5 — content engine

- **Seed, not curriculum.** 22 skills, 16 exercises and 3 units prove the types and relationships; Field Ready's Gate 6 (Conversion and Copy) and Gate 12 (Capstone) have no authored skills, seven gates have no project, and every seeded skill has at least one coverage gap. The compiler reports all of it (`npm run content:build`, 36 warnings) and the `/system` Content section lists the gaps. Authoring is Phase 24.
- **Three persistent clients, not twenty.** CNT-009 (≥ 20 clients across the §37 industries) stays NOT_STARTED; the client schema and hidden state are complete and exercised.
- **Registry verification depth varies.** 24 records were verified on their own (or a directly related) help-center article; 10 (Send Email, Remove Contact Tag, Assign to User, Send Internal Notification, Remove from Workflow, Survey Submitted, Pipeline Stage Changed, Opportunity Status Changed, Customer Replied, Payment Received) have their name confirmed on GHL's official trigger/action list pages or a related article, and their `supported_configs` are marked as not individually verified in `verification_note`. Filters and config fields are the compiler's vocabulary for the Workflow Lab (Phase 12), not a claim about GHL's exact UI.
- **Fidelity is declared, not yet exercised.** The simulator does not exist, so `simulation_fidelity` and `known_limitations` describe what Phase 10–14 must honour; the "Simulator approximations versus real GHL" section below fills in per feature once behaviour is implemented.
- **MDX is validated, not rendered.** Units are syntax-checked and their embeds resolved at build time; the bundle carries the raw MDX body. Rendering (and the embed components) is the Academy, Phase 8.
- **Attempt stamping is a contract, not a table yet.** The bundle carries `content_version` and `content_hash`; the attempt records that store them arrive with the learning engine (Phase 6) and exercise runner (Phase 9), so CNT-007, DATA-011 and INF-013 remain partial.
- **Learning units and rubrics are not versioned individually.** A rubric change is a new `_V<n>` file by rule; a unit change is a content_version bump. Per-record history relies on Git.
- **The content lock is a discipline.** `content:check` fails when sources change without a version bump; a developer can still bump-and-lock without reviewing what changed. Review happens in the pull request, where `content.lock.yaml` changes are visible.
- **Warnings are printed twice during `vite build`** (once per Vite environment: client and Worker); the compile itself runs once.

## Phase 2 — design system

- **Holo physics measured, not hand-tested.** Follow, settle, per-layer response, reduced motion and touch were measured on the production bundle with real DevTools mouse and touch events (`npm run review:holo`; numbers in `docs/reviews/phase-2-visual-review.md`). No physical phone, tablet or trackpad was available to this review, so the *feel* on a device — and the learner's own reaction to the hover — is still the real acceptance for DES-002 and HOL-005 and should be recorded here.
- **DATA-001 / SYNC-007 acceptance is two-thirds unreachable until Phases 9 and 12.** The end-to-end sync path is verified with notes; "moving a workflow node" and "completing a deterministic exercise" (and "dragging a node produces no sync operation") cannot be exercised before those features exist, so both stay PARTIAL on purpose.
- **Sync (Phase 4) — what is still thin.** Only `notes` has a local table today, so it is the only entity that actually travels; the other twelve entity kinds are declared and their D1 tables exist. When a later phase adds an entity's local table it must reset the pull cursor (`sync_state.all.server_cursor = 0`) once so history is fetched. `/api/sync/link` has no per-IP rate limit yet (the 256-bit key makes guessing infeasible; a Cloudflare rate-limit binding is the planned addition). The two-device verification ran in two headless Chrome profiles against the local preview and the deployed preview, not on physical devices. Headless Chrome shows no install prompt and denies persistent storage, as noted for Phase 3.
- **Pepper custody.** `SYNC_KEY_PEPPER` for preview and production was generated randomly and uploaded without being shown to anyone (D-034). If it is ever lost, every learner has to link again with their key; rotate it now with a value you keep if you want that control.
- **Install prompt not observed.** Chrome's installability check passes (`Page.getInstallabilityErrors` is empty on the production bundle) but headless Chrome never shows the prompt itself; confirm the "Install app" affordance on a phone and on desktop Chrome. Headless Chrome also denies `navigator.storage.persist()`, so diagnostics read "Persistent storage: no" there; real browsers grant it after engagement or installation.
- **DATA-001 acceptance interactions are future features.** The offline note, workflow-node move and deterministic exercise named in the acceptance test arrive in Phases 8, 12 and 9; Phase 3 proves the same path with the device rename and the diagnostics test note.
- **What still differs from the Doodlemon reference.** The reference's holo is a photographed foil card (warm gold-green base, hard diagonal rainbow, micro-sparkle) with a constant 4.5 s float and a mouse-driven background parallax; its tiles lift 8 px behind a saturated gradient ring. Bloomlab's material is procedural in the pastel palette on a light ground, so it reads softer and cooler; sparkle is a static grain with parallax rather than per-pixel glitter; there is no idle float or parallax (spec §148 / MOT-004); the rim is white at the light's angle with pastel tints elsewhere rather than a full-strength gradient ring; and cards lift 5 px with up to 6° of tilt (§68) where the reference lifts 8 px with none.
- Ink Faint is tuned from the spec value (`#8F8AA5` → `#86819C`) so it clears 3:1 on every light surface; it is still reserved for large or decorative text (D-017).
- `Popover` positions itself with `getBoundingClientRect` on open (flips above when there is no room below) rather than CSS anchor positioning; it does not reposition on scroll while open.
- `Sheet` relies on the native `<dialog>` for focus trapping and Escape; browsers without `showModal` get an open attribute without trapping.
- Icons are a hand-drawn set of 22 stroke glyphs; more will be added as screens need them, kept in one file to avoid a dependency.
- Semantic colours never appear as small text; success and warning glyphs sit below 3:1 on white by design because a text label always accompanies them.
- No dark theme exists and none is specified: ink workspaces (`InkSurface`) are per-environment surfaces, not a global mode.

## By design (spec-mandated constraints, not defects)

- Recovery limitation (SYNC-006): losing every connected device and the sync key means server recovery is impossible until account authentication exists.
- Call Room v1 is turn-based, not full-duplex realtime (CALL-002).
- Real-GHL fieldwork is manual with screenshots and configuration answers (FLD-002); API verification is deferred (FLD-003).
- Payments Lab, Companies, Custom Objects, Smart Lists and advanced calendar rules are post-Field-Ready (Phase 25).
- No Durable Objects, Queues, Redis, Supabase, Firebase, separate Node server, or vector database in v1 (INF-006, INF-007, INF-008).
- Environments are chosen at build time (`CLOUDFLARE_ENV` + Vite mode, D-013); one build artefact cannot be promoted between environments.

## Simulator approximations versus real GHL

None yet — no simulator exists. When populated, each entry records: feature id, fidelity (A / B / C / REAL_GHL), what differs from real GHL, and why.
