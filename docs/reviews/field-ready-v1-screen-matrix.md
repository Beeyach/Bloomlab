# Field-Ready v1 remediation — screen/state evidence

L is rerun on the stable remediation Preview-mode build: 36 routes × five widths, 180 layouts,
zero recorded failures. It is layout evidence, not a new manual certification. B denotes a named actual
browser probe; T denotes unit/integration checks. Shared T, Load open and Open remain incomplete
cells, not PASSED. All physical Safari, assistive-technology and long-session boundaries remain.
The new Home probe covers active/empty client work, whole-screen held storage/error/retry,
keyboard and touch at all five widths and 480 px. Child-local read recovery also has direct T.

| Screen family | Desktop | Tablet | Mobile | Empty | Loading | Error | Keyboard | Touch |
|---|---|---|---|---|---|---|---|---|
| Command Center | B remediation-home | B remediation-home | B remediation-home | B remediation-home; T phase7 | B held storage; T ActiveClient | B storage retry; T ActiveClient | B remediation-keyboard session; new client link | B client destination; full session touch remains open |
| Campaign/path selection | L | L | L | T advancedPaths | T advancedPaths | T advancedPaths | B advanced-paths | B advanced-paths |
| Skill Map/detail | L | L | L | T phase7 | Load open | shared T | B advanced-paths; E native trace | B moments; advanced-paths |
| Academy/fresh CONNECT lesson | L | L | L | No exposure: B academy | Load open | shared T | B academy; connect | B academy; connect |
| Decision/build/fix/run exercises | L; B remediation-exercise replay/open writing | L; B remediation-exercise | L; B remediation-exercise | B exercise/new draft; T no observed replay | Load open | B failed result; T evaluation | B remediation-keyboard submit; B replay controls | B remediation-exercise controls; exercise; connect |
| Pricing | L; B remediation-exercise | L; B remediation-exercise | L; B remediation-exercise | B pricing | Load open | T invalid scope allocation; B pricing validation | B pricing | B remediation-exercise scope/quote/reload; pricing |
| Negotiation | L | L | L | B negotiation | Load open | B negotiation fallback | B negotiation | B negotiation |
| Call Room | L | L | L | B call | B call held requests | B call microphone/STT/feedback/restart | B call | B call |
| Prospect/audit/written work | L | L | L | B sales | Load open | B sales refused result | B sales | B sales |
| Fieldwork proof | L | L | L | B fieldwork | B fieldwork held upload | B fieldwork upload retry | B fieldwork | B fieldwork |
| CRM/companies/objects/Smart Lists | L | L | L | B crm-review; advanced-labs | Load open | B CRM refused operation; shared T | B crm-review; advanced-labs | B crm-review; advanced-labs |
| Workflow | L; B remediation-draft | L; B remediation-draft | L; B remediation-draft | B workflow | T draft read gate; Load open | T failed checkpoint read/write retry; B workflow refusal | B workflow arrows/undo; R4 Lab path | B workflow step editor; offline unsaved-step reload |
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


No major screen is declared fully accepted from layout alone. Original evidence definitions and
unchanged composition notes: `phase-26-screen-matrix.md`. Current outcomes and remaining scope:
`field-ready-v1-remediation.md`.
