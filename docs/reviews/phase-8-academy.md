# Phase 8 review — Academy

Date: 2026-09-03 · Branch `feat/academy` · Spec §76, §98–§100, §30, §74, §84; CUR-036, DES-020.

The Academy turns the authored learning units into the reading experience: the MDX bodies from Phase 5 render as an editorial surface with real embeds, and finishing a unit is the first learner action that produces evidence through the Phase 6 engine without the diagnostic form. Nothing in the client parses MDX; nothing on the page records anything until the learner says they finished.

## Routes and where things are

| Route / layer | Where | What |
|---|---|---|
| `/academy/:unitId` (`?skill=` optional) | `apps/web/src/academy/AcademyUnit.tsx` | Masthead, contents list, the compiled unit body, the finish panel with the next step. Unknown ids render "No unit at this address." with a link to the Skill Map. Every route sits in the Phase 7 screen error boundary. |
| Unit modules | `packages/content-schema/src/vite.ts` | `virtual:bloomlab-content/units` → `{ [id]: () => import('virtual:bloomlab-unit/<id>') }`; each unit module is the MDX body compiled by `@mdx-js/mdx` (React automatic runtime) at build time. `apps/web/src/academy/unitModules.ts` wraps each in `React.lazy`. |
| Prose components | `apps/web/src/academy/prose.tsx`, `slug.ts` | Headings with stable anchors (`where-the-money-leaks`), paragraphs, lists, tables (concept comparisons), code, links, blockquotes. |
| Embeds | `apps/web/src/academy/embeds/` | `Callout`, `Depth`, `Feature`, `Exercise`, `Simulation`, `Diagram` (`FunnelDiagram`, `WorkflowPathDiagram` + `workflowSteps.ts`), `Interactive` (`FunnelMathInteractive`), arithmetic in `funnelMath.ts`. |
| Completion | `apps/web/src/academy/completion.ts` | `findUnitCompletion`, `useUnitCompletion` (live query), `completeUnit` → `recordEvidence`. |
| Content | `content/learning-units/*.mdx`, `packages/content-schema/src/schemas/learningUnit.ts`, `compile/validate.ts` | The embed vocabulary (`UNIT_EMBEDS` + `DIAGRAM_KINDS` + `INTERACTIVE_KINDS` + required attributes), validated at build time. |
| Tests | `apps/web/src/academy/academy.test.tsx` (14), `apps/web/src/screens/phase7.test.tsx` (2 updated) | Over the real bundle with a fresh IndexedDB per test. |
| Review tooling | `scripts/review/academy-probe.mjs`, `capture.mjs` (three unit pages), `keyboard-probe.mjs` | Chrome-driven keyboard, evidence, reload, offline, reduced motion and touch checks; five-width audit; tab-order log. |

## Content source and rendering path, exactly

1. `content/learning-units/LU-*.mdx` — YAML front matter (id, title, territory, tier, skills, ghl_features, estimated_minutes, summary) and an MDX body.
2. `compileContentDir` (Phase 5) validates the front matter, compiles the body once for syntax, and records `headings`, `embeds` (component + string attributes + line), `depth_sections`, `word_count` and the raw `body_mdx` in the bundle. Phase 8 adds validation of `<Diagram kind>` / `<Interactive kind>`: known kinds only, every required attribute present and numeric where it must be, and for `workflow` diagrams a scenario that exists and defines the named workflow (`MISSING_WORKFLOW`).
3. The Vite plugin serves the bundle (`virtual:bloomlab-content`) and, new, `virtual:bloomlab-content/units`; each `virtual:bloomlab-unit/<id>` is `compile(body_mdx, { jsxImportSource: 'react', development: false })` — a JS module whose default export takes `{ components }`.
4. `AcademyUnit` looks the unit up in the bundle for the masthead, contents list (from `headings` of depth 2) and skills, then renders the lazy module with `COMPONENTS` = prose elements + the seven embeds. Vitest uses the same plugin, so the tests render the real compiled units.
5. Vite emits one chunk per unit (`LU-funnel-math-basics-*.js` ≈ 3.2 kB, `LU-workflow-foundations-*.js` ≈ 2.9 kB, `LU-tags-vs-custom-fields-*.js` ≈ 3.3 kB) and one for the Academy screen (≈ 23 kB); the service worker precaches them with the rest of the shell, which is why a unit opens offline.

## How finishing a unit becomes evidence

