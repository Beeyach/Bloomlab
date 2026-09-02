# PRODUCT VISION

Working product specification derived from `BLOOMLAB_MASTER_SPEC.md` §1–§13, §123–§124, §158–§162, §167–§170. The master spec is authoritative; this file restates it for daily use and links to requirement IDs.

## 1. What Bloomlab is

Bloomlab is a premium, interactive, mastery-based web application that trains one learner to become highly competent at funnel strategy, GoHighLevel implementation, conversion thinking, marketing, prospecting, sales, pricing, negotiation, client delivery, and increasingly advanced technical GHL work.

It is a **learning simulator**. It is not:

- a prototype
- an LMS mockup
- a dashboard with placeholder cards
- a course website
- a GHL course (see §5 of the master spec)

Name: **Bloomlab**. Use this spelling everywhere.

## 2. Primary user (PRD-001, PRD-006)

Bloomlab is initially for one learner, Ary, who already has:

- basic familiarity with GHL
- basic workflow knowledge
- basic website building knowledge
- basic funnel knowledge
- lead-capture funnel experience

The learner is never treated as someone who has never seen GHL. A placement assessment (Gate 0) discovers what can be skipped.

## 3. Core outcome (PRD-005)

The learner should be able to hear a business problem such as:

> "We get leads from Meta ads, people fill out the form, half never book, reception forgets to follow up, and booked consultations keep no-showing."

and independently reason:

- what is happening
- what information is missing
- where the likely bottleneck is
- what should be built
- what should not be built
- which GHL features apply
- how to structure the CRM
- how to structure workflows
- how to test the system
- how to explain the system
- how to price the work
- how to pitch it
- how to negotiate
- how to scope it
- how to deliver it
- how to measure whether it helped

The learner should increasingly reach "Yeah, I know how to do that." without needing AI to tell them every step.

## 4. Four identities (PRD-010)

The learner is becoming four things at once:

| Identity | Capability |
|---|---|
| Funnel Strategist | Understands customer paths, offers, conversion, friction, qualification, follow-up, metrics, funnel architecture. |
| GHL Systems Builder | Implements and troubleshoots increasingly difficult GoHighLevel systems. |
| Conversion and Sales Operator | Prospects, audits, communicates, discovers, pitches, prices, negotiates, closes, retains. |
| Technical GHL Specialist | Eventually comfortable with APIs, webhooks, custom code, integrations, data modeling, snapshots, AI agents, platform extension. Comes later. |

The learner should be able to start earning before completing all four.

## 5. Learning philosophy (PRD-011)

**SEE → UNDERSTAND → FIX → BUILD → EXPLAIN → SELL → REBUILD WITHOUT HELP**

The curriculum is not dominated by passive lessons. Most time is spent building, diagnosing, predicting, troubleshooting, explaining, writing, speaking, pricing, negotiating, making decisions.

Rough long-term ratio: 20% instruction · 60% practical work · 20% retrieval, explanation, selling, review. Advanced levels become even more practical.

## 6. Progression rules

### Fully asynchronous (PRD-002) — hard requirement

There are no calendar locks. The learner may study 30 minutes, 1 hour, 3 hours, 5 hours or longer and continue immediately if required competency gates are passed. Never show "Come back tomorrow." Never require waiting until a specific date.

### 30-Day Field Ready is a pace, not a schedule (PRD-007)

Expected availability ≈ 3–5 hours/day; suggested total ≈ 90–120 hours. Faster and slower are both fine. Progress is based on mastery gates.

Display: **FIELD READY CAMPAIGN — "Suggested pace: ~30 days at 3–5 hours/day"**, never "Day 7 locked until tomorrow".

### Field Ready does not mean expert (PRD-008)

Passing Field Ready means the learner is:

- capable of diagnosing common Bloomwired-sized problems
- capable of implementing core systems
- capable of troubleshooting common failures
- capable of speaking with prospects
- capable of writing sales communication
- capable of scoping and pricing common work
- capable of negotiating basic objections
- capable of completing selected work in real GHL
- aware of when something exceeds current competency

It does not claim full expert status.

### Mastery-gated (PRD-003)

Advancement depends on evidence across mastery states (see `EXERCISE_ENGINE.md`). Quizzes alone never award mastery.

