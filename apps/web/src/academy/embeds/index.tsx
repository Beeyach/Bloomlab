import { useId, useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';

import { EXERCISE_LABELS, ExecutionEvent, type ExerciseType } from '@bloomlab/design-system';

import {
  advanceTo,
  createRun,
  initialAccount,
  processEvent,
  toZone,
  type SimulatorScenario,
} from '@bloomlab/simulator-core';

import { content } from '../../content/bundle';
import { modeWord } from '../../screens/learningCopy';
import { featureName } from '../../workflow/palette';
import {
  buildTriggerEvent,
  defaultTriggerInput,
  triggerTestOptions,
} from '../../workflow/triggerTest';
import { timelineRow } from '../../workflow/words';
import styles from './embeds.module.css';
import { FunnelDiagram } from './FunnelDiagram';
import { FunnelMathInteractive } from './FunnelMathInteractive';
import { WorkflowPathDiagram } from './WorkflowPathDiagram';

/**
 * The Academy's embed vocabulary (content/learning-units/*.mdx → `UNIT_EMBEDS`). Each is a real
 * element with its own behaviour; none is a picture of one. Kinds a unit may use are validated
 * by the content compiler, so an unknown kind cannot reach the reader.
 */

const CALLOUT_LABELS: Record<string, string> = {
  idea: 'Idea',
  warning: 'Watch out',
  note: 'Note',
};

export function Callout({ kind = 'note', children }: { kind?: string; children?: ReactNode }) {
  const label = CALLOUT_LABELS[kind] ?? CALLOUT_LABELS.note;
  return (
    <aside className={styles.callout} data-kind={kind} data-embed="callout">
      <span className={styles.calloutLabel}>{label}</span>
      <div className={styles.calloutBody}>{children}</div>
    </aside>
  );
}

/** Expandable depth (spec §76): a native disclosure, keyboard and screen-reader ready. */
export function Depth({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <details className={styles.depth} data-embed="depth">
      <summary className={styles.depthSummary}>
        <span className={styles.depthLabel}>Go deeper</span>
        <span className={styles.depthTitle}>{title}</span>
      </summary>
      <div className={styles.depthBody}>{children}</div>
    </details>
  );
}

const FIDELITY_WORDS: Record<string, string> = {
  A: 'Simulated faithfully',
  B: 'Simulated with a labelled approximation',
  C: 'Simplified in the simulator',
  REAL_GHL: 'Real GHL only, never simulated',
};

/** A technical note on a real GHL feature, straight from the verified registry (GHL-005). */
export function Feature({ id }: { id: string }) {
  const feature = content.ghl_features.find((candidate) => candidate.id === id);
  const headingId = useId();
  if (!feature) return null;
  return (
    <aside className={styles.feature} aria-labelledby={headingId} data-embed="feature">
      <p className={styles.embedLabel}>In GHL</p>
      <h3 id={headingId} className={styles.featureName}>
        {feature.official_name}
      </h3>
      <p className={styles.featureMeta}>
        <code className={styles.mono}>{feature.id}</code> · {feature.area} ·{' '}
        {FIDELITY_WORDS[feature.simulation_fidelity] ?? feature.simulation_fidelity}
      </p>
      {feature.approximation_note && (
        <p className={styles.featureText}>{feature.approximation_note}</p>
      )}
      {feature.known_limitations.length > 0 && (
        <ul className={styles.featureList}>
          {feature.known_limitations.slice(0, 2).map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      )}
      <p className={styles.featureMeta}>
        Verified {feature.last_verified} ·{' '}
        <a
          href={feature.source_url}
          target="_blank"
          rel="noreferrer"
          className={styles.featureLink}
        >
          Official documentation
        </a>
      </p>
    </aside>
  );
}

/** The practice that follows the reading: opens the real exercise in the runner. */
export function Exercise({ id }: { id: string }) {
  const exercise = content.exercises.find((candidate) => candidate.id === id);
  const headingId = useId();
  if (!exercise) return null;
  return (
    <aside className={styles.practice} aria-labelledby={headingId} data-embed="exercise">
      <p className={styles.embedLabel}>
        Practice · {EXERCISE_LABELS[exercise.type as ExerciseType]} · {exercise.estimated_minutes}{' '}
        min · {modeWord(exercise.mode)}
      </p>
      <h3 id={headingId} className={styles.practiceTitle}>
        {exercise.title}
      </h3>
      <p className={styles.practiceText}>
        Finishing this unit records that you read it. The exercise is where the capability gets
        demonstrated.
      </p>
      <p className={styles.practiceText}>
        <Link
          to={`/exercise/${exercise.id}?skill=${exercise.skills[0] ?? ''}`}
          className={styles.featureLink}
        >
          Open this exercise
        </Link>
      </p>
    </aside>
  );
}

/**
 * Host for the shared GHL simulator embed (spec §76 "inline simulations"). The simulator core is
 * Phase 10; until it exists this host states plainly what will run here — the scenario, the
 * workflow and the contact — and simulates nothing.
 */
export function Simulation({
  scenario: scenarioId,
  workflow: workflowId,
  contact: contactId,
}: {
  scenario: string;
  workflow?: string;
  contact?: string;
}) {
  const scenario = content.scenarios.find((candidate) => candidate.id === scenarioId);
  const headingId = useId();
  if (!scenario) return null;
  const workflow = scenario.initial_account_state.workflows.find(
    (candidate) => candidate.id === workflowId,
  );
  const contact = scenario.initial_account_state.contacts.find(
    (candidate) => candidate.id === contactId,
  );
  // Real engine output: the account exactly as the simulator compiles it from this scenario.
  // Nothing below is described from the YAML by hand, and nothing is played back as if it ran.
  const account = initialAccount(scenario as unknown as SimulatorScenario);
  const compiled = contactId ? account.contacts[contactId] : undefined;
  const starts = compiled
    ? Object.values(account.appointments).find((row) => row.contact_id === compiled.id)
    : undefined;

  return (
    <aside className={styles.simulation} aria-labelledby={headingId} data-embed="simulation">
      <h3 id={headingId} className={styles.simulationTitle}>
        {workflow ? `Run ${workflow.name}` : scenario.title}
        {contact ? ` for ${contact.first_name} ${contact.last_name}` : ''}
      </h3>
      <p className={styles.simulationText}>
        This is the starting state the simulator actually loads, at{' '}
        {toZone(scenario.simulation_time, scenario.timezone)} in {scenario.timezone}.
        {compiled && (
          <>
            {' '}
            {compiled.first_name} carries{' '}
            {compiled.tags.length > 0 ? compiled.tags.join(', ') : 'no tags'};{' '}
            {compiled.phone ? 'a phone number is on file' : 'there is no phone number on file'}
            {compiled.dnd ? ' and the contact is on do-not-disturb' : ''}
            {starts ? `; the appointment starts ${starts.starts_at}` : ''}.
          </>
        )}
      </p>
      {workflow && compiled ? (
        <InlineRun
          scenario={scenario as unknown as SimulatorScenario}
          workflowId={workflow.id}
          contactId={compiled.id}
        />
      ) : (
        <p className={styles.simulationText}>
          Choose a workflow and a contact to see the engine run them; the structure is drawn in the
          diagram above.
        </p>
      )}
      <p className={styles.simulationText}>
        <Link to={`/workflow?scenario=${scenario.id}${workflow ? `&workflow=${workflow.id}` : ''}`}>
          Open this scenario in the Workflow Lab
        </Link>{' '}
        to change the workflow and run it again.
      </p>
    </aside>
  );
}

/**
 * The contact walked through the workflow by the real engine, in memory, from the scenario's
 * authored start (CUR-036). Every row is an execution record the engine wrote; nothing is played
 * back from a description. Time is moved once past the first wait so a reminder's wake shows.
 */
function InlineRun({
  scenario,
  workflowId,
  contactId,
}: {
  scenario: SimulatorScenario;
  workflowId: string;
  contactId: string;
}) {
  const state = useMemo(() => {
    // The contact is put through the workflow the way the account would do it: the kind of event
    // its trigger listens for happens (a booking, a tag, a reply), and the engine's trigger
    // matcher decides. Only when the trigger cannot be fired in the simulator is the contact
    // enrolled directly, and the engine records that as a direct enrolment.
    let run = createRun(scenario);
    const workflow = run.account.workflows[workflowId] ?? null;
    const option = workflow ? triggerTestOptions(workflow)[0] : undefined;
    const built = option
      ? buildTriggerEvent(
          option,
          defaultTriggerInput(run.account, contactId, scenario.simulation_time, option.event),
          run.account,
        )
      : null;
    const source = { kind: 'injector_action' as const, id: 'academy_embed' };
    run = processEvent(
      run,
      built?.ok
        ? {
            type: built.event.type,
            at: scenario.simulation_time,
            origin: 'injected',
            source,
            payload: built.event.payload,
          }
        : {
            type: 'WORKFLOW_ENROLLED',
            at: scenario.simulation_time,
            origin: 'injected',
            source,
            payload: { workflow_id: workflowId, contact_id: contactId },
          },
    );
    const parked = Object.values(run.account.workflow_runs).find(
      (row) => row.workflow_id === workflowId && row.status === 'waiting' && row.wait?.wake_at,
    );
    if (parked?.wait?.wake_at) run = advanceTo(run, parked.wait.wake_at);
    return run;
  }, [scenario, workflowId, contactId]);
  const workflow = state.account.workflows[workflowId] ?? null;
  const theRun = Object.values(state.account.workflow_runs).find(
    (row) => row.workflow_id === workflowId,
  );
  const rows = state.execution
    .filter((row) => row.workflow_run_id === theRun?.id)
    .map((row) => timelineRow(row, workflow, state.account, state.clock.timezone));
  if (!theRun) {
    return (
      <p className={styles.simulationText} data-testid="embed-not-enrolled">
        The event happened, but{' '}
        {workflow ? featureName(workflow.trigger.ghl_feature_id) : 'the trigger'} did not enrol this
        contact: the trigger or its filters did not match. Nothing was started by hand.
      </p>
    );
  }
  return (
    <ol className={styles.simulationRows} aria-label="What the engine did">
      {rows.map((row) => (
        <ExecutionEvent
          key={row.id}
          time={row.time}
          name={row.name}
          detail={row.detail}
          status={row.status}
          branch={row.branch}
        />
      ))}
    </ol>
  );
}

export function Diagram({ kind, ...attributes }: { kind: string } & Record<string, unknown>) {
  if (kind === 'funnel') return <FunnelDiagram {...attributes} />;
  if (kind === 'workflow') return <WorkflowPathDiagram {...attributes} />;
  return null;
}

export function Interactive({ kind, ...attributes }: { kind: string } & Record<string, unknown>) {
  if (kind === 'funnel-math') return <FunnelMathInteractive {...attributes} />;
  return null;
}
