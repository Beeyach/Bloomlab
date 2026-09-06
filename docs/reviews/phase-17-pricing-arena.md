# Phase 17 — Pricing Arena

Reviewed 2026-09-06, against `main` at `5a66038` plus the Phase 17 branch.
Requirements: **EXR-016**, **SAL-009**, **SAL-016**, **PRI-001**, **PRI-002**, **PRI-003**,
**PRI-004** (all P1).

## What was built

A deal desk inside the runner that already existed, driven by content, with one rule underneath it:
the learner prices what the client asked for, and what the work costs is not on the screen while
they are deciding.

**The desk** is seven areas of one object. What they asked for, in the client's own words. What is
in the deal, as scope lines the learner can take out. The price. How it is paid. How long it takes.
What recurs. What is not included, written by the learner rather than picked from a list. Change
anything and the other areas move, because they are all views of the same eight answers.

**What the learner sees** is their own arithmetic and their own promises. The one-time total, what
is due on signature, what is left on delivery, what a monthly fee comes to over a year. Every one of
those is built from numbers they set, which is why showing them costs nothing.

**What they do not see** is the hours behind any scope line, what an hour costs to deliver, the
floor, the contingency or the margin. The price column on every scope line reads as a dash. That is
the point: a desk that shows the cost turns pricing into subtraction, and subtraction is the habit
the phase exists to break.

**Taking a line out** says what it leaves the client with, in the client's terms. Take out the Meta
Lead Ads connection and Glowhaus reads "Leads keep arriving by email and somebody retypes them", and
the requirement Priya stated about Dana retyping every lead changes from "The deal answers this" to
"Nothing left in the deal answers this". Take out the discovery calendar on the Summit deal and the
no-show recovery that needs it is named. The two booking calendars cannot be taken out at all: they
are the brief's own promise, and without them there is nothing to open Round Rock with.

**After submitting**, the whole hidden half appears at once: the hours the kept scope came to, what
the revision round and the compressed timeline added, what it all cost at the rate the exercise
authors, the contingency the scenario's own risk score asked for, what was quoted, the margin it
carried, and what a 40% and a 55% margin would each have needed. There is no correct price line,
because there is not one.

## No single correct price, and a floor under all of them

The engine judges four things and none of them is a target number:

- **Does the quote clear what delivering the scope costs?** That is the critical failure. Twenty-two
  hours at $55 is $1,210 on the Summit deal, and $1,209 fails at any score.
- **Does it carry the risk this client brings?** Cost plus the contingency the scenario's `risk`
  score asks for. A quote can clear the floor and still not cover the risk, and the two are reported
  separately.
- **Does it hold a margin the business can work at?** Measured on revenue, with the retainer left
  out, so a thin build attached to a good retainer still reads thin.
- **Does it charge for the scope it promised?** Every requirement still answered, no line left
  depending on something removed, no locked line dropped, the deposit inside the total, the rush fee
  agreeing with the timeline.

$2,200 and $3,200 both pass the Summit deal on every economic check. $1,200 fails and says why. Take
the migration and the handover out and the build is seventeen hours, so $1,600 now clears the floor
— and the checks say which promise that deal stopped keeping.

## The critical rule that was wrong, and what replaced it

The Phase 5 seed had:

```yaml
critical_failures:
  - id: c1
    path: price.total
    operator: gte
    value: 1200
```

Two things were wrong with it and one thing was not. It was **not** inverted: `grade.ts` fails a
critical assertion when it does not pass, so a critical check states the condition that must hold,
and `gte 1200` reads correctly as "the total must be at least 1200". What was wrong is that
`price.total` was a path nothing in the product produced, so the exercise could not be run at all,
and that 1,200 traced to nothing: the scenario says 22 hours, and no rate anywhere turned 22 hours
into 1,200.

