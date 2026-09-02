# BLOOMLAB TECHNICAL ARCHITECTURE v1

## 1. Architecture Goal

Bloomlab should behave like a serious installed application even though it runs on the web.

The technical priorities are:

1. instant-feeling interaction
2. reliable cross-device progress sync
3. offline-tolerant study
4. deterministic simulator behavior
5. very limited AI dependency
6. low recurring cost
7. clean content/version management
8. easy GitHub development
9. mobile, tablet, and desktop from one codebase
10. ability to commercialize later without rewriting everything

The system should not require Claude to function.

If every AI API stopped working tomorrow, the curriculum, simulator, progression, projects, exercises, CRM Lab, Workflow Lab, Funnel Lab, pricing drills, deterministic grading, portfolio, and saved progress should still work.

---

# 2. Recommended Stack

## Frontend

**React + TypeScript + Vite**

Deployed through:

**Cloudflare Workers + Static Assets**

Not legacy Workers Sites.

Cloudflare currently supports full-stack React apps through Workers, Vite, static assets, and an API Worker. Workers Sites is deprecated for new projects.

### Why React

Bloomlab contains highly interactive interfaces:

- node editors
- drag/drop
- timelines
- simulated CRM
- skill graph
- call interface
- inspectors
- persistent client state
- complex exercise states

React fits this better than building the application as mostly static pages.

### Language

Use:

**TypeScript everywhere**

No untyped JavaScript for application logic.

---

# 3. Styling

Use:

**CSS variables + CSS Modules or well-structured component CSS**

Tailwind may be used selectively for layout utilities if Fable works better with it, but Bloomlab must not visually become a standard Tailwind component library.

The design system should have explicit tokens:

```text
color
spacing
radius
shadow
motion
typography
holographic material
density
z-index
breakpoints
```

Create reusable visual primitives such as:

```text
HoloMaterial
Surface
InkSurface
ToolPanel
Sheet
Inspector
Popover
Field
Button
IconButton
```

Then semantic product components sit above those.

Do not create one universal Card component and use it for everything.

---

# 4. Application Structure

Bloomlab is a single application with several environments.

```text
Bloomlab
│
├── Command Center
├── Campaigns
├── Skill Map
├── Academy
│
├── Simulator
│   ├── Workflow Lab
│   ├── CRM Lab
│   ├── Funnel Lab
│   ├── Calendar Lab
│   ├── Conversations Lab
│   ├── Payments Lab
│   └── Reporting Lab
│
├── Clients
├── Exercises
├── Call Room
├── Pricing Arena
├── Fieldwork
├── Portfolio
├── Playground
└── Settings
```

These are different views over shared data.

They are not separate applications.

---

# 5. Cloudflare Architecture

Use Cloudflare as the primary application platform.

```text
Browser
   │
   ├── Static Bloomlab application
   │
   └── /api/*
         │
         ▼
Cloudflare Worker
   │
   ├── D1
   ├── R2
   ├── Claude API
   ├── ElevenLabs API
   └── Google Cloud APIs
```

Cloudflare's current Workers + Vite setup can deploy the frontend assets and Worker backend together.

This is preferable to maintaining separate frontend hosting and API hosting for Bloomlab v1.

---

# 6. D1

Use **Cloudflare D1** as Bloomlab's primary synced relational database.

D1 currently provides managed SQL with SQLite semantics and direct Worker integration.

D1 stores things that need synchronization or server persistence.

Examples:

```text
learner identity
devices
progress
skill evidence
exercise attempts
campaign state
fieldwork records
portfolio metadata
client progress
session history
AI usage
sync metadata
content versions
```

It should not receive a database write every time a workflow node moves three pixels.

Local UI state remains local until meaningful checkpoints.

---

# 7. Local-First Storage

Use **IndexedDB** in the browser for active application data.

Do not use localStorage as Bloomlab's main datastore.

IndexedDB handles:

- current simulator session
- unfinished exercise
- node positions
- current client workspace
- notes
- cached curriculum
- cached assets metadata
- offline progress changes
- pending sync operations
- audio metadata
- recent execution logs

Recommended abstraction:

**Dexie** or another small IndexedDB wrapper.

Do not build a complicated custom IndexedDB ORM unless needed.

---

# 8. Local-First Behavior

The learner should never feel like every click needs a server.

Normal interaction:

