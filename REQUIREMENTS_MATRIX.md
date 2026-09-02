# REQUIREMENTS MATRIX

Authoritative requirement register for Bloomlab. Derived from `BLOOMLAB_MASTER_SPEC.md` (§ refs) and `docs/reference/BLOOMLAB_TECHNICAL_ARCHITECTURE_v1.md` (TA§ refs).

Rules (spec §125–§127):

- IDs are stable and never reused. Format `PREFIX-NNN`.
- Priority: **P0** Blocking · **P1** Required (Field Ready) · **P2** Important · **P3** Enhancement. Never silently downgrade.
- Status: `NOT_STARTED` · `IN_PROGRESS` · `IMPLEMENTED_UNVERIFIED` · `PASSED` · `PARTIAL` · `BLOCKED` · `DEFERRED` · `FAILED`. Never mark `PASSED` without evidence.
- Phase: the build phase from spec §163 where the requirement is expected to pass. `all` = cross-cutting constraint checked at every audit. `—` only for `DEFERRED`.
- Acceptance criteria live in `ACCEPTANCE_TESTS.md`, keyed by these IDs.
- Current status roll-up lives in `IMPLEMENTATION_STATUS.md`.

Validate this file with `node scripts/validate-requirements.mjs`.

---

## PRD — Product

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| PRD-001 | Personal-first: built for one learner (Ary). No billing, subscriptions, instructor dashboards, student management, teams, public profiles, marketplace, classroom management, or social feed unless explicitly requested. | P0 | all | NOT_STARTED | §2, §3, §143 |
| PRD-002 | Fully asynchronous progression. No calendar locks. Never show "Come back tomorrow" or date-locked curriculum. Learner continues immediately when competency gates pass. | P0 | 6 | NOT_STARTED | §7, §143 |
| PRD-003 | Mastery-gated progression: advancement depends on competency gates and evidence, never on dates and never on quizzes alone. | P0 | 6 | NOT_STARTED | §11, §29, §143 |
| PRD-004 | Substantially usable without runtime AI: curriculum, simulator, progression, exercises, deterministic grading, CRM/Workflow/Funnel Labs, pricing drills, portfolio and saved progress all work with AI Off. | P0 | all | NOT_STARTED | §106, §107, §143, TA§1 |
| PRD-005 | Real skill transfer: learner can independently diagnose, architect, build, troubleshoot, explain, price, pitch, negotiate and deliver real funnel and GoHighLevel systems. | P0 | 24 | NOT_STARTED | §4, §143, §168 |
| PRD-006 | Placement assessment (Gate 0) discovers what the learner can skip. Learner is never treated as a GHL novice. | P1 | 24 | NOT_STARTED | §2, §11 |
| PRD-007 | "30-Day Field Ready" is a suggested pace (~90–120 h at 3–5 h/day), displayed as "FIELD READY CAMPAIGN — Suggested pace: ~30 days at 3–5 hours/day", never as day locks. Learner may finish faster or slower. | P1 | 7 | NOT_STARTED | §8 |
| PRD-008 | Field Ready means capable-not-expert: diagnose common Bloomwired-sized problems, implement core systems, troubleshoot common failures, speak with prospects, write sales communication, scope and price common work, negotiate basic objections, complete selected work in real GHL, recognise when something exceeds competency. | P1 | 24 | NOT_STARTED | §9 |
| PRD-009 | Architecture avoids dead ends that would force a rewrite of the learning engine for later commercialisation, without building commercial infrastructure now. | P1 | all | NOT_STARTED | §3, TA§1 |
| PRD-010 | Curriculum develops four identities at once: Funnel Strategist, GHL Systems Builder, Conversion & Sales Operator, Technical GHL Specialist (last comes later). Learner can start earning before completing. | P1 | 24 | NOT_STARTED | §5 |
| PRD-011 | Long-term time ratio ≈ 20% instruction / 60% practical work / 20% retrieval, explanation, selling, review; advanced levels more practical. | P1 | 24 | NOT_STARTED | §6 |
| PRD-012 | App copy is short, smart, direct, professional, occasionally playful ("Run it.", "Something broke. Find out why.", "Deal lost. Good decision."). No childish gamification, no "Amazing job, superstar!". | P1 | 7 | NOT_STARTED | §158 |
| PRD-013 | Progress language uses capabilities demonstrated and the states Passed / Needs another run / Demonstrated / Independent / Mastered / Field Ready. No XP, no star ratings. | P1 | 7 | IN_PROGRESS | §159 |
| PRD-014 | Rewards are new capabilities, simulator tools, clients, scenarios, Playground features, portfolio projects, skill mastery and territory access — never meaningless points. | P1 | 7 | NOT_STARTED | §160 |
| PRD-015 | Signature moments heavily polished: Holo Skill Interaction, First Workflow Execution, Client Case Reveal, Failed Test reveal, Independent Pass recognition, Field Ready (restrained cinematic). | P2 | 26 | NOT_STARTED | §161 |
| PRD-016 | Sound is optional and subtle (snap, connect, execution, selection, completion), always mutable, never constant. | P3 | 26 | NOT_STARTED | §162 |
| PRD-017 | Training continually applies to Bloomwired: ICP, offer structure, positioning, pricing, audits, outreach, discovery, proposals, portfolio, client experience, reusable systems, care plans, recurring support. No generic agency-guru scripts as doctrine. | P1 | 24 | NOT_STARTED | §123 |
| PRD-018 | Scenarios biased toward Bloomwired prospect industries (coaches, consultants, therapists, med spas, photographers, realtors, fitness, pet, home services, wedding vendors, local services) plus additional industries for transfer. | P1 | 24 | NOT_STARTED | §124, §37 |

