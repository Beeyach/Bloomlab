BLOOMLAB . ULTIMATE MASTER BUILD SPECIFICATION

You are building Bloomlab, a premium, interactive, mastery-based web application that trains one learner to become highly competent at funnel strategy, GoHighLevel implementation, conversion thinking, marketing, prospecting, sales, pricing, negotiation, client delivery, and increasingly advanced technical GHL work.

This is not a prototype brief.

This is not a request for an LMS mockup.

This is not a request for a dashboard with placeholder cards.

This specification is authoritative.

Build the actual application progressively from this specification.

---

0. OPERATING RULE

Before changing code:

1. Read this specification.
2. Read "CLAUDE.md".
3. Read relevant product specification files.
4. Read active requirement IDs.
5. Inspect the existing implementation.
6. Inspect related tests.
7. Preserve working functionality.

After changing code:

1. Run type checking.
2. Run relevant unit tests.
3. Run simulator regression tests.
4. Run content validation.
5. Build the app.
6. Inspect affected responsive widths.
7. Compare against acceptance criteria.
8. Update requirement statuses.
9. Update "IMPLEMENTATION_STATUS.md".
10. Report anything incomplete plainly.

Never silently weaken a requirement because implementation is difficult.

If a requirement cannot currently be completed, mark it:

"PARTIAL"

or:

"BLOCKED"

and explain why.

Do not call a phase complete until its required acceptance criteria pass.

---

1. PRODUCT

Name

Bloomlab

Use this spelling everywhere.

---

2. PRIMARY USER

Bloomlab is initially for one learner, Ary.

The learner currently has:

- basic familiarity with GHL
- basic workflow knowledge
- basic website building knowledge
- basic funnel knowledge
- lead-capture funnel experience

Do not treat the learner as someone who has never seen GHL.

Use a placement assessment to discover what can be skipped.

---

3. LONG-TERM PRODUCT DIRECTION

Bloomlab may become commercial later.

Do not build commercial infrastructure now.

Architecture should avoid obvious dead ends that would require rewriting the entire learning engine later.

Personal learning quality is more important than future monetization.

Do not build:

- billing
- subscription management
- instructor dashboards
- student management
- teams
- public profiles
- marketplace
- classroom management
- social feed

unless explicitly requested later.

---

4. CORE OUTCOME

Bloomlab exists to create this outcome:

The learner should be able to hear a business problem such as:

«“We get leads from Meta ads, people fill out the form, half never book, reception forgets to follow up, and booked consultations keep no-showing.”»

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

The learner should increasingly reach:

«“Yeah, I know how to do that.”»

without needing AI to tell them every step.

---

5. BLOOMLAB IS NOT JUST A GHL COURSE

The learner is becoming four things at once:

Funnel Strategist

Understands customer paths, offers, conversion, friction, qualification, follow-up, metrics, and funnel architecture.

GHL Systems Builder

Can implement and troubleshoot increasingly difficult GoHighLevel systems.

Conversion and Sales Operator

Can prospect, audit, communicate, discover, pitch, price, negotiate, close, and retain.

Technical GHL Specialist

Eventually becomes comfortable with APIs, webhooks, custom code, integrations, data modeling, snapshots, AI agents, and platform extension.

The fourth level comes later.

The learner should be able to start earning before completing it.

---

6. LEARNING PHILOSOPHY

Bloomlab is based on:

SEE → UNDERSTAND → FIX → BUILD → EXPLAIN → SELL → REBUILD WITHOUT HELP

Do not build a curriculum dominated by passive lessons.

The learner should spend most time:

- building
- diagnosing
- predicting
- troubleshooting
- explaining
- writing
- speaking
- pricing
- negotiating
- making decisions

A rough long-term ratio is:

20% instruction

60% practical work

20% retrieval, explanation, selling, review

Advanced levels should become even more practical.

---

7. PROGRESSION IS FULLY ASYNCHRONOUS

This is a hard requirement.

There are no calendar locks.

The learner may study:

- 30 minutes
- 1 hour
- 3 hours
- 5 hours
- longer

and continue immediately if required competency gates are passed.

Never show:

«Come back tomorrow.»

Never require waiting until a specific date to continue curriculum.

---

8. 30-DAY FIELD READY

“30-Day Field Ready” is a suggested pace, not a literal schedule.

Expected learner availability:

approximately 3–5 hours per day

Suggested total:

roughly 90–120 hours

A learner can finish faster.

A learner can take longer.

Progress is based on mastery gates.

Display wording should be more like:

FIELD READY CAMPAIGN

"Suggested pace: ~30 days at 3–5 hours/day"

not:

"Day 7 locked until tomorrow"

---

9. FIELD READY DOES NOT MEAN EXPERT

Passing Field Ready means:

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

---

10. CAMPAIGN MODEL

Campaigns are curated paths through one master skill graph.

Do not duplicate skills inside campaigns.

Example:

"FIELD_READY"

references skill IDs.

"ADVANCED_AUTOMATION"

references some of the same skill IDs plus harder ones.

---

11. FIELD READY GATES

Use competency stages instead of days.

Gate 0 . Placement

Assess:

- funnel reasoning
- lead capture
- workflow basics
- fields vs values
- pipeline basics
- basic pricing
- written prospect response
- short spoken discovery interaction

Allow strong demonstrated basics to clear early requirements.

---

Gate 1 . Funnel Thinking

Train:

- customer journey
- funnel purpose
- traffic intent
- offers
- friction
- CTA
- conversion
- funnel math
- bottleneck thinking

---

Gate 2 . Lead Systems

Train:

- lead capture
- forms
- confirmation
- follow-up
- CRM capture
- pipeline
- next action

---

Gate 3 . GHL Data Foundations

Train:

- contacts
- tags
- custom fields
- custom values
- opportunities
- pipelines
- assignments
- correct architecture decisions

---

Gate 4 . Workflow Foundations

Train:

- triggers
- filters
- actions
- waits
- If/Else
- re-entry
- timing
- communications
- pipeline automation

---

Gate 5 . Booking and Qualification

Train:

- forms
- surveys
- qualification
- calendars
- routing
- reminders
- cancellations
- reschedules
- no-shows

---

Gate 6 . Conversion and Copy

Train:

- page hierarchy
- message match
- CTA placement
- conversion copy
- proof
- qualification friction
- mobile conversion design

---

Gate 7 . Diagnosis and QA

Train:

- workflow troubleshooting
- funnel troubleshooting
- logs
- edge cases
- metrics
- pre-launch QA
- bottleneck diagnosis

---

Gate 8 . Prospecting and Audits

Train:

- ICP
- prospect selection
- evidence
- research
- outreach
- cold email
- follow-up
- audit quality

---

Gate 9 . Discovery and Selling

Train:

- cold calls
- discovery
- Zoom-style calls
- listening
- questions
- diagnosis
- explaining systems
- pitching outcomes

---

Gate 10 . Pricing and Negotiation

Train:

- scope
- fixed pricing
- recurring pricing
- deposits
- revisions
- exclusions
- risk
- negotiation
- reducing scope
- walking away

---

Gate 11 . Proposal and Delivery

Train:

- proposal
- acceptance
- onboarding
- dependencies
- build order
- client updates
- QA
- handoff

---

Gate 12 . Field Ready Capstone

No instructional handholding.

The learner completes:

"diagnose → design → price → negotiate → propose → build → test → explain"

with part of implementation performed in real GHL.

---

12. MASTER CURRICULUM TERRITORIES

The permanent skill map contains:

STRATEGIZE

Funnels, business logic, offers, conversion, funnel economics.

BUILD

Pages, funnels, forms, surveys, calendars, payments.

AUTOMATE

Workflows, communication, timing, logic, lifecycle automation.

ARCHITECT

CRM, custom fields, custom values, opportunities, pipelines, companies, custom objects.

DIAGNOSE

QA, troubleshooting, metrics, attribution, deliverability, experimentation.

CONNECT

DNS, HTTP, JSON, webhooks, APIs, GitHub, Cloudflare, Google Cloud, technical implementation.

SELL

Prospecting, audits, discovery, calls, pitching, pricing, negotiation, closing.

DELIVER

Proposal, onboarding, project planning, communication, handoff, reporting, retention.

SCALE

Snapshots, reusable vertical systems, agency architecture, SaaS concepts, Marketplace.

JUDGMENT

Judgment sits centrally and is measured across all territories.

---

13. JUDGMENT COMPETENCIES

Measure whether the learner can decide:

- whether a funnel is needed at all
- whether automation is appropriate
- whether GHL is appropriate
- whether a tag or field is appropriate
- whether custom code is warranted
- whether a prospect should be contacted
- whether evidence supports an audit claim
- whether a project should be accepted
- whether scope is realistic
- whether price is realistic
- whether complexity is justified
- whether the learner should admit not knowing
- what could break
- what information is missing

Reward:

«“I don’t know yet, but this is how I would verify it.”»

over fabricated confidence.

---

14. STRATEGIZE CURRICULUM

Teach progressively:

Field Ready

- customer path
- awareness
- intent
- traffic source
- offer
- CTA
- friction
- trust
- qualification
- conversion points
- funnel math
- CPL
- booking rate
- show rate
- close rate
- CAC basics
- AOV
- LTV basics
- bottleneck reasoning

Core funnel families:

- lead capture
- lead magnet
- consultation
- appointment
- quote request
- application
- assessment
- VSL-to-call
- content-to-booking
- service inquiry
- reactivation

Practitioner

- webinar
- evergreen webinar
- challenge
- workshop
- direct purchase
- checkout
- order bump
- upsell
- downsell
- subscription
- trial
- membership
- course enrollment

Advanced

- multi-funnel architecture
- lifecycle strategy
- retention
- referral
- churn prevention
- experimentation
- advanced diagnosis

Specialist

- complete business-system architecture

---

15. BUILD CURRICULUM

Teach:

Conversion Layout

- hierarchy
- first screen
- headline
- CTA placement
- proof
- objection handling
- FAQ
- forms
- mobile composition
- thank-you flow

Copy

- customer language
- desired outcome
- pain
- mechanism
- benefit
- headline
- subhead
- CTA
- form microcopy
- reminder copy
- sales copy
- nurture copy
- reactivation

The learner should increasingly write without automatically using AI.

GHL Funnel Builder

Teach current real features.

GHL Websites

Teach:

- pages
- navigation
- domains
- responsive behavior
- reusable/global elements
- tracking
- SEO basics
- scripts
- QA

Forms

Teach:

- field mapping
- required fields
- validation
- hidden data
- consent
- confirmation
- workflow triggering

Surveys

Teach:

- applications
- multi-step qualification
- conditional logic
- scoring
- routing
- disqualification

Calendars

Teach:

- availability
- appointment duration
- buffers
- notice
- timezone
- cancellation
- reschedule
- team scheduling
- round robin
- service calendars
- classes
- resources
- locations
- complex scheduling later

Payments

Teach progressively:

- products
- prices
- one-time payments
- recurring payments
- checkout
- payment links
- order forms
- invoices
- estimates
- contracts
- deposits
- failed payment
- refund
- coupons
- taxes
- more advanced revenue flows later

---

16. AUTOMATE CURRICULUM

This is one of Bloomlab’s largest areas.

Teach actual GHL concepts.

Foundations

- event
- trigger
- filters
- actions
- state
- enrollment
- execution
- exit

Core Triggers

Only use real current GHL trigger names or clearly marked training approximations.

Examples may include current features such as:

- form submission
- survey submission
- appointment events
- contact changes
- tag events
- opportunity changes
- pipeline stage events
- inbound communication
- payment/order events

Verify actual current names in official GHL documentation before adding them to the registry.

Core Actions

Examples:

- Send SMS
- Send Email
- Add Tag
- Remove Tag
- update data
- create/update opportunity
- assign user
- internal notification
- Wait
- If/Else
- webhook
- workflow enrollment/removal

Again, verify actual current GHL naming.

Wait Logic

Teach:

- fixed delay
- appointment-relative wait
- time/date
- business hours
- event waiting
- timezone
- late enrollment

Branching

Teach:

- If/Else
- AND/OR
- comparisons
- dynamic values
- fallback
- multiple paths

Re-entry

Teach:

- duplicate enrollment
- repeated triggers
- overlapping workflows
- duplicate messages
- exits
- race conditions later

Common Systems

Teach:

- immediate lead response
- nurture
- booking reminders
- cancellation
- reschedule
- no-show recovery
- pipeline movement
- internal alerts
- assignment

Advanced

Teach:

- modular automation
- naming
- workflow responsibility
- date logic
- webhooks
- data manipulation
- ecommerce automation
- reliability
- idempotency concepts
- race conditions
- large automation architecture
- custom workflow extensions later

---

17. ARCHITECT CURRICULUM

Teach:

Contacts

- identity
- source
- contact activity
- owner
- notes
- tasks
- DND

Tags

Teach correct and incorrect use.

Custom Fields

Teach:

- data types
- contact fields
- opportunity fields
- forms
- workflows
- reporting impact

Custom Values

This is a major competency.

Teach:

- reusable account values
- merge variables
- configuration portability
- snapshot-friendly design
- when not to use custom values

Pipelines

Teach:

- stage design
- status
- value
- owner
- meaningful sales process representation

Opportunities

Teach:

- create/update
- multiple opportunities
- stage movement
- value
- fields
- ownership

Smart Lists

Teach segmentation.

Companies

Teach B2B use.

Custom Objects

Advanced.

Teach:

- schemas
- records
- associations
- workflows
- limitations
- when custom objects are excessive

Data Modeling

Give realistic problems.

Example:

«Veterinary clinic has customers, pets, appointments, and treatment plans.»

The learner decides what each thing should be.

---

18. DIAGNOSE CURRICULUM

Teach:

QA

Build a Bloomwired QA protocol covering:

- pages
- forms
- links
- validation
- field mapping
- workflow entry
- workflow exit
- SMS
- email
- calendar
- cancellation
- rescheduling
- pipeline
- payments
- tracking
- desktop
- tablet
- mobile
- edge cases

Workflow Troubleshooting

Teach:

- execution logs
- waiting
- skipped actions
- filters
- duplicate enrollment
- missing data
- incorrect branch
- failed actions

Funnel Troubleshooting

Teach:

- broken links
- forms
- domains
- routing
- tracking
- responsive issues

Deliverability

Teach:

- sending domains
- authentication concepts
- reputation
- warming
- bounce
- spam
- hygiene
- opt-out

SMS/Phone Reliability

Teach:

- numbers
- DND
- failed sends
- carrier issues
- routing
- compliance concepts

Analytics

Teach:

- visitor → lead
- lead → booked
- booked → show
- show → sale
- stage conversion
- close rate
- revenue
- source
- UTM
- attribution
- dashboard reasoning

Experimentation

Teach:

- baseline
- hypothesis
- change
- measurement
- confounding
- weak evidence

---

19. CONNECT CURRICULUM

This eventually creates technical independence.

Teach enough to make integrations understandable.

DNS

- domains
- subdomains
- DNS records
- SSL
- Cloudflare concepts

JSON

Read and modify structured payloads.

HTTP

- GET
- POST
- PATCH
- DELETE
- headers
- body
- response codes

Webhooks

- inbound
- outbound
- payloads
- authentication
- mapping
- errors

APIs

- endpoint
- resource
- authorization
- scopes
- pagination
- rate limits
- errors
- retries

Teach current GHL API practices.

Do not teach obsolete API patterns as current.

Git and GitHub

Teach:

- repo
- commits
- branches
- rollback
- issues
- releases
- secrets

Cloudflare

Advanced practical integrations:

- Workers
- endpoints
- transformations
- webhook receivers

Google Cloud

Use where useful.

JavaScript

Teach specifically for GHL/operator work:

- payload transformation
- simple logic
- browser debugging
- custom page behavior
- serverless functions

Marketplace/App Extension

Specialist track only.

---

20. SELL CURRICULUM

This is a large territory.

ICP

Teach:

- fit
- economics
- recurring need
- technical fit
- access to decision maker

Research

Understand:

- traffic
- lead capture
- booking
- follow-up
- sales
- retention

Evidence-Based Audit

Every finding is classified:

VERIFIED

Directly observed.

LIKELY

Evidence suggests it.

UNKNOWN

Needs confirmation.

Penalize unsupported claims.

Prospect Qualification

Some prospects should be skipped.

Cold Email

Train:

- opener
- evidence
- relevance
- problem
- CTA
- follow-up

Social Outreach

Train where useful.

Cold Calls

Train speaking.

Discovery

Teach:

- opening
- agenda
- current process
- desired result
- pain
- volume
- impact
- urgency
- tools
- staff
- stakeholders
- budget
- decision process
- next step

Listening

Penalize excessive talking and premature pitching.

Technical Discovery

Teach relevant systems questions.

Presentation

Train:

"problem → consequence → system → outcome"

Client Language

Teach explanation without unnecessary GHL jargon.

Pricing

Teach:

- fixed
- hourly
- project
- setup
- recurring
- retainer
- margin
- complexity
- risk
- minimum viable project pricing

