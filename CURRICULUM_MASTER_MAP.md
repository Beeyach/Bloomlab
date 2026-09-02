# CURRICULUM MASTER MAP

Working curriculum specification derived from `BLOOMLAB_MASTER_SPEC.md` §10–§24, §36–§37, §137–§138, §154–§157. This is the map the content in `content/` must realise. Requirement IDs: CUR-*, PRD-006, PRD-010, PORT-003, CNT-009.

## 1. Structure (CUR-001, CUR-016)

- One **master skill graph**. Every skill has one ID and one home territory.
- **Campaigns** are curated paths through the graph that reference skill IDs. Skills are never duplicated inside campaigns. `FIELD_READY` references skill IDs; `ADVANCED_AUTOMATION` references some of the same IDs plus harder ones.
- Nine **territories** plus **JUDGMENT**, which sits centrally and is measured across all territories.

| Territory | Scope |
|---|---|
| STRATEGIZE | Funnels, business logic, offers, conversion, funnel economics |
| BUILD | Pages, funnels, forms, surveys, calendars, payments |
| AUTOMATE | Workflows, communication, timing, logic, lifecycle automation |
| ARCHITECT | CRM, custom fields, custom values, opportunities, pipelines, companies, custom objects |
| DIAGNOSE | QA, troubleshooting, metrics, attribution, deliverability, experimentation |
| CONNECT | DNS, HTTP, JSON, webhooks, APIs, GitHub, Cloudflare, Google Cloud, technical implementation |
| SELL | Prospecting, audits, discovery, calls, pitching, pricing, negotiation, closing |
| DELIVER | Proposal, onboarding, project planning, communication, handoff, reporting, retention |
| SCALE | Snapshots, reusable vertical systems, agency architecture, SaaS concepts, Marketplace |
| JUDGMENT | Central; measured across all territories |

## 2. Judgment competencies (CUR-017)

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

Reward "I don't know yet, but this is how I would verify it." over fabricated confidence.

## 3. FIELD_READY campaign — competency gates (CUR-002 … CUR-015)

Gates are competency stages, not days. A gate is passed by mastery evidence, never by time.

| Gate | Name | Trains / assesses |
|---|---|---|
| 0 | Placement | funnel reasoning · lead capture · workflow basics · fields vs values · pipeline basics · basic pricing · written prospect response · short spoken discovery interaction. Strong demonstrated basics clear early requirements. |
| 1 | Funnel Thinking | customer journey · funnel purpose · traffic intent · offers · friction · CTA · conversion · funnel math · bottleneck thinking |
| 2 | Lead Systems | lead capture · forms · confirmation · follow-up · CRM capture · pipeline · next action |
| 3 | GHL Data Foundations | contacts · tags · custom fields · custom values · opportunities · pipelines · assignments · correct architecture decisions |
| 4 | Workflow Foundations | triggers · filters · actions · waits · If/Else · re-entry · timing · communications · pipeline automation |
| 5 | Booking and Qualification | forms · surveys · qualification · calendars · routing · reminders · cancellations · reschedules · no-shows |
| 6 | Conversion and Copy | page hierarchy · message match · CTA placement · conversion copy · proof · qualification friction · mobile conversion design |
| 7 | Diagnosis and QA | workflow troubleshooting · funnel troubleshooting · logs · edge cases · metrics · pre-launch QA · bottleneck diagnosis |
| 8 | Prospecting and Audits | ICP · prospect selection · evidence · research · outreach · cold email · follow-up · audit quality |
| 9 | Discovery and Selling | cold calls · discovery · Zoom-style calls · listening · questions · diagnosis · explaining systems · pitching outcomes |
| 10 | Pricing and Negotiation | scope · fixed pricing · recurring pricing · deposits · revisions · exclusions · risk · negotiation · reducing scope · walking away |
| 11 | Proposal and Delivery | proposal · acceptance · onboarding · dependencies · build order · client updates · QA · handoff |
| 12 | Field Ready Capstone | No instructional handholding. diagnose → design → price → negotiate → propose → build → test → explain, with part of implementation performed in real GHL. |

## 4. Territory curricula

### 4.1 STRATEGIZE (CUR-018)