## CUR — Curriculum

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| CUR-001 | One master skill graph. Campaigns are curated paths that reference skill IDs; skills are never duplicated inside campaigns. | P0 | 5 | NOT_STARTED | §10, §144 |
| CUR-002 | `FIELD_READY` campaign expressed as competency Gates 0–12, not days. | P0 | 6 | NOT_STARTED | §11 |
| CUR-003 | Gate 0 Placement assesses funnel reasoning, lead capture, workflow basics, fields vs values, pipeline basics, basic pricing, written prospect response, short spoken discovery; strong basics clear early requirements. | P1 | 24 | NOT_STARTED | §11 |
| CUR-004 | Gate 1 Funnel Thinking: customer journey, funnel purpose, traffic intent, offers, friction, CTA, conversion, funnel math, bottleneck thinking. | P1 | 24 | NOT_STARTED | §11 |
| CUR-005 | Gate 2 Lead Systems: lead capture, forms, confirmation, follow-up, CRM capture, pipeline, next action. | P1 | 24 | NOT_STARTED | §11 |
| CUR-006 | Gate 3 GHL Data Foundations: contacts, tags, custom fields, custom values, opportunities, pipelines, assignments, correct architecture decisions. | P1 | 24 | NOT_STARTED | §11 |
| CUR-007 | Gate 4 Workflow Foundations: triggers, filters, actions, waits, If/Else, re-entry, timing, communications, pipeline automation. | P1 | 24 | NOT_STARTED | §11 |
| CUR-008 | Gate 5 Booking and Qualification: forms, surveys, qualification, calendars, routing, reminders, cancellations, reschedules, no-shows. | P1 | 24 | NOT_STARTED | §11 |
| CUR-009 | Gate 6 Conversion and Copy: page hierarchy, message match, CTA placement, conversion copy, proof, qualification friction, mobile conversion design. | P1 | 24 | NOT_STARTED | §11 |
| CUR-010 | Gate 7 Diagnosis and QA: workflow troubleshooting, funnel troubleshooting, logs, edge cases, metrics, pre-launch QA, bottleneck diagnosis. | P1 | 24 | NOT_STARTED | §11 |
| CUR-011 | Gate 8 Prospecting and Audits: ICP, prospect selection, evidence, research, outreach, cold email, follow-up, audit quality. | P1 | 24 | NOT_STARTED | §11 |
| CUR-012 | Gate 9 Discovery and Selling: cold calls, discovery, Zoom-style calls, listening, questions, diagnosis, explaining systems, pitching outcomes. | P1 | 24 | NOT_STARTED | §11 |
| CUR-013 | Gate 10 Pricing and Negotiation: scope, fixed pricing, recurring pricing, deposits, revisions, exclusions, risk, negotiation, reducing scope, walking away. | P1 | 24 | NOT_STARTED | §11 |
| CUR-014 | Gate 11 Proposal and Delivery: proposal, acceptance, onboarding, dependencies, build order, client updates, QA, handoff. | P1 | 24 | NOT_STARTED | §11 |
| CUR-015 | Gate 12 Field Ready Capstone: no instructional handholding; diagnose → design → price → negotiate → propose → build → test → explain, with part of implementation in real GHL. | P1 | 24 | NOT_STARTED | §11, §155 |
| CUR-016 | Permanent skill map has nine territories — STRATEGIZE, BUILD, AUTOMATE, ARCHITECT, DIAGNOSE, CONNECT, SELL, DELIVER, SCALE — plus JUDGMENT measured centrally across all. | P0 | 5 | NOT_STARTED | §12 |
| CUR-017 | Judgment competencies measured: whether a funnel/automation/GHL/tag-or-field/custom code is needed, whether to contact a prospect, whether evidence supports an audit claim, whether to accept a project, realistic scope/price/complexity, admitting not knowing, what could break, what is missing. Reward "I don't know yet, but this is how I would verify it" over fabricated confidence. | P1 | 24 | NOT_STARTED | §13 |
| CUR-018 | STRATEGIZE curriculum tiers: Field Ready (customer path … bottleneck reasoning; 11 core funnel families), Practitioner (webinar … course enrollment), Advanced (multi-funnel … advanced diagnosis), Specialist (complete business-system architecture). | P1 | 24 | NOT_STARTED | §14 |
| CUR-019 | BUILD curriculum: conversion layout, copy, GHL Funnel Builder (current real features), GHL Websites, Forms, Surveys, Calendars, Payments (progressive). | P1 | 24 | NOT_STARTED | §15 |
| CUR-020 | AUTOMATE curriculum: foundations, core triggers, core actions, wait logic, branching, re-entry, common systems, advanced (modular automation, naming, date logic, webhooks, idempotency, race conditions, large architecture). | P1 | 24 | NOT_STARTED | §16 |
| CUR-021 | ARCHITECT curriculum: contacts, tags (correct/incorrect use), custom fields, custom values (major competency), pipelines, opportunities, smart lists, companies, custom objects (advanced), data modeling with realistic problems. | P1 | 24 | NOT_STARTED | §17 |
| CUR-022 | DIAGNOSE curriculum: Bloomwired QA protocol (19 areas), workflow troubleshooting, funnel troubleshooting, deliverability, SMS/phone reliability, analytics (visitor→lead→booked→show→sale, UTM, attribution), experimentation. | P1 | 24 | NOT_STARTED | §18 |
| CUR-023 | CONNECT curriculum: DNS, JSON, HTTP, webhooks, APIs (current GHL API practice, no obsolete patterns), Git/GitHub, Cloudflare Workers, Google Cloud, JavaScript for operator work; Marketplace/App extension specialist only. | P1 | 25 | NOT_STARTED | §19 |
| CUR-024 | SELL curriculum: ICP, research, evidence-based audit, prospect qualification, cold email, social outreach, cold calls, discovery, listening, technical discovery, presentation, client language, pricing, scope, negotiation, closing. | P1 | 24 | NOT_STARTED | §20 |
| CUR-025 | DELIVER curriculum: proposal, change requests, onboarding, build order dependencies, client communication, handoff, retention (later). | P1 | 24 | NOT_STARTED | §21 |
| CUR-026 | SCALE curriculum: templates, naming standards, deployment checklist, snapshots, vertical systems (Bloomwired Med Spa Core, Coach Lead Path, Home Services Follow-Up, Photographer Inquiry System), agency architecture; SaaS / white label / Marketplace specialist only. | P2 | 25 | NOT_STARTED | §22 |
| CUR-027 | GHL AI curriculum taught only after deterministic understanding; covers when workflows beat AI, Conversation AI, Voice AI, workflow AI actions, agents, knowledge bases, tools, MCP/external tools, escalation, permissions, hallucination risk, cost, logs, irreversible actions. Product names verified from official GHL sources. | P2 | 25 | NOT_STARTED | §23 |
| CUR-028 | Supporting GHL specialties present in the full graph (reputation, reviews, Social Planner, courses, memberships, communities, client portal, affiliates, ecommerce, blogs, SEO, IVR, prospecting tool, ad reporting, rentals, services, resources, contracts, estimates, invoices, payment links, subscriptions, advanced reporting); not all in Field Ready. | P2 | 25 | NOT_STARTED | §24 |
| CUR-029 | Learner increasingly writes copy without automatically using AI. | P1 | 24 | NOT_STARTED | §15 |
| CUR-030 | Starter projects: Lead Capture System, Consultation Booking, Application Funnel, Reactivation, Full Capstone (complete fictional Bloomwired client). | P1 | 24 | NOT_STARTED | §154 |
| CUR-031 | Capstone exam: no normal hints; learner receives business, offers, staff, metrics, current systems, problems, hidden edge cases, client communications, budget constraints; must diagnose, architect, build, test, troubleshoot, price, negotiate, propose, explain; reasoning questions asked; major implementation in real GHL. | P1 | 24 | NOT_STARTED | §155 |
| CUR-032 | Post-Field-Ready paths: Automation Specialist, Funnel & Conversion Specialist, Sales Operator, Technical GHL Specialist, Agency Systems, GHL AI Specialist, recommended Bloomwired Operator Path. | P2 | 25 | NOT_STARTED | §157 |
| CUR-033 | Content coverage matrix (Skill × Learn / Guided / Practice / Fix / Independent / Pressure / Fieldwork / Sales Use) generated from content data, not maintained by hand. | P1 | 5 | NOT_STARTED | §137 |
| CUR-034 | Minimum curriculum: one master graph, Field Ready path, practical work for every core skill, independent assessment, retrieval, pricing, negotiation, calls, written sales, proposals, prospecting, real GHL fieldwork. | P0 | 24 | NOT_STARTED | §144 |
| CUR-035 | Field Ready content complete from placement through capstone before advanced curriculum; no hundreds of shallow lessons before the learning loop works. | P1 | 24 | NOT_STARTED | PHASE 24 |
| CUR-036 | Academy behaves like an interactive editorial publication: strong typography, short sections, diagrams, inline simulations, interaction, expandable depth. Not "video + paragraph + next lesson". | P1 | 8 | NOT_STARTED | §76 |

## MAS — Mastery

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| MAS-001 | Mastery states: UNSEEN, LEARNING, GUIDED, PRACTICED, INDEPENDENT, PRESSURE_TESTED, MASTERED, NEEDS_REFRESH. | P0 | 6 | NOT_STARTED | §29 |
| MAS-002 | Mastery is never awarded from quizzes alone. | P0 | 6 | NOT_STARTED | §29 |
| MAS-003 | Evidence record stores skill, exercise, result, score, assistance, difficulty, critical failures, date, simulator version, content version, real-GHL evidence where required. | P0 | 6 | NOT_STARTED | §30 |
| MAS-004 | Critical failure system: a dangerous failure (e.g. cancelled appointment receives reminder) fails the attempt regardless of numeric score. | P0 | 9 | NOT_STARTED | §31 |
| MAS-005 | Review system: old skills reappear as short retrieval challenges inside later sessions; review-due never blocks forward progress; failed retrieval re-queues the skill. | P1 | 6 | NOT_STARTED | §32 |
| MAS-006 | Session Builder offers 30 min / 1 hour / 2 hours / Deep Session; inputs: active campaign, current gate, weak skills, review due, failures, active boss client, fieldwork, assistance dependence; assembled algorithmically with no AI; "Continue" available after session ends. | P1 | 6 | NOT_STARTED | §33, TA§70 |
| MAS-007 | Assistance meter tracks Independent / Light Assistance / Guided / Heavy Assistance quietly, without shaming; mastery requires sufficient independent evidence. | P1 | 6 | NOT_STARTED | §34 |
| MAS-008 | Mastery engine is its own TypeScript package (`packages/mastery-engine`): inputs skill definition, evidence history, assistance, difficulty, recency, critical failures, fieldwork requirement; outputs state, confidence, missing_requirements, review_priority. No AI. | P0 | 6 | NOT_STARTED | §102, TA§68 |
| MAS-009 | Review scheduler is evidence-based (last_demonstrated, failure_rate, mastery_level, importance, review_due), not an Anki clone. | P1 | 6 | NOT_STARTED | TA§69 |
| MAS-010 | Field Ready pass requires sufficient evidence across funnel strategy, GHL implementation, automation, CRM architecture, troubleshooting, sales, pricing, negotiation, fieldwork, client explanation — never one overall percentage. | P0 | 24 | NOT_STARTED | §156 |
| MAS-011 | A heavily assisted pass is not independent mastery evidence. | P0 | 6 | NOT_STARTED | §28, §34 |