- Opening, scrolling, reloading and re-opening a unit write nothing: the tests and the probe check `skill_evidence` is empty after a render.
- "Finish this unit" calls `completeUnit(unit)` → `findUnitCompletion` (an exposure row with source `learning_unit` and this unit's id on this learner's record); if one exists nothing is written and the panel shows the recorded date. Otherwise `recordEvidence({ skill_ids: unit.skills, kind: 'exposure', result: 'exposed', source: { type: 'learning_unit', id } })` writes one evidence row per skill (no attempt row, `score: null`, no assistance), stamped with app, content (`2026.09.03`), content hash, simulator and rules versions, and recomputes the derived rows. The live snapshot updates the finish panel, which shows `nextStepForSkill` for the requested (or first) skill.
- Engine effect: UNSEEN → LEARNING; `counts.independent_passes` stays 0; repeated exposures and passed quizzes leave the skill at LEARNING with `missing_requirements` still including practice (test "exposure and quizzes can never produce independent or mastered state").
- Offline: the write is local and queues outbox operations; the probe finished a second unit with the page and the service worker offline, reloaded offline and still saw "You finished this unit today" with two evidence rows (one per skill) and five queued operations; back online `/api/health` answered. The two-device test with the fake sync server shows the other device receiving the exposure and evaluating LEARNING.

## Phase 7 navigation changes (D-064)

- `stepDestination(step, skillId)` in `learningCopy.ts`: a unit step → `/academy/<unit>?skill=<skill>`, anything else → `/skills/<skill>`.
- Command Center: Continue and every session-plan item use it. For a new learner Continue now opens *Funnel math, in the owner's numbers* directly (test "Continue opens the unit directly when the engine says the next step is a unit"); the plan's first item links to the Academy.
- Capability sheet: the next-step block gains "Read this unit" when the step is a unit; for exercises and retrievals it says the exercise runner arrives with Phase 9.
- Unit finish panel: "Continue reading" when the next step is another unit; the exercise pointer and the sheet link otherwise; links back to the capability and the Command Center. After finishing Funnel math the Command Center's object reads "Started, nothing passed yet." and no longer offers "Next · Read" (test "completing the unit updates the next step on the Command Center").
- Deep links and Back: `/academy/LU-…` renders standalone; the router keeps history, so Back returns to the Command Center or the map.

## The diagrams

- **Funnel** (`<Diagram kind="funnel" leads booking show close ticket />`, funnel-math unit): a `<figure>` labelled by its `<figcaption>`; an ordered list of four stages, each a label, a bar whose width is the count as a share of leads (min 4 %) with the count inside in IBM Plex Mono, and the rate to the next stage written out ("46% book →"). The stage that loses the most people carries `data-leak`, a peach bar with a dashed outline and the words "← biggest loss"; the caption states every number and the loss in a sentence ("140 leads become 64 bookings, 37 consultations and 13 sales worth about $5,360 a month. The biggest loss is between leads and the next stage: 76 people."). Semantic HTML + CSS, one column at every width, nothing on hover, nothing by colour alone.
- **Workflow path** (`<Diagram kind="workflow" scenario workflow />`, workflow unit): drawn from `SC-glowhaus-no-show`'s `wf-booking-confirmation` — trigger (Customer Booked Appointment, filter "calendar is consultation"), then each node in edge order (Confirmation SMS with its template, Add Contact Tag "tag: booked", Exit) as boxed steps with SVG arrow connectors; a row from 768 px, a column below. The caption narrates the run in words.

## The inline interaction

`<Interactive kind="funnel-math" leads="140" booking="0.46" show="0.58" close="0.35" ticket="410" ad_spend="2400" />` renders "Push on one number": number inputs for leads and average ticket (16 px, 44 px tall), three range sliders for booking, show and close rates (each with a `<label>` and a live `<output>`), a reset button, and a `aria-live="polite"` results panel: sales, "n book · n show · n buy", revenue a month, profit after ad spend, the biggest leak in people, and "One lift at a time" — booking to 60 %, show to 80 %, close to 50 % with the resulting sales and delta (or "already there"). Everything is `funnelMath.ts`: deterministic arithmetic, no simulator, no randomness. The unit's prose numbers (13 sales, about $5,300, +4 for booking to 60 %, +5 for show to 80 %) fall out of it exactly.

## Verification

**Tests** — `npm run ci`: typecheck, lint, format, **327 tests in 40 files**, docs validator, content check, production build. New: 14 in `academy.test.tsx` — compiled sections and contents list; diagram with accessible description, depth and callout; opening records nothing; pure arithmetic; deterministic change and reset; focusable slider / disclosure / finish with Enter; exposure through `recordEvidence` and UNSEEN → LEARNING only; reload and no duplicate; exposure and quizzes never independent or mastered; offline write on one device syncs and the other converges; Continue opens the unit; plan item opens the Academy; the sheet offers the unit; completing updates the next step.

