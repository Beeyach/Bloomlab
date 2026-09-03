import { useId } from 'react';

import { content } from '../../content/bundle';
import styles from './embeds.module.css';
import { workflowSteps, type Step } from './workflowSteps';

const KIND_WORDS: Record<Step['kind'], string> = {
  trigger: 'Trigger',
  action: 'Action',
  wait: 'Wait',
  branch: 'If / Else',
  goal: 'Goal',
  end: 'End',
};

/**
 * A workflow drawn from the scenario that defines it (Diagram kind="workflow"): trigger, filters,
 * actions and exit in the order GHL runs them, with connectors between the steps. A row on wide
 * screens, a column on phones; every step is text, so nothing depends on hover or colour.
 */
export function WorkflowPathDiagram(attributes: Record<string, unknown>) {
  const captionId = useId();
  const scenario = content.scenarios.find((candidate) => candidate.id === attributes.scenario);
  const workflow = scenario?.initial_account_state.workflows.find(
    (candidate) => candidate.id === attributes.workflow,
  );
  if (!scenario || !workflow) return null;
  const steps = workflowSteps(workflow);
  const caption =
    typeof attributes.caption === 'string'
      ? attributes.caption
      : `${workflow.name}: ${steps
          .map((step, index) =>
            index === 0
              ? `when ${step.title.toLowerCase()}${step.detail ? ` (${step.detail})` : ''}`
              : step.kind === 'end'
                ? 'then the contact exits'
                : `${step.title.toLowerCase()}${step.detail ? ` — ${step.detail}` : ''}`,
          )
          .join('; ')}.`;

  return (
    <figure className={styles.path} aria-labelledby={captionId} data-embed="diagram-workflow">
      <ol className={styles.pathSteps}>
        {steps.map((step, index) => (
          <li key={step.id} className={styles.pathStep} data-kind={step.kind}>
            {index > 0 && (
              <svg
                className={styles.pathConnector}
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M4 12h14M13 7l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            )}
            <span className={styles.pathNode}>
              <span className={styles.pathKind}>{KIND_WORDS[step.kind]}</span>
              <span className={styles.pathTitle}>{step.title}</span>
              {step.detail && <span className={styles.pathDetail}>{step.detail}</span>}
            </span>
          </li>
        ))}
      </ol>
      <figcaption id={captionId} className={styles.caption}>
        {caption}
      </figcaption>
    </figure>
  );
}