```text
user action
   ↓
local state updates immediately
   ↓
IndexedDB checkpoint
   ↓
sync queue updated
   ↓
server sync occurs quietly
```

If internet disappears:

Bloomlab continues working.

A small sync indicator may show:

`Saved on this device`

When connection returns:

`Synced`

No modal interruption.

---

# 9. Progressive Web App

Make Bloomlab an installable **PWA**.

This gives a more application-like experience on:

- Android
- tablets
- desktop

Use a service worker for:

- application shell caching
- curriculum cache
- stable asset cache
- offline fallback

Do not cache API responses blindly.

Progress lives in IndexedDB.

---

# 10. Bloomlab Sync Key

There is no conventional login in v1.

Bloomlab uses a private recovery/sync credential.

Example presentation:

```text
BLOOMLAB SYNC KEY

BLM-K8XR-3PVQ-...
```

Internally, use substantially stronger entropy than the friendly display above suggests.

Generate at least **256 bits of cryptographically secure random data**.

The display can use a safer human-friendly encoding.

---

# 11. Sync-Key Security

The raw sync secret must never be stored in D1.

Flow:

```text
Browser generates secret
        ↓
Worker receives secret over HTTPS
        ↓
Worker hashes secret
        ↓
D1 stores hash
```

Server lookup should use a cryptographic hash of the key.

Better:

```text
SHA-256(secret + server-side pepper)
```

The server-side pepper lives only in a Cloudflare Worker secret.

---

# 12. Device Sessions

Do not send the master sync key with every request.

After linking a device:

```text
sync key
   ↓
verified
   ↓
device session created
   ↓
device receives revocable session token
```

Each device gets its own session.

D1 stores:

```text
device_id
learner_id
token_hash
created_at
last_seen_at
revoked_at
device_label
```

Later Bloomlab can show:

**Connected devices**

`Ary's Android`
`Desktop Chrome`
`Tablet`

with:

**Revoke**

---

# 13. Sync-Key Recovery Limitation

Because there is no email/password account:

**losing every connected device plus the sync key means losing server recovery access.**

Bloomlab should state this clearly when generating the key.

Offer:

- copy key
- download recovery file
- QR display
- confirm key saved

Do not force account creation.

Proper identity/authentication can be added before commercial launch.

---

# 14. Sync Model

Each syncable entity should have:

```text
id
learner_id
updated_at
revision
device_id
deleted_at
```

Use optimistic synchronization.

For simple progress records:

latest valid revision wins.

For append-only evidence:

merge.

For complex simulator work:

maintain explicit project snapshots.

Avoid pretending arbitrary concurrent editing on multiple devices is conflict-free.

If two devices edit the exact same active project simultaneously, Bloomlab may show:

**Two versions were changed. Choose which version to keep.**

This is better than silently destroying work.

---

# 15. R2 Storage

Use **Cloudflare R2** for larger unstructured files.

R2 is Cloudflare's object-storage service and is suitable for application files and media.

R2 should eventually contain:

- ElevenLabs generated audio
- scenario voice assets
- fieldwork screenshots
- portfolio screenshots
- generated certificates
- downloadable recovery backups
- client scenario attachments
- optional recordings
- large scenario datasets

D1 stores metadata.

R2 stores files.

Never store huge binary objects directly in D1.

---

# 16. R2 Privacy

Buckets containing personal learner data should remain private.

Access files through:

- Worker authorization
- short-lived signed access
- controlled application routes

Do not expose uploaded fieldwork screenshots through a public bucket.

Static course assets that are inherently public can be handled separately.

---

# 17. Durable Objects

**Do not make Durable Objects a Bloomlab v1 dependency.**

Bloomlab's initial user model is:

one learner using multiple devices asynchronously.

D1 + local IndexedDB is sufficient.

Durable Objects are useful for coordinated real-time state, collaborative sessions, chat, multiplayer-style state, and similar applications.

Possible future uses:

- multiplayer negotiation training
- mentor observing a learner live
- shared classroom simulations
- live collaborative workflows
- real-time commercial team training

Not needed now.

---

# 18. Cloudflare Queues

Also avoid requiring Queues initially.

Cloudflare Queues currently supports delayed/batched background processing, retries, and dead-letter handling.

Add it when Bloomlab has enough asynchronous server work to benefit.

Likely future uses:

- AI evaluation jobs
- large audio processing
- portfolio export generation
- batch analytics
- bulk content updates
- email delivery
- delayed scenario events

