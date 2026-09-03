# Phase 11 review — CRM Lab

What was built, what it does, what it deliberately does not do, and what remains. Written against
the code on the branch, not against the plan.

---

## 1. Base commit

`4aec03f9c882d6cfc5a45761ebe4181ea7019e51` — `main` after the Phase 10 merge. Branch
`feat/crm-lab`, one pull request. Phase 12 was not started.

## 2. Phase 11 scope

Spec Phase 11 is "build core contact/pipeline state"; §55 lists the nine capabilities. The
requirement rows are CRM-001 (P0), CRM-003 (P1) and CRM-004 (P1). Everything in this phase serves
those three. Companies as an editable area, custom objects, Smart Lists, bulk actions, workflow
execution, the Funnel, Calendar and Reporting Labs, the Playground, AI grading, sales exercises,
pricing and voice were out of scope and none were touched.

## 3. Requirement status

| ID | Status | Evidence |
|---|---|---|
| CRM-001 | PASSED | All nine areas are worked through the Lab and every change is a simulator event on the shared run: 35 engine tests, 22 data-layer tests, 22 screen tests, the 27-check flow probe and the five-width review probe, all green. |
| CRM-003 | PASSED | The poor choice is allowed and unremarked (tests in `crm.test.ts` and `crmScreen.test.tsx`), and the consequence is a real deterministic exercise graded from the learner's own account: fails while Jordan's interest is three tags, passes once it is one field (`consequence.test.ts`, 9 tests). |
| CRM-004 | PASSED | Dense rows and a two-pane workspace on desktop; a stage switcher plus local scroller on tablet and phone; seventeen states audited at 1440 / 1024 / 768 / 390 / 320 with no page-level overflow, no touch control under 44 px on a coarse pointer, no input under 16 px on a phone (`crm-review-probe.mjs`, PASS). |
| SIM-001 | PARTIAL (unchanged) | Phase 11 adds the CRM half of the shared-account chain — contact, tag, field, owner, opportunity, owner, stage, note, task — all in one state and one log. The "fire a workflow" link still waits for Phase 12. |
| SIM-005 | PASSED (extended) | Ten internal CRM events added to the catalogue with reducers, validation, replay and tests. None is presented as a GHL trigger. |
| A11Y-001 | PARTIAL (unchanged) | Every primary CRM action is keyboard-operable with a visible ring (probe). The requirement spans the whole product and stays open. |
| EXR-004 … EXR-007, EXR-019 | unchanged | The CRM runtime declines every workflow exercise; a test asserts each stays un-runnable. |

## 4. CRM architecture

```
CRM screen (React)
  → apps/web/src/crm/commands.ts        the one door: intent → pending simulator event
    → @bloomlab/simulator-core          processEvent: validate, reduce, log, record
      → apps/web/src/simulator/store.ts persist the run (sim_projects / sim_events / sim_snapshots)
        → UI reads the new StoredRun
```

There is no CRM store in React, no "UI contacts" collection and no second reducer. The screens
hold only ephemeral UI state (which area, which record, whether a form is open); the account is
always `run.state.account`. A source-level test fails if a CRM screen imports the database, calls
`processEvent`, `saveRun` or `resetStoredRun`, or assigns into `state.account` (D-094).

Files: `crm/commands.ts` (mutation door), `crm/activity.ts` (history derivation), `crm/words.ts`
(wording), `crm/useCrmRun.ts` (run lifecycle), `crm/CrmLab.tsx` (areas and list),
`crm/ContactDetail.tsx`, `crm/PipelineBoard.tsx`, `crm/CrmSetup.tsx`, `crm/exerciseRuntime.ts`
(the CRM as an exercise runtime), `crm/crm.module.css`.

## 5. Command / event path

Every wrapper in `commands.ts` builds one event and calls `runCommand`, which processes it
through the engine and persists the result. The outcome is `{ ok: true, run }` or
`{ ok: false, run, refusal }`; a refusal leaves the run untouched and carries the engine's code,
message and detail for the screen and for diagnostics. The wrappers are: `createContact`,
`updateContact`, `assignContact`, `addTag`, `removeTag`, `defineField`, `updateField`,
`createOpportunity`, `updateOpportunity`, `assignOpportunity`, `moveOpportunity`,
`createPipeline`, `updatePipeline`, `addNote`, `createTask`, `updateTask`, `setTaskCompleted`.
No business rule lives in the layer; it translates and persists.

## 6. New simulator events

Ten internal event types, appended to the catalogue (36 total):