**Field Ready:** customer path · awareness · intent · traffic source · offer · CTA · friction · trust · qualification · conversion points · funnel math · CPL · booking rate · show rate · close rate · CAC basics · AOV · LTV basics · bottleneck reasoning.

Core funnel families: lead capture · lead magnet · consultation · appointment · quote request · application · assessment · VSL-to-call · content-to-booking · service inquiry · reactivation.

**Practitioner:** webinar · evergreen webinar · challenge · workshop · direct purchase · checkout · order bump · upsell · downsell · subscription · trial · membership · course enrollment.

**Advanced:** multi-funnel architecture · lifecycle strategy · retention · referral · churn prevention · experimentation · advanced diagnosis.

**Specialist:** complete business-system architecture.

### 4.2 BUILD (CUR-019, CUR-029)

- **Conversion Layout:** hierarchy · first screen · headline · CTA placement · proof · objection handling · FAQ · forms · mobile composition · thank-you flow.
- **Copy:** customer language · desired outcome · pain · mechanism · benefit · headline · subhead · CTA · form microcopy · reminder copy · sales copy · nurture copy · reactivation. The learner increasingly writes without automatically using AI.
- **GHL Funnel Builder:** current real features only.
- **GHL Websites:** pages · navigation · domains · responsive behavior · reusable/global elements · tracking · SEO basics · scripts · QA.
- **Forms:** field mapping · required fields · validation · hidden data · consent · confirmation · workflow triggering.
- **Surveys:** applications · multi-step qualification · conditional logic · scoring · routing · disqualification.
- **Calendars:** availability · appointment duration · buffers · notice · timezone · cancellation · reschedule · team scheduling · round robin · service calendars · classes · resources · locations · complex scheduling later.
- **Payments (progressive):** products · prices · one-time · recurring · checkout · payment links · order forms · invoices · estimates · contracts · deposits · failed payment · refund · coupons · taxes · advanced revenue flows later.

### 4.3 AUTOMATE (CUR-020) — one of Bloomlab's largest areas

Teach actual GHL concepts. Only real current GHL trigger/action names or clearly marked training approximations (GHL-006).

- **Foundations:** event · trigger · filters · actions · state · enrollment · execution · exit.
- **Core triggers (verify names):** form submission · survey submission · appointment events · contact changes · tag events · opportunity changes · pipeline stage events · inbound communication · payment/order events.
- **Core actions (verify names):** Send SMS · Send Email · Add Tag · Remove Tag · update data · create/update opportunity · assign user · internal notification · Wait · If/Else · webhook · workflow enrollment/removal.
- **Wait logic:** fixed delay · appointment-relative wait · time/date · business hours · event waiting · timezone · late enrollment.
- **Branching:** If/Else · AND/OR · comparisons · dynamic values · fallback · multiple paths.
- **Re-entry:** duplicate enrollment · repeated triggers · overlapping workflows · duplicate messages · exits · race conditions later.
- **Common systems:** immediate lead response · nurture · booking reminders · cancellation · reschedule · no-show recovery · pipeline movement · internal alerts · assignment.
- **Advanced:** modular automation · naming · workflow responsibility · date logic · webhooks · data manipulation · ecommerce automation · reliability · idempotency concepts · race conditions · large automation architecture · custom workflow extensions later.

### 4.4 ARCHITECT (CUR-021)

- **Contacts:** identity · source · contact activity · owner · notes · tasks · DND.
- **Tags:** correct and incorrect use.
- **Custom Fields:** data types · contact fields · opportunity fields · forms · workflows · reporting impact.
- **Custom Values (major competency):** reusable account values · merge variables · configuration portability · snapshot-friendly design · when not to use custom values.
- **Pipelines:** stage design · status · value · owner · meaningful sales process representation.
- **Opportunities:** create/update · multiple opportunities · stage movement · value · fields · ownership.
- **Smart Lists:** segmentation. **Companies:** B2B use.
- **Custom Objects (advanced):** schemas · records · associations · workflows · limitations · when excessive.
- **Data Modeling:** realistic problems, e.g. "Veterinary clinic has customers, pets, appointments, and treatment plans." The learner decides what each thing should be.

### 4.5 DIAGNOSE (CUR-022)