For the personal v1, keep architecture simpler.

---

# 19. Simulator Engine

This is the most technically significant part of Bloomlab.

Build the simulator as a **deterministic TypeScript engine completely separate from React**.

React displays it.

React does not contain the actual simulation rules.

Suggested package:

```text
packages/simulator-core
```

The engine accepts:

```text
current state
+
event
+
configuration
```

and returns:

```text
new state
+
generated events
+
execution records
```

Conceptually:

```text
State + Event → Transition → State + Events
```

---

# 20. Simulator State

A simulated account contains:

```text
account
users
contacts
companies
tags
custom fields
custom values
opportunities
pipelines
appointments
calendars
forms
surveys
products
payments
conversations
workflows
workflow runs
tasks
notes
event log
analytics
```

Not every object needs every GHL capability immediately.

The schema is designed for expansion.

---

# 21. Event-Driven Simulation

Examples of events:

```text
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
EMAIL_OPENED

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
```

Real GHL terminology should be used where the exercise exposes a GHL feature.

---

# 22. Simulator Reducers

Use pure deterministic transition functions where possible.

Example conceptually:

```text
applyEvent(state, event)
```

should not:

- call Claude
- mutate browser globals
- depend on system time directly
- generate uncontrolled randomness
- perform network requests

This makes the simulator testable.

---

# 23. Simulation Clock

Never use actual wall-clock time as the source of truth inside exercises.

Each simulation has:

```text
simulation_time
timezone
scheduled_events
```

Example:

```text
2026-09-02T10:00:00
America/Los_Angeles
```

Time-machine actions alter this clock.

This allows deterministic testing of:

- waits
- reminders
- appointment-relative timing
- business hours
- delays
- follow-up
- recurring behavior

---

# 24. Event Scheduler

The simulator maintains a priority queue of future events.

Example:

```text
10:00 FORM_SUBMITTED
10:00 WORKFLOW_ENROLLED
10:00 SMS_SENT
15:00 WAIT_COMPLETED
15:00 IF_ELSE_EVALUATED
```

Time Machine:

**Next Event**

simply advances the simulator clock to the earliest queued event.

This needs zero AI.

---

# 25. Deterministic Randomness

Some exercises may require probability.

Example:

simulate 100 visitors.

Use seeded pseudo-randomness.

Scenario specifies:

```text
seed: 184729
```

This means the same challenge produces the same result during grading.

No learner fails because the random generator behaved differently.

---

# 26. Simulator Snapshots

Save simulator state as:

```text
initial scenario
+
event log
+
periodic snapshot
```

This gives:

- undo
- rewind
- replay
- troubleshooting
- reproducible grading
- execution inspection

Do not serialize the complete giant state after every tiny event forever.

Use periodic checkpoints.

---

# 27. Web Worker

Run heavier simulator execution in a browser **Web Worker**.

This keeps:

- workflow execution
- traffic simulation
- timeline replay
- analytics calculations

off the main UI thread.

The holographic interface should not stutter because a 500-event workflow simulation is running.

---

# 28. Workflow Definition Schema

Workflows should be stored as structured data.

Example concept:

```text
workflow
  id
  name
  trigger
  trigger_filters
  nodes[]
  edges[]
  settings
```

Node:

```text
id
type
ghl_feature_id
config
position
```

This means UI layout and workflow behavior remain separate.

Moving a node does not alter automation behavior.

---

# 29. GHL Feature Registry

Every simulated GHL feature references:

```text
ghl_feature_id
official_name
category
feature_type
native_or_external
simulation_fidelity
last_verified
docs_reference
supported_configs
known_limitations
curriculum_skills
```

Example:

```text
GHL-WF-WAIT
```

The Workflow Lab gets available actions from this registry.

Exercise content also references the same registry.

This avoids curriculum saying one thing while Simulator supports another.

---

# 30. Simulation Fidelity

Use explicit levels.

### FIDELITY A

Very close behavioral match.

Examples:

- tag changes
- fields
- basic workflow branching
- pipeline movement

### FIDELITY B

Training-equivalent behavior with some internal simplification.

### FIDELITY C

Concept demonstration.

### REAL_GHL

No simulator reproduction.

Bloomlab teaches it and requires real GHL fieldwork.

Never fake unsupported behavior.

---

# 31. Exercise Engine