Scope

Teach:

- deliverables
- assumptions
- exclusions
- revisions
- dependencies
- location count
- workflow complexity
- migration
- integration
- rush work
- copy
- design
- support

Negotiation

Train:

- budget objection
- competitor price
- discount request
- scope reduction
- phased project
- payment terms
- deposit
- concessions
- silence
- walking away

A lost deal can receive a high score.

Closing

Train:

- asking for commitment
- proposal follow-up
- ghosting
- decision delay
- next-step control

---

21. DELIVER CURRICULUM

Teach:

Proposal

- problem
- recommendation
- scope
- price
- timeline
- assumptions
- exclusions
- acceptance

Change Requests

Teach scope control.

Onboarding

Teach:

- access
- credentials
- domains
- calendars
- users
- branding
- copy
- payment
- expectations

Build Order

Teach dependencies.

A common example:

"data → pipeline → calendar → forms → workflows → funnel → tracking → QA"

not random building.

Client Communication

Train:

- update
- blocker
- delay
- approval
- revision
- technical explanation

Handoff

Teach:

- documentation
- training
- ownership
- support

Retention

Teach later:

- reporting
- maintenance
- retainer
- expansion
- referral
- account strategy

---

22. SCALE CURRICULUM

Later-stage territory.

Teach:

Templates

Naming standards

Deployment checklist

Snapshots

Teach:

- what belongs in a snapshot
- reusable values
- fields
- workflows
- funnels
- calendars
- forms
- portability
- client-specific cleanup
- QA
- versioning

Potential Bloomwired assets:

- Bloomwired Med Spa Core
- Bloomwired Coach Lead Path
- Bloomwired Home Services Follow-Up
- Bloomwired Photographer Inquiry System

Vertical Systems

Teach productization.

Agency Architecture

Teach:

- subaccounts
- permissions
- usage concepts
- account structure

SaaS concepts

Specialist only.

White label

Specialist only.

Marketplace

Specialist only.

---

23. GHL AI CURRICULUM

AI should not be taught before the learner understands the deterministic system underneath.

Teach later:

- when a normal workflow is better than AI
- Conversation AI
- Voice AI
- workflow AI actions
- current GHL agent products
- knowledge bases
- tools
- shared skills/capabilities
- MCP/external tools where current
- escalation
- permissions
- hallucination risk
- cost
- logs
- irreversible actions

Verify current product names from official GHL sources before publishing lessons.

GHL changes frequently.

---

24. SUPPORTING GHL SPECIALTIES

Include in the full graph:

- reputation
- review requests
- Social Planner
- courses
- memberships
- communities
- client portal
- affiliate management
- ecommerce
- blogs
- SEO tools
- IVR/phone
- prospecting tool
- ad reporting
- rentals
- services
- resources
- contracts
- estimates
- invoices
- payment links
- subscriptions
- advanced reporting

Not everything belongs in Field Ready.

---

25. GHL CAPABILITY REGISTRY

Create:

"content/ghl-features/"

Every simulated or taught feature must have a registry record.

Required fields:

id:
official_name:
area:
feature_type:
implementation_type:
status:
simulation_fidelity:
last_verified:
source_url:
known_limitations:
skills:

"implementation_type":

- native_ghl
- integration
- custom_code
- external_service

"status":

- current
- needs_review
- deprecated
- removed

"simulation_fidelity":

- A
- B
- C
- REAL_GHL

Never expose a supposed native GHL feature in Bloomlab without a registry entry.

---

26. GHL FIDELITY

Fidelity A

Bloomlab closely reproduces the relevant behavior.

Examples:

- fields
- tags
- pipeline state
- simple workflow logic

Fidelity B

Training-equivalent behavior with simplified internals.

Fidelity C

Conceptual demonstration.

REAL_GHL

Do not simulate.

Learner practices inside actual GHL.

Clearly label approximations.

Never teach fictional native functionality.

---

27. EXERCISE ENGINE

Bloomlab must support these exercise families.

---

BUILD IT

Give an objective.

Learner constructs the solution.

Example:

«Build a no-show recovery workflow.»

Use actual real GHL concepts.

Grading is deterministic where possible.

---

FIX IT

Give a broken system.

Learner diagnoses and repairs it.

Do not immediately reveal the faulty node.

Show symptoms.

Example:

«Maria received two reminder messages. Expected one.»

---

RUN THE LEAD

Show a contact and workflow.

Learner predicts execution.

Then animate actual execution.

---

EDGE CASE

Change one important variable.

Examples:

- appointment booked late
- canceled
- missing phone
- different timezone
- second location
- duplicate entry

Ask whether the system still works.

---

WHAT WOULD YOU BUILD?

Give a business problem without telling the learner which GHL feature is being tested.

Learner designs the system.

Allow multiple valid architectures.

Use AI only when needed for open-ended reasoning.

---

ARCHITECTURE DECISION

Teach decisions such as:

"tag vs custom field vs custom value vs opportunity field vs custom object"

Later remove multiple-choice support.

---

FUNNEL AUTOPSY

Give a simulated page plus data.

Allow inspection of:

- traffic source
- conversion rate
- scroll behavior
- form completion
- booking rate
- drop-off

Require distinction between:

problem

and:

hypothesis

---

FUNNEL ASSEMBLY

Give blocks or blank architecture.

Learner creates page/funnel information structure.

Do not force one universal order where multiple solutions are valid.

---

PROSPECT IT

Give multiple fake businesses.

Learner decides:

- Contact
- Maybe
- Skip

Require reasoning.

---

AUDIT IT

Force findings into:

- Verified
- Likely
- Unknown

---

WRITE IT

Train:

- cold email
- follow-up
- interested reply
- discovery recap
- proposal explanation
- client update
- scope response
- payment reminder
- upsell
- breakup email

Use AI rubric where needed.

---

SAY IT

Voice practice.

Modes:

- cold call
- discovery
- proposal presentation
- negotiation
- client explanation

---

PRICE IT

Give project scope.

Learner chooses:

- project price
- deposit
- recurring
- rush fee
- timeline
- revisions
- inclusions
- exclusions

Reveal hidden economics and risk after submission.

---

NEGOTIATE IT

Client pushes back.

Allow:

- clarify
- hold price
- reduce scope
- phase
- concession
- walk away

Winning is not the only successful result.

---

EXPLAIN IT

Require technical explanation for different audiences.

Examples:

- business owner
- another GHL builder

---

REBUILD BLIND

No lesson.

No step-by-step support.

Hints reduce independence evidence.

---

FIELDWORK

Learner performs real work in GHL.

Bloomlab collects:

- screenshots where helpful
- configuration answers
- explanation
- test results

Then questions reasoning.

---

BOSS CLIENT

Persistent multi-stage client engagement.

Possible sequence:

"audit → discovery → architecture → pricing → negotiation → proposal → implementation → QA → launch → reporting → change request"

Earlier decisions affect later consequences.

---

28. HINT SYSTEM

Support:

Nudge

Small directional clue.

Concept Reminder

Reminds learner of principle.

Worked Example

High assistance.

Track assistance.

A heavily assisted pass is not independent mastery evidence.

---

29. MASTERY STATES

Use:

- UNSEEN
- LEARNING
- GUIDED
- PRACTICED
- INDEPENDENT
- PRESSURE_TESTED
- MASTERED
- NEEDS_REFRESH

Do not award mastery from quizzes alone.

---

30. MASTERY EVIDENCE

Store:

- skill
- exercise
- result
- score
- assistance
- difficulty
- critical failures
- date
- simulator version
- content version
- real-GHL evidence where required

---

31. CRITICAL FAILURE SYSTEM

A high numeric score cannot override a dangerous failure.

Example:

Workflow score:

- correctness 45%
- edge cases 20%
- architecture 15%
- maintainability 10%
- explanation 10%

But:

«canceled appointments receive reminders»

can still cause failure.

---

32. REVIEW SYSTEM

Old skills reappear.

Do not block forward progress because review is due.

Inject short retrieval challenges into later sessions.

A failed retrieval adds skill back to review queue.

---

33. SESSION BUILDER

Support:

- 30 min
- 1 hour
- 2 hours
- Deep Session

Inputs:

- active campaign
- current gate
- weak skills
- review due
- failures
- active boss client
- fieldwork
- assistance dependence

Generate session algorithmically.

Do not call AI for routine session selection.

Allow:

Continue

after the generated session ends.

---

34. ASSISTANCE METER

Track dependence quietly.

Possible states:

- Independent
- Light Assistance
- Guided
- Heavy Assistance