- **QA — Bloomwired QA protocol:** pages · forms · links · validation · field mapping · workflow entry · workflow exit · SMS · email · calendar · cancellation · rescheduling · pipeline · payments · tracking · desktop · tablet · mobile · edge cases.
- **Workflow troubleshooting:** execution logs · waiting · skipped actions · filters · duplicate enrollment · missing data · incorrect branch · failed actions.
- **Funnel troubleshooting:** broken links · forms · domains · routing · tracking · responsive issues.
- **Deliverability:** sending domains · authentication concepts · reputation · warming · bounce · spam · hygiene · opt-out.
- **SMS/Phone reliability:** numbers · DND · failed sends · carrier issues · routing · compliance concepts.
- **Analytics:** visitor → lead · lead → booked · booked → show · show → sale · stage conversion · close rate · revenue · source · UTM · attribution · dashboard reasoning.
- **Experimentation:** baseline · hypothesis · change · measurement · confounding · weak evidence.

### 4.6 CONNECT (CUR-023) — creates technical independence

- **DNS:** domains · subdomains · DNS records · SSL · Cloudflare concepts.
- **JSON:** read and modify structured payloads.
- **HTTP:** GET · POST · PATCH · DELETE · headers · body · response codes.
- **Webhooks:** inbound · outbound · payloads · authentication · mapping · errors.
- **APIs:** endpoint · resource · authorization · scopes · pagination · rate limits · errors · retries. Current GHL API practices only; never obsolete patterns as current.
- **Git and GitHub:** repo · commits · branches · rollback · issues · releases · secrets.
- **Cloudflare:** Workers · endpoints · transformations · webhook receivers. **Google Cloud:** where useful.
- **JavaScript (for GHL/operator work):** payload transformation · simple logic · browser debugging · custom page behavior · serverless functions.
- **Marketplace / App extension:** Specialist track only.

### 4.7 SELL (CUR-024) — a large territory

- **ICP:** fit · economics · recurring need · technical fit · access to decision maker.
- **Research:** traffic · lead capture · booking · follow-up · sales · retention.
- **Evidence-based audit:** every finding VERIFIED (directly observed) / LIKELY (evidence suggests) / UNKNOWN (needs confirmation). Penalise unsupported claims.
- **Prospect qualification:** some prospects should be skipped.
- **Cold email:** opener · evidence · relevance · problem · CTA · follow-up. **Social outreach** where useful. **Cold calls:** train speaking.
- **Discovery:** opening · agenda · current process · desired result · pain · volume · impact · urgency · tools · staff · stakeholders · budget · decision process · next step. **Listening:** penalise excessive talking and premature pitching. **Technical discovery:** relevant systems questions.
- **Presentation:** problem → consequence → system → outcome. **Client language:** no unnecessary GHL jargon.
- **Pricing:** fixed · hourly · project · setup · recurring · retainer · margin · complexity · risk · minimum viable project pricing.
- **Scope:** deliverables · assumptions · exclusions · revisions · dependencies · location count · workflow complexity · migration · integration · rush work · copy · design · support.
- **Negotiation:** budget objection · competitor price · discount request · scope reduction · phased project · payment terms · deposit · concessions · silence · walking away. A lost deal can receive a high score.
- **Closing:** asking for commitment · proposal follow-up · ghosting · decision delay · next-step control.

### 4.8 DELIVER (CUR-025)

- **Proposal:** problem · recommendation · scope · price · timeline · assumptions · exclusions · acceptance.
- **Change requests:** scope control.
- **Onboarding:** access · credentials · domains · calendars · users · branding · copy · payment · expectations.
- **Build order:** data → pipeline → calendar → forms → workflows → funnel → tracking → QA, not random building.
- **Client communication:** update · blocker · delay · approval · revision · technical explanation.
- **Handoff:** documentation · training · ownership · support.
- **Retention (later):** reporting · maintenance · retainer · expansion · referral · account strategy.

### 4.9 SCALE (CUR-026) — later-stage

Templates · naming standards · deployment checklist · **Snapshots** (what belongs in a snapshot, reusable values, fields, workflows, funnels, calendars, forms, portability, client-specific cleanup, QA, versioning) · potential Bloomwired assets (Med Spa Core, Coach Lead Path, Home Services Follow-Up, Photographer Inquiry System) · vertical systems / productization · agency architecture (subaccounts, permissions, usage concepts, account structure) · SaaS concepts, white label, Marketplace — Specialist only.