Exercises should be data-driven.

Example structure:

```text
exercise_id
type
title
skills
scenario
instructions
allowed_features
starting_state
expected_outcomes
critical_failures
grading
hints
fieldwork
portfolio
```

A new exercise should usually require adding content data, not building a new React page.

---

# 32. Deterministic Grading

Use code whenever possible.

Types:

### State assertion

```text
contact.tags contains "Qualified"
```

### Event assertion

```text
exactly one SMS sent
```

### Timing assertion

```text
reminder occurred 24h before appointment
```

### Architecture assertion

```text
required trigger exists
```

### Negative assertion

```text
cancelled contact received no reminder
```

### Sequence assertion

```text
opportunity created before assignment notification
```

---

# 33. Grading Rubric

A challenge may contain:

```text
critical
required
quality
bonus
```

Example:

### Critical

Cancelled appointment must not receive reminder.

### Required

Confirmation sent.

24-hour reminder sent.

Opportunity created.

### Quality

Naming.

Modularity.

Avoid duplicate actions.

### Bonus

Graceful handling of missing phone number.

---

# 34. AI Grading Boundary

AI must never override deterministic failure.

If:

```text
expected SMS count: 1
actual SMS count: 2
```

Claude cannot say:

> This is probably acceptable.

It failed.

AI handles areas where several defensible answers exist.

---

# 35. Claude API Architecture

Claude calls only happen through the Worker.

Never expose the Anthropic API key to the browser.

Route:

```text
browser
   ↓
Bloomlab Worker
   ↓
budget check
   ↓
request normalization
   ↓
Claude
   ↓
schema validation
   ↓
result stored
```

---

# 36. Model Routing

Use model routing based on task complexity.

## Deterministic

No model.

## Haiku-class model

Use for:

- basic classification
- extracting structured information
- identifying whether rubric items were mentioned
- short feedback normalization

## Sonnet-class model

Use for:

- sales email critique
- open-ended diagnosis
- proposal review
- negotiation
- discovery-call evaluation
- explanation quality
- difficult scenario reactions

## Fable

Primarily used for:

**building Bloomlab through Claude Code**

Do not make Fable the default runtime model.

Current Anthropic pricing makes caching and model choice meaningful for a $20 monthly ceiling. Prompt-cache reads can cost substantially less than normal input, and Batch processing is currently priced at 50% of standard API rates for eligible asynchronous jobs.

---

# 37. AI Budget Governor

Create a real server-side budget system.

Tables:

```text
ai_usage
ai_budget
ai_request_log
```

Track:

```text
model
input_tokens
cached_input_tokens
output_tokens
estimated_cost
exercise_id
request_type
created_at
```

Budget:

```text
monthly_limit_usd = 20
```

Recommended internal behavior:

### $0–$12

Normal limited AI use.

### $12–$16

Prefer cheaper models.

Reduce optional coaching calls.

### $16–$19

AI reserved for important assessments and roleplay.

### $19+

Block optional requests.

Keep only explicitly permitted essential requests.

Never silently exceed the user-defined limit.

---

# 38. Cost Display

Settings can show:

**AI this month**

`$6.83 / $20`

Breakdown:

`Call feedback`
`Written coaching`
`Negotiation`
`Diagnosis`

Do not obsessively display cost during normal learning.

---

# 39. Prompt Caching

Use Anthropic prompt caching for repeated stable context such as:

- Bloomlab grading philosophy
- sales rubric
- negotiation rules
- persistent client profile
- current skill criteria

Anthropic currently supports prompt caching to reduce repeated input costs and latency.

Do not send the entire Bloomlab curriculum to Claude every call.

---

# 40. Structured AI Responses

Never rely on free-form prose parsing.

Request structured JSON responses.

Example:

```text
score
rubric_results[]
critical_issue
strengths[]
improvements[]
next_probe
confidence
```

Validate response against a schema before accepting it.

If invalid:

retry once using a repair prompt.

If still invalid:

save the learner's work and report evaluation failure.

---

# 41. AI Feedback Storage

Store:

- learner submission
- rubric version
- model
- result
- cost
- timestamp

Do not automatically store giant model prompts forever.

Keep enough information to reproduce grading logic without creating unnecessary storage.

---

# 42. AI Evaluation Versioning

Every AI rubric gets a version.

Example:

```text
SALES_DISCOVERY_RUBRIC_V3
```

