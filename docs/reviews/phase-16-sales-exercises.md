# Phase 16 — Sales Exercises

Reviewed 2026-09-06, against `main` at `7e391ca` plus the Phase 16 branch.
Requirements: **SAL-001** (P0) and **EXR-012**, **EXR-013**, **EXR-014**, **EXR-018**, **CONV-002**,
**SAL-002**, **SAL-003**, **SAL-004**, **SAL-005**, **SAL-006**, **SAL-007**, **SAL-008**,
**SAL-013** (all P1).

## What was built

Four work areas and a client thread, all inside the runner that already existed, all driven by
content. The rule underneath every one of them is the same rule Phase 15 used for numbers, applied
to selling: a claim has to point at something, and confidence is not evidence.

**Prospect it** shows three businesses and only what can be seen of each: a test enquiry that took
22 hours, an ad running today, a published price list, a footer badge. The learner picks Contact,
Maybe or Skip, names which of the five dimensions drove it, ticks the evidence behind those
dimensions and writes why. Halcyon is right to skip — eighteen-dollar classes and a booking app the
studio does not control — and Ridgeline is a defensible Maybe, so contacting all three fails the
deterministic half. A defended Skip scores exactly what a defended Contact scores.

**Audit it** gives the learner Northwind's public presence and one test enquiry, and asks them to
write their own findings. Every finding is Verified, Likely or Unknown. Verified needs something
observed first-hand behind it; Likely needs evidence and stays labelled an inference; Unknown needs
what would settle it. Anything else is an unsupported claim and costs points. The work area says so
the moment it happens: "Marked Verified with nothing you saw yourself behind it."

**Write it** is eight briefs covering all fifteen pieces EXR-014 and SAL-013 name — the cold email
and the follow-up, the reply to "what does this cost", the recap, the proposal explanation, the
scope answer, the Friday update, the blocker, the delay, the approval, the revision, the technical
explanation, the payment reminder, the upsell and the last email to a prospect who went quiet. Each
has a reader, a cap counted as the learner types, and the one next step it asks for.

**Explain it** asks for the same no-show system twice: once for Priya, who will never open a
workflow builder, and once for the builder who will maintain it. The two answers are separate
fields and the schema refuses an EXPLAIN IT that authors only one.

**The thread** is two authored conversations. Marcus answers email but not calls, so discovery
happens in writing; and nine days after the proposal, nothing. The client writes, the learner picks
what they are doing and writes back, and the client answers as themselves.

## What is deterministic, and what is not

Everything measured here is measured. Nothing here is judged.

Deterministic now: how many businesses got a decision, whether each decision is one the brief
accepts, whether every dimension named is backed by cited evidence, how many findings were written,
how each was classified, which ones stand up and which are unsupported claims, how many words each
message is against its cap, whether each message names one next step, whether the first email cites
something observed, how many glossary terms an owner explanation used, which parts of the frame the
markers found, how many turns the thread ran, what share of it the learner wrote, whether a pitch
landed before the client agreed, which discovery topics came up, and whether it ended on a next
step.

Owed to Phase 19: whether the email is any good. Whether the reason is sound as prose. Whether the
explanation is clear. Whether the finding is worth making. Every selling exercise is `mixed`, and a
learner who does everything right sees a score of 100 with `rubric_pending` and the sentence that
says the written half waits for the AI gateway. That is what it honestly is.

The line matters most where it would have been easiest to blur. "Skip with sound reasoning can
score full marks" could have been implemented as a length check on the reason. It is not: the
decision has to be one the evidence carries, and every dimension named has to have cited evidence
behind it, and a two-hundred-word reason with nothing ticked scores nothing. A test pins that.

## The evidence boundary

A sales exercise's `sales.evidence` is the whole of what the learner can see. A client's and a
scenario's `hidden_facts` are not addressable: an id that is not in the pack supports nothing, and
the content build now fails if a hidden fact's own words appear in an evidence observation, an
instruction, a hint or a client's message. Northwind's 22-hour reply is evidence; Northwind's quote
follow-up rate is not, and the exercise's nudge says so in those terms.

Second-hand evidence is marked as such and can carry a Likely and nothing stronger. Three reviews
mentioning slow callbacks are real and are not something you watched happen.

## The thread, and why it branches on a move

Phase 19 owns the only thing that could read free prose, so the thread asks the learner to say what
they are doing — ask, say it back, propose a system, ask for a decision, set the next step — and
branches on that. The message itself is written by the learner and kept whole for the rubric.

Sending without picking a move is allowed and takes the authored fallback: the client asks what was
meant. That was a deliberate choice over inferring an intent from keywords. It is honest, it is what
a real person does with an unclear email, and it gives SAL-005 a real signal for the early pitch
rather than a guess.

Nothing in either thread says "Correct." A test walks every authored node to check it, and the probe
checks the rendered page.

## Talk share, at the boundary

Talk share is the learner's words over the whole thread's words, rounded to a whole percent, from
one function. Exactly 60 is not penalised; 61 is. A thread with nothing in it reports nothing rather
than 0%, which is the same rule REP-003 established for a rate over no denominator. The learner sees
the same figure the check applies, because it is the same call.