It is now `price.at_or_above_floor`, where the floor is the included scope hours (plus revision and
rush hours) at the rate the exercise authors. Changing the scope changes the floor, which is what
makes a reduced deal defensible at a lower price. A content cross-check now fails the build when a
pricing block's scope hours and its scenario's `estimated_labor_hours` disagree, so the two halves
of an exercise's economics cannot drift apart (D-163).

## The hourly cost is authored, not invented

Nothing in the source establishes a universal hourly delivery cost, so the engine does not carry
one. `pricing.cost.hourly_cost` lives in the exercise file, alongside the contingency per point of
risk, the margin band and the timeline policy. Both Phase 17 exercises author $55, which is a
policy of the business doing the work rather than a fact about the client; a different business
would author a different number and the same quotes would be judged differently (D-161).

## What is deterministic, and what is not

Everything above is arithmetic or a promise kept, and all of it runs today.

`EX-PRICE_IT-glowhaus-two-locations` is graded `deterministic`: it passes end to end, reports a real
score and produces `sales_use` evidence. `EX-PRICE_IT-summit-application-funnel` is `mixed` and
names `PRICING_REASONING_RUBRIC_V1`, so it reports its deterministic score and `rubric_pending`
until Phase 19. Nothing reads the learner's explanation, nothing scores prose, and nothing pretends
to.