Do not shame the learner.

Mastery requires sufficient independent evidence.

---

35. PORTFOLIO

Major projects can become portfolio items.

Store:

- brief
- business problem
- architecture
- funnel
- workflows
- screenshots
- learner reasoning
- skills demonstrated
- assistance level
- real-GHL evidence where applicable

Fictional work must be labeled:

Simulation Project

or:

Demonstration Build

Never fabricate client outcomes.

---

36. PORTFOLIO PROGRESSION

Field Ready examples:

1. Lead Capture + Follow-Up
2. Consultation Booking System
3. Application / Qualification System
4. No-Show Recovery
5. Full Bloomwired Client Capstone

Practitioner examples:

6. VSL / sales system
7. paid product funnel
8. multi-staff service system
9. database reactivation
10. client onboarding system

Advanced examples:

11. multi-location system
12. API-integrated build
13. reporting/attribution
14. reusable vertical snapshot
15. complex Boss Client

Specialist examples:

16. custom integration
17. AI-assisted system
18. marketplace extension
19. migration
20. full business architecture

---

37. PERSISTENT FICTIONAL CLIENTS

Create recurring businesses rather than disposable scenarios.

Initial industries should strongly overlap likely Bloomwired buyers while extending beyond them:

- med spa
- coach
- consultant
- therapist
- photographer
- realtor
- gym/fitness
- pet service
- HVAC
- roofing
- cleaning
- remodeling
- dentist
- chiropractor
- law firm
- accounting
- recruiting
- course creator
- wedding vendor
- B2B service

Each client has persistent state.

---

38. CLIENT SCHEMA

Each client should support:

id:
business_name:
industry:
locations:
team:
offers:
lead_sources:
current_systems:
metrics:
problems:
relationship_state:
assets:
hidden_facts:
voice:
history:

---

39. HIDDEN CLIENT STATE

Roleplay can track hidden values such as:

- trust
- urgency
- price sensitivity
- frustration
- technical sophistication
- actual budget
- stated budget
- decision authority
- fear
- previous bad experience

Do not expose numerical hidden state to learner.

---

40. SCENARIO ENGINE

Scenarios use:

current state

- learner action
- # rules
  updated scenario

Use authored branching where practical.

Use AI only when learner free-form language requires interpretation.

---

41. SIMULATOR PRINCIPLE

Bloomlab contains one shared fake GHL account model.

Labs are not separate mini-games.

A form submitted in Funnel Lab can:

- create a CRM contact
- populate fields
- fire workflow
- create opportunity
- send simulated SMS
- create appointment
- affect reporting

This is critical.

---

42. SIMULATOR ARCHITECTURE

Create a deterministic TypeScript package:

"packages/simulator-core"

Do not put simulation logic inside React components.

Concept:

"State + Event → Transition → New State + Events"

---

43. SIMULATED ACCOUNT MODEL

Support progressively:

- account
- users
- contacts
- companies
- tags
- custom fields
- custom values
- opportunities
- pipelines
- appointments
- calendars
- forms
- surveys
- products
- payments
- conversations
- workflows
- workflow runs
- tasks
- notes
- analytics
- event log

---

44. SIMULATOR EVENTS

Examples:

CONTACT_CREATED
CONTACT_UPDATED
TAG_ADDED
TAG_REMOVED

FORM_SUBMITTED
SURVEY_SUBMITTED

APPOINTMENT_BOOKED
APPOINTMENT_RESCHEDULED
APPOINTMENT_CANCELLED
APPOINTMENT_STATUS_CHANGED

SMS_SENT
SMS_RECEIVED
EMAIL_SENT

OPPORTUNITY_CREATED
OPPORTUNITY_UPDATED
PIPELINE_STAGE_CHANGED

PAYMENT_RECEIVED
PAYMENT_FAILED
REFUND_ISSUED

TIME_ADVANCED

WORKFLOW_ENROLLED
WORKFLOW_STEP_COMPLETED
WORKFLOW_EXITED

WEBHOOK_RECEIVED
WEBHOOK_RESPONSE

Use exact real GHL terminology in UI when representing actual GHL features.

---

45. SIMULATION CLOCK

Every scenario has its own deterministic clock.

Store:

- simulation time
- timezone
- scheduled future events

Never depend directly on actual wall-clock time for graded behavior.

---

46. TIME MACHINE

Support:

- +1 minute
- +1 hour
- +1 day
- Next Event

as relevant.

Show current simulated date/time clearly.

---

47. EVENT INJECTOR

Allow scenario-defined events:

- contact reply
- tag added
- appointment cancellation
- appointment reschedule
- payment
- form submission
- opportunity movement

---

48. SIMULATOR EXECUTION LOG

Store:

- trigger
- data
- step
- start
- completion
- branch result
- skipped action
- waiting
- failure
- exit reason

This powers troubleshooting.

---

49. SEE FAILURES

Simulate realistic failures.

Examples:

- missing phone
- DND
- invalid webhook auth
- missing field
- unavailable appointment
- duplicate enrollment
- bad condition
- workflow loop
- integration failure

Teach observable symptoms before giving fixes.

---

50. WORKFLOW LAB

This is a flagship feature.

Desktop:

- canvas
- toolbar
- inspector
- execution timeline

Support:

- add trigger
- filter
- action
- Wait
- If/Else
- branches
- reorder
- connect
- undo
- redo
- run test
- inspect history

---

51. WORKFLOW LAB MUST USE REAL GHL MECHANICS

If Bloomlab shows:

Appointment Status

or:

Send SMS

or:

Wait

it must map to a real current GHL function or be clearly marked as an approximation.

No made-up native GHL actions.

---

52. WORKFLOW TEST CONTACT

Allow:

Use existing simulated contact

or:

Generate test contact

Run contact visibly through workflow.

Display:

- current node
- current values
- branch result
- timeline events

---

53. WORKFLOW NODE DESIGN

Each node shows:

- action type
- real feature name
- concise configuration
- status

Do not expose all settings on the canvas.

Use contextual inspector.

---

54. MOBILE WORKFLOW LAB

Do not shrink the desktop canvas.

Use a structured vertical/drill-down flow editor.

Mobile must still support:

- configuring steps
- inspecting branches
- testing
- reviewing execution
- editing

---

55. CRM LAB

Support:

- contacts
- fields
- tags
- opportunities
- pipelines
- assignments
- activity history
- notes
- tasks
- companies later
- custom objects later

Allow poor architectural choices when technically possible.

Let later consequences teach why they were poor.

---

56. FUNNEL LAB

This is a conversion architecture simulator, not a complete replacement for a page builder.

Support:

- funnel steps
- page structure blocks
- forms
- surveys
- calendar
- checkout concepts
- mobile/tablet/desktop preview
- simulated visitor

Modes:

- BUILD
- PREVIEW
- SIMULATE

Submitting a form creates real simulated CRM data.

---

57. CALENDAR LAB

Support progressively:

- duration
- availability
- buffers
- minimum notice
- staff
- assignment
- round robin
- services
- locations
- confirmation
- reschedule
- cancellation
- advanced resource rules later

---

58. CONVERSATIONS LAB

Simulate:

- SMS
- email
- call events later
- other channels where useful

Replies can affect workflows.

---

59. PAYMENTS LAB

Support later:

- product
- price
- one-time
- subscription
- payment link
- invoice
- failed payment
- refund

Payment events can fire workflows.

---

60. REPORTING LAB

Use actual simulator data to calculate:

- leads
- conversion
- booking rate
- show rate
- close rate
- revenue
- pipeline value
- source performance
- response rate
- time to contact

Train diagnosis.

---

61. PLAYGROUND

Once a feature is unlocked, keep it available in Playground.

Learner can experiment freely.

Do not require assigned exercise to use simulator.

---

62. DESIGN REFERENCE

Primary visual reference:

https://doodlemonjigsaw.netlify.app/

The learner strongly likes:

- color palette
- holographic appearance
- iridescence
- interaction
- animation
- tactile behavior
- playful material quality

Match that visual feeling closely.

Do not copy:

- Pokémon/Doodlemon art
- logo
- copyrighted characters
- exact branded illustrations
- exact page composition

Adapt the visual language into Bloomlab.

---

63. DESIGN NORTH STAR

Bloomlab should feel:

collectible + tactile + intelligent + playful + polished + immersive

Conceptually:

Doodlemon energy × premium creative software × professional simulation game

The interface should make the learner want to open it for hours.

---

64. CORE DESIGN RULE

The interface is quiet. The objects are magical.

Do not make everything holographic.

Reserve strong holo treatment for:

- territory cards
- mastery cards
- client case covers
- selected challenges
- portfolio projects
- meaningful unlocks
- advanced/mastered states
- Field Ready achievement

---

65. COLORS

Use these as initial tokens.

Cloud

"#F8FAFF"

Snow

"#FFFFFF"

Mist

"#F0F3FC"

Soft Lilac

"#EEEAFB"

Ink

"#18152B"

Deep Ink

"#100D22"

Ink Soft

"#5D5873"

Ink Faint

"#8F8AA5"

Electric Sky

"#6EC8FF"

Bubblegum

"#FF82C8"

Lavender

"#A99BFF"

Aqua

"#75E6DE"

Lemon Cream

"#FFE98A"

Peach

"#FFB49C"

Ice

"#CFF8FF"

Semantic:

Success "#56BFA1"

Warning "#E5A94C"

Error "#D85C72"

Info "#5D90D9"

Tune slightly if needed for contrast and final polish, while retaining the Doodlemon-inspired family.

---

66. TYPOGRAPHY

Initial recommendation:

Display

Bricolage Grotesque

UI / Body

Inter

Technical

IBM Plex Mono

If implementation has a strong reason to substitute, retain:

- expressive display grotesk
- highly readable UI sans
- restrained technical mono

Do not use generic system fonts everywhere unless necessary for performance fallback.

---

67. HOLOGRAPHIC MATERIAL SYSTEM

Build a reusable:

"HoloMaterial"

not dozens of unrelated gradients.

Support:

- base pearlescent layer
- spectral layer
- moving radial reflection
- fine foil texture
- edge sheen
- pointer tilt
- touch response
- reduced motion

Variants:

- soft
- collectible
- mastery
- legendary

Legendary must remain tasteful.

---

68. HOLO PHYSICS

Desktop:

pointer position influences:

- rotateX
- rotateY
- reflection position
- spectral angle
- shadow direction
- edge sheen

Maximum tilt:

approximately 5–7 degrees

Pointer exit:

settle toward neutral around 350–500ms

Touch:

- press changes reflection
- drag moves reflection
- release settles

Do not require device orientation permissions.

---

69. MOTION

Motion categories:

- state
- spatial
- execution
- reward

Normal interaction timing:

approximately 120–300ms

Major accomplishments:

approximately 1.5–3 seconds

User can skip major sequences.

Respect reduced motion.

---

70. NO AI-SLOP DESIGN

Reject these as default patterns:

- giant gradient hero
- purple SaaS gradient
- gradient text
- glassmorphism everywhere
- random blobs
- icon beside every heading
- endless three-column cards
- every section in a card
- giant useless stats
- fake analytics
- emoji navigation
- trophy spam
- rocket graphics
- stock SaaS art
- generic AI avatar
- huge shadows
- random confetti
- excessive pills
- identical layouts across every environment
- generic “Welcome back” dashboard

---

71. SEMANTIC COMPONENTS

Do not use one universal Card component for the whole product.

Create semantic components such as:

- SkillCard
- ClientCaseCover
- WorkflowNode
- ExercisePrompt
- MasteryBadge
- ContactRow
- PipelineCard
- HoloTerritory
- CallParticipant
- PricingScopeItem
- ExecutionEvent

Share tokens underneath.

---

72. INFORMATION DENSITY

Academy:

low-medium

Workflow Lab:

medium-high

CRM:

high

Call Room:

very low

Pricing Arena:

medium

Skill Map:

high visual, low text

Do not use one design density everywhere.

---

73. APP SHELL

Desktop:

compact left rail around 68–80px.

Primary areas:

- Home
- Campaign
- Skill Map
- Simulator
- Clients
- Portfolio
- Playground

Minimal top context.

No giant sidebar.

---

74. COMMAND CENTER

Primary question:

«What should I do next?»

Main object:

Continue

Show:

- campaign
- gate
- current topic
- progress

Supporting:

- active client
- due retrieval
- recent mastery
- Build My Session

Do not fill home with meaningless metrics.

---

75. SKILL MAP

Signature screen.

Nine territories plus Judgment.

Territories should feel like holographic regions or collectible objects rather than tiny LMS nodes.

Skill states:

- unseen
- available
- learning
- practiced
- independent
- pressure-tested
- mastered
- needs refresh

Mastery changes visual material.

---

76. ACADEMY

Feels like an interactive editorial publication.

Use:

- strong typography
- short sections
- diagrams
- inline simulations
- interaction
- expandable depth

Do not default to:

"video + paragraph + next lesson"

---

77. WORKFLOW LAB VISUALS

Dark ink workspace.

Light clean nodes.

Active execution:

aqua/blue.

Do not make it neon hacker software.

---

78. CLIENT CASES

Client covers should feel collectible and premium.

Use abstract identity/material treatment rather than mandatory stock photos.

Persistent clients can later have generated portraits where useful.

---

79. CALL ROOM

Minimal, immersive, dark.

Show:

- client identity
- company
- objective
- audio state
- elapsed time
- notes drawer

Do not clone Zoom.

Early training may show discovery anchors.

Advanced calls remove aids.

---

80. PRICING ARENA

Design as a deal desk.

Show:

- requirements
- scope
- price
- payment
- timeline
- recurring
- exclusions

Scope reductions should have visible structural consequences.

---

81. BROKEN BUILD MODE

Use an understated:

INCIDENT

state.

Provide:

- symptom
- logs
- client complaint
- system state

Do not use cartoon alarm effects.

---

82. RESPONSIVE

Required review widths:

- 1440
- 1024
- 768
- 390
- 320

Tablet is first class.

Mobile is recomposed.

No critical desktop feature may simply disappear because responsive work is difficult.

---

83. MOBILE EXAMPLES

Workflow:

vertical step editor.

CRM:

stage view / deliberate local horizontal scroller.

Academy:

editorial reading.

Call Room:

mobile-first voice experience.

Inbox:

natural conversation flow.

Skill Map:

territory-first.

---

84. ACCESSIBILITY

Support:

- keyboard
- visible focus
- labels
- reduced motion
- sufficient contrast
- non-color status
- drag alternatives
- touch targets around 44px
- mobile input font size at least 16px
- no critical hover-only information

---

85. STACK

Use:

Frontend

React + TypeScript + Vite

Hosting/API

Cloudflare Workers + Static Assets

Local data

IndexedDB

Use Dexie or similarly small wrapper.

Synced relational data

Cloudflare D1

Files/audio

Cloudflare R2

Source

GitHub

AI

Claude API behind Worker

Voice

ElevenLabs

Speech recognition

Google Cloud Speech-to-Text V2

---

86. LOCAL-FIRST

Normal interaction must not wait on server.

Flow:

"UI → local state → IndexedDB → sync queue → server"

If internet disappears:

Bloomlab remains usable for ordinary non-AI learning.

---

87. PWA

Make Bloomlab installable.

Cache:

- app shell
- stable curriculum
- stable assets

Progress belongs in IndexedDB.

Do not rely solely on browser localStorage.

---

88. CROSS-DEVICE SYNC WITHOUT LOGIN

No normal auth initially.

Use a:

Bloomlab Sync Key

First device generates a high-entropy cryptographic secret.

Server stores only derived/hash material.

Never store raw master secret in D1.

After device connection, issue a revocable device session.

---

89. DEVICE MODEL

Store:

- device ID
- learner ID
- token hash
- created
- last seen
- revoked
- label

Allow device revocation later.

---

90. RECOVERY

Explain clearly:

If all devices and the sync key are lost, recovery is impossible without future account authentication.

Allow:

- copy key
- recovery file
- QR
- confirmation it was saved

---

91. SYNC

Sync meaningful state.

Do not sync every drag coordinate immediately.

Use:

- revision
- updated time
- device
- deleted time

For append-only evidence:

merge.

For conflicting complex edits:

do not silently overwrite.

Offer conflict choice.

---

92. D1

D1 stores learner-specific synced data.

Do not store static curriculum primarily in D1.

Rule:

Git = what Bloomlab teaches

D1 = what learner has done

---

93. D1 DOMAINS

Identity:

- learners
- devices
- sync_sessions

Learning:

- skill_progress
- skill_evidence
- campaign_progress
- exercise_attempts
- review_queue
- fieldwork

Simulation:

- sim_projects
- sim_snapshots
- sim_events
- client_progress

Portfolio:

- portfolio_projects
- portfolio_assets

AI:

- ai_usage
- ai_feedback
- rubric_runs

System:

- content_versions
- sync_operations
- feature_flags

---

94. R2

Use for:

- generated audio
- voice assets
- screenshots
- portfolio media
- fieldwork media
- recovery backup
- scenario attachments