## EXR — Exercise Engine

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| EXR-001 | Exercises are data-driven (`exercise_id, type, title, skills, scenario, instructions, allowed_features, starting_state, expected_outcomes, critical_failures, grading, hints, fieldwork, portfolio`). A new exercise usually requires content, not a new React page. | P0 | 9 | NOT_STARTED | TA§31 |
| EXR-002 | Deterministic grading via code assertions: state, event, timing, architecture, negative, sequence. | P0 | 9 | NOT_STARTED | §27, TA§32 |
| EXR-003 | Rubric tiers: critical, required, quality, bonus. | P0 | 9 | NOT_STARTED | TA§33 |
| EXR-004 | BUILD IT: objective given, learner constructs solution with real GHL concepts, deterministic grading where possible. | P1 | 9 | NOT_STARTED | §27 |
| EXR-005 | FIX IT: broken system with symptoms shown ("Maria received two reminder messages. Expected one."); faulty node not revealed immediately. | P1 | 9 | NOT_STARTED | §27 |
| EXR-006 | RUN THE LEAD: learner predicts execution of a contact through a workflow, then actual execution is animated. | P1 | 9 | NOT_STARTED | §27 |
| EXR-007 | EDGE CASE: one important variable changed (late booking, cancelled, missing phone, timezone, second location, duplicate); learner judges whether the system still works. | P1 | 9 | NOT_STARTED | §27 |
| EXR-008 | WHAT WOULD YOU BUILD?: business problem without naming the GHL feature under test; multiple valid architectures accepted; AI used only where open-ended reasoning requires it. | P1 | 9 | NOT_STARTED | §27 |
| EXR-009 | ARCHITECTURE DECISION: tag vs custom field vs custom value vs opportunity field vs custom object; multiple-choice support removed at later levels. | P1 | 9 | NOT_STARTED | §27 |
| EXR-010 | FUNNEL AUTOPSY: simulated page plus data; inspect traffic source, conversion rate, scroll behavior, form completion, booking rate, drop-off; learner must separate problem from hypothesis. | P1 | 15 | NOT_STARTED | §27 |
| EXR-011 | FUNNEL ASSEMBLY: blocks or blank architecture; learner creates page/funnel information structure; no forced universal order where several are valid. | P1 | 13 | NOT_STARTED | §27 |
| EXR-012 | PROSPECT IT: multiple fake businesses; learner decides Contact / Maybe / Skip with required reasoning. | P1 | 16 | NOT_STARTED | §27 |
| EXR-013 | AUDIT IT: findings forced into Verified / Likely / Unknown. | P1 | 16 | NOT_STARTED | §27 |
| EXR-014 | WRITE IT: cold email, follow-up, interested reply, discovery recap, proposal explanation, client update, scope response, payment reminder, upsell, breakup email; AI rubric where needed. | P1 | 16 | NOT_STARTED | §27 |
| EXR-015 | SAY IT: voice practice modes cold call, discovery, proposal presentation, negotiation, client explanation. | P1 | 21 | NOT_STARTED | §27 |
| EXR-016 | PRICE IT: learner sets project price, deposit, recurring, rush fee, timeline, revisions, inclusions, exclusions; hidden economics and risk revealed after submission. | P1 | 17 | NOT_STARTED | §27 |
| EXR-017 | NEGOTIATE IT: client pushes back; learner may clarify, hold price, reduce scope, phase, concede, or walk away; winning is not the only success. | P1 | 18 | NOT_STARTED | §27 |
| EXR-018 | EXPLAIN IT: technical explanation for different audiences (business owner, another GHL builder). | P1 | 16 | NOT_STARTED | §27 |
| EXR-019 | REBUILD BLIND: no lesson, no step-by-step support; hints reduce independence evidence. | P1 | 9 | NOT_STARTED | §27 |
| EXR-020 | FIELDWORK: real GHL work; Bloomlab collects screenshots, configuration answers, explanation, test results, then questions reasoning. | P1 | 22 | NOT_STARTED | §27 |
| EXR-021 | BOSS CLIENT: persistent multi-stage engagement (audit → discovery → architecture → pricing → negotiation → proposal → implementation → QA → launch → reporting → change request); earlier decisions affect later consequences. | P1 | 24 | NOT_STARTED | §27 |
| EXR-022 | Hint system: Nudge, Concept Reminder, Worked Example; assistance tracked per attempt. | P1 | 9 | NOT_STARTED | §28 |
| EXR-023 | Workflow scoring example (correctness 45%, edge cases 20%, architecture 15%, maintainability 10%, explanation 10%) with critical-failure override. | P1 | 12 | NOT_STARTED | §31 |
| EXR-024 | No stub / no static replacement: a requirement that logs to console, shows fake success, is a static placeholder, says "coming soon", works only for a screenshot, or opens a nonfunctional modal stays PARTIAL. Interactive simulation is never replaced by a diagram, negotiation by an article, Funnel Autopsy by a quiz. | P0 | all | NOT_STARTED | §129, §130 |

## SIM — Simulator Core

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| SIM-001 | One shared simulated GHL account model across all labs. A form submitted in Funnel Lab can create a contact, populate fields, fire a workflow, create an opportunity, send simulated SMS, create an appointment and affect reporting. Labs are not separate mini-games. | P0 | 10 | NOT_STARTED | §41, §145 |
| SIM-002 | Deterministic TypeScript package `packages/simulator-core`; no simulation logic inside React components. | P0 | 10 | NOT_STARTED | §42, TA§19 |
| SIM-003 | Transition model `State + Event → Transition → New State + Events (+ execution records)` via pure reducers that never call Claude, mutate globals, read system time, use uncontrolled randomness, or perform network requests. | P0 | 10 | NOT_STARTED | §42, TA§22 |
| SIM-004 | Simulated account model supports progressively: account, users, contacts, companies, tags, custom fields, custom values, opportunities, pipelines, appointments, calendars, forms, surveys, products, payments, conversations, workflows, workflow runs, tasks, notes, analytics, event log. | P0 | 10 | NOT_STARTED | §43, TA§20 |
| SIM-005 | Event catalogue per §44 (CONTACT_*, TAG_*, FORM_SUBMITTED, SURVEY_SUBMITTED, APPOINTMENT_*, SMS_SENT/RECEIVED, EMAIL_SENT/OPENED, OPPORTUNITY_*, PIPELINE_STAGE_CHANGED, PAYMENT_*, REFUND_ISSUED, TIME_ADVANCED, WORKFLOW_*, WEBHOOK_*). Real GHL terminology used in UI for real features. | P0 | 10 | NOT_STARTED | §44, TA§21 |
| SIM-006 | Every scenario has its own deterministic clock storing simulation time, timezone and scheduled future events. Graded behavior never depends on wall-clock time. | P0 | 10 | NOT_STARTED | §45, TA§23 |
| SIM-007 | Time Machine: +1 minute, +1 hour, +1 day, Next Event; current simulated date/time always clearly shown. | P1 | 10 | NOT_STARTED | §46 |
| SIM-008 | Event scheduler is a priority queue of future events; Next Event advances the clock to the earliest queued event with no AI. | P0 | 10 | NOT_STARTED | TA§24 |
| SIM-009 | Event Injector allows scenario-defined events: contact reply, tag added, appointment cancellation, appointment reschedule, payment, form submission, opportunity movement. | P1 | 10 | NOT_STARTED | §47 |
| SIM-010 | Execution log stores trigger, data, step, start, completion, branch result, skipped action, waiting, failure, exit reason. | P0 | 10 | NOT_STARTED | §48 |
| SIM-011 | Realistic failures simulated: missing phone, DND, invalid webhook auth, missing field, unavailable appointment, duplicate enrollment, bad condition, workflow loop, integration failure. Observable symptoms shown before fixes. | P1 | 15 | NOT_STARTED | §49 |
| SIM-012 | Seeded deterministic randomness; scenario specifies `seed`; identical inputs give identical grading results. | P0 | 10 | NOT_STARTED | TA§25 |
| SIM-013 | Snapshots: initial scenario + event log + periodic checkpoints provide undo, rewind, replay, troubleshooting, reproducible grading. Full state is not serialised after every event. | P0 | 10 | NOT_STARTED | TA§26, §145 |
| SIM-014 | Heavy simulation runs in a browser Web Worker where beneficial; UI never blocks during large workflow executions. | P1 | 12 | NOT_STARTED | §97, TA§27 |
| SIM-015 | Playground: once a feature is unlocked it stays available for free experimentation without an assigned exercise. | P1 | 12 | NOT_STARTED | §61 |
| SIM-016 | Workflow definition schema: `id, name, trigger, trigger_filters, nodes[], edges[], settings`; node `id, type, ghl_feature_id, config, position`. Layout is separate from behavior — moving a node never changes automation. | P0 | 10 | NOT_STARTED | TA§28 |
| SIM-017 | Simulator regression suite with fixture IDs (e.g. WAIT-001 fixed wait, WAIT-002 appointment-relative, WAIT-003 late enrollment, WAIT-004 cancellation during wait). Every bug fix adds a regression fixture. CI fails on regression. | P0 | 10 | NOT_STARTED | §133, TA§74 |
| SIM-018 | Replay and reset of any scenario. | P0 | 10 | NOT_STARTED | §145 |
| SIM-019 | Simulator has its own version; attempts record `simulator_version`. | P0 | 10 | NOT_STARTED | §101, TA§56 |