| Type | Content name | Reducer |
|---|---|---|
| `CONTACT_ASSIGNED` | `contact.assigned` | `reducers/assignment.ts` |
| `OPPORTUNITY_ASSIGNED` | `opportunity.assigned` | `reducers/assignment.ts` |
| `FIELD_DEFINED` | `field.defined` | `reducers/fields.ts` |
| `FIELD_UPDATED` | `field.updated` | `reducers/fields.ts` |
| `PIPELINE_CREATED` | `pipeline.created` | `reducers/pipelines.ts` |
| `PIPELINE_UPDATED` | `pipeline.updated` | `reducers/pipelines.ts` |
| `NOTE_ADDED` | `note.added` | `reducers/crm.ts` |
| `TASK_CREATED` | `task.created` | `reducers/crm.ts` |
| `TASK_UPDATED` | `task.updated` | `reducers/crm.ts` |
| `TASK_COMPLETED` | `task.completed` | `reducers/crm.ts` |

Reused where already right: `CONTACT_CREATED`, `CONTACT_UPDATED`, `TAG_ADDED`, `TAG_REMOVED`,
`OPPORTUNITY_CREATED`, `OPPORTUNITY_UPDATED`, `PIPELINE_STAGE_CHANGED`. No deletion event was
added because the Phase 11 UI offers no deletion.

**These are Bloomlab's internal record of what happened.** None is a HighLevel workflow trigger
or action, and nothing in the UI, the content or an exercise implies one is (D-092). The catalogue
module refuses at load time any two types whose content names collide, because the content name
replaces only the first underscore.

## 7. State-model changes

- `Contact.owner_id: string | null` and `Opportunity.owner_id: string | null` — references into
  `users`, never names (D-089). A new opportunity starts with its contact's owner.
- `CustomField` gains `object: 'contact' | 'opportunity'`, a typed `type` from the seven
  supported types, and `options: string[] | null`, required for `dropdown` and refused otherwise
  (D-090).
- `Opportunity` gains `name`, `status` from the fixed set `open · won · lost · abandoned`,
  `custom_fields`, `owner_id`.
- `Task` and `Note` share `CrmTarget { contact_id, opportunity_id }`; one is required (D-091).
  Task: `title`, `description`, `due_at`, `completed`, `completed_at`, `assigned_to`. Note: `body`,
  `author_id`, `at`.
- Scenarios author `users`, `notes`, `tasks`, owners, dropdown options, opportunity names,
  statuses and fields; validation refuses a dangling user, an undefined or wrong-object field, a
  dropdown without options, options on a non-dropdown, and a targetless note or task.

## 8. Contact behaviour

List and search (name, email, phone, tag; search never writes), create, edit the standard fields
as one form saved as one `CONTACT_UPDATED` carrying only what changed, do-not-disturb as one
click, source, owner from the account's own users, tags, custom field values, linked
opportunities, activity, notes and tasks. A missing phone or email is stated in words ("No
phone"), never left as a gap. No deletion: it is not needed for acceptance and was not added to
claim CRUD.

## 9. Custom fields

Setup defines a field with a label, a key, an object (contact or opportunity), a real type and,
for a dropdown, its options. A field appears on every record of its object at once, rendered by
type: a select for a dropdown, a number input, a date input, or text. Values are saved on change
(dropdown) or on blur (text), each as one `CONTACT_UPDATED` / `OPPORTUNITY_UPDATED` with only
that field. A value for an undefined field, or for a field of the other object, is refused by the
engine and shown. Two existing GlowHaus dropdowns had no options; the content was fixed, not the
rule.

## 10. Tags

Add an existing tag or a new name (the account vocabulary grows), remove a tag, see the change at
once and in history. `TAG_ADDED` / `TAG_REMOVED` only. Nothing warns about a tag that would have
been better as a field.

## 11. Assignments

Contact owner and opportunity owner are separate settings and may differ, matching HighLevel's
decoupled-owner behaviour (registry `GHL-CRM-OWNERS`, fidelity B). An invalid owner is refused by
the engine. Names are resolved from `users` at render, so no screen hard-codes a person.

## 12. Opportunities

Inspect, create for a contact (pipeline, stage, name, value), edit value, status, owner and custom
fields, move stage. Every edit is its own event. **Not offered:** moving a deal to a different
pipeline (see §32) and deletion.

## 13. Pipelines

Inspect, create a pipeline with ordered stages, edit a pipeline's stage list (add, rename,
reorder, remove). A stage holding deals may leave only when the same event names where they go;
the Setup screen asks for the destination and the engine refuses a silent strand (D-093). Stages
holding nothing may be dropped freely. Moving a deal to a stage not in its pipeline is refused.

## 14. Notes

Internal only, on a contact or an opportunity, with an author and simulator time. Shown in the
contact's Notes panel, in the opportunity inspector and in activity. Not rich text.

## 15. Tasks