If a rubric changes later, old attempts remain associated with the original version.

This matters if Bloomlab becomes commercial.

---

# 43. ElevenLabs

ElevenLabs provides Bloomlab's client voices.

Its current API supports streamed text-to-speech responses.

Use two voice modes.

---

# 44. Voice Mode A. Pre-generated Assets

Preferred whenever possible.

Generate and save:

- greetings
- scripted objections
- common responses
- voicemail
- interruptions
- scenario-specific lines
- recurring client dialogue

Store audio in R2.

Benefits:

- no runtime TTS cost
- immediate playback
- consistent performance
- reusable across attempts

Given the existing **128k expiring ElevenLabs credits**, early production should deliberately generate a useful reusable voice library.

---

# 45. Voice Mode B. Dynamic Speech

Use ElevenLabs dynamically for:

- advanced negotiation
- unpredictable roleplay
- open-ended discovery calls
- Boss Client conversations

Flow:

```text
Claude chooses client response
       ↓
Worker sends response to ElevenLabs
       ↓
audio stream returned
       ↓
audio played
```

Cache reusable generated responses when appropriate.

---

# 46. Voice Character Registry

Store fictional client voice configuration separately.

Example:

```text
client_id
voice_id
speech_rate
style
stability
allowed_emotion_range
language
```

Do not randomly change a recurring client's voice between sessions.

---

# 47. Speech-to-Text

Use **Google Cloud Speech-to-Text V2** for spoken learner responses.

Google currently supports streaming and standard speech recognition through its Speech-to-Text offering.

Initial approach:

1. record learner response locally
2. upload audio through Bloomlab backend
3. transcribe
4. show transcript
5. evaluate transcript
6. optionally delete raw audio after processing

Do not require live streaming for v1.

Turn-based voice calls are technically much simpler and can still feel excellent.

---

# 48. Call Simulation v1

Do **not** begin with full-duplex realtime AI telephone infrastructure.

Use natural turn-taking.

Flow:

```text
client speaks
↓
audio finishes
↓
Ary responds
↓
speech recorded
↓
transcription
↓
scenario evaluates response
↓
client state changes
↓
next client line generated/selected
↓
ElevenLabs speaks
```

With careful transition animation, this can feel very natural.

Later:

**Call Room v2**

could introduce lower-latency streaming.

---

# 49. Recording Policy

Default:

save transcript.

Raw voice recording can be:

- temporary
- optional to retain
- user-deletable

For personal use, retaining calls could help review.

If Bloomlab becomes commercial, recording consent/privacy needs a proper product/legal pass.

---

# 50. Scenario Engine

Scenarios should have hidden state.

Example:

```text
client:
  trust: 42
  urgency: 83
  price_sensitivity: 55
  frustration: 30
```

Dialogue actions can modify state.

Example:

Strong diagnosis:

```text
trust +10
```

Premature pitch:

```text
trust -8
```

Ignoring objection:

```text
frustration +15
```

Do not show these numbers to the learner.

They are simulation internals.

---

# 51. Branching Without AI

Many interactions can use authored branches.

Example:

```text
client says budget objection
```

Learner response can first be classified into broad strategies:

```text
discount
hold
clarify
reduce_scope
phase
walk_away
defensive
```

Pre-authored client reactions cover common paths.

Claude only handles language that genuinely needs interpretation.

This reduces API usage substantially.

---

# 52. Content Storage

Do not store the entire curriculum as hand-written JSX.

Curriculum content lives as structured files in Git.

Recommended:

```text
/content
```

with formats such as:

**YAML + Markdown/MDX**

Use YAML for structured definitions.

Use Markdown/MDX for learning prose where interactive embeds are useful.

---

# 53. Content Repository Structure

Suggested:

```text
content/
│
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
```

This is one of the biggest protections against missing requirements.

---

# 54. Content Validation

Create schemas for every content type.

Use something like:

**Zod**

Example:

```text
SkillSchema
ExerciseSchema
ScenarioSchema
ClientSchema
GHLFeatureSchema
RubricSchema
CampaignSchema
```

Build should fail if content references:

- missing skill
- missing feature
- invalid scenario
- invalid prerequisite
- nonexistent exercise
- duplicate ID

No silent broken curriculum links.

---

# 55. Build-Time Content Compilation

During build:

```text
source content
   ↓
validate
   ↓
resolve relationships
   ↓
generate optimized curriculum bundle
```

