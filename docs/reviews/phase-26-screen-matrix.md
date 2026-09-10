# Phase 26 — screen and state coverage

> Navigation follow-up: D-202 and [the navigation redesign review](../reviews/navigation-shell-redesign.md) supersede this document’s fixed-104 px/containment contract. Historical PASS evidence is preserved, but the learner’s contradictory real-use report requires fresh two-state genuine-input verification. All unrelated acceptance remains unchanged.


This is controlled implementation review, not physical-device, screen-reader or long-session
acceptance. The executable route list is `scripts/review/screen-matrix.mjs`: 36 route/detail/runner
states. `polish-probe.mjs` checks every state at **1440/1024/768/390/320**, captures each viewport,
and fails page overflow, phone targets below 44 px, phone fields below 16 px, user-facing monospace
or small uppercase eyebrows. Native checkbox/radio labels count as their actual activation area;
the pricing probe independently toggles the scope. Intentional Lab-local scrollers remain local.

The table separates layout coverage from state-specific evidence. **L** means the five-width
initial-state layout sweep, not a claim that every interaction was exercised in that capture.
**B** means a named controlled browser probe; **T** means an actual unit/integration regression;
**shared T** is the error boundary regression, not per-screen fault injection. **Load open** means
normal asynchronous opening was observed, but no dedicated held-loading assertion is cited.
**Open** identifies missing complete coverage and must not be read as passed. Fixtures use isolated
browser profiles/local test databases and are never Ary's progress. The Phase 26 review records the
observed run outcomes; final exact-head artifacts and identities are attached to draft PR #28.

| Screen family | Desktop | Tablet | Mobile | Empty | Loading | Error | Keyboard | Touch |
|---|---|---|---|---|---|---|---|---|
| Command Center | L | L | L | T phase7 | Load open | shared T | E native trace; earlier keyboard probe | Earlier touch probe; exhaustive H session flow open |
| Campaign/path selection | L | L | L | T advancedPaths | T advancedPaths | T advancedPaths | B advanced-paths | B advanced-paths |
| Skill Map/detail | L | L | L | T phase7 | Load open | shared T | B advanced-paths; E native trace | B moments; advanced-paths |
| Academy/fresh CONNECT lesson | L | L | L | No exposure: B academy | Load open | shared T | B academy; connect | B academy; connect |
| Decision/build/fix/run exercises | L | L | L | B exercise/new draft | Load open | B failed result; T evaluation | B connect; workflow | B exercise; connect |
| Pricing | L | L | L | B pricing | Load open | B pricing validation | B pricing | B pricing |
| Negotiation | L | L | L | B negotiation | Load open | B negotiation fallback | B negotiation | B negotiation |
| Call Room | L | L | L | B call | B call held requests | B call microphone/STT/feedback/restart | B call | B call |
| Prospect/audit/written work | L | L | L | B sales | Load open | B sales refused result | B sales | B sales |
| Fieldwork proof | L | L | L | B fieldwork | B fieldwork held upload | B fieldwork upload retry | B fieldwork | B fieldwork |
| CRM/companies/objects/Smart Lists | L | L | L | B crm-review; advanced-labs | Load open | B CRM refused operation; shared T | B crm-review; advanced-labs | B crm-review; advanced-labs |
| Workflow | L | L | L | B workflow | Load open | B workflow refusal; T crash-safe run | B workflow arrows/undo | B workflow step editor |
| Funnel | L | L | L | B funnel autopsy empty | Load open | B funnel refusal | B funnel reorder | B funnel sheets |
| Calendar | L | L | L | B calendar; advanced-labs | Load open | B calendar availability/refusal | B calendar | B calendar |
| Reporting | L | L | L | B reporting denominator empty | Load open | shared T | B reporting | B reporting |
| Payments | L | L | L | B advanced-labs | T paymentsScreen | T paymentsScreen/refusal | B advanced-labs | B advanced-labs |
| Incident | L | L | L | B incident initial evidence | Load open | B incident reproduced faults | B incident | B incident |
| Inbox | L | L | L | B workflow conversations | Load open | shared T | B workflow | B workflow |
| Clients/detail/project | L | L | L | B clients missing evidence | B clients held storage | B clients read/save retry | B clients | B clients |
| Portfolio/list/detail | L | L | L | B portfolio; T portfolio | Load open | T portfolio retry; B missing media | B portfolio | B portfolio |
| Field Ready | L | L | L | B moments incomplete | Load open | shared T | B clients; moments Skip | B moments certificate |
| Playground | L | L | L | T learning unlocks | Load open | shared T | E native controls; complete flow open | Layout only; complete flow open |
| AI settings | L | L | L | B connect AI Off | Load open | T gateway refusal/recovery | Native controls; full H flow open | B connect AI Off |
| Sync/export/restore | L | L | L | B restore no file | Load open; B confirmation | B restore malformed/offline; T rollback; axe failed-link state | B restore | B restore |
| Global Search/glossary/history | L | L | L | B search no match/history | Load open | T search read failure/retry; B invalid history | B search | B search |
| Rail/phone More | B rail | B rail | B rail | Not applicable: fixed destinations | Not applicable: synchronous shell | B independent boundary scrolling | B all destinations, Escape focus | B rail isolated gestures |

