# KNOWN LIMITATIONS

Honest record of approximations, gaps and mismatches (spec §140). Updated at the end of every phase. Once the simulator exists, every approximation versus real GHL is listed here per registry feature.

Last updated: 2026-09-02 (end of Phase 1)

## Current state

- The product has no learning content, simulator, mastery engine or sync. Phase 1 delivered the repository foundation only: build tooling, routing, tokens, a Worker health endpoint, tests and CI.
- The home route is a Phase 1 foundation screen showing the version triplet and environment. It is not the Command Center (DES-010, Phase 7) and makes no claim to be.
- `/system` (diagnostics) exists only in local and preview environments; it is off in production by flag.
- Nothing has been deployed. The Cloudflare Worker, D1 databases and R2 buckets do not exist yet, and GitHub has no Cloudflare secrets, so the CI deploy jobs are inert until the user provides them.
- The GitHub Actions workflow has been written and mirrors `npm run ci`, which passes locally; it has not yet been observed passing on GitHub (first run follows the Phase 1 push).
- The dev machine runs Node 22.18 while `engines.node` is `>=22.22.0` (react-router 8's floor). Everything works locally with npm engine warnings; CI uses the latest 22.x.
- No GHL feature names have been verified against official documentation yet. Names used in the spec and curriculum documents are working labels until the registry (GHL-001, GHL-006) is populated with `last_verified` and `source_url`.
- The Design Bible references https://doodlemonjigsaw.netlify.app/ for visual feeling; no visual verification against it has been done yet (Phase 2). The Phase 1 screens use the real tokens and fonts but no holographic material.
- The ~128k ElevenLabs credits have an expiry window; voice asset generation (VOI-005) is scheduled for Phase 20. Risk: credits expire before Phase 20. By design this is not a functional dependency.
- Prettier does not format Markdown (`*.md` is ignored) so the control documents keep their hand-laid tables.

## By design (spec-mandated constraints, not defects)

- Recovery limitation (SYNC-006): losing every connected device and the sync key means server recovery is impossible until account authentication exists.
- Call Room v1 is turn-based, not full-duplex realtime (CALL-002).
- Real-GHL fieldwork is manual with screenshots and configuration answers (FLD-002); API verification is deferred (FLD-003).
- Payments Lab, Companies, Custom Objects, Smart Lists and advanced calendar rules are post-Field-Ready (Phase 25).
- No Durable Objects, Queues, Redis, Supabase, Firebase, separate Node server, or vector database in v1 (INF-006, INF-007, INF-008).
- Environments are chosen at build time (`CLOUDFLARE_ENV` + Vite mode, D-013); one build artefact cannot be promoted between environments.

## Simulator approximations versus real GHL

None yet — no simulator exists. When populated, each entry records: feature id, fidelity (A / B / C / REAL_GHL), what differs from real GHL, and why.