The rubric itself was not edited. Its first item ("the price does not fall below the estimated labor
cost") now duplicates a check the engine makes deterministically, but changing a rubric changes a
contract attempts were judged under, so it stays as it is and the deterministic check wins where
they overlap.

## The schema refuses what could not honestly be priced

The content build fails on: a scope dependency loop; a removable line that does not say what
removing it leaves behind; a line requiring itself, or requiring a line that does not exist; a
requirement pointing at scope that does not exist; a scope-training exercise missing any of the
thirteen dimensions; a pricing block on anything but PRICE IT; a PRICE IT with no pricing block or
no scenario; a check on a price figure the engine does not produce, or on a scope line the exercise
does not have; a proposal that is not all eight sections, or two fields claiming the same section;
scope hours that disagree with the scenario's estimated labor hours; and a priced scenario with no
economics at all.

## Independent audit findings

Independent review found four correctness gaps after the first implementation report.

1. **Invalid values could lower the deal cost.** The number inputs had HTML minimums, but the
   parsers accepted negative values and `dealBasis` multiplied a negative revision count into the
   cost. Pricing parsers and quote normalization now reject impossible negative values, and the
   deal basis defensively clamps malformed legacy revisions. Regression tests cover negative money,
   revisions, deposits and timelines (D-165).
2. **Required PRICE IT constraints could be averaged away.** The grader treated required rows as a
   hard gate only for FUNNEL ASSEMBLY. A PRICE IT attempt could therefore miss a required deal
   constraint and still cross 70% on other rows. PRICE IT required assertions now produce
   `required_failure`, so all eight required answers and required deal constraints have to hold
   (D-165).
3. **The margin floor used the rounded label.** A true 39.6% margin rounded to 40% and passed a 40%
   policy. The display may still round to a whole percent, but the gate compares the quote against
   the exact revenue needed for the authored margin. The reveal says the percentage is rounded and
   names the exact dollar floor when it misses (D-165).
4. **The proposal claimed continuity that did not exist.** Its brief said to use the learner's own
   PRICE IT numbers, but no Phase 17 path injects a previous attempt into this WRITE IT exercise.
   The proposal is now explicitly standalone and carries the priced scope it asks the learner to
   turn into the eight sections. Persistent cross-stage continuity remains Boss Client work
   (D-166).

The audit also rechecked the original `price.total gte 1200` question. The operator itself was not
inverted: critical assertions state the condition that must hold. The real defects were the missing
state path and the untraceable 1,200 number, which D-163 already replaced with the derived floor.

## Verification

- **1456 tests** (1360 before), across:
  - `apps/web/src/exercise/pricing/pricing.test.ts` — 32 tests on the math alone: rounding half away
    from zero and never to negative zero, a percentage over a zero denominator, the total with and
    without a rush fee, a deposit expressed both ways reaching the same canonical dollars, a
    percentage deposit that stays unset while there is no total, a deposit larger than the total,
    recurring excluded from the margin, margin against revenue rather than cost, the floor at
    exactly the cost and one dollar under it, cost falling when scope comes out and rising with
    revisions and a compressed timeline, and the rush fee in all four timeline combinations.
  - `apps/web/src/exercise/pricingCoverage.test.ts` — the requirements against the compiled
    curriculum: ten pricing concepts, thirteen scope dimensions, eight proposal sections plus the
    standalone priced-scope contract, scope
    hours matching every priced scenario, no hidden economics in authored learner-facing copy, the
    two defensible prices, the under-floor critical failure, and the smaller deal with a lower
    floor.
  - `apps/web/src/exercise/pricingRunner.test.tsx` — the real screen: seven areas, all eight
    answers, the requirement that stops being answered, the consequence text, the locked line that
    cannot be removed, the dangling dependency, the reload with the numbers and the exclusions
    intact, a scope decision and a fee typed in the same breath, and the hidden-economics check on
    the rendered desk.
- **`npm run review:pricing`**: 17 sections, PASS, in Chromium at 1440, 1024, 768, 390 and 320, plus
  the phone path, the keyboard path (Tab to a scope line, Space to remove it, Tab on to the price)
  and reduced motion. The hidden-economics check runs again at every width. Screenshots in
  `.review/pricing-*.png`.
- **The hidden-economics test was checked against a deliberate leak**: passing a real `priceImpact`
  to the scope lines instead of `null` fails it, so it is not passing vacuously.
- **Regression probes re-run**: `review:sales` (24 sections, PASS), `review:exercise`,
  `review:academy`, `review:keyboard`, `review:touch` — all pass.

## What did not pass, honestly

- **PRI-001 is PARTIAL.** Its acceptance criterion asks for a visible price change when a scope line
  is removed, and EXR-016 forbids showing hidden economics before submission. The learner sets one
  project fee for the whole deal, so there is no per-line price to subtract, and the removed line's
  delivery cost is exactly what may not be shown. The structural half is fully met and the economic
  half is shown after submitting. Recorded in D-162 rather than settled by rewording either
  criterion.
- **PRI-002 is PARTIAL.** All nine economics fields are required and stored on the scenario. The
  runtime math directly consumes estimated labor and risk; the remaining fields constrain the
  authored scenario and scope rather than each getting a second multiplier. Price, margin, scope
  and risk are evaluated. Reasoning feedback is not: the explanation is collected and preserved and
  the rubric is named, and Phase 19 executes it.
- **`review:learning`** cannot complete here. The Worker cannot reach the network to create a sync
  key, so the two-device half never starts. Re-checked on the stashed baseline in the same container
  with the same result, so it is the environment and not a regression. This is the same limitation
  recorded at the end of Phase 16.

## Boundaries held

- No AI call, no Anthropic SDK, no Worker AI route, no fake score. A mixed exercise reports
  `rubric_pending`, which is what it honestly is.
- No keyword counting standing in for judgment, and no reason length read as reasoning quality.
- No hidden economics on the desk before submission, checked by a test and again at all five widths
  by the probe. No hidden facts from the scenario in learner-visible copy.
- One source of truth for the arithmetic: the desk and the grader call the same functions, and the
  desk parses what the learner types with the same parsers the engine uses.
- No negotiation engine. `EX-NEGOTIATE_IT-summit-freelancer-quote` is untouched and still
  un-runnable, and Summit's freelancer-quote and budget-objection injectables stay unused.
- No voice, no Call Room. `EX-SAY_IT-summit-discovery` is untouched and still un-runnable.
- `PRICING_REASONING_RUBRIC_V1` is unedited.