State probes are under `scripts/review/`, with the names in column entries plus `-probe.mjs`.
Unit coverage includes `screens/{phase7,advancedPaths}.test.tsx`, the exercise runner suites,
`clients/completion.test.tsx`, `portfolio/portfolio.test.tsx`, `search/search.test.tsx`,
`backup/restore.test.tsx` and `app/ScreenErrorBoundary.test.tsx`. Some asynchronous state coverage
remains shared or unit-only, and the table explicitly retains open interaction cells. DES-018 and
global A11Y-001 are not promoted from this matrix.

## Visual observations and scope

Inspected representative captures: Command Center 1440, Workflow 1024, CRM/Clients 768, Call Room
390, Search 390, and Academy/Pricing 320. Academy retains editorial reading; Workflow retains
canvas/palette and its phone step editor; CRM uses dense records and bounded local scrolling;
Call Room stays quiet and sparse. Pricing remains a work surface, not a generic dashboard.
No new hero, decorative eyebrow, monospace, confetti, fake metric or generic modal was introduced.
Recovery screenshots exposed an existing contrast bug: the error accent is only 3.53:1 on cloud,
below the normal-text threshold. Sync, session builder, Academy and runner failure copy now use
the normal text role (matching Field's established error-copy treatment). All four failed new
source regressions before the correction. Axe detected the actual controlled failed-link state;
that state now recurs at both CI widths. No linking request escapes the document-scoped fixture.
Client directory links still do not implement collectible case covers: DES-012 remains IN_PROGRESS.
The five existing starter projects do not close PORT-003's twenty-project requirement.

The 104 px rail is unchanged; ten deliberately short **480 px** normal/reduced cases verify its
independent wheel/touch scroll, unclipped focus and every destination/bottom action. Phone More
remains separately bounded and returns focus on Escape. Holo's live-preference/offscreen probe
uses the actual Skill Map material, not a demo substitute.

## Performance boundary

`lazy-route-probe.mjs` measures actual JavaScript execution and separately records resource timing
and cache contents. Academy does not execute the Workflow route; opening Workflow executes its own
chunk. However, the existing Workbox offline policy precaches all built JS/CSS, including Workflow
in the background. This does **not** satisfy PERF-001's full “only likely next” preload requirement.
Changing the offline cache contract is not hidden inside polish; the row remains PARTIAL.

Chrome DevTools MCP was not configured. The web-performance skill's trace workflow was paused and
configuration requested; repository Chromium/CDP probes and source/bundle inspection were the
available fallback. No MCP trace, Lighthouse/Core Web Vitals result or reference-device performance
certification is claimed. Long-session comfort and exhaustive physical/mobile acceptance remain
open; DES-017 and broad RSP-002/003/004 assessments remain for independent audit.