## WFL — Workflow Lab

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| WFL-001 | Desktop Workflow Lab has canvas, toolbar, inspector and execution timeline. | P0 | 12 | NOT_STARTED | §50 |
| WFL-002 | Supports add trigger, filter, action, Wait, If/Else, branches, reorder, connect, undo, redo, run test, inspect history. | P0 | 12 | NOT_STARTED | §50 |
| WFL-003 | Every displayed trigger/action (Appointment Status, Send SMS, Wait, …) maps to a real current GHL function via the registry or is clearly marked as an approximation. No made-up native GHL actions. | P0 | 12 | NOT_STARTED | §51 |
| WFL-004 | Test contact: use existing simulated contact or generate one; run visibly through the workflow showing current node, current values, branch result, timeline events. | P0 | 12 | NOT_STARTED | §52 |
| WFL-005 | Node shows action type, real feature name, concise configuration, status; full settings live in a contextual inspector, not on the canvas. | P1 | 12 | NOT_STARTED | §53 |
| WFL-006 | Mobile Workflow Lab is a structured vertical / drill-down editor (not a shrunken canvas) supporting configuring steps, inspecting branches, testing, reviewing execution, editing. | P0 | 12 | NOT_STARTED | §54, §131 |
| WFL-007 | Visuals: dark ink workspace, light clean nodes, aqua/blue active execution; not neon hacker software. | P1 | 12 | NOT_STARTED | §77 |
| WFL-008 | Wait logic: fixed delay, appointment-relative wait, time/date, business hours, event waiting, timezone, late enrollment. | P0 | 12 | NOT_STARTED | §16 |
| WFL-009 | Branching: If/Else, AND/OR, comparisons, dynamic values, fallback, multiple paths. | P0 | 12 | NOT_STARTED | §16 |
| WFL-010 | Re-entry semantics: duplicate enrollment, repeated triggers, overlapping workflows, duplicate messages, exits (race conditions later). | P0 | 12 | NOT_STARTED | §16 |
| WFL-011 | Available actions are sourced from the GHL feature registry, never hardcoded in the Lab. | P0 | 12 | NOT_STARTED | TA§29 |
| WFL-012 | First Workflow Execution signature moment: watch the contact travel through the system. | P2 | 12 | NOT_STARTED | §161 |

## CRM — CRM Lab

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| CRM-001 | CRM Lab supports contacts, fields, tags, opportunities, pipelines, assignments, activity history, notes, tasks. | P0 | 11 | NOT_STARTED | §55 |
| CRM-002 | Companies and custom objects added later (schemas, records, associations, workflows, limitations, when excessive). | P2 | 25 | NOT_STARTED | §55, §17 |
| CRM-003 | Poor architectural choices are allowed when technically possible; later consequences teach why they were poor. | P1 | 11 | NOT_STARTED | §55 |
| CRM-004 | High information density on desktop; mobile uses stage view / deliberate local horizontal scroller. | P1 | 11 | NOT_STARTED | §72, §83 |
| CRM-005 | Smart list segmentation. | P2 | 25 | NOT_STARTED | §17 |

## FUN — Funnel Lab

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| FUN-001 | Funnel Lab is a conversion architecture simulator (not a page-builder replacement): funnel steps, page structure blocks, forms, surveys, calendar, checkout concepts, mobile/tablet/desktop preview, simulated visitor. | P1 | 13 | NOT_STARTED | §56 |
| FUN-002 | Modes BUILD / PREVIEW / SIMULATE. | P1 | 13 | NOT_STARTED | §56 |
| FUN-003 | Submitting a form in Funnel Lab creates real simulated CRM data and fires workflows through the shared account. | P0 | 13 | NOT_STARTED | §56, §41 |
| FUN-004 | Funnel Autopsy data inspection: traffic source, conversion rate, scroll behavior, form completion, booking rate, drop-off. | P1 | 15 | NOT_STARTED | §27 |

## CAL — Calendar Lab

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| CAL-001 | Calendar Lab supports progressively: duration, availability, buffers, minimum notice, staff, assignment, round robin, services, locations, confirmation, reschedule, cancellation. | P1 | 14 | NOT_STARTED | §57 |
| CAL-002 | Advanced resource rules (classes, resources, complex scheduling) later. | P3 | 25 | NOT_STARTED | §57, §15 |
| CAL-003 | Booking events (APPOINTMENT_BOOKED / RESCHEDULED / CANCELLED / STATUS_CHANGED) fire workflows through the shared simulator. | P0 | 14 | NOT_STARTED | §44, §57 |

## CONV — Conversations

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| CONV-001 | Conversations Lab simulates SMS and email (call events and other channels later); replies can affect workflows. | P1 | 12 | NOT_STARTED | §58 |
| CONV-002 | Written sales simulation: persistent inbox-like conversations where client messages react to the learner's answer; conversation continues naturally instead of always showing "Correct." | P1 | 16 | NOT_STARTED | §120 |

## PAY — Payments Lab

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| PAY-001 | Payments Lab (later): product, price, one-time, subscription, payment link, invoice, failed payment, refund; payment events fire workflows. | P2 | 25 | NOT_STARTED | §59 |

## REP — Reporting Lab

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| REP-001 | Reporting Lab calculates from actual simulator data: leads, conversion, booking rate, show rate, close rate, revenue, pipeline value, source performance, response rate, time to contact. | P1 | 15 | NOT_STARTED | §60 |
| REP-002 | Reporting trains diagnosis (bottleneck reasoning), not passive dashboards. | P1 | 15 | NOT_STARTED | §60, §18 |
| REP-003 | No fake analytics or meaningless metrics anywhere in the product. | P0 | all | NOT_STARTED | §70, §74 |

## SAL — Sales and Delivery

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| SAL-001 | Evidence-based audit: every finding classified VERIFIED (directly observed) / LIKELY (evidence suggests) / UNKNOWN (needs confirmation); unsupported claims penalised. | P0 | 16 | NOT_STARTED | §20 |
| SAL-002 | Prospect qualification: some prospects should be skipped; ICP fit, economics, recurring need, technical fit, decision-maker access. | P1 | 16 | NOT_STARTED | §20 |
| SAL-003 | Cold email training: opener, evidence, relevance, problem, CTA, follow-up. | P1 | 16 | NOT_STARTED | §20 |
| SAL-004 | Discovery structure: opening, agenda, current process, desired result, pain, volume, impact, urgency, tools, staff, stakeholders, budget, decision process, next step; plus technical discovery. | P1 | 16 | NOT_STARTED | §20 |
| SAL-005 | Listening graded: excessive talking and premature pitching penalised. | P1 | 16 | NOT_STARTED | §20 |
| SAL-006 | Presentation frame: problem → consequence → system → outcome. | P1 | 16 | NOT_STARTED | §20 |
| SAL-007 | Client language: explanation without unnecessary GHL jargon. | P1 | 16 | NOT_STARTED | §20 |
| SAL-008 | Closing: asking for commitment, proposal follow-up, ghosting, decision delay, next-step control. | P1 | 16 | NOT_STARTED | §20 |
| SAL-009 | Proposal structure: problem, recommendation, scope, price, timeline, assumptions, exclusions, acceptance. | P1 | 17 | NOT_STARTED | §21 |
| SAL-010 | Change-request scope control. | P1 | 24 | NOT_STARTED | §21 |
| SAL-011 | Onboarding: access, credentials, domains, calendars, users, branding, copy, payment, expectations. | P1 | 24 | NOT_STARTED | §21 |
| SAL-012 | Build order taught as dependencies (data → pipeline → calendar → forms → workflows → funnel → tracking → QA), not random building. | P1 | 24 | NOT_STARTED | §21 |
| SAL-013 | Client communication types: update, blocker, delay, approval, revision, technical explanation. | P1 | 16 | NOT_STARTED | §21 |
| SAL-014 | Handoff: documentation, training, ownership, support. | P1 | 24 | NOT_STARTED | §21 |
| SAL-015 | Retention (later): reporting, maintenance, retainer, expansion, referral, account strategy. | P2 | 25 | NOT_STARTED | §21 |
| SAL-016 | Scope training: deliverables, assumptions, exclusions, revisions, dependencies, location count, workflow complexity, migration, integration, rush, copy, design, support. | P1 | 17 | NOT_STARTED | §20 |

