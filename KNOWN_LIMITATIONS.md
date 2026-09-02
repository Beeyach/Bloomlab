# KNOWN LIMITATIONS

Honest record of approximations, gaps and mismatches (spec §140). Updated at the end of every phase. Once the simulator exists, every approximation versus real GHL is listed here per registry feature.

Last updated: 2026-09-02 (end of Phase 2)

## Current state

- The product has no learning content, simulator, mastery engine or sync. Phases 1–2 delivered the repository foundation and the design system (tokens, primitives, HoloMaterial, motion, eleven semantic components) plus a developer gallery to review them.
- The home route is a Phase 1 foundation screen showing the version triplet and environment. It is not the Command Center (DES-010, Phase 7) and makes no claim to be.
- `/system` (diagnostics) and `/design` (gallery) exist only in local and preview environments; both are off in production by flag.
- The semantic components are presentational: they take typed props and will be wired to real engines from Phase 6 onward. Their prop shapes may change when the data models land; they share tokens, so the visual language will not.
- Deployment is live: every push to `main` deploys the `bloomlab` Worker (https://bloomlab.cool-sunset-2169.workers.dev) and every pull request redeploys the single shared `bloomlab-preview` Worker (D-020). Both hosts are public `workers.dev` URLs serving the foundation app with no learner data. D1 databases and R2 buckets do not exist yet (Phase 4).
- The dev machine runs Node 22.18 while `engines.node` is `>=22.22.0` (react-router 8's floor). Everything works locally with npm engine warnings; CI uses the latest 22.x.
- No GHL feature names have been verified against official documentation yet. Names used in the gallery samples ("Send SMS", "If / Else", "Wait", "Appointment Status") are illustrative until the registry (GHL-001, GHL-006) is populated with `last_verified` and `source_url`.
- The ~128k ElevenLabs credits have an expiry window; voice asset generation (VOI-005) is scheduled for Phase 20. Risk: credits expire before Phase 20. By design this is not a functional dependency.
- Prettier does not format Markdown (`*.md` is ignored) so the control documents keep their hand-laid tables.

## Phase 2 — design system

- **Holo physics observed live** at 800 px and 768 px viewports: tilt ≈ 5.2–5.5° at a corner, glare, band sweep, rim, shadow and settle all respond to a real pointer; touch press/drag/release verified with pointer events. Reduced motion was verified by forcing the tokens the media query sets (the machine's OS preference could not be toggled from the review tool); the hook path is unit-tested.
- **What still differs from the Doodlemon reference.** The reference is a photographed foil card (`Dragonair.jpg`) with a slow float animation; Bloomlab's material is procedural CSS with pastel bands, so the foil reads softer and lighter than the photographed rainbow-gold frame, and there is no idle float (spec §148 forbids constant holographic animation — cards lift only while hovered). A real foil's micro-sparkle is approximated by a static grain with parallax rather than per-pixel glitter. The learner's own reaction to the gallery remains the real acceptance for DES-002 and should be recorded here.
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
