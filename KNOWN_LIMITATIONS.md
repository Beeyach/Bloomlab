# KNOWN LIMITATIONS

Honest record of approximations, gaps and mismatches (spec §140). Updated at the end of every phase. Once the simulator exists, every approximation versus real GHL is listed here per registry feature.

Last updated: 2026-09-02 (end of Phase 0)

## Current state

- No application code exists. Every functional requirement is `NOT_STARTED`. Phase 0 delivered documents and a control-document validator only.
- No GHL feature names have been verified against official documentation yet. Names used in the spec and curriculum documents ("Send SMS", "If/Else", "Wait", "Appointment Status", trigger names) are working labels until the registry (GHL-001, GHL-006) is populated with `last_verified` and `source_url`.
- The Design Bible references https://doodlemonjigsaw.netlify.app/ for visual feeling; no visual verification against it has been done yet (Phase 2).
- No Cloudflare resources (Worker, D1, R2) are provisioned and no secrets are configured. Phase 1 and Phase 4 need the user to create these.
- The ~128k ElevenLabs credits have an expiry window; voice asset generation (VOI-005) is scheduled for Phase 20. Risk: credits expire before Phase 20. By design this is not a functional dependency.

## By design (spec-mandated constraints, not defects)

- Recovery limitation (SYNC-006): losing every connected device and the sync key means server recovery is impossible until account authentication exists.
- Call Room v1 is turn-based, not full-duplex realtime (CALL-002).
- Real-GHL fieldwork is manual with screenshots and configuration answers (FLD-002); API verification is deferred (FLD-003).
- Payments Lab, Companies, Custom Objects, Smart Lists and advanced calendar rules are post-Field-Ready (Phase 25).
- No Durable Objects, Queues, Redis, Supabase, Firebase, separate Node server, or vector database in v1 (INF-006, INF-007, INF-008).

## Simulator approximations versus real GHL

None yet — no simulator exists. When populated, each entry records: feature id, fidelity (A / B / C / REAL_GHL), what differs from real GHL, and why.