## 7. Campaigns and gates (CUR-001, CUR-002)

Campaigns are curated paths through one master skill graph; skills are never duplicated inside campaigns. `FIELD_READY` references skill IDs; `ADVANCED_AUTOMATION` references some of the same IDs plus harder ones. The Field Ready gates (0 Placement … 12 Capstone) and all territory curricula are defined in `CURRICULUM_MASTER_MAP.md`.

## 8. Long-term direction (PRD-001, PRD-009)

Bloomlab may become commercial later. Do not build commercial infrastructure now. Architecture should avoid dead ends that would require rewriting the learning engine. Personal learning quality is more important than future monetisation.

Do not build unless explicitly requested later: billing, subscription management, instructor dashboards, student management, teams, public profiles, marketplace, classroom management, social feed.

## 9. Bloomwired application (PRD-017, PRD-018)

Training continually applies to Bloomwired. Teach and refine: ICP, offer structure, positioning, pricing, audits, outreach, discovery, proposals, portfolio, client experience, reusable systems, care plans, recurring support. Do not teach generic agency-guru scripts as doctrine.

Scenarios are biased toward Bloomwired prospect industries — coaches, consultants, therapists, med spas, photographers, realtors, fitness, pet businesses, home services, wedding vendors, local services — plus additional industries to build transfer.

## 10. Product voice

### App copy (PRD-012)

Short, smart, direct, professional, occasionally playful.

- Run it.
- Something broke. Find out why.
- No hints this time.
- What would you build?
- Maria received two reminders. She should have received one.
- Deal lost. Good decision.

Avoid "Amazing job, superstar!" and childish gamification.

### Progress language (PRD-013)

Prefer "47 capabilities demonstrated" over "12,450 XP". Use Passed · Needs another run · Demonstrated · Independent · Mastered · Field Ready. No star ratings.

### Rewards (PRD-014)

New capabilities, new simulator tools, new clients, new scenarios, Playground features, portfolio projects, skill mastery, new territory access. Not meaningless points.

## 11. Signature moments (PRD-015) and sound (PRD-016)

Polish heavily: Holo Skill Interaction (pointer/touch physical response), First Workflow Execution (watch the contact travel through the system), Client Case Reveal (new Boss Client opens like a premium collectible case), Failed Test (reveal exactly where the observable result diverged), Independent Pass (recognise no assistance was used), Field Ready (restrained cinematic achievement).

Sound is optional and subtle — snap, connect, execution, selection, completion — always mutable, never constant.

## 12. Final release standard (§167)

Bloomlab v1 may be called **Field-Ready Complete** only when: all P0 requirements pass; Field Ready P1 requirements pass; content validation passes; simulator regression passes; sync passes; AI fallback passes; responsive review passes; accessibility core flows pass; the GHL Field Ready registry is current; the placement-to-capstone path can be completed; real-GHL fieldwork can be recorded; design review passes; no major core interface is a stub.

## 13. Ultimate product test (§168)

Not "Does Bloomlab look impressive?", "Does the code compile?", or "Are there many lessons?". The real test:

> Can Ary enter Bloomlab with basic funnel/GHL experience and gradually become capable of independently diagnosing, architecting, building, troubleshooting, explaining, pricing, pitching, negotiating, and delivering real funnel and GoHighLevel systems?

If that result is not happening, change the product.

## 14. Final product principles (§169)

Bloomlab must be: beautiful enough to want to open · interactive enough to teach through action · accurate enough that GHL practice transfers · difficult enough to create real competency · forgiving enough to encourage experimentation · cheap enough to run personally · independent enough that AI outages do not cripple it · structured enough that curriculum can grow · versioned enough to survive GHL changes · professional enough to become commercial later · fun enough that 3–5 hour sessions do not feel like an LMS.

## 15. Final directive (§170)

Build Bloomlab as a real learning simulator. Do not simplify it into a course website. Do not bury it in generic dashboard UI. Do not make AI the brain of deterministic systems. Do not fake GoHighLevel functionality. Do not call shallow exposure mastery. Do not lock progress to dates. Do not remove difficult interactions on mobile. Do not treat pricing, sales, negotiation, marketing and client delivery as side modules. Do not let the visual experience become generic. The learner is training to become a capable professional who can earn money from these skills. Every major product decision should support that.