A pitch counts as early when it lands at or before the turn the client agreed on: that message was
written before its author had read the agreement.

## What the build refuses

The content schema fails the build on: an AUDIT IT with no evidence, or with nothing observed
first-hand so that nothing could ever be Verified; a prospect list where no business is right to
skip; a Maybe that does not name what it is waiting on; a dimension backed by evidence about a
different business, or by evidence the exercise never shows; an EXPLAIN IT with one audience; a
thread with a duplicate node id, a branch to a node that does not exist, a branching node with no
fallback, no ending, or a node nobody can reach; a check on a sales figure the family does not
produce, on a message field that does not exist, on a frame part with no markers behind it, or on a
discovery topic the thread never covers; and a hidden fact in learner-visible copy.

Thirty-one schema tests exist because each of those is a way an exercise could reach a learner as
something that cannot honestly be done.

## Persistence bugs found in review

`review:sales` typed a cold email, typed the follow-up, ticked the evidence, reloaded, and got the
follow-up back empty.

Every keystroke saves, and each save is a read-modify-write against one workspace row. Two of them
in flight against different fields could interleave: the second read the row before the first had
written it and put back a copy without the first edit in it. The learner would never see it happen.
The screen still showed what they typed.

Writes are queued per attempt so those edits cannot overtake one another. Independent review found
the matching submit-side race: a learner could type and immediately press Run it while the latest
save was still queued. Finalization used the older attempt object supplied by React, so the finished
attempt could omit the last edit even though that edit was on its way to IndexedDB. Submission now
waits for the attempt's write queue, reloads the persisted attempt and grades that response. A
regression deliberately starts finalization before the last save resolves and proves the last edit
is both graded and kept on the finished attempt.

The independent pass also found that the PROSPECT IT family schema accepted two businesses even
though EXR-012 requires at least three. The shipped exercise already had three; the validator now
enforces the same minimum for every future PROSPECT IT exercise.

These are shared Phase 9 persistence semantics and a Phase 16 family invariant, not probe
workarounds.

## Rubric versioning

Two rubrics moved to V2 because their contract materially changed: `SALES_DISCOVERY_RUBRIC_V2` now
carries all fourteen discovery topics plus technical discovery, and `WRITTEN_COMMUNICATION_RUBRIC_V2`
carries the six cold-email concepts, the audience rule and the frame. `AUDIT_EVIDENCE_RUBRIC_V1` did
not change and was not versioned.

Rubric items now name what they judge as data (`topics`, `concepts`), so "the rubric covers all
fifteen topics" is fifteen parameterised test cases rather than a claim in a document. V1 of each
rubric is untouched and stays valid for the attempts it judged.

## Verification

- **1358 tests** (1196 before), across:
  - `apps/web/src/exercise/sales/sales.test.ts` — the five projections, the evidence rules, the talk
    share boundary, the early pitch, and full deterministic runs of four exercises.
  - `apps/web/src/exercise/salesRunner.test.tsx` — the real screens: three businesses, three
    classifications and no fourth, the reload of each work area, the thread's branches and fallback,
    the finished thread on the attempt record, and the two-edit regression.
  - `apps/web/src/exercise/salesCoverage.test.ts` — the requirements against the compiled
    curriculum: fifteen written pieces, fifteen discovery topics, six writing concepts, five closing
    situations, and no hidden fact in any learner-visible string.
  - `packages/content-schema/test/sales.test.ts` — every schema refusal listed above.
- **`npm run review:sales`**: 24 sections, PASS, in Chromium at 1440, 1024, 768, 390 and 320, plus
  the keyboard path (a radio group reached by Tab and moved through with the arrow keys) and reduced
  motion. Screenshots in `.review/sales-*.png`.
- **Regression probes re-run**: `review:exercise`, `review:academy`, `review:crm`, `review:workflow`,
  `review:funnel`, `review:calendar`, `review:reporting`, `review:incident`, `review:rail` — all
  pass, except the one known section below.

## What did not pass, honestly

- **`review:workflow` → `five-hundred-events`** still misses its frame ceilings in this container:
  p95 was inside 50 ms this time, the 100 ms maximum-frame and long-task ceilings were not. This is
  the carry-over Phases 13, 14 and 15 recorded, in a path Phase 16 does not touch. PERF-002 still
  needs one run on the reference desktop.
- **`review:learning`** cannot complete here: its second device fails to link, so the two-device
  half does not run. The same failure was reproduced on `main` at `7e391ca` in the same container
  before this review, with an identical signature, so it is the environment and not a regression.
  The single-device half passes on both.

## Boundaries held

- No AI call, no Anthropic SDK, no Worker AI route, no "generate this for me" button anywhere.
- No pricing arena, no deal desk, no negotiation engine; the closing thread stops at the decision
  and the next step and never quotes or trades scope.
- No voice, no Call Room, no STT. `EX-SAY_IT-summit-discovery` is untouched and still un-runnable.
- No live business research, no scraping, no real email.
- No hidden client state rendered anywhere, and no answer key in the markup: a test checks that the
  authored evaluation and the Maybe's unresolved condition are not in the DOM.
