import { useCallback, useMemo, useRef, useState } from 'react';

import { Button, Field, Input, Select, StatusPill } from '@bloomlab/design-system';
import {
  canCreateContact,
  contentEventName,
  firstStep,
  stepOf,
  validateFunnel,
  visitorActions,
  type AccountState,
  type Funnel,
  type SimulatorScenario,
  type VisitAction,
} from '@bloomlab/simulator-core';

import type { PendingEvent } from '@bloomlab/simulator-core';

import type { StoredRun } from '../simulator/store';
import type { ExecutionResult } from '../workflow/execution';
import {
  VISIT_SOURCES,
  formStarted,
  formSubmission,
  funnelBooking,
  funnelPayment,
  newVisitId,
  newVisitor,
  performEvents,
  stepViewed,
  surveySubmission,
  visitEnded,
  visitStarted,
  type SubmissionValues,
  type Visitor,
} from './commands';
import { FunnelPage } from './FunnelPage';
import { visitorEventsSince, visitorLogWatermark } from './session';
import { money } from './edit';
import { fieldLabel, simulatorTime } from './words';
import styles from './funnel.module.css';

/**
 * SIMULATE: a visitor walks the funnel the learner built (FUN-001, FUN-002, FUN-003).
 *
 * The page is the same renderer PREVIEW uses, with working controls dropped into the capture
 * blocks — so what the visitor meets is the learner's architecture, never a canned page.
 *
 * Every action becomes a real account event through the one execution door (D-109): a form
 * submission is `FORM_SUBMITTED`, which the intake reducer validates against the referenced form
 * and which generates `CONTACT_CREATED` or `CONTACT_UPDATED` on the ordinary path; a booking is
 * `APPOINTMENT_BOOKED`; a checkout is `PAYMENT_RECEIVED`. The engine's own trigger matcher then
 * decides which workflows enrol. Nothing here writes a contact, and nothing here injects
 * `WORKFLOW_ENROLLED` — a workflow that fires, fired because the event actually matched it.
 *
 * A refusal is shown as a refusal. If the form has no such field, or the visitor gave no name and
 * the account has no contact to update, the engine says so and the visitor does not move on.
 */

/**
 * What this walk has done, and how much of it the account has been told (FUN-004, D-147). Held in
 * a ref rather than in state because it is a record of the past, not something the screen renders:
 * changing it must never cause a render, and a render must never lose it.
 */
interface VisitLog {
  id: string;
  started: boolean;
  steps: { id: string; blocks: number }[];
  recordedSteps: number;
  forms: string[];
  recordedForms: number;
  ended: 'left' | 'completed' | null;
  recordedEnd: boolean;
}

const newVisitLog = (firstStepId: string | null, blocks: number): VisitLog => ({
  id: newVisitId(),
  started: false,
  steps: firstStepId ? [{ id: firstStepId, blocks }] : [],
  recordedSteps: 0,
  forms: [],
  recordedForms: 0,
  ended: null,
  recordedEnd: false,
});

export interface VisitorRunProps {
  funnel: Funnel;
  run: StoredRun;
  scenario: SimulatorScenario;
  busy: boolean;
  perform: (
    command: (current: StoredRun) => Promise<ExecutionResult>,
  ) => Promise<ExecutionResult | null>;
}

/** One thing the account did because of the visitor, read out of the run's own history. */
interface ChainEntry {
  sequence: number;
  type: string;
  at: string;
  origin: string;
  detail: string;
}

