import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';

import { EXERCISE_LABELS, type ExerciseType } from '@bloomlab/design-system';

import { content } from '../../content/bundle';
import { modeWord } from '../../screens/learningCopy';
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
  return (
    <aside className={styles.simulation} aria-labelledby={headingId} data-embed="simulation">
      <p className={styles.embedLabel}>Inline simulation · arrives with Phase 10</p>
      <h3 id={headingId} className={styles.simulationTitle}>
        {workflow ? `Run ${workflow.name}` : scenario.title}
        {contact ? ` for ${contact.first_name} ${contact.last_name}` : ''}
      </h3>
      <p className={styles.simulationText}>
        This embed will enrol {contact ? contact.first_name : 'a contact'} in{' '}
        {workflow ? `"${workflow.name}"` : 'the scenario'} on Bloomlab's GHL simulator and show,
        step by step, what they receive. The simulator core is Phase 10, so nothing runs here yet —
        the workflow's structure is drawn in the diagram above, and the prediction you wrote down is
        still the point of this section.
      </p>
      <p className={styles.simulationMeta}>
        Scenario <code className={styles.mono}>{scenario.id}</code>
        {workflow && (
          <>
            {' '}
            · workflow <code className={styles.mono}>{workflow.id}</code>
          </>
        )}
      </p>
    </aside>
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