The app receives indexed data rather than repeatedly parsing hundreds of YAML files at runtime.

---

# 56. Content Version

Every Bloomlab release gets:

```text
content_version
app_version
simulator_version
```

Example:

```text
app: 0.8.3
content: 2026.09.17
simulator: 0.5
```

Saved exercise attempts record those versions.

---

# 57. GitHub Repository

Recommended monorepo:

```text
bloomlab/
│
├── apps/
│   └── web/
│
├── worker/
│
├── packages/
│   ├── simulator-core/
│   ├── exercise-engine/
│   ├── mastery-engine/
│   ├── content-schema/
│   ├── design-system/
│   └── shared/
│
├── content/
│
├── migrations/
│
├── tests/
│
├── scripts/
│
├── docs/
│
├── public/
│
├── CLAUDE.md
├── PRODUCT_VISION.md
├── DESIGN_SYSTEM.md
├── CURRICULUM_MASTER_MAP.md
├── IMPLEMENTATION_STATUS.md
└── REQUIREMENTS_MATRIX.md
```

---

# 58. Branching Strategy

Keep this simple.

```text
main
```

Stable/deployed.

Feature branches:

```text
feat/workflow-lab
feat/skill-map
fix/mobile-call-room
```

Short-lived branches.

Do not construct complicated GitFlow for a one-person project.

---

# 59. Commit Discipline

Claude should make focused commits.

Examples:

```text
feat: add deterministic wait-step execution
fix: prevent cancelled appointments receiving reminders
content: add GlowHaus no-show scenario
design: refine holo card pointer physics
```

Avoid:

```text
updates
stuff
final fixes
```

This matters when Claude introduces a regression and you need to find it.

---

# 60. GitHub Issues

Every substantial piece of work should map to a requirement or issue.

Issue:

```text
SIM-031 Workflow Time Machine
```

Contains:

- requirement
- UX expectation
- acceptance tests
- affected components

Claude references the issue ID in commits.

---

# 61. Environment Separation

At minimum:

```text
local
preview
production
```

Separate D1 databases:

```text
bloomlab-dev
bloomlab-prod
```

Separate R2 buckets where practical.

Never test migrations against production first.

---

# 62. Secrets

Secrets belong in platform secret storage.

Examples:

```text
ANTHROPIC_API_KEY
ELEVENLABS_API_KEY
GOOGLE_CLOUD_CREDENTIAL
SYNC_KEY_PEPPER
```

Never:

- commit secrets
- place them in client-side Vite variables
- paste them into curriculum files
- store them in D1

---

# 63. GHL Credentials

Bloomlab should **not require your GHL credentials** for ordinary training.

Real-GHL fieldwork is initially manual.

Later, optional Private Integration access may allow Bloomlab to verify selected tasks.

That should be a separate integration phase.

Do not make Bloomlab dependent on your production GHL account.

---

# 64. GHL Verification Later

Future advanced feature:

Connect a dedicated GHL training subaccount through approved API access.

Then Bloomlab could verify things like:

- workflow exists
- custom field exists
- pipeline exists
- opportunity created
- calendar configured

But only after the base learning system works.

The first version uses:

screenshots + configuration questions + real-GHL practical tasks.

---

# 65. Database Domains

D1 tables should be grouped conceptually.

## Identity

```text
learners
devices
sync_sessions
```

## Learning

```text
skill_progress
skill_evidence
campaign_progress
exercise_attempts
review_queue
fieldwork
```

## Simulation

```text
sim_projects
sim_snapshots
sim_events
client_progress
```

## Portfolio

```text
portfolio_projects
portfolio_assets
```

## AI

```text
ai_usage
ai_feedback
rubric_runs
```

## System

```text
content_versions
sync_operations
feature_flags
```

---

# 66. Don't Mirror All Content Into D1

Static curriculum should live in Git.

D1 stores **learner-specific state**.

This gives us:

```text
Git = what Bloomlab teaches
D1 = what Ary has done
```

Very clean separation.

---

# 67. Analytics

For v1, keep analytics focused on learning.

Track:

```text
exercise attempted
exercise passed
skill demonstrated
hint used
critical failure
fieldwork completed
campaign gate completed
AI request
session duration
```

Do not build invasive product analytics for a single-user personal tool.

Later commercial analytics can be added separately.

---