export function VisitorRun({ funnel, run, scenario, busy, perform }: VisitorRunProps) {
  const account = run.state.account;
  const problems = useMemo(() => validateFunnel(funnel, account), [funnel, account]);
  const errors = problems.filter((issue) => issue.severity === 'error');

  const start = firstStep(funnel);
  const [visitor, setVisitor] = useState<Visitor>(() => newVisitor());
  const [stepId, setStepId] = useState<string | null>(start?.id ?? null);
  const [values, setValues] = useState<Record<string, SubmissionValues>>({});
  const [slot, setSlot] = useState<Record<string, string>>({});
  const [refusal, setRefusal] = useState<string | null>(null);
  /** Where in the run's log this visit began, so the chain shows this visit and not the account. */
  const [from, setFrom] = useState<number>(() => visitorLogWatermark(run));
  const [done, setDone] = useState(false);
  /**
   * The visit this walk is being recorded as (FUN-004, D-147).
   *
   * A walk is traffic, so it is recorded as traffic, through the same events an authored cohort
   * uses — and it travels in the *same commit* as whatever the visitor did. There is one writer
   * to a run at a time: telemetry on its own timer would race the learner's own submission, and
   * one of the two would be dropped by the Lab's single-flight guard. So this ref accumulates
   * what the visit has done and `owed` turns the unrecorded part into events, which ride along
   * with the next action.
   *
   * Telemetry needs a funnel the account actually holds, so an unsaved draft is walked without
   * being recorded and the screen says so rather than losing the visit silently.
   */
  const [source, setSource] = useState<string>(VISIT_SOURCES[0]);
  const recordable = Boolean(account.funnels[funnel.id]);
  const visit = useRef<VisitLog>(newVisitLog(start?.id ?? null, start?.blocks.length ?? 1));
  /**
   * Visits that ended with no commit to travel with — somebody pressed "Start over" halfway down.
   * They wait here and are written with the next action, because two commits in one tick are both
   * built against the run this render captured and the second would undo the first.
   */
  const abandoned = useRef<VisitLog[]>([]);
  /**
   * Where the visit came from is fixed the moment any of it is recorded: a visit does not change
   * its source halfway through, and the picker says so by becoming unavailable rather than by
   * quietly ignoring the change.
   */
  const [sourceLocked, setSourceLocked] = useState(false);

  const step = stepId ? stepOf(funnel, stepId) : null;
  const actions = useMemo(
    () => (step ? visitorActions(funnel, account, step.id, run.state.clock.now) : []),
    [funnel, account, step, run.state.clock.now],
  );

  /**
   * Everything about this visit the account has not been told yet, as events against `current`.
   * Nothing is marked recorded here: `settle` does that, once the commit has actually succeeded,
   * so a refused submission does not silently lose the steps that led to it.
   */
  const owed = useCallback(
    (current: StoredRun): PendingEvent[] => {
      if (!recordable) return [];
      const events: PendingEvent[] = [];
      for (const log of [...abandoned.current, visit.current]) {
        if (!log.started) {
          events.push(visitStarted(current, { visit_id: log.id, funnel_id: funnel.id, source }));
        }
        for (const view of log.steps.slice(log.recordedSteps)) {
          events.push(stepViewed(current, log.id, view.id, view.blocks));
        }
        for (const block of log.forms.slice(log.recordedForms)) {
          events.push(formStarted(current, log.id, block));
        }
        if (log.ended && !log.recordedEnd) events.push(visitEnded(current, log.id, log.ended));
      }
      return events;
    },
    [funnel.id, recordable, source],
  );

  /** Marks what `owed` produced as recorded. Called only after a commit succeeded. */
  const settle = useCallback(() => {
    for (const log of [...abandoned.current, visit.current]) {
      log.started = true;
      log.recordedSteps = log.steps.length;
      log.recordedForms = log.forms.length;
      if (log.ended) log.recordedEnd = true;
    }
    abandoned.current = [];
    setSourceLocked(true);
  }, []);

  /** True when this walk has done something the account has not been told about. */
  const owesAnything = () => {
    const log = visit.current;
    return (
      !log.started ||
      log.recordedSteps < log.steps.length ||
      log.recordedForms < log.forms.length ||
      Boolean(log.ended && !log.recordedEnd)
    );
  };

  /** Writes what the visit owes on its own, when nothing else is being committed. */
  const flush = useCallback(async () => {
    if (!recordable) return;
    const result = await perform(async (current) =>
      performEvents(current, scenario, owed(current)),
    );
    if (result?.ok) settle();
  }, [owed, perform, recordable, scenario, settle]);

  // Deliberately not memoised: it is one button's handler, and it resets six pieces of state,
  // which is not something a stable identity buys anything for.
  const restart = () => {
    // A walk abandoned mid-funnel is a drop-off and the Autopsy has to see it as one — but it is
    // not written here. Starting over must never be a save: a commit now would be built against
    // the run this render captured, and whatever the learner did next would be applied to the
    // same stale run and lose it. So the visit joins the queue and travels with the next action.
    if (!done) visit.current.ended = 'left';
    if (owesAnything()) abandoned.current = [...abandoned.current, visit.current];
    visit.current = newVisitLog(
      firstStep(funnel)?.id ?? null,
      firstStep(funnel)?.blocks.length ?? 1,
    );
    setSourceLocked(false);
    setVisitor(newVisitor());
    setStepId(firstStep(funnel)?.id ?? null);
    setValues({});
    setSlot({});
    setRefusal(null);
    setDone(false);
    setFrom(visitorLogWatermark(run));
  };

  const known = account.contacts[visitor.contact_id];

  // Plain functions from here down: they read a ref and set state, which is what the React
  // compiler memoises well and what manual dependency lists get wrong.
  const advance = (to: string | null) => {
    const log = visit.current;
    if (to === null) {
      setDone(true);
      log.ended = 'completed';
      // A call to action ends the funnel without committing anything of its own, so this is the
      // one place a visit is written on its own — and nothing else is in flight when it is.
      if (!log.recordedEnd) void flush();
      return;
    }
    setStepId(to);
    if (!log.steps.some((view) => view.id === to)) {
      const next = stepOf(funnel, to);
      log.steps.push({ id: to, blocks: next?.blocks.length ?? 1 });
    }
  };

  /** The visitor began filling something in. Starting is not submitting, and never becomes it. */
  const noteFormStart = (blockId: string) => {
    const log = visit.current;
    if (!log.forms.includes(blockId)) log.forms.push(blockId);
  };

  const act = async (action: VisitAction) => {
    setRefusal(null);
    if (action.kind === 'advance') {
      advance(action.to_step_id);
      return;
    }
    const answers = values[action.block_id] ?? {};
    if (
      (action.kind === 'submit_form' || action.kind === 'submit_survey') &&
      !known &&
      !canCreateContact(answers)
    ) {
      setRefusal(
        'This visitor has no name yet, and the account has no contact to update. A submission that would create a nameless contact is refused by the engine, so fill in a first name.',
      );
      return;
    }
    // One commit for the whole action: what the visit still owes, then the thing the visitor
    // actually did. Either all of it lands or none of it does, so the Autopsy never sees a
    // submission with no visit behind it (D-147). An action that finishes the funnel carries the
    // visit's ending too, rather than being followed by a second commit against a stale run.
    if (action.to_step_id === null) visit.current.ended = 'completed';
    const result = await perform(async (current) => {
      const telemetry = owed(current);
      const id = visit.current.id;
      switch (action.kind) {
        case 'submit_form':
          return performEvents(current, scenario, [
            ...telemetry,
            formSubmission(current, visitor, action.form_id, answers, id),
          ]);
        case 'submit_survey':
          return performEvents(current, scenario, [
            ...telemetry,
            surveySubmission(current, visitor, action.survey_id, answers, id),
          ]);
        case 'book': {
          const chosen = slot[action.block_id];
          const picked = action.slots.find((row) => row.starts_at === chosen) ?? action.slots[0];
          if (!picked) throw new Error('This calendar has no openings to book.');
          const booking = funnelBooking(current, visitor, action.calendar_id, picked);
          if ('refusal' in booking) {
            return { ok: false as const, run: current, refusal: booking.refusal };
          }
          return performEvents(current, scenario, [...telemetry, booking.event]);
        }
        case 'checkout':
          return performEvents(current, scenario, [
            ...telemetry,
            funnelPayment(current, visitor, action.product_id, action.amount),
          ]);
      }
    });
    if (!result) return;
    if (!result.ok) {
      setRefusal(result.refusal.message);
      return;
    }
    settle();
    // The account now knows this visitor: from here the same person updates rather than creates.
    setVisitor((current) => ({ ...current, is_new: false }));
    advance(action.to_step_id);
  };

  /** What the account did since this visit began, in the run's own order. Read, never invented. */
  const chain: ChainEntry[] = useMemo(
    () =>
      visitorEventsSince(run, from).map((event) => ({
        sequence: event.sequence,
        type: contentEventName(event.type),
        at: event.at,
        origin: event.origin,
        detail: describe(event.payload, account),
      })),
    [run, from, account],
  );

  if (errors.length > 0) {
    return (
      <div className={styles.simulateBlocked} data-testid="simulate-blocked">
        <h3 className={styles.panelHeading}>This funnel cannot be walked yet</h3>
        <ul className={styles.problemList}>
          {errors.map((issue, index) => (
            <li key={`${issue.code}-${index}`}>{issue.message}</li>
          ))}
        </ul>
        <p className={styles.muted}>Fix these in Build, then come back.</p>
      </div>
    );
  }

  if (!step && !done) {
    return <p className={styles.muted}>This funnel has no steps yet.</p>;
  }

  return (
    <div className={styles.simulate}>
      <div className={styles.visitorBar}>
        <p className={styles.visitorWho} data-testid="visitor-identity">
          {known
            ? `Visiting as ${known.first_name}${known.last_name ? ` ${known.last_name}` : ''} — the account already has this contact, so a submission updates it.`
            : 'Visiting as someone the account has never met. The first submission creates the contact.'}
        </p>
        <Field label="Came from">
          <Select
            value={source}
            onChange={(event) => setSource(event.target.value)}
            disabled={sourceLocked}
            data-testid="visitor-source"
          >
            {VISIT_SOURCES.map((row) => (
              <option key={row} value={row}>
                {row}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="ghost" size="sm" onClick={restart} data-testid="visitor-restart">
          Start over as a new visitor
        </Button>
      </div>

      {!recordable && (
        <p className={styles.muted} data-testid="visit-not-recorded">
          This funnel is not saved yet, so the walk is not recorded as traffic and the Autopsy will
          not see it. Save it in Build first.
        </p>
      )}

      {refusal && (
        <p className={styles.refusal} role="alert" data-testid="visitor-refusal">
          {refusal}
        </p>
      )}

      {done ? (
        <div className={styles.visitorDone} data-testid="visitor-finished">
          <StatusPill label="Funnel finished" tone="success" glyph="check" />
          <p className={styles.muted}>
            The visitor reached the end of the funnel. What the account did is below.
          </p>
        </div>
      ) : (
        step && (
          <div className={styles.visitorFrame}>
            <p className={styles.visitorStep}>
              {step.name}
              <span className={styles.visitorStepOf}>
                {' '}
                — step {funnel.steps.findIndex((row) => row.id === step.id) + 1} of{' '}
                {funnel.steps.length}
              </span>
            </p>
            <FunnelPage
              step={step}
              account={account}
              controls={Object.fromEntries(
                actions.map((action) => [
                  action.block_id,
                  <VisitorControl
                    key={action.block_id}
                    action={action}
                    busy={busy}
                    values={values[action.block_id] ?? {}}
                    chosenSlot={slot[action.block_id]}
                    timezone={run.state.clock.timezone}
                    onValue={(field, value) => {
                      noteFormStart(action.block_id);
                      setValues((current) => ({
                        ...current,
                        [action.block_id]: { ...(current[action.block_id] ?? {}), [field]: value },
                      }));
                    }}
                    onSlot={(value) =>
                      setSlot((current) => ({ ...current, [action.block_id]: value }))
                    }
                    onAct={() => void act(action)}
                  />,
                ]),
              )}
            />
          </div>
        )
      )}

      <section className={styles.chain} aria-label="What the account did">
        <h3 className={styles.panelHeading}>What the account did</h3>
        {chain.length === 0 ? (
          <p className={styles.muted}>
            Nothing yet. Submitting, booking or paying puts a real event through the engine, and
            everything it causes appears here in the run&rsquo;s own order.
          </p>
        ) : (
          <ol className={styles.chainList} data-testid="visitor-chain">
            {chain.map((entry) => (
              <li key={entry.sequence} className={styles.chainRow}>
                <span className={styles.chainType}>{entry.type}</span>
                <span className={styles.chainOrigin} data-origin={entry.origin}>
                  {ORIGIN_WORDS[entry.origin] ?? entry.origin}
                </span>
                <span className={styles.chainDetail}>{entry.detail}</span>
                <span className={styles.chainAt}>
                  {simulatorTime(entry.at, run.state.clock.timezone)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

const ORIGIN_WORDS: Record<string, string> = {
  injected: 'from the funnel',
  generated: 'caused by it',
  scheduled: 'a scheduled wake',
  clock: 'the clock',
  scenario: 'the scenario',
};

/** A one-line summary of what an event carried, read from the payload the engine recorded. */
function describe(payload: Record<string, unknown>, account: AccountState): string {
  const parts: string[] = [];
  const contactId = typeof payload.contact_id === 'string' ? payload.contact_id : null;
  if (contactId) {
    const contact = account.contacts[contactId];
    parts.push(contact ? `${contact.first_name} ${contact.last_name ?? ''}`.trim() : contactId);
  }
  if (typeof payload.form_id === 'string')
    parts.push(account.forms[payload.form_id]?.name ?? payload.form_id);
  if (typeof payload.survey_id === 'string')
    parts.push(account.surveys[payload.survey_id]?.name ?? payload.survey_id);
  if (typeof payload.calendar_id === 'string')
    parts.push(account.calendars[payload.calendar_id]?.name ?? payload.calendar_id);
  if (typeof payload.product_id === 'string')
    parts.push(account.products[payload.product_id]?.name ?? payload.product_id);
  if (typeof payload.amount === 'number') parts.push(money(payload.amount));
  if (typeof payload.workflow_id === 'string')
    parts.push(account.workflows[payload.workflow_id]?.name ?? payload.workflow_id);
  if (typeof payload.tag === 'string') parts.push(`tag ${payload.tag}`);
  if (typeof payload.body === 'string') parts.push(`“${truncate(payload.body)}”`);
  return parts.join(' · ');
}

const truncate = (text: string, limit = 60): string =>
  text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;

/* ---- the controls a visitor actually operates ------------------------------------------- */

function VisitorControl({
  action,
  busy,
  values,
  chosenSlot,
  timezone,
  onValue,
  onSlot,
  onAct,
}: {
  action: VisitAction;
  busy: boolean;
  values: SubmissionValues;
  chosenSlot: string | undefined;
  timezone: string;
  onValue: (field: string, value: string) => void;
  onSlot: (value: string) => void;
  onAct: () => void;
}) {
  switch (action.kind) {
    case 'submit_form':
    case 'submit_survey':
      return (
        <div className={styles.visitorForm}>
          {action.fields.map((field) => (
            <Field key={field} label={fieldLabel(field)}>
              <Input
                value={String(values[field] ?? '')}
                onChange={(event) => onValue(field, event.target.value)}
                data-testid={`visitor-field-${field}`}
              />
            </Field>
          ))}
          <Button onClick={onAct} disabled={busy} data-testid={`visitor-submit-${action.block_id}`}>
            {action.kind === 'submit_form' ? 'Submit' : 'Send answers'}
          </Button>
        </div>
      );
    case 'book':
      return (
        <div className={styles.visitorForm}>
          {action.slots.length === 0 ? (
            <p className={styles.pageUnset}>
              This calendar has no openings. Its working hours, duration, buffers, minimum notice or
              team are what decide that.
            </p>
          ) : (
            <Field
              label="Pick a time"
              hint="The calendar’s real openings: its working hours, duration, buffers, minimum notice and who is free. Change them in the Calendar Lab and these change."
            >
              <Select
                value={chosenSlot ?? action.slots[0]?.starts_at}
                onChange={(event) => onSlot(event.target.value)}
                data-testid={`visitor-slot-${action.block_id}`}
              >
                {action.slots.map((slot) => (
                  <option key={slot.starts_at} value={slot.starts_at}>
                    {simulatorTime(slot.starts_at, timezone)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Button
            onClick={onAct}
            disabled={busy || action.slots.length === 0}
            data-testid={`visitor-book-${action.block_id}`}
          >
            Book it
          </Button>
        </div>
      );
    case 'checkout':
      return (
        <div className={styles.visitorForm}>
          <p className={styles.pagePrice}>
            {money(action.amount)}
            {action.recurring ? ' each month' : ''}
          </p>
          <p className={styles.muted}>
            Paying records one payment against this product. Product setup, subscriptions, failed
            payments and refunds are the Payments Lab&rsquo;s, not this one.
          </p>
          <Button onClick={onAct} disabled={busy} data-testid={`visitor-pay-${action.block_id}`}>
            Pay {money(action.amount)}
          </Button>
        </div>
      );
    case 'advance':
      return (
        <Button onClick={onAct} disabled={busy} data-testid={`visitor-advance-${action.block_id}`}>
          Continue
        </Button>
      );
  }
}