Title, description, due date in simulator time, assignee from `users`, linked to a contact or an
opportunity; complete and reopen. Shown in the Tasks panel and in activity. No recurrence,
priorities or bulk operations.

## 16. Activity history

Derived from the run's event log by `activity.ts`, ordered by simulator sequence, filtered to the
record (a contact's history includes events on its opportunities), with seeded notes and tasks
shown once as "already on the record" rather than twice. `words.ts` turns the entry into a
sentence at render; an id resolves to a name through the account. Simulator time, in the
account's zone. Set in Inter with tabular digits — no monospace (DES-022).

## 17. Scenario / run lifecycle

The Lab runs `SC-glowhaus-crm`: five contacts (one with no phone and no owner, one with no email,
one on DND), two users, six-stage pipeline, four deals, two notes, two tasks, one appointment and
a scheduled confirmation. Jordan carries three `wants-*` tags — the CRM-003 case, seeded rather
than staged. The Lab resumes the most recently updated run of the scenario and never merges or
discards others; with several it says so and offers the rest (D-096). It never starts a run on
render.

## 18. Persistence

Every committed mutation persists the run through the Phase 10 store. No save on hover, on
keystroke or while a select is open. The flow probe reloads after twelve mutations and finds every
one, and finds all of them in the activity history.

## 19. Offline

With the page and its service worker offline, a tag was added, the page reloaded offline, the tag
still there, and the state consistent after reconnect (flow probe steps 16–21). No CRM action waits
for the Worker.

## 20. Sync / cross-device

Two simulated devices in `crm.test.ts`: device A works the account and syncs; device B pulls and
sees the same run, contacts, tags and deals. The `sim_projects` snapshot conflict semantics from
Phase 4 are untouched — no CRM-specific sync protocol was added. Physical two-device hardware
testing did not happen.

## 21. Reset generation preservation

Reset requires confirmation, calls Phase 10's `resetStoredRun`, keeps the run id, mints a new
generation, and leaves old append rows immutable. The flow probe resets, works again, reloads and
finds the post-reset activity (D-087 regression, steps 22–25).

## 22. GHL verification sources

| Feature | Registry | Fidelity | Verified | Source |
|---|---|---|---|---|
| Contacts | `GHL-CRM-CONTACTS` | A | 2026-09-03 | help article 155000005055 |
| Tags | `GHL-CRM-TAGS` | A | 2026-09-02 | help article 155000003111 |
| Custom Fields | `GHL-CRM-CUSTOM-FIELDS` | A | 2026-09-02 | help article 48001161579 |
| Opportunities | `GHL-CRM-OPPORTUNITIES` | A | 2026-09-02 | help article 155000001983 |
| Pipelines | `GHL-CRM-PIPELINES` | A | 2026-09-02 | help article 155000001982 |
| Decoupled owners | `GHL-CRM-OWNERS` (new) | B | 2026-09-03 | help article 155000002273 |
| Notes | `GHL-CRM-NOTES` (new) | B | 2026-09-03 | help article 155000004555 |
| Tasks | `GHL-CRM-TASKS` (new) | B | 2026-09-03 | help article 155000005529 |

**Method, stated plainly.** The build environment's egress proxy denies every
`help.gohighlevel.com` request, so the three new records were verified through search-engine
summaries of the official articles rather than a direct read, and each record's
`verification_note` says so. Nothing was added from memory.

## 23. Fidelity limitations

- DND is modelled as one flag; HighLevel allows DND per channel as well as global.
- Notes are plain text; HighLevel notes support richer formatting.
- Opportunities carry one contact; HighLevel supports followers and additional contacts.
- The opportunity owner defaults to the contact owner at creation only; the follower-sync
  sub-settings of the decoupled-owner feature are not modelled.
- Tasks: no recurrence, priority, reminders or Spaces.
- No companies editing, custom objects, Smart Lists, bulk actions, advanced filters, contact-page
  customisation or pipeline permissions.

## 24. CRM-003 — the poor choice and its consequence

**Allowed.** Adding a fourth `wants-*` tag to Jordan produces no warning, no alert and no text
that says the learner should have used a field (`crmScreen.test.tsx`). Defining a field where a
tag would do, or a tag where a field would do, is equally unremarked.

**The consequence.** `EX-FIX_IT-jordan-treatment-interest`: Priya wants one number, how many
leads want Laser. Maria's field answers; Jordan's three tags count him three times. The exercise
is graded from the CRM account itself. Before the fix it fails on the critical gate (the tag that
duplicates the field) and on the required field check; after the fix — set the field to what the
note on his deal says, remove the three tags — it passes at 100. Removing the tags without
setting the field still fails; "fixing" Jordan by breaking Maria loses the quality check. All
four cases are tests.

## 25. Exercise integration

The CRM Lab is the first entry in `EXERCISE_RUNTIMES` (D-097). It claims `state`, `events` and
`references` from the CRM run through the Phase 10 adapter, and never `architecture`. `handles`
matches only exercises whose scenario is the CRM scenario, so every workflow exercise stays exactly
as un-runnable as before, which a test asserts. If the runtime has no account to read (the Lab has
never been opened on this device) the grade is refused with `RuntimeUnavailableError` rather than
graded against a learner-only context that would claim state it never had; the runner says in
words to open the CRM first. Evidence finalizes through the Phase 9 path with normal attempt
identity and idempotency; a test records an attempt and finds the evidence row.

## 26. Accessibility

Keyboard, from the review probe: switch area, open a deal, move its stage from the picker, open a
contact, reach owner, DND, the tag input, Notes, the note field, Tasks, and open and cancel the
reset confirmation — each with a visible focus ring. No information is hover-only. Status is never
colour alone: DND is a labelled pill, a refusal has a border and words. Touch targets are 44 px on
a coarse pointer, including tag chips (fixed this phase). Inputs are at least 16 px at phone
widths. The stage editor's raw textarea had no accessible label; it now uses the `Textarea`
primitive and names its pipeline.

## 27. Tablet / mobile design

1024: two-pane workspace, board columns side by side. 768: stage switcher above a snapping local
scroller; the inspector becomes a bottom sheet. 390 and 320: compact contact rows that open a
sheet with the four panels; one stage column fills the viewport with the switcher as the primary
way through; setup forms stack. Nothing is removed at any width.

## 28. Five-width review

`npm run review:crm-review` — seventeen states (contacts, contact selected, contact edit, tags,
custom fields, activity, notes, tasks, pipeline board, opportunity selected, pipeline setup, create
contact, create opportunity, refusal, empty search, reset confirmation) at each of the five widths:
no page-level horizontal overflow, nothing off-screen that is not inside an intentional clipper or
the board's own scroller, no monospace, no eyebrow, no text under 12 px, no control under 44 px on
a coarse pointer, no input under 16 px on a phone. PASS. Screenshots in `.review/crm/`.

## 29. Performance / lazy loading

`/crm` is a route-level lazy chunk; the CRM is not in the initial bundle. Nothing on the CRM
screens is holographic or animated. Activity derivation is one pass over the log per render of the
panel, for an authored account of five contacts. No Worker.

## 30. Test table

| File | Tests | Covers |
|---|---|---|
| `packages/simulator-core/test/crm.test.ts` | 35 | Owners, field definitions and values, pipelines and migration, notes, tasks, activity order, refusals, replay |
| `apps/web/src/crm/crm.test.ts` | 22 | One-account chain, direct-mutation guard, activity adapter, two-device sync, reset, CRM-003 allowance |
| `apps/web/src/crm/crmScreen.test.tsx` | 22 | The real App at `/crm`: list from the run, search never writes, every edit lands in `sim_events`, refusal shown, field defined in Setup appears on a contact, stage switcher, edit details |
| `apps/web/src/crm/consequence.test.ts` | 9 | The CRM-003 exercise fails before and passes after; runtime scope; refusal without an account; evidence recorded |
| Existing suites | 695 | Unchanged, green; two event-count assertions moved from 26 to 36 |

Total: 783 tests in 61 files. Phase 11 added 88.

## 31. Browser probes

- `npm run review:crm` — 27 checks: open, resume, select, edit field, assign owner, tag, define
  field, set value, note, task, complete, opportunity, stage move, reload, activity, offline
  mutation, offline reload, reconnect, reset, post-reset mutation, post-reset reload. PASS.
- `npm run review:crm-review` — five widths, keyboard, touch stage move at 390, reduced motion.
  PASS.
- Existing probes re-run on the same build: holo-touch (PASS, real-tablet check unchanged),
  keyboard, touch, simulator, exercise, learning, academy, offline, sync — no regressions.

## 32. Known limitations

- Moving an opportunity between pipelines is not offered; the stage event is scoped to the deal's
  pipeline.
- No deletion of contacts, opportunities, fields, pipelines, notes or tasks.
- Custom Values have no editor in the Lab; the account's `custom_values` are untouched.
- One pipeline is shown on the board at a time (the first); the scenario authors one.
- The fidelity gaps in §23.

## 33. Exact Phase 12 boundary

Phase 12 owns the Workflow Lab: the canvas, node execution, waits, branches, traversal, the Web
Worker, and the `architecture` grading source. Nothing in Phase 11 executes a workflow, and the CRM
runtime declines every exercise that needs one. Any later phase can trigger the same CRM behaviour
by calling `crm/commands.ts` without importing a screen.