## PRI — Pricing

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| PRI-001 | Pricing Arena designed as a deal desk showing requirements, scope, price, payment, timeline, recurring, exclusions; scope reductions have visible structural consequences. | P1 | 17 | NOT_STARTED | §80 |
| PRI-002 | Pricing engine: no single universally correct price. Scenario stores baseline complexity, estimated labor, risk, migration, locations, integrations, custom development, rush, recurring support; evaluation covers price, margin, scope, risk, reasoning. | P1 | 17 | NOT_STARTED | §122 |
| PRI-003 | Pricing models taught: fixed, hourly, project, setup, recurring, retainer, margin, complexity, risk, minimum viable project pricing. | P1 | 17 | NOT_STARTED | §20 |
| PRI-004 | Pricing math covered by unit tests. | P1 | 17 | NOT_STARTED | §132 |

## NEG — Negotiation and Scenario Engine

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| NEG-001 | Hidden client state (trust, urgency, price sensitivity, frustration, technical sophistication, actual budget, stated budget, decision authority, fear, previous bad experience, alternative provider strength) is tracked and never shown numerically to the learner. | P0 | 18 | NOT_STARTED | §39, §121, TA§50 |
| NEG-002 | Learner actions: clarify, hold price, reduce scope, phase, concession, walk away. Winning is not the only success; a lost deal can score high. | P1 | 18 | NOT_STARTED | §27, §20 |
| NEG-003 | Authored branching first: learner responses classified into strategies (discount, hold, clarify, reduce_scope, phase, walk_away, defensive) with pre-authored reactions; AI only for language that genuinely needs interpretation. | P1 | 18 | NOT_STARTED | §40, TA§51 |
| NEG-004 | Objection coverage: budget, competitor price, discount request, scope reduction, phased project, payment terms, deposit, concessions, silence, walking away. | P1 | 18 | NOT_STARTED | §20 |
| NEG-005 | Scenario engine: current state + learner action + rules → updated scenario; dialogue actions modify hidden state (e.g. strong diagnosis trust +10, premature pitch trust −8, ignored objection frustration +15). | P0 | 18 | NOT_STARTED | §40, TA§50 |

## CALL — Call Room

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| CALL-001 | Call Room is minimal, immersive, dark; shows client identity, company, objective, audio state, elapsed time, notes drawer. Not a Zoom clone. | P1 | 21 | NOT_STARTED | §79 |
| CALL-002 | Turn-based v1 flow: client audio → learner response → record → transcribe → evaluate → update scenario → next response, with natural transitions. No full-duplex realtime telephony in v1. | P1 | 21 | NOT_STARTED | §117, §118, TA§48 |
| CALL-003 | Call grading: questions, listening, diagnosis, clarity, jargon, pitch timing, objection handling, next step. Accent is not graded. | P1 | 21 | NOT_STARTED | §119 |
| CALL-004 | Early training may show discovery anchors; advanced calls remove aids. | P2 | 21 | NOT_STARTED | §79 |
| CALL-005 | Mobile-first voice experience. | P1 | 21 | NOT_STARTED | §83 |
| CALL-006 | Recording policy: transcript saved by default; raw audio temporary, optional to retain, user-deletable. | P1 | 21 | NOT_STARTED | TA§49 |

## FLD — Fieldwork

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| FLD-001 | Real-GHL proof flow: screenshots where helpful, configuration answers, explanation, test results; Bloomlab then questions reasoning. | P1 | 22 | NOT_STARTED | §27, §153 |
| FLD-002 | v1 never requires a GHL API connection or production GHL credentials; fieldwork uses the learner's real training/subaccount manually. | P0 | all | NOT_STARTED | §153, TA§63 |
| FLD-003 | Optional later GHL verification via approved Private Integration (workflow/field/pipeline/opportunity/calendar existence). | P3 | — | DEFERRED | TA§64 |
| FLD-004 | Selected mastery requires real-GHL evidence (REAL_GHL fidelity features). | P1 | 22 | NOT_STARTED | §26, §30 |

## PORT — Portfolio

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| PORT-001 | Portfolio item stores brief, business problem, architecture, funnel, workflows, screenshots, learner reasoning, skills demonstrated, assistance level, real-GHL evidence where applicable. | P1 | 23 | NOT_STARTED | §35 |
| PORT-002 | Fictional work labelled "Simulation Project" or "Demonstration Build". Client outcomes are never fabricated. | P0 | 23 | NOT_STARTED | §35 |
| PORT-003 | Portfolio progression: Field Ready 1–5, Practitioner 6–10, Advanced 11–15, Specialist 16–20 as listed in §36. | P2 | 24 | NOT_STARTED | §36 |