### 4.10 GHL AI (CUR-027)

Not taught before the learner understands the deterministic system underneath. Later: when a normal workflow is better than AI · Conversation AI · Voice AI · workflow AI actions · current GHL agent products · knowledge bases · tools · shared skills/capabilities · MCP/external tools where current · escalation · permissions · hallucination risk · cost · logs · irreversible actions. Verify current product names from official GHL sources; GHL changes frequently.

### 4.11 Supporting GHL specialties (CUR-028)

In the full graph, not all in Field Ready: reputation · review requests · Social Planner · courses · memberships · communities · client portal · affiliate management · ecommerce · blogs · SEO tools · IVR/phone · prospecting tool · ad reporting · rentals · services · resources · contracts · estimates · invoices · payment links · subscriptions · advanced reporting.

## 5. Projects

### Starter projects (CUR-030)

| Project | Flow |
|---|---|
| Lead Capture System | Traffic → page → form → CRM → follow-up → pipeline |
| Consultation Booking | Qualification → calendar → confirmation → reminders → cancellation → no-show recovery |
| Application Funnel | Survey/application → qualification → routing → pipeline → booking |
| Reactivation | Existing database → segmentation → outreach → response → booking |
| Full Capstone | Complete fictional Bloomwired client |

### Capstone exam (CUR-031)

No normal hints. Learner receives business, offers, staff, metrics, current systems, problems, hidden edge cases, client communications, budget constraints. Must diagnose, architect, build, test, troubleshoot, price, negotiate, propose, explain. Major implementation requires real GHL fieldwork. Bloomlab asks: why a custom field? why this pipeline? what happens with late booking? what breaks with a second location? what if no phone exists? what happens after reschedule? why this price? what would you remove for a lower budget?

### Field Ready pass (MAS-010)

Sufficient evidence required across funnel strategy, GHL implementation, automation, CRM architecture, troubleshooting, sales, pricing, negotiation, fieldwork, client explanation. Never one overall percentage.

### Post-Field-Ready paths (CUR-032)

| Path | Territory order |
|---|---|
| Automation Specialist | AUTOMATE → ARCHITECT → CONNECT |
| Funnel & Conversion Specialist | STRATEGIZE → BUILD → DIAGNOSE |
| Sales Operator | SELL → STRATEGIZE → DELIVER |
| Technical GHL Specialist | CONNECT → AUTOMATE → ARCHITECT → GHL AI |
| Agency Systems | DELIVER → SCALE → ARCHITECT |
| GHL AI Specialist | GHL AI → AUTOMATE → CONNECT |
| Bloomwired Operator Path (recommended) | Broad competency |

### Portfolio progression (PORT-003)

Field Ready: 1 Lead Capture + Follow-Up · 2 Consultation Booking System · 3 Application / Qualification System · 4 No-Show Recovery · 5 Full Bloomwired Client Capstone. Practitioner: 6 VSL / sales system · 7 paid product funnel · 8 multi-staff service system · 9 database reactivation · 10 client onboarding system. Advanced: 11 multi-location system · 12 API-integrated build · 13 reporting/attribution · 14 reusable vertical snapshot · 15 complex Boss Client. Specialist: 16 custom integration · 17 AI-assisted system · 18 marketplace extension · 19 migration · 20 full business architecture.

## 6. Persistent fictional clients (CNT-009, PRD-018)

Recurring businesses with persistent state rather than disposable scenarios. Initial industries: med spa · coach · consultant · therapist · photographer · realtor · gym/fitness · pet service · HVAC · roofing · cleaning · remodeling · dentist · chiropractor · law firm · accounting · recruiting · course creator · wedding vendor · B2B service.

## 7. Coverage matrices

### Content coverage (CUR-033) — generated from content data

| Skill | Learn | Guided | Practice | Fix | Independent | Pressure | Fieldwork | Sales Use |
|---|---|---|---|---|---|---|---|---|

### GHL coverage (GHL-007) — generated from registry + content

| GHL Feature | Skill | Simulator | Fidelity | Exercise | Fieldwork | Last Verified |
|---|---|---|---|---|---|---|

Both are derived by the content compiler (Phase 5). They are never maintained by hand.