Private learner assets should not be public by default.

---

95. DO NOT REQUIRE DURABLE OBJECTS IN V1

Do not add Durable Objects unless a concrete feature requires coordinated real-time server state.

Possible future use:

- multiplayer
- mentor observation
- collaborative sessions

---

96. DO NOT REQUIRE QUEUES IN V1

Add Cloudflare Queues later if background processing justifies it.

Possible future use:

- AI batch jobs
- long audio processing
- exports
- delayed tasks

Keep v1 simpler.

---

97. SIMULATOR WEB WORKER

Run heavier simulation in browser Web Worker where beneficial.

Do not block UI during large workflow executions.

---

98. CONTENT ARCHITECTURE

Do not hardcode curriculum inside JSX.

Create:

content/
├── skills/
├── ghl-features/
├── campaigns/
├── learning-units/
├── exercises/
├── scenarios/
├── clients/
├── rubrics/
├── projects/
├── portfolio/
└── glossary/

Use YAML for structured definitions.

Use Markdown/MDX for learning prose and interactive embeds.

---

99. CONTENT VALIDATION

Use Zod or equivalent.

Validate:

- unique IDs
- valid prerequisites
- valid skill refs
- valid GHL feature refs
- valid client refs
- valid scenario refs
- valid campaign refs

Build fails on broken references.

---

100. CONTENT COMPILATION

Build-time flow:

"source → validate → resolve → compile → optimized bundle"

Do not repeatedly parse a giant content folder at runtime.

---

101. CONTENT VERSIONING

Store:

- app version
- content version
- simulator version

Attempts preserve version metadata.

If GHL changes later, old evidence remains historically valid to its original content version.

---

102. GITHUB REPOSITORY

Use a monorepo approximately like:

bloomlab/
├── apps/
│ └── web/
├── worker/
├── packages/
│ ├── simulator-core/
│ ├── exercise-engine/
│ ├── mastery-engine/
│ ├── content-schema/
│ ├── design-system/
│ └── shared/
├── content/
├── migrations/
├── tests/
├── scripts/
├── docs/
├── public/
├── CLAUDE.md
├── PRODUCT_VISION.md
├── CURRICULUM_MASTER_MAP.md
├── DESIGN_SYSTEM.md
├── TECH_ARCHITECTURE.md
├── REQUIREMENTS_MATRIX.md
├── ACCEPTANCE_TESTS.md
├── IMPLEMENTATION_STATUS.md
├── KNOWN_LIMITATIONS.md
└── CHANGELOG.md

---

103. GIT

Use simple workflow:

"main"

plus short-lived feature branches.

Use focused commits.

Good:

"feat: add appointment-relative wait execution"

Bad:

"updates"

---

104. ENVIRONMENTS

Use:

- local
- preview
- production

Separate development and production D1.

Do not test database migrations against production first.

---

105. SECRETS

Never expose:

- Anthropic API key
- ElevenLabs key
- Google Cloud credentials
- sync pepper
- future GHL credentials

to browser bundle.

Use platform secret storage.

---

106. AI PHILOSOPHY

Bloomlab should use as little runtime AI as practical.

Preferred order:

1. code
2. deterministic rules
3. authored branches
4. lightweight classifier
5. full LLM judgment

AI is the coach.

AI is not the course engine.

---

107. AI SETTING

Support conceptually:

- AI Coaching Off
- Limited
- Full

Default personal mode:

Limited

Core Bloomlab still functions with AI Off.

---

108. AI BUDGET

Target:

approximately $20/month maximum

Implement server-side AI cost tracking and budget governor.

Do not silently exceed limit.

Store:

- model
- tokens
- cost estimate
- request type
- exercise
- timestamp

Possible thresholds:

$0–12 normal limited behavior

$12–16 prefer cheaper models

$16–19 reserve AI for important tasks

$19+ optional AI blocked

Make configuration adjustable.

---

109. MODEL ROUTING

Use no model for deterministic tasks.

Use cheaper Claude model for:

- classification
- basic extraction
- simple rubric checks

Use stronger model for:

- open-ended sales critique
- diagnosis
- proposal review
- negotiation
- call evaluation
- hard client reasoning

Do not use the most expensive model by default at runtime.

---

110. AI STRUCTURED OUTPUT

Require schema-driven results.

Example:

{
"score": 82,
"rubric_results": [],
"critical_issue": null,
"strengths": [],
"improvements": [],
"next_probe": "",
"confidence": 0.9
}

Validate before accepting.

Never depend on parsing arbitrary prose.

---

111. AI CANNOT OVERRIDE OBJECTIVE FAILURE

Example:

Expected SMS:

1

Actual SMS:

2

Result:

failed

Claude cannot reinterpret it.

---

112. AI FAILURE

If AI fails:

- save learner submission
- preserve transcript
- preserve deterministic state
- offer retry
- allow other non-AI study

Never lose work.

---

113. ELEVENLABS

Use for recurring fictional client voices.

The user currently has approximately 128k ElevenLabs credits with an upcoming expiry window.

If development reaches voice asset production while those credits are still available, prioritize generating reusable voice assets.

Do not make future Bloomlab functionality depend on those expiring credits.

---

114. VOICE ASSET MODE

Pre-generate:

- greetings
- objections
- interruptions
- voicemail
- recurring lines
- scripted scenario dialogue

Store in R2.

---

115. DYNAMIC VOICE

Use dynamic TTS only where open-ended roleplay needs it.

Flow:

"scenario/Claude response → ElevenLabs → audio"

Cache reusable generated lines where appropriate.

---

116. VOICE CHARACTER REGISTRY

Store:

- client
- voice ID
- speech rate
- style
- stability
- language

Recurring characters keep consistent voices.

---

117. SPEECH TO TEXT

Use Google Cloud Speech-to-Text.

Initial voice simulation is turn-based.

Do not build full-duplex realtime telephony first.

---

118. CALL FLOW V1

"client audio → learner response → record → transcribe → evaluate → update scenario → next response"

Make transitions feel natural.

---

119. CALL GRADING

Evaluate:

- questions
- listening
- diagnosis
- clarity
- jargon
- pitch timing
- objection handling
- next step

Do not grade accent.

---

120. WRITTEN SALES SIMULATION

Provide persistent inbox-like conversations.

Client messages react to learner answer.

Do not always show:

«Correct.»

Continue conversation naturally.

---

121. NEGOTIATION STATE

Client can have hidden:

- actual budget
- stated budget
- urgency
- trust
- alternative provider strength
- prior bad experiences
- decision authority

Learner does not see internal numbers.

---

122. PRICING ENGINE

Do not treat one exact price as universally correct.

Scenario can store:

- baseline complexity
- estimated labor
- risk
- migration
- locations
- integrations
- custom development
- rush
- recurring support

Evaluate:

- price
- margin
- scope
- risk
- reasoning

---

123. BLOOMWIRED APPLICATION

Training should continually apply to Bloomwired.

Teach and refine:

- ICP
- offer structure
- positioning
- pricing
- audits
- outreach
- discovery
- proposals
- portfolio
- client experience
- reusable systems
- care plans
- recurring support

Do not teach generic agency guru scripts as doctrine.

---

124. BLOOMWIRED PROSPECT INDUSTRIES

Bias scenarios toward:

- coaches
- consultants
- therapists
- med spas
- photographers
- realtors
- fitness
- pet businesses
- home services
- wedding vendors
- local services

plus additional industries to build transfer.

---

125. REQUIREMENTS SYSTEM

Create stable IDs.

Prefixes:

PRD
CUR
MAS
EXR
SIM
WFL
CRM
FUN
CAL
CONV
PAY
REP
SAL
PRI
NEG
CALL
FLD
PORT
DES
HOL
MOT
RSP
A11Y
SYNC
DATA
AI
VOI
INF
PERF
SEC
CNT
GHL

---

126. REQUIREMENT STATUS

Allowed:

- NOT_STARTED
- IN_PROGRESS
- IMPLEMENTED_UNVERIFIED
- PASSED
- PARTIAL
- BLOCKED
- DEFERRED
- FAILED

Never mark PASSED without evidence.

---

127. PRIORITY

Use:

P0 Blocking

P1 Required

P2 Important

P3 Enhancement

Do not silently downgrade requirements.

---

128. DEFINITION OF DONE

A major feature is not complete because its page exists.

It is complete when required behavior passes:

- behavior
- edge cases
- error state
- loading state
- persistence
- responsiveness
- accessibility
- touch
- keyboard
- tests
- design review
- requirement update

---

129. NO STUB RULE

A requirement is not implemented if the feature:

- logs to console
- shows fake hardcoded success
- is a static placeholder
- shows “coming soon”
- only works for a canned screenshot
- opens a nonfunctional modal

Leave requirement PARTIAL.

---

130. NO STATIC REPLACEMENT RULE

If spec requires:

interactive workflow simulation

do not replace it with:

workflow diagram.

If spec requires:

negotiation practice

do not replace it with:

article about negotiation.

If spec requires:

Funnel Autopsy

do not replace it with:

quiz.

The interaction itself is part of the requirement.

---

131. NO MOBILE FEATURE REMOVAL

Do not remove core functionality on mobile.

Recompose it.

---

132. TESTING

Required layers:

Unit

- simulator
- grading
- mastery
- session builder
- sync
- pricing math

Scenario

End-to-end simulation cases.

Content

Validate IDs/references.

UI

Core interaction.

Responsive

Required widths.

Accessibility

Keyboard/touch/reduced motion.

Real GHL

Selected manual field validation.

---

133. SIMULATOR REGRESSION SUITE

Every important simulator behavior gets fixtures.

Example:

- fixed wait
- appointment-relative wait
- late enrollment
- cancellation during wait

Bug fixes add regression tests.

---

134. CI

GitHub Actions should run:

- typecheck
- lint
- unit tests
- simulator tests
- content validation
- build

before merge/deploy.

---

135. VISUAL REVIEW

Review major screens at:

- 1440
- 1024
- 768
- 390
- 320

Check:

- hierarchy
- density
- material
- interaction
- holo restraint
- slop patterns
- responsive composition
- long-session comfort

---

136. SCREEN COVERAGE MATRIX

Track:

| Screen | Desktop | Tablet | Mobile | Empty | Loading | Error | Keyboard | Touch |

No major screen is complete with only desktop checked.

---

137. CONTENT COVERAGE MATRIX

Generate:

| Skill | Learn | Guided | Practice | Fix | Independent | Pressure | Fieldwork | Sales Use |

Use data.

Do not manually maintain if derivable.

---

138. GHL COVERAGE MATRIX

Generate:

| GHL Feature | Skill | Simulator | Fidelity | Exercise | Fieldwork | Last Verified |

This catches forgotten areas.

---

139. IMPLEMENTATION STATUS

Maintain concise file.

Example:

CURRENT PHASE
Workflow Lab

PASSED
WFL-001
WFL-002

IN PROGRESS
WFL-005

FAILED
WFL-018

BLOCKED
None

NEXT
WFL-006
WFL-011

---

140. KNOWN LIMITATIONS

Record simulator approximations honestly.

Do not hide mismatches from real GHL.

---

141. INDEPENDENT AUDIT

At major milestones:

Do not code.

Audit active requirements against repo.

Find:

- missing requirements
- partial features
- stubs
- TODOs
- fake data
- responsive gaps
- missing tests
- stale GHL mapping
- design violations
- inaccessible interactions

Output:

"AUDIT_REPORT.md"

---

142. ADVERSARIAL AUDIT

Test ugly cases:

- offline mid-exercise
- refresh mid-simulation
- duplicate events
- missing phone
- missing email
- canceled appointment during wait
- timezone change
- AI timeout
- AI budget exhausted
- ElevenLabs failure
- transcription failure
- sync conflict
- second device
- extreme values
- malformed scenario data

---

143. CORE PRODUCT REQUIREMENTS

At minimum include these:

PRD-001

Personal-first.

PRD-002

Fully asynchronous.

PRD-003

Mastery-gated.

PRD-004

Substantially usable without runtime AI.

PRD-005

Real skill transfer.

---

144. CORE CURRICULUM REQUIREMENTS

At minimum:

- one master graph
- Field Ready path through graph
- practical work for every core skill
- independent assessment
- retrieval
- pricing
- negotiation
- calls
- written sales
- proposals
- prospecting
- real GHL fieldwork

---

145. CORE SIMULATOR REQUIREMENTS

At minimum:

- shared simulated account
- deterministic core
- internal clock
- event log
- snapshots
- replay/reset
- GHL feature registry
- no AI core execution

---

146. CORE SYNC REQUIREMENTS

At minimum:

- cross-device
- no normal auth
- sync key
- hashed master secret
- device sessions
- offline use
- reconnect sync
- no silent destructive conflicts

---

147. CORE AI REQUIREMENTS

At minimum:

- ~$20 target
- cost tracking
- server-side keys
- deterministic-first
- structured output
- rubric versions
- graceful failure
- AI-off useful product

---

148. PERFORMANCE

Do not let holographic richness harm usability.

Use:

- CSS transforms
- composited layers
- route-level lazy loading
- offscreen animation pause
- Web Worker simulator
- local-first interaction

Heavy simulator routes should not load during simple Academy reading.

---

149. ERROR BOUNDARIES

Major environments should fail independently.

Claude failure must not break Workflow Lab.

Call Room failure must not break CRM.

Sync failure must not destroy local state.

TTS failure must provide text fallback.

Transcription failure must preserve audio if retry is possible.

---

150. BACKUP

Provide:

Export Bloomlab Data

Include:

- progress
- evidence
- projects
- notes
- simulator saves
- portfolio metadata

Later add restore.

Never silently overwrite during restore.

---

151. GHL FRESHNESS

GHL changes often.

Every GHL registry item stores:

- last verified
- source
- status

When adding or updating GHL curriculum, use official current GHL documentation where possible.

Never blindly reproduce old YouTube tutorials.

---

152. SECURITY

Never:

- expose API keys
- commit secrets
- use production data for development casually
- publish learner screenshots
- store raw sync secret server-side
- silently send private recordings to unrelated services

---

153. REAL GHL FIELDWORK

Do not require GHL API connection for initial Bloomlab.

Use learner’s real GHL training/subaccount for selected projects.

Later, optional approved GHL integration can verify selected objects.

Do not make v1 dependent on production GHL credentials.

---

154. STARTER PROJECTS

Field Ready should eventually contain serious projects such as:

Lead Capture System

Traffic → page → form → CRM → follow-up → pipeline.

Consultation Booking

Qualification → calendar → confirmation → reminders → cancellation → no-show recovery.

Application Funnel

Survey/application → qualification → routing → pipeline → booking.

Reactivation

Existing database → segmentation → outreach → response → booking.

Full Capstone

Complete fictional Bloomwired client.

---

155. CAPSTONE EXAM

No normal hints.

Learner receives:

- business
- offers
- staff
- metrics
- current systems
- problems
- hidden edge cases
- client communications
- budget constraints

Must:

- diagnose
- architect
- build
- test
- troubleshoot
- price
- negotiate
- propose
- explain

Major implementation requires real GHL fieldwork.

Bloomlab asks reasoning questions such as:

- why a custom field?
- why this pipeline?
- what happens with late booking?
- what breaks with second location?
- what if no phone exists?
- what happens after reschedule?
- why this price?
- what would you remove for lower budget?

---

156. FIELD READY PASS

Do not pass based on one overall percentage if critical skills are missing.

Require sufficient evidence across:

- funnel strategy
- GHL implementation
- automation
- CRM architecture
- troubleshooting
- sales
- pricing
- negotiation
- fieldwork
- client explanation

---

157. POST-FIELD-READY PATHS

Offer:

Automation Specialist

AUTOMATE → ARCHITECT → CONNECT

Funnel & Conversion Specialist

STRATEGIZE → BUILD → DIAGNOSE

Sales Operator

SELL → STRATEGIZE → DELIVER

Technical GHL Specialist

CONNECT → AUTOMATE → ARCHITECT → GHL AI

Agency Systems

DELIVER → SCALE → ARCHITECT

GHL AI Specialist

GHL AI → AUTOMATE → CONNECT

Recommended

Bloomwired Operator Path

Broad competency.

---

158. APP COPY STYLE

UI copy should be:

- short
- smart
- direct
- professional
- occasionally playful

Examples:

Run it.

Something broke. Find out why.

No hints this time.

What would you build?

Maria received two reminders. She should have received one.

Deal lost. Good decision.

Avoid:

«Amazing job, superstar!»

Avoid childish gamification.

---

159. PROGRESS LANGUAGE

Prefer:

47 capabilities demonstrated

over:

12,450 XP

Use:

- Passed
- Needs another run
- Demonstrated
- Independent
- Mastered
- Field Ready

No star ratings.

---

160. REWARDS

Rewards are:

- new capabilities
- new simulator tools
- new clients
- new scenarios
- Playground features
- portfolio projects
- skill mastery
- new territory access

Not meaningless points.

---

161. SIGNATURE MOMENTS