**Academy probe** (`node scripts/review/academy-probe.mjs`, production build, Chrome):

| Check | Result |
|---|---|
| Render | h1 the unit title; h2 The four numbers / Where the money leaks / Say it back / Finished reading?; embeds diagram-funnel, callout, interactive-funnel-math, depth, exercise; the figure labelled by its caption; no evidence before finishing |
| Keyboard | slider focused; ArrowRight ×2 → 60, results change to "14 sales"; Enter on the focused summary opens the depth; Enter on the focused Finish button (focus ring visible) records — one exposure row (`exposure`, `exposed`, source `learning_unit`, content `2026.09.03`) and the next-step panel |
| Reload | "You finished this unit today." persists; no Finish button; still one row |
| Offline | the second unit opens from the precache with the page and service worker offline; `/api/health` fails (never cached); Finish writes two rows (one per skill) and queues outbox operations (evidence plus derived rows); an offline reload keeps the completion; back online the API answers `preview` |
| Reduced motion | the funnel bar transition reads 0 (motion token `0s`) |
| Touch (390 px) | coarse pointer; no horizontal overflow; the workflow path is a column (trigger, action, action, end); tapping the summary opens it; Finish is 44 px and records by tap; tapping the slider track moves it (value 92) and the results change; slider 44 px tall |

**Keyboard probe** (`PAGES=academy/LU-funnel-math-basics npm run review:keyboard`): rail → sync status → the capability link in the masthead → the four contents links → the interactive's two number inputs, three sliders and reset → the depth summary → the practice pointer's link → Finish; every stop `:focus-visible` with a ring.

**Capture audit** (`PAGES=academy,academy-workflow,academy-tags npm run review:capture`) at 1440 / 1024 / 768 / 390 / 320 for all three units: no horizontal overflow, no off-viewport element, no control under 44 px (the interactive's reset button was 36–39 px and was fixed), no input under 16 px, no text under 12 px; the only clipped elements are the visually hidden spans.

## Responsive notes (1440 / 1024 / 768 / 390 / 320)

- 1440 and 1024: the masthead on a 44 rem measure; the contents list in a sticky 12 rem column beside the text with the current section marked; the interactive's controls and results side by side; the workflow path as a row.
- 768: the contents list moves above the text as a wrapped row of numbered links; the interactive keeps two columns; the path stays a row and wraps.
- 390 and 320: a single measure; the funnel's label column narrows to 4.5 rem at 320; the interactive's number inputs stack; the path is a column with rotated connectors; the finish panel and next-step panel are full width; the bottom rail stays.

## Screen coverage (DES-018)

| Screen | Desktop | Tablet | Mobile | Empty | Loading | Error | Keyboard | Touch |
|---|---|---|---|---|---|---|---|---|
| Academy unit | ✓ 1440 / 1024 | ✓ 768 | ✓ 390 / 320 | unknown id: "No unit at this address."; no next step: "No suitable next exercise is authored for this capability yet." | "Opening the unit…" (`role=status`) while the chunk loads | screen boundary; failed completion `role=alert` with retry | ✓ probe | ✓ probe |

## Requirement statuses

PASSED: DES-020. PARTIAL: CUR-036 — the acceptance sample (typography-led sections, a diagram, an inline interactive embed) is met by the funnel-math unit; the `<Simulation>` embed is an honest host that states the scenario, workflow and contact it will run and simulates nothing until the shared simulator core (Phase 10). Phase 8 evidence added to PRD-003, DATA-001, PERF-001, RSP-002, RSP-003, RSP-004, DES-017, DES-018 and A11Y-001 (still PARTIAL: exercises, submission and the labs remain). Decisions D-062 … D-066.

## Not done / honest gaps

- Exercises do not run; `<Exercise>` embeds and next steps point at the authored exercise and say the runner arrives with Phase 9.
- The workflow unit's `<Simulation>` embed simulates nothing; the workflow's structure is drawn by the diagram above it.
- Three units exist; the rest of the curriculum is Phase 24. Two diagram kinds and one interactive kind exist; another needs a renderer.
- A finished unit cannot be recorded again; reading position is not stored.
- Offline and touch were verified by DevTools emulation in Chrome, not on a physical phone; arrow keys on the slider are verified in Chrome, not in jsdom.
