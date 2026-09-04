import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

import type { StoredRun } from '../simulator/store';
import type { ExecutionResult } from '../workflow/execution';
import {
  VISIT_SOURCES,
  bookFromFunnel,
  formStarted,
  newVisitId,
  newVisitor,
  payFromFunnel,
  performEvents,
  stepViewed,
  submitForm,
  submitSurvey,
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
   * The visit this walk is being recorded as (FUN-004). A walk is traffic, so it is recorded as
   * traffic, through the same events an authored cohort uses. Telemetry needs a funnel the
   * account actually holds, so an unsaved draft is walked without being recorded and the screen
   * says so rather than losing the visit silently.
   */
  const [source, setSource] = useState<string>(VISIT_SOURCES[0]);
  const [visitId, setVisitId] = useState<string | null>(null);
  const recordable = Boolean(account.funnels[funnel.id]);
  const started = useRef<string | null>(null);
  const seen = useRef<Set<string>>(new Set());

  const step = stepId ? stepOf(funnel, stepId) : null;
  const actions = useMemo(
    () => (step ? visitorActions(funnel, account, step.id, run.state.clock.now) : []),
    [funnel, account, step, run.state.clock.now],
  );

  /** Records telemetry beside whatever else the visitor did, as one commit. */
  const record = useCallback(
    async (events: (current: StoredRun) => Parameters<typeof performEvents>[2]) => {
      if (!recordable) return;
      await perform(async (current) => performEvents(current, scenario, events(current)));
    },
    [perform, recordable, scenario],
  );

  // Deliberately not memoised: it is one button's handler, and it both writes an event and
  // resets six pieces of state, which is not something a stable identity buys anything for.
  const restart = () => {
    // A walk that is abandoned mid-funnel is a drop-off, and the Autopsy has to see it as one.
    const ending = visitId;
    if (ending && !done) void record((current) => [visitEnded(current, ending, 'left')]);
    setVisitor(newVisitor());
    setStepId(firstStep(funnel)?.id ?? null);
    setValues({});
    setSlot({});
    setRefusal(null);
    setDone(false);
    setVisitId(null);
    started.current = null;
    seen.current = new Set();
    setFrom(visitorLogWatermark(run));
  };

  /**
   * The visit begins when the walk does, and the first step view goes with it. Guarded by a ref
   * rather than by state, so a re-render never starts a second visit for one walk.
   */
  useEffect(() => {
    if (!recordable || visitId || !start || started.current === funnel.id) return;
    started.current = funnel.id;
    const id = newVisitId();
    setVisitId(id);
    seen.current.add(start.id);
    void record((current) => [
      visitStarted(current, { visit_id: id, funnel_id: funnel.id, source }),
      stepViewed(current, id, start.id, start.blocks.length),
    ]);
  }, [funnel.id, recordable, record, source, start, visitId]);

  const known = account.contacts[visitor.contact_id];

  const advance = useCallback(
    (to: string | null) => {
      if (to === null) {
        setDone(true);
        if (visitId) void record((current) => [visitEnded(current, visitId, 'completed')]);
        return;
      }
      setStepId(to);
      if (visitId && !seen.current.has(to)) {
        seen.current.add(to);
        const next = stepOf(funnel, to);
        void record((current) => [stepViewed(current, visitId, to, next?.blocks.length ?? 1)]);
      }
    },
    [funnel, record, visitId],
  );

  /** The visitor began filling something in. Starting is not submitting, and never becomes it. */
  const noteFormStart = useCallback(
    (blockId: string) => {
      if (!visitId || seen.current.has(`form:${blockId}`)) return;
      seen.current.add(`form:${blockId}`);
      void record((current) => [formStarted(current, visitId, blockId)]);
    },
    [record, visitId],
  );

  const act = useCallback(
    async (action: VisitAction) => {
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
      const result = await perform(async (current) => {
        switch (action.kind) {
          case 'submit_form':
            return submitForm(
              current,
              scenario,
              visitor,
              action.form_id,
              answers,
              undefined,
              visitId,
            );
          case 'submit_survey':
            return submitSurvey(
              current,
              scenario,
              visitor,
              action.survey_id,
              answers,
              undefined,
              visitId,
            );
          case 'book': {
            const chosen = slot[action.block_id];
            const picked = action.slots.find((row) => row.starts_at === chosen) ?? action.slots[0];
            if (!picked) throw new Error('This calendar has no openings to book.');
            return bookFromFunnel(current, scenario, visitor, action.calendar_id, picked);
          }
          case 'checkout':
            return payFromFunnel(current, scenario, visitor, action.product_id, action.amount);
        }
      });
      if (!result) return;
      if (!result.ok) {
        setRefusal(result.refusal.message);
        return;
      }
      // The account now knows this visitor: from here the same person updates rather than creates.
      setVisitor((current) => ({ ...current, is_new: false }));
      advance(action.to_step_id);
    },
    [advance, known, perform, scenario, slot, values, visitId, visitor],
  );

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
            disabled={visitId !== null}
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