Polish these heavily:

Holo Skill Interaction

Pointer/touch physical response.

First Workflow Execution

Watch contact travel through system.

Client Case Reveal

New Boss Client opens like a premium collectible case.

Failed Test

Reveal exactly where observable result diverged.

Independent Pass

Recognize no assistance was used.

Field Ready

Restrained cinematic achievement.

---

162. SOUND

Optional.

Subtle:

- snap
- connect
- execution
- selection
- completion

Always allow mute.

No constant game sound.

---

163. PHASED BUILD ORDER

Do not attempt to generate the entire product in one uncontrolled pass.

---

PHASE 0 . SPEC PACKAGE

Before major implementation, create or update:

- "CLAUDE.md"
- "PRODUCT_VISION.md"
- "CURRICULUM_MASTER_MAP.md"
- "DESIGN_SYSTEM.md"
- "TECH_ARCHITECTURE.md"
- "CONTENT_ARCHITECTURE.md"
- "SIMULATOR_SPEC.md"
- "EXERCISE_ENGINE.md"
- "REQUIREMENTS_MATRIX.md"
- "ACCEPTANCE_TESTS.md"
- "IMPLEMENTATION_STATUS.md"
- "KNOWN_LIMITATIONS.md"

These files must reflect this prompt.

Do not replace this prompt with vague summaries.

---

PHASE 1 . REPOSITORY FOUNDATION

Build:

- React
- TypeScript
- Vite
- Worker
- routing
- design tokens
- lint
- tests
- CI
- environments

---

PHASE 2 . DESIGN SYSTEM

Build and visually verify:

- typography
- palette
- surfaces
- buttons
- forms
- holo system
- motion
- responsive primitives
- focus states
- reduced motion

Do not build the whole product using generic temporary UI and promise to style later.

The visual language should exist early.

---

PHASE 3 . LOCAL-FIRST DATA

Build:

- IndexedDB
- data services
- local state persistence
- sync queue primitives

---

PHASE 4 . D1 + SYNC

Build:

- learner
- sync key
- hashing
- device sessions
- sync
- conflicts
- offline recovery

Verify across at least two browser/device contexts.

---

PHASE 5 . CONTENT ENGINE

Build:

- schemas
- YAML/MDX loading
- validation
- compilation
- IDs
- prerequisite resolution
- feature registry

---

PHASE 6 . LEARNING ENGINE

Build:

- skills
- campaigns
- mastery
- evidence
- review queue
- session builder

---

PHASE 7 . COMMAND CENTER + SKILL MAP

Build premium UI.

Implement real progress state.

No fake dashboard metrics.

---

PHASE 8 . ACADEMY

Build interactive learning units.

Allow embedded small simulations.

---

PHASE 9 . EXERCISE RUNNER

Implement core exercise shell and deterministic grading.

Start with:

- Build It
- Fix It
- Run the Lead
- Edge Case
- Architecture Decision
- Rebuild Blind

---

PHASE 10 . SIMULATOR CORE

Build:

- account state
- events
- clock
- event scheduler
- snapshots
- replay
- seeded randomness
- logs

---

PHASE 11 . CRM LAB

Build core contact/pipeline state.

---

PHASE 12 . WORKFLOW LAB

Build flagship Workflow Lab.

This phase receives extensive testing.

---

PHASE 13 . FUNNEL LAB

Connect forms to CRM/workflows.

---

PHASE 14 . CALENDAR LAB

Connect booking events.

---

PHASE 15 . TROUBLESHOOTING + REPORTING

Build diagnostic scenarios.

---

PHASE 16 . SALES EXERCISES

Build:

- Prospect It
- Audit It
- Write It
- Explain It

---

PHASE 17 . PRICING ARENA

Build pricing logic and scenarios.

---

PHASE 18 . NEGOTIATION

Build branching negotiation.

Add limited AI when justified.

---

PHASE 19 . AI GATEWAY

Build:

- server routes
- model routing
- budget governor
- structured grading
- retry/failure behavior

---

PHASE 20 . VOICE ASSET SYSTEM

Generate/use reusable ElevenLabs assets.

---

PHASE 21 . CALL ROOM

Build turn-based voice simulations.

---

PHASE 22 . FIELDWORK

Build real-GHL proof flow.

---

PHASE 23 . PORTFOLIO

Build demonstration-project records.

---

PHASE 24 . FIELD READY CONTENT

Populate enough complete curriculum to take learner from placement through capstone.

Do not fill the app with hundreds of shallow lessons before the learning loop works.

---

PHASE 25 . ADVANCED CURRICULUM

Expand after Field Ready is end-to-end usable.

---

PHASE 26 . POLISH

Perform:

- responsive pass
- accessibility pass
- performance pass
- design audit
- simulator audit
- GHL feature audit
- content audit
- adversarial test
- gap audit

---

164. CLAUDE.MD CONTENT

Create "CLAUDE.md" containing these operating principles.

Mission

Build Bloomlab according to authoritative specs.

Requirements

Requirements are authoritative.

Difficulty is not permission to weaken them.

Interaction

Never replace requested interactive behavior with a static approximation unless the spec explicitly allows it.

GHL Accuracy

Do not invent native GHL features.

Map simulated features to registry.

Design

Follow Bloomlab Design Bible.

Reject generic SaaS/LMS patterns.

Responsive

Mobile and tablet are product surfaces, not afterthoughts.

Testing

Critical logic requires tests.

Bugs receive regression tests.

Content

Do not hardcode normal curriculum content in React.

AI

Do not use AI where code can decide reliably.

Safety

Never expose secrets.

Preservation

Do not rewrite unrelated working features while implementing a scoped task.

Reporting

Always state:

- passed
- partial
- blocked
- failed
- tests
- known limitations

Clarification

Do not repeatedly ask for details already supplied by the specification.

Make reasonable implementation decisions where the spec leaves a noncritical choice open.

Document those decisions.

---

165. FIRST IMPLEMENTATION RESPONSE

When this master specification is first given to you:

Do not immediately start generating dozens of UI pages.

First:

1. inspect repository
2. report current state
3. create/update required specification files
4. create requirement matrix
5. create implementation phase checklist
6. identify conflicts with existing repo
7. establish foundation if repo is empty
8. begin Phase 1

If the repo is empty, proceed rather than asking which stack to use.

The stack is already specified.

---

166. NO REPEATED APPROVAL GATES

Do not stop after every small feature asking:

«Should I continue?»

Continue through the active phase while requirements are clear.

Stop only for:

- genuinely destructive operation needing user choice
- missing secret/credential that blocks execution
- requirement conflict that cannot be resolved reasonably
- external service setup requiring the user

Otherwise proceed.

---

167. FINAL RELEASE STANDARD

Bloomlab v1 may be called Field-Ready Complete only when:

- all P0 requirements pass
- Field Ready P1 requirements pass
- content validation passes
- simulator regression passes
- sync passes
- AI fallback passes
- responsive review passes
- accessibility core flows pass
- GHL Field Ready registry is current
- placement-to-capstone path can be completed
- real-GHL fieldwork can be recorded
- design review passes
- no major core interface is a stub

---

168. ULTIMATE PRODUCT TEST

The final question is not:

«Does Bloomlab look impressive?»

It is not:

«Does the code compile?»

It is not:

«Are there many lessons?»

The real test is:

«Can Ary enter Bloomlab with basic funnel/GHL experience and gradually become capable of independently diagnosing, architecting, building, troubleshooting, explaining, pricing, pitching, negotiating, and delivering real funnel and GoHighLevel systems?»

If that result is not happening, change the product.

---

169. FINAL PRODUCT PRINCIPLES

Bloomlab must be:

beautiful enough to want to open

interactive enough to teach through action

accurate enough that GHL practice transfers

difficult enough to create real competency

forgiving enough to encourage experimentation

cheap enough to run personally

independent enough that AI outages do not cripple it

structured enough that curriculum can grow

versioned enough to survive GHL changes

professional enough to become commercial later

fun enough that 3–5 hour sessions do not feel like an LMS

---

170. FINAL DIRECTIVE

Build Bloomlab as a real learning simulator.

Do not simplify it into a course website.

Do not bury the product in generic dashboard UI.

Do not make AI the brain of deterministic systems.

Do not fake GoHighLevel functionality.

Do not call shallow exposure mastery.

Do not lock progress to dates.

Do not remove difficult interactions on mobile.

Do not treat pricing, sales, negotiation, marketing, and client delivery as side modules.

Do not let the visual experience become generic.

The learner is training to become a capable professional who can earn money from these skills.

Every major product decision should support that.oh