## DES — Design

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| DES-001 | Visual language adapted from https://doodlemonjigsaw.netlify.app/ (palette, holographic appearance, iridescence, interaction, animation, tactile, playful material). Never copy Pokémon/Doodlemon art, logo, characters, branded illustrations or exact page composition. | P0 | 2 | PASSED | §62 |
| DES-002 | North star: collectible + tactile + intelligent + playful + polished + immersive; "Doodlemon energy × premium creative software × professional simulation game". | P1 | 2 | PASSED | §63 |
| DES-003 | Core rule: the interface is quiet, the objects are magical. Strong holo reserved for territory cards, mastery cards, client case covers, selected challenges, portfolio projects, meaningful unlocks, advanced/mastered states, Field Ready achievement. | P0 | 2 | PASSED | §64 |
| DES-004 | Initial colour tokens exactly as §65 (Cloud #F8FAFF, Snow #FFFFFF, Mist #F0F3FC, Soft Lilac #EEEAFB, Ink #18152B, Deep Ink #100D22, Ink Soft #5D5873, Ink Faint #8F8AA5, Electric Sky #6EC8FF, Bubblegum #FF82C8, Lavender #A99BFF, Aqua #75E6DE, Lemon Cream #FFE98A, Peach #FFB49C, Ice #CFF8FF; Success #56BFA1, Warning #E5A94C, Error #D85C72, Info #5D90D9), tuned only for contrast within the same family. | P0 | 2 | PASSED | §65 |
| DES-005 | Typography: Bricolage Grotesque (display), Inter (UI/body), IBM Plex Mono (technical); substitutes must be expressive display grotesk / readable UI sans / restrained mono. No generic system fonts everywhere. | P1 | 2 | PASSED | §66 |
| DES-006 | No AI-slop patterns: giant gradient hero, purple SaaS gradient, gradient text, glassmorphism everywhere, random blobs, icon beside every heading, endless three-column cards, every section in a card, giant useless stats, fake analytics, emoji navigation, trophy spam, rocket graphics, stock SaaS art, generic AI avatar, huge shadows, random confetti, excessive pills, identical layouts everywhere, generic "Welcome back" dashboard. | P0 | all | IN_PROGRESS | §70 |
| DES-007 | Semantic components (SkillCard, ClientCaseCover, WorkflowNode, ExercisePrompt, MasteryBadge, ContactRow, PipelineCard, HoloTerritory, CallParticipant, PricingScopeItem, ExecutionEvent) sharing tokens; no single universal Card component. | P0 | 2 | PASSED | §71, TA§3 |
| DES-008 | Information density varies by environment: Academy low-medium, Workflow Lab medium-high, CRM high, Call Room very low, Pricing Arena medium, Skill Map high visual / low text. | P1 | 7 | IN_PROGRESS | §72 |
| DES-009 | App shell: compact left rail ~68–80 px with Home, Campaign, Skill Map, Simulator, Clients, Portfolio, Playground; minimal top context; no giant sidebar. | P1 | 7 | NOT_STARTED | §73 |
| DES-010 | Command Center answers "What should I do next?"; main object is Continue (campaign, gate, current topic, progress); supporting: active client, due retrieval, recent mastery, Build My Session. No meaningless metrics. | P1 | 7 | NOT_STARTED | §74 |
| DES-011 | Skill Map signature screen: nine territories plus Judgment as holographic regions / collectible objects, not tiny LMS nodes; skill states unseen → needs refresh change the visual material. | P1 | 7 | NOT_STARTED | §75 |
| DES-012 | Client case covers feel collectible and premium using abstract identity/material treatment; no mandatory stock photos. | P2 | 24 | IN_PROGRESS | §78 |
| DES-013 | Broken Build Mode uses an understated INCIDENT state with symptom, logs, client complaint, system state. No cartoon alarms. | P1 | 15 | NOT_STARTED | §81 |
| DES-014 | Explicit design tokens: color, spacing, radius, shadow, motion, typography, holographic material, density, z-index, breakpoints. | P0 | 1 | PASSED | TA§3 |
| DES-015 | Visual primitives: HoloMaterial, Surface, InkSurface, ToolPanel, Sheet, Inspector, Popover, Field, Button, IconButton. | P0 | 2 | PASSED | TA§3 |
| DES-016 | Styling via CSS variables + CSS Modules / component CSS; Tailwind only selectively for layout utilities; product must not look like a standard Tailwind component library. | P1 | 2 | PASSED | TA§3 |
| DES-017 | Visual review of major screens at 1440 / 1024 / 768 / 390 / 320 checking hierarchy, density, material, interaction, holo restraint, slop patterns, responsive composition, long-session comfort. | P1 | all | IN_PROGRESS | §135 |
| DES-018 | Screen coverage matrix maintained: Screen × Desktop / Tablet / Mobile / Empty / Loading / Error / Keyboard / Touch. No major screen complete with desktop only. | P1 | all | IN_PROGRESS | §136 |
| DES-019 | Visual language exists early; product is never built with generic temporary UI to be "styled later". | P0 | 2 | PASSED | PHASE 2 |
| DES-020 | Academy visual design is editorial (strong typography, diagrams, inline simulation embeds). | P1 | 8 | NOT_STARTED | §76 |

## HOL — Holographic Material

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| HOL-001 | One reusable `HoloMaterial` (not dozens of gradients) with base pearlescent layer, spectral layer, moving radial reflection, fine foil texture, edge sheen, pointer tilt, touch response, reduced-motion behavior. | P0 | 2 | PASSED | §67 |
| HOL-002 | Variants: soft, collectible, mastery, legendary (legendary stays tasteful). | P1 | 2 | PASSED | §67 |
| HOL-003 | Desktop physics: pointer position drives rotateX, rotateY, reflection position, spectral angle, shadow direction, edge sheen; max tilt ≈ 5–7°; settle to neutral in ≈ 350–500 ms on pointer exit. | P1 | 2 | PASSED | §68 |
| HOL-004 | Touch: press changes reflection, drag moves reflection, release settles. Device orientation permission never requested. | P1 | 2 | PASSED | §68 |
| HOL-005 | Holo Skill Interaction signature moment (pointer/touch physical response) polished. | P2 | 26 | NOT_STARTED | §161 |

## MOT — Motion

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| MOT-001 | Motion categories: state, spatial, execution, reward. | P1 | 2 | PASSED | §69 |
| MOT-002 | Normal interaction timing ≈ 120–300 ms; major accomplishments ≈ 1.5–3 s and skippable. | P1 | 2 | PASSED | §69 |
| MOT-003 | Reduced motion respected across all motion and holo effects. | P0 | 2 | PASSED | §69, §84 |
| MOT-004 | No constant expensive holographic animation; animations stop off-screen. | P1 | 2 | PASSED | §148, TA§78 |

## RSP — Responsive

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| RSP-001 | Required review widths: 1440, 1024, 768, 390, 320. | P0 | all | IN_PROGRESS | §82 |
| RSP-002 | Tablet is first class; mobile is recomposed, not shrunk. | P0 | all | IN_PROGRESS | §82 |
| RSP-003 | No critical desktop feature disappears on mobile because responsive work is difficult; recompose instead. | P0 | all | IN_PROGRESS | §82, §131 |
| RSP-004 | Mobile recompositions: Workflow → vertical step editor; CRM → stage view / local horizontal scroller; Academy → editorial reading; Call Room → mobile-first voice; Inbox → natural conversation flow; Skill Map → territory-first. | P1 | 12 | NOT_STARTED | §83 |
| RSP-005 | Preview deployments for substantial branches/PRs inspectable on a phone before merge. | P2 | 1 | PASSED | TA§76 |

## A11Y — Accessibility

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| A11Y-001 | Full keyboard operability of core flows. | P0 | 2 | PASSED | §84 |
| A11Y-002 | Visible focus states. | P0 | 2 | PASSED | §84 |
| A11Y-003 | Accessible labels on controls and inputs. | P0 | 2 | PASSED | §84 |
| A11Y-004 | Sufficient contrast, including text over holographic surfaces. | P0 | 2 | PASSED | §84 |
| A11Y-005 | Status never conveyed by colour alone. | P0 | 2 | PASSED | §84 |
| A11Y-006 | Drag interactions have non-drag alternatives. | P0 | 12 | NOT_STARTED | §84 |
| A11Y-007 | Touch targets ≈ 44 px. | P0 | 2 | PASSED | §84 |
| A11Y-008 | Mobile input font size ≥ 16 px. | P0 | 2 | PASSED | §84 |
| A11Y-009 | No critical information is hover-only. | P0 | 2 | PASSED | §84 |
| A11Y-010 | Automated accessibility checks in CI plus manual review of keyboard, focus flow, touch, reduced motion, holographic contrast, drag alternatives. | P1 | 26 | NOT_STARTED | TA§77 |

## SYNC — Cross-device Sync

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| SYNC-001 | Cross-device sync with no normal auth in v1. | P0 | 4 | NOT_STARTED | §88, §146 |
| SYNC-002 | Bloomlab Sync Key: ≥ 256 bits of cryptographically secure random data generated on the first device; friendly display encoding (e.g. `BLM-K8XR-3PVQ-…`). | P0 | 4 | NOT_STARTED | §88, TA§10 |
| SYNC-003 | Server stores only derived material `SHA-256(secret + server-side pepper)`; pepper lives only in a Worker secret; raw master secret is never stored in D1. | P0 | 4 | NOT_STARTED | §88, TA§11 |
| SYNC-004 | Device sessions: after key verification each device receives its own revocable session token; master key is not sent with every request. D1 stores device_id, learner_id, token_hash, created_at, last_seen_at, revoked_at, device_label. | P0 | 4 | NOT_STARTED | §89, TA§12 |
| SYNC-005 | Connected-devices list with Revoke. | P2 | 4 | NOT_STARTED | §89, TA§12 |
| SYNC-006 | Recovery: clear statement that losing all devices and the key means server recovery is impossible; offer copy key, download recovery file, QR, confirm-saved. Account creation never forced. | P1 | 4 | NOT_STARTED | §90, TA§13 |
| SYNC-007 | Only meaningful state syncs (not every drag coordinate); syncable entities carry id, learner_id, updated_at, revision, device_id, deleted_at. | P0 | 4 | NOT_STARTED | §91, TA§14 |
| SYNC-008 | Merge rules: append-only evidence merges; simple progress uses latest valid revision; complex simulator work uses explicit project snapshots. | P0 | 4 | NOT_STARTED | §91, TA§14 |
| SYNC-009 | No silent destructive conflict resolution; on conflicting complex edits show "Two versions were changed. Choose which version to keep." | P0 | 4 | NOT_STARTED | §91, §146 |
| SYNC-010 | Offline use with quiet reconnect sync; indicator "Saved on this device" → "Synced"; no modal interruption. | P0 | 4 | NOT_STARTED | §86, TA§8 |
| SYNC-011 | Sync verified across at least two browser/device contexts. | P0 | 4 | NOT_STARTED | PHASE 4 |
| SYNC-012 | Synchronisation logic covered by unit tests. | P1 | 4 | NOT_STARTED | §132 |

## DATA — Data and Persistence

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| DATA-001 | Local-first flow `UI → local state → IndexedDB → sync queue → server`; normal interaction never waits on the server. | P0 | 3 | NOT_STARTED | §86 |
| DATA-002 | IndexedDB via Dexie (or similarly small wrapper) for active application data; localStorage is never the main datastore; no custom IndexedDB ORM. | P0 | 3 | NOT_STARTED | §87, TA§7 |
| DATA-003 | Installable PWA caching app shell, stable curriculum and stable assets via service worker; API responses not cached blindly; progress lives in IndexedDB. | P1 | 3 | NOT_STARTED | §87, TA§9 |
| DATA-004 | Git = what Bloomlab teaches; D1 = what the learner has done. Static curriculum is not mirrored into D1. | P0 | 4 | NOT_STARTED | §92, TA§66 |
| DATA-005 | D1 domains: Identity (learners, devices, sync_sessions); Learning (skill_progress, skill_evidence, campaign_progress, exercise_attempts, review_queue, fieldwork); Simulation (sim_projects, sim_snapshots, sim_events, client_progress); Portfolio (portfolio_projects, portfolio_assets); AI (ai_usage, ai_feedback, rubric_runs); System (content_versions, sync_operations, feature_flags). | P0 | 4 | NOT_STARTED | §93, TA§65 |
| DATA-006 | R2 holds generated audio, voice assets, screenshots, portfolio media, fieldwork media, recovery backups, scenario attachments; D1 holds metadata; no huge binaries or giant JSON blobs in D1. | P1 | 20 | NOT_STARTED | §94, TA§15 |
| DATA-007 | Private learner assets are never public; access through Worker authorisation, short-lived signed access, or controlled routes. | P0 | 20 | NOT_STARTED | §94, TA§16 |
| DATA-008 | Export Bloomlab Data: versioned backup containing progress, evidence, projects, notes, simulator saves, portfolio metadata. | P1 | 23 | NOT_STARTED | §150, TA§80 |
| DATA-009 | Restore Backup validates version and schema, requires confirmation, never silently overwrites. | P2 | 26 | NOT_STARTED | §150, TA§81 |
| DATA-010 | Separate development and production D1 (`bloomlab-dev`, `bloomlab-prod`); migrations never tested against production first. | P0 | 4 | NOT_STARTED | §104, TA§61 |
| DATA-011 | Content update safety: completed historical attempts are never mutated when GHL features or content change. | P0 | 5 | NOT_STARTED | TA§82 |

## AI — Runtime AI

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| AI-001 | Minimal runtime AI. Preferred order: code → deterministic rules → authored branches → lightweight classifier → full LLM judgment. AI is the coach, not the course engine. | P0 | 19 | NOT_STARTED | §106 |
| AI-002 | AI setting: Off / Limited / Full; default Limited; core Bloomlab functions with AI Off. | P0 | 19 | NOT_STARTED | §107 |
| AI-003 | Budget ≈ $20/month with server-side cost tracking and governor; thresholds $0–12 normal, $12–16 prefer cheaper models, $16–19 important tasks only, $19+ optional AI blocked; configurable; never silently exceeded. | P0 | 19 | NOT_STARTED | §108, TA§37 |
| AI-004 | Usage log stores model, input tokens, cached input tokens, output tokens, estimated cost, request type, exercise, timestamp. | P0 | 19 | NOT_STARTED | §108, TA§37 |
| AI-005 | Model routing: no model for deterministic tasks; cheaper Claude model for classification, extraction, simple rubric checks; stronger model for open-ended sales critique, diagnosis, proposal review, negotiation, call evaluation, hard client reasoning. Most expensive model never default at runtime. | P0 | 19 | NOT_STARTED | §109, TA§36 |
| AI-006 | Schema-driven structured output (`score, rubric_results[], critical_issue, strengths[], improvements[], next_probe, confidence`), validated before acceptance; one repair-prompt retry; then save learner work and report evaluation failure. Never parse arbitrary prose. | P0 | 19 | NOT_STARTED | §110, TA§40 |
| AI-007 | AI cannot override objective deterministic failure (expected SMS 1, actual 2 → failed). | P0 | 19 | NOT_STARTED | §111, TA§34 |
| AI-008 | AI failure handling: save submission, preserve transcript and deterministic state, offer retry, allow other non-AI study. Never lose work. | P0 | 19 | NOT_STARTED | §112 |
| AI-009 | Claude is called only through the Worker (`browser → Worker → budget check → normalisation → Claude → schema validation → stored`). API key never reaches the browser. | P0 | 19 | NOT_STARTED | §105, TA§35 |
| AI-010 | Prompt caching for stable context (grading philosophy, rubrics, negotiation rules, client profile, skill criteria); the whole curriculum is never sent per call. | P1 | 19 | NOT_STARTED | TA§39 |
| AI-011 | Every AI rubric is versioned (e.g. `SALES_DISCOVERY_RUBRIC_V3`); old attempts stay bound to their original version. | P0 | 19 | NOT_STARTED | TA§42 |
| AI-012 | AI feedback storage: submission, rubric version, model, result, cost, timestamp; giant prompts not stored forever. | P1 | 19 | NOT_STARTED | TA§41 |
| AI-013 | Settings show "AI this month $x / $20" with breakdown (call feedback, written coaching, negotiation, diagnosis); cost not shown obsessively during learning. | P2 | 19 | NOT_STARTED | TA§38 |

## VOI — Voice

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| VOI-001 | ElevenLabs provides recurring fictional client voices. | P1 | 20 | NOT_STARTED | §113, TA§43 |
| VOI-002 | Pre-generated asset mode (preferred): greetings, objections, interruptions, voicemail, recurring lines, scripted scenario dialogue stored in R2. | P1 | 20 | NOT_STARTED | §114, TA§44 |
| VOI-003 | Dynamic TTS only where open-ended roleplay needs it (`scenario/Claude response → ElevenLabs → audio`); reusable generated lines cached. | P2 | 21 | NOT_STARTED | §115, TA§45 |
| VOI-004 | Voice character registry: client, voice ID, speech rate, style, stability, allowed emotion range, language; recurring characters keep consistent voices. | P1 | 20 | NOT_STARTED | §116, TA§46 |
| VOI-005 | While the ~128k expiring ElevenLabs credits remain, prioritise generating a reusable voice library; future functionality never depends on those credits. | P2 | 20 | NOT_STARTED | §113 |
| VOI-006 | Google Cloud Speech-to-Text V2, turn-based: record locally → upload via backend → transcribe → show transcript → evaluate → optionally delete raw audio. No live streaming in v1. | P1 | 21 | NOT_STARTED | §117, TA§47 |
| VOI-007 | TTS failure shows transcript/text fallback; transcription failure preserves the recording and allows retry. | P0 | 21 | NOT_STARTED | §149, TA§79 |

## INF — Infrastructure and Process

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| INF-001 | Locked stack: React + TypeScript + Vite; Cloudflare Workers + Static Assets (not Workers Sites); IndexedDB (Dexie); Cloudflare D1; Cloudflare R2; GitHub; Claude API behind Worker; ElevenLabs; Google Cloud Speech-to-Text V2. | P0 | 1 | PARTIAL | §85, TA§89 |
| INF-002 | Monorepo layout per §102: apps/web, worker, packages/{simulator-core, exercise-engine, mastery-engine, content-schema, design-system, shared}, content, migrations, tests, scripts, docs, public, plus root control docs. | P0 | 1 | PASSED | §102, TA§57 |
| INF-003 | Git workflow: `main` plus short-lived feature branches; focused conventional commits (`feat:`, `fix:`, `content:`, `design:` …); never "updates". | P0 | 0 | PASSED | §103, TA§58, TA§59 |
| INF-004 | Environments local / preview / production with separate dev and prod D1 and, where practical, R2. | P0 | 1 | PARTIAL | §104, TA§61 |
| INF-005 | GitHub Actions CI runs typecheck, lint, unit tests, simulator tests, content validation, build on PRs and main pushes; deploy only after checks pass. | P0 | 1 | PARTIAL | §134, TA§75 |
| INF-006 | No Durable Objects in v1 unless a concrete feature requires coordinated real-time server state. | P0 | all | NOT_STARTED | §95, TA§17 |
| INF-007 | No Cloudflare Queues in v1. | P0 | all | NOT_STARTED | §96, TA§18 |
| INF-008 | No Redis, Supabase, Firebase, separate Node server, Kubernetes, microservices, or vector database unless a real feature proves necessity. | P0 | all | NOT_STARTED | TA§85 |
| INF-009 | TypeScript everywhere; no untyped JavaScript for application logic. | P0 | 1 | PASSED | TA§2 |
| INF-010 | Simple feature flags (e.g. voice_calls, workflow_lab_v2, ai_negotiation, custom_objects, ghl_verification) so half-finished interfaces are not exposed. | P1 | 1 | PASSED | TA§72 |
| INF-011 | Error boundaries per major environment: Claude failure never breaks Workflow Lab, Call Room failure never breaks CRM, sync failure never destroys local state. No external service can destroy study progress. | P0 | 7 | NOT_STARTED | §149, TA§79 |
| INF-012 | Substantial work maps to a requirement ID or GitHub issue; commits reference the ID. | P2 | 1 | PASSED | TA§60 |
| INF-013 | Every release carries `app_version`, `content_version`, `simulator_version`; saved attempts record all three. | P0 | 5 | IN_PROGRESS | §101, TA§56 |
| INF-014 | Project-control documents maintained: REQUIREMENTS_MATRIX, IMPLEMENTATION_STATUS (§139 format), KNOWN_LIMITATIONS, CHANGELOG, ACCEPTANCE_TESTS, plus the Phase 0 spec package. | P0 | 0 | PASSED | §139, §140, §163 |
| INF-015 | Independent audit at major milestones (no coding) producing `AUDIT_REPORT.md` covering missing requirements, partial features, stubs, TODOs, fake data, responsive gaps, missing tests, stale GHL mapping, design violations, inaccessible interactions. | P1 | all | NOT_STARTED | §141 |
| INF-016 | Adversarial audit cases: offline mid-exercise, refresh mid-simulation, duplicate events, missing phone/email, cancelled appointment during wait, timezone change, AI timeout, AI budget exhausted, ElevenLabs failure, transcription failure, sync conflict, second device, extreme values, malformed scenario data. | P1 | 26 | NOT_STARTED | §142 |
| INF-017 | Client-side global search over skills, GHL features, lessons, glossary, clients, past exercises; no external search service. | P2 | 26 | NOT_STARTED | TA§71 |
| INF-018 | Analytics limited to learning events (exercise attempted/passed, skill demonstrated, hint used, critical failure, fieldwork completed, gate completed, AI request, session duration); no invasive product analytics. | P2 | 6 | NOT_STARTED | TA§67 |

## PERF — Performance

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| PERF-001 | Fast app shell; route-level code splitting; heavy simulators lazy-loaded; only likely next content preloaded; Workflow Lab does not load while reading Academy. | P0 | 7 | NOT_STARTED | §148, TA§78 |
| PERF-002 | Simulator interaction ≈ 60 fps where feasible using CSS transforms and composited layers. | P1 | 12 | NOT_STARTED | §148 |
| PERF-003 | Off-screen animations pause; holographic richness never harms usability. | P1 | 2 | PASSED | §148 |

## SEC — Security

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| SEC-001 | Secrets (ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, GOOGLE_CLOUD_CREDENTIAL, SYNC_KEY_PEPPER, future GHL credentials) live only in platform secret storage; never in the browser bundle, Vite client variables, commits, curriculum files, or D1. | P0 | all | NOT_STARTED | §105, §152, TA§62 |
| SEC-002 | Production data is never used casually for development. | P0 | all | NOT_STARTED | §152 |
| SEC-003 | Learner screenshots and fieldwork media are never published. | P0 | all | NOT_STARTED | §152 |
| SEC-004 | Raw sync secret is never stored server-side (see SYNC-003). | P0 | 4 | NOT_STARTED | §152 |
| SEC-005 | Private recordings are never silently sent to unrelated services. | P0 | 21 | NOT_STARTED | §152 |
| SEC-006 | Recording consent/privacy product-legal pass before any commercial launch. | P3 | — | DEFERRED | TA§49 |

## CNT — Content Architecture

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| CNT-001 | Curriculum is never hardcoded inside JSX. | P0 | 5 | NOT_STARTED | §98, TA§52 |
| CNT-002 | `content/` tree: skills, ghl-features, campaigns, learning-units, exercises, scenarios, clients, rubrics, projects, portfolio, glossary. | P0 | 5 | NOT_STARTED | §98, TA§53 |
| CNT-003 | YAML for structured definitions; Markdown/MDX for learning prose and interactive embeds. | P0 | 5 | NOT_STARTED | §98 |
| CNT-004 | Zod (or equivalent) schemas for every content type: SkillSchema, ExerciseSchema, ScenarioSchema, ClientSchema, GHLFeatureSchema, RubricSchema, CampaignSchema, LearningUnitSchema, ProjectSchema, GlossarySchema. | P0 | 5 | NOT_STARTED | §99, TA§54 |
| CNT-005 | Validation enforces unique IDs and valid prerequisites, skill refs, GHL feature refs, client refs, scenario refs, campaign refs, exercise refs. Build fails on any broken reference. | P0 | 5 | NOT_STARTED | §99 |
| CNT-006 | Build-time compilation `source → validate → resolve → compile → optimized bundle`; the giant content folder is never parsed at runtime. | P0 | 5 | NOT_STARTED | §100, TA§55 |
| CNT-007 | Content version recorded on every release; attempts preserve version metadata so old evidence stays historically valid. | P0 | 5 | NOT_STARTED | §101 |
| CNT-008 | Client schema: id, business_name, industry, locations, team, offers, lead_sources, current_systems, metrics, problems, relationship_state, assets, hidden_facts, voice, history. | P0 | 5 | NOT_STARTED | §38 |
| CNT-009 | Persistent fictional clients with persistent state across the §37 industries (med spa, coach, consultant, therapist, photographer, realtor, gym, pet service, HVAC, roofing, cleaning, remodeling, dentist, chiropractor, law firm, accounting, recruiting, course creator, wedding vendor, B2B service). | P1 | 24 | NOT_STARTED | §37 |
| CNT-010 | Glossary content type and search integration. | P2 | 24 | NOT_STARTED | §98, TA§71 |
| CNT-011 | Content tests run in CI (all IDs valid, no missing prerequisites, no unknown GHL features). | P0 | 5 | NOT_STARTED | TA§73 |

## GHL — GoHighLevel Accuracy

| ID | Requirement | Priority | Phase | Status | Spec |
|---|---|---|---|---|---|
| GHL-001 | Capability registry at `content/ghl-features/` with required fields id, official_name, area, feature_type, implementation_type, status, simulation_fidelity, last_verified, source_url, known_limitations, skills (plus supported_configs). | P0 | 5 | NOT_STARTED | §25, TA§29 |
| GHL-002 | `implementation_type` ∈ native_ghl, integration, custom_code, external_service. | P0 | 5 | NOT_STARTED | §25 |
| GHL-003 | `status` ∈ current, needs_review, deprecated, removed. | P0 | 5 | NOT_STARTED | §25 |
| GHL-004 | `simulation_fidelity` ∈ A, B, C, REAL_GHL; approximations clearly labelled; fictional native functionality never taught. | P0 | 5 | NOT_STARTED | §26, TA§30 |
| GHL-005 | No supposed native GHL feature is ever exposed in Bloomlab without a registry entry. | P0 | all | NOT_STARTED | §25 |
| GHL-006 | Trigger, action and product names verified against official current GHL documentation before entering the registry; obsolete API patterns never taught as current; old YouTube tutorials never blindly reproduced. | P0 | 5 | NOT_STARTED | §16, §23, §151 |
| GHL-007 | GHL coverage matrix generated: GHL Feature × Skill / Simulator / Fidelity / Exercise / Fieldwork / Last Verified. | P1 | 5 | NOT_STARTED | §138 |
| GHL-008 | Freshness: features not verified recently are flagged; a maintenance script generates a review list. | P2 | 26 | NOT_STARTED | TA§83 |
| GHL-009 | Simulator approximations and mismatches with real GHL recorded honestly in KNOWN_LIMITATIONS.md. | P0 | all | NOT_STARTED | §140 |
| GHL-010 | Exact real GHL terminology used in UI wherever a real feature is represented. | P0 | all | NOT_STARTED | §44, §51 |
