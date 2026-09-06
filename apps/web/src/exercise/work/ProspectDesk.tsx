import { useState } from 'react';

import {
  PROSPECT_DECISIONS,
  QUALIFICATION_AXES,
  type Exercise,
  type ProspectDecision,
  type QualificationAxis,
} from '@bloomlab/content-schema';

import { content } from '../../content/bundle';
import { emptyProspectDecision, type ProspectDecisionResponse, type SalesResponse } from '../sales';
import { EvidencePack } from './EvidencePack';
import { AXIS_WORDS, DECISION_HELP, DECISION_WORDS } from './words';
import styles from './work.module.css';

/**
 * PROSPECT IT (EXR-012, SAL-002).
 *
 * Several businesses, what can be seen of each, and three answers. Nothing on this screen says
 * which one is right, nothing rewards contacting, and a Skip is a full answer: the decision, why,
 * which dimensions drove it, and the evidence behind them. The authored evaluation — acceptable
 * decisions, the evidence each dimension needs — is never rendered here.
 */
export function ProspectDesk({
  exercise,
  sales,
  onChange,
  disabled,
}: {
  exercise: Exercise;
  sales: SalesResponse;
  onChange: (prospects: Record<string, ProspectDecisionResponse>) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(exercise.prospects[0] ?? '');
  const client = content.clients.find((candidate) => candidate.id === open);
  const answer = sales.prospects[open] ?? emptyProspectDecision();
  const evidence = exercise.sales.evidence.filter((item) => item.client === open);

  const update = (change: Partial<ProspectDecisionResponse>) =>
    onChange({ ...sales.prospects, [open]: { ...answer, ...change } });

  const toggle = <T,>(list: readonly T[], value: T): T[] =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  return (
    <div className={styles.desk} data-testid="prospect-desk">
      <ul className={styles.switcher} aria-label="The businesses on your list">
        {exercise.prospects.map((id) => {
          const business = content.clients.find((candidate) => candidate.id === id);
          const decision = sales.prospects[id]?.decision ?? null;
          return (
            <li key={id}>
              <button
                type="button"
                className={styles.switch}
                aria-current={id === open ? 'true' : undefined}
                data-testid={`prospect-tab-${id}`}
                onClick={() => setOpen(id)}
              >
                <span className={styles.switchName}>{business?.business_name ?? id}</span>
                <span className={styles.switchState}>
                  {decision ? DECISION_WORDS[decision] : 'Not decided'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {client && (
        <div className={styles.prospect} data-testid={`prospect-${client.id}`}>
          <h3 className={styles.deskTitle}>{client.business_name}</h3>
          <p className={styles.deskNote}>
            {client.locations[0]?.city}
            {client.locations[0]?.region ? `, ${client.locations[0].region}` : ''}
          </p>

          <EvidencePack
            items={evidence}
            title="What you can see of them"
            name={`prospect-${client.id}`}
            selected={answer.evidence}
            onToggle={(id) => update({ evidence: toggle(answer.evidence, id) })}
            disabled={disabled}
          />

          <fieldset className={styles.choices} disabled={disabled}>
            <legend className={styles.legend}>Your call</legend>
            {PROSPECT_DECISIONS.map((decision: ProspectDecision) => (
              <label key={decision} className={styles.choice}>
                <input
                  type="radio"
                  name={`prospect-decision-${client.id}`}
                  value={decision}
                  checked={answer.decision === decision}
                  data-testid={`decision-${client.id}-${decision}`}
                  onChange={() => update({ decision })}
                />
                <span className={styles.choiceBody}>
                  <span className={styles.choiceName}>{DECISION_WORDS[decision]}</span>
                  <span className={styles.choiceHelp}>{DECISION_HELP[decision]}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className={styles.choices} disabled={disabled}>
            <legend className={styles.legend}>What drove it</legend>
            {QUALIFICATION_AXES.map((axis: QualificationAxis) => (
              <label key={axis} className={styles.choice}>
                <input
                  type="checkbox"
                  checked={answer.axes.includes(axis)}
                  data-testid={`axis-${client.id}-${axis}`}
                  onChange={() => update({ axes: toggle(answer.axes, axis) })}
                />
                <span className={styles.choiceBody}>
                  <span className={styles.choiceName}>{AXIS_WORDS[axis]}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Why</span>
            <textarea
              className={styles.textarea}
              rows={4}
              value={answer.reason}
              disabled={disabled}
              data-testid={`reason-${client.id}`}
              aria-describedby={`reason-help-${client.id}`}
              onChange={(event) => update({ reason: event.target.value })}
            />
            <span id={`reason-help-${client.id}`} className={styles.help}>
              One or two sentences. What you would say to yourself in a week when you have forgotten
              this business.
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