# 68. Mastery Engine

Build mastery as its own TypeScript package.

Inputs:

```text
skill definition
evidence history
assistance
difficulty
recency
critical failures
fieldwork requirement
```

Output:

```text
state
confidence
missing_requirements
review_priority
```

Example:

```text
state: INDEPENDENT

missing:
  - pressure_test
  - real_ghl_fieldwork
```

No AI needed.

---

# 69. Review Scheduler

Use a simple evidence-based scheduler.

Do not build a giant Anki clone.

Each skill gets:

```text
last_demonstrated
failure_rate
mastery_level
importance
review_due
```

The session builder mixes due review into current progression.

---

# 70. Session Builder

Also deterministic.

Inputs:

```text
available_time
active_campaign
current_gate
weak_skills
review_due
active_project
recent_failures
assistance_dependence
```

Then assembles a reasonable session.

The learner can always continue afterward.

No calendar lock.

---

# 71. Search

Bloomlab should eventually have fast global search.

Search:

- skills
- GHL features
- lessons
- glossary
- clients
- past exercises

Use a client-side search index initially.

No external search service needed.

---

# 72. Feature Flags

Use simple feature flags.

Examples:

```text
voice_calls
workflow_lab_v2
ai_negotiation
custom_objects
ghl_verification
```

This lets Fable build large features incrementally without exposing half-finished interfaces.

---

# 73. Testing Strategy

Bloomlab requires several test layers.

## Unit tests

For:

- simulator transitions
- grading
- mastery
- session selection
- pricing math
- synchronization logic

## Scenario tests

Example:

```text
cancelled appointment must not receive reminder
```

## Content tests

All IDs valid.

No missing prerequisites.

No unknown GHL features.

## UI tests

Core user workflows.

## Responsive tests

Desktop/tablet/mobile.

## Visual review

Design Bible compliance.

---

# 74. Simulator Regression Suite

This is mandatory.

Every GHL behavior Bloomlab simulates gets test fixtures.

Example:

```text
WAIT-001 fixed wait
WAIT-002 appointment relative wait
WAIT-003 late enrollment
WAIT-004 cancellation during wait
```

If Claude modifies the wait engine later and breaks `WAIT-003`, CI fails.

This is how we stop “one fix broke three old exercises.”

---

# 75. Continuous Integration

GitHub Actions should run:

```text
typecheck
lint
unit tests
simulator tests
content validation
build
```

on pull requests and main pushes.

Deployment only happens after checks pass.

---

# 76. Preview Deployments

Each substantial branch/PR should be previewable.

You should be able to inspect it on your phone before merging.

Especially for:

- mobile layout
- touch
- holographic interaction
- Workflow Lab
- Call Room

---

# 77. Accessibility Tests

Automated checks can catch basic issues.

Still require manual review for:

- keyboard operation
- focus flow
- touch
- reduced motion
- holographic contrast
- drag alternatives

---

# 78. Performance Budget

Bloomlab is visually rich, but it must remain fast.

Targets:

- initial app shell loads quickly
- simulator interaction remains 60fps where feasible
- no constant expensive holographic animations
- route-level code splitting
- lazy-load heavy simulators
- preload only likely next content
- stop animations off-screen

Workflow Lab does not need to load while reading an Academy lesson.

---

# 79. Error Boundaries

Each major environment should fail independently.

If Call Room crashes:

CRM Lab should still work.

If Claude fails:

exercise submission remains saved.

If ElevenLabs fails:

show transcript/text fallback.

If Google transcription fails:

keep recording and allow retry.

If sync fails:

keep local progress.

No external service should be capable of destroying study progress.

---

# 80. Backup

Provide:

**Export Bloomlab Data**

Produces a versioned encrypted or structured backup containing:

- progress
- evidence
- projects
- notes
- simulator saves
- portfolio metadata

Large R2 files can be referenced or optionally bundled later.

This gives you another safety layer beyond sync.

---

# 81. Import

Bloomlab should eventually support:

**Restore Backup**

Validate:

- backup version
- schema
- user confirmation

Never overwrite current data silently.

---

# 82. Content Update Safety

When Bloomlab updates a GHL feature:

do not mutate completed historical exercises.

Example:

GHL changes a workflow action in November.

New exercises reference updated feature version.

Old attempt still records what existed when completed.

---

# 83. GHL Freshness

Every GHL feature record includes:

```text
last_verified
source
status
```

Possible status:

```text
current
needs_review
deprecated
removed
```

Bloomlab can flag:

**This feature has not been verified recently.**

Eventually a maintenance script can generate a review list.

---

# 84. Architecture Anti-Patterns

Fable must not:

- store everything in one giant React state object
- put simulator logic inside components
- call Claude directly from browser
- store API secrets client-side
- hardcode lessons into pages
- duplicate GHL feature definitions
- make separate fake databases for every lab
- use AI to calculate deterministic answers
- use localStorage for all state
- make server connection mandatory for ordinary exercises
- put huge JSON blobs into one D1 row
- rebuild curriculum relationships at runtime
- silently resolve sync conflicts
- introduce infrastructure just because Cloudflare offers it
- add realtime infrastructure before Bloomlab needs realtime behavior

---

# 85. v1 Infrastructure

The actual infrastructure required for the first usable Bloomlab should be surprisingly small:

```text
GitHub
Cloudflare Worker
Cloudflare Static Assets
Cloudflare D1
Cloudflare R2
Browser IndexedDB
Claude API
ElevenLabs
Google Speech-to-Text
```

That is enough.

No Redis.

No Supabase.

No Firebase.

No separate Node server.

No Kubernetes.

No microservice zoo.

No vector database unless a real feature later proves it necessary.

---

# 86. Initial Build Order

## Foundation

1. repo
2. React/Vite/Workers
3. design tokens
4. routing
5. D1
6. sync key
7. IndexedDB
8. content schemas
9. content compiler

## Learning Core

10. skills
11. campaign
12. evidence
13. mastery
14. exercise runner
15. session builder

## Simulator Core

16. simulator data model
17. event engine
18. simulation clock
19. contact engine
20. workflow engine
21. grading engine

## Interface

22. Workflow Lab
23. CRM Lab
24. Funnel Lab
25. client workspace

## Commercial Skills

26. pricing exercises
27. inbox simulation
28. negotiation

## AI

29. Claude gateway
30. rubric evaluation
31. AI budget governor

## Voice

32. ElevenLabs asset system
33. recording
34. Google transcription
35. Call Room

## Larger Expansion

36. calendars
37. payments
38. reporting
39. portfolio
40. advanced GHL

---

# 87. What Does Not Belong in v1

Do not let Fable disappear for days building:

- full user authentication
- admin panel
- commercial billing
- multi-user teams
- instructor dashboards
- live multiplayer
- live mentor sessions
- social feed
- public profiles
- marketplace
- native mobile apps
- full realtime voice
- full GHL API verification
- arbitrary plugin system

Those are potential future products.

Bloomlab first needs to make **Ary better at funnels, GHL, marketing, sales, pricing, and client work**.

---

# 88. Technical North Star

Bloomlab should be:

**local-first**

so it feels immediate.

**server-synced**

so progress follows the learner.

**event-driven**

so systems behave predictably.

**content-driven**

so curriculum can grow without rewriting the app.

**deterministically graded**

where objective correctness exists.

**AI-assisted**

only where judgment genuinely requires it.

**versioned**

so GHL changes do not corrupt old learning.

**modular**

so a broken Call Room does not break Workflow Lab.

**simple enough**

that one person plus Claude can actually maintain it.

---

# 89. Locked Architecture

### Client
React + TypeScript + Vite

### Hosting/API
Cloudflare Workers + Static Assets

### Local persistence
IndexedDB

### Synced relational persistence
Cloudflare D1

### File/audio storage
Cloudflare R2

### State architecture
Local-first + checkpoint sync

### Simulator
Deterministic TypeScript event engine

### Simulator execution
Web Worker where workloads justify it

### Learning content
Git-tracked YAML + Markdown/MDX

### Validation
TypeScript schemas / Zod

### AI
Claude API behind Worker

### AI philosophy
Limited and budget-controlled

### Voice generation
ElevenLabs

### Speech recognition
Google Cloud Speech-to-Text V2

### Source control
GitHub

### CI
GitHub Actions

### Auth
None initially

### Cross-device identity
Bloomlab Sync Key + device sessions

### Realtime infrastructure
None initially

### Durable Objects
Future option

### Queues
Future option when background processing warrants them

### Real GHL
Required for selected practical projects, not for everyday simulator exercises

This should be considered the default architecture unless implementation testing exposes a concrete reason to change it.