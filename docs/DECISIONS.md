# DECISIONS

Implementation decisions made where the spec leaves a noncritical choice open (CLAUDE.md → Clarification). Append-only. Reference the decision ID in commits when relevant.

| ID | Date | Decision | Why |
|---|---|---|---|
| D-001 | 2026-09-02 | Repository line endings are LF, enforced by `.gitattributes` (`* text=auto eol=lf`). | The dev machine has `core.autocrlf=true` globally; Cloudflare, CI and Linux tooling expect LF. Prevents CRLF noise in diffs. |
| D-002 | 2026-09-02 | `docs/reference/BLOOMLAB_TECHNICAL_ARCHITECTURE_v1.md` is preserved verbatim as an input reference. The root `TECH_ARCHITECTURE.md` is the normative working architecture document derived from it plus the master spec. | Spec §102 requires `TECH_ARCHITECTURE.md` at root; the v1 reference was supplied under `docs/reference/`. Keeping both avoids rewriting the source. |
| D-003 | 2026-09-02 | Where the master spec and the v1 architecture reference differ in granularity, the master spec governs. The v1 "Initial Build Order" (TA§86, 40 steps) is used as intra-phase ordering guidance inside the master spec's 27 phases (§163). | Master spec §0 declares itself authoritative. |
| D-004 | 2026-09-02 | Requirement IDs use `PREFIX-NNN` (three digits, zero-padded). DELIVER-territory requirements (proposal, onboarding, handoff, retention) are filed under `SAL` because §125 defines no `DEL` prefix. | Stable, sortable, and stays within the spec's prefix list. |
| D-005 | 2026-09-02 | Phase 0 includes a dependency-free Node script `scripts/validate-requirements.mjs` that checks the requirements matrix and cross-document ID references. | Gives Phase 0 a real validation step and protects the control documents from drift before code exists. |
| D-006 | 2026-09-02 | The simulator event catalogue includes `EMAIL_OPENED` (present in TA§21, absent from master §44). | TA§21 is a superset; including it costs nothing and supports deliverability and analytics curriculum. |
| D-007 | 2026-09-02 | Package manager for Phase 1 is deferred to Phase 1. Node 22.18 and npm 10.9.3 are present; pnpm is not installed. | Not a Phase 0 concern; recorded so Phase 1 does not re-discover it. |
