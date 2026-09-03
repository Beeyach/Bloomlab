import { Link } from 'react-router';

import {
  MasteryBadge,
  Stack,
  StatusPill,
  Surface,
  cx,
  type StatusGlyph,
  type StatusTone,
} from '@bloomlab/design-system';
import type { GateEvaluation, GateStatus } from '@bloomlab/mastery-engine';

import { content } from '../content/bundle';
import { defaultCampaignId, useLearnerSnapshot } from '../data/learning';
import styles from './CampaignScreen.module.css';
import { joinWords, plural, skillTitle } from './learningCopy';

const GATE_PILL: Record<GateStatus, { label: string; tone: StatusTone; glyph: StatusGlyph }> = {
  passed: { label: 'Passed', tone: 'success', glyph: 'check' },
  in_progress: { label: 'In progress', tone: 'info', glyph: 'clock' },
  available: { label: 'Open', tone: 'neutral', glyph: 'ring' },
  locked: { label: 'After its prerequisites', tone: 'neutral', glyph: 'dash' },
  optional: { label: 'Placement', tone: 'neutral', glyph: 'ring' },
};

type GateContent = (typeof content.campaigns)[number]['gates'][number];

function criteriaWords(criteria: GateContent['pass_criteria']): string {
  const parts = [
    `${plural(criteria.independent_evidence_per_skill, 'independent demonstration')} per capability`,
  ];
  if (criteria.pressure_test_required) parts.push('a pressure test');
  if (criteria.fieldwork_required) parts.push('real GHL fieldwork');
  return joinWords(parts);
}

function Gate({
  gate,
  definition,
  current,
}: {
  gate: GateEvaluation;
  definition: GateContent | undefined;
  current: boolean;
}) {
  const pill = GATE_PILL[gate.status];
  return (
    <li className={styles.gateItem} aria-current={current ? 'step' : undefined}>
      <Surface
        tone={current ? 'tint' : 'snow'}
        padding="md"
        className={cx(styles.gate, current && styles.current)}
      >
        <header className={styles.gateHeader}>
          <div>
            <h2 className={styles.gateName}>
              Gate {gate.number} · {gate.name}
            </h2>
          </div>
          <StatusPill label={pill.label} tone={pill.tone} glyph={pill.glyph} />
        </header>
        {definition && <p className={styles.summary}>{definition.summary}</p>}
        {definition?.placement ? (
          <p className={styles.criteria}>
            Assesses {plural(gate.total, 'capability', 'capabilities')} you may already have;
            {gate.cleared.length > 0
              ? ` ${plural(gate.cleared.length, 'is', 'are')} already demonstrated.`
              : ' none demonstrated yet, so the campaign starts at Gate 1.'}
          </p>
        ) : gate.total === 0 ? (
          <p className={styles.criteria}>
            The capabilities for this gate are authored in a later content phase.
          </p>
        ) : (
          <p className={styles.criteria}>
            {gate.passed_count} of {gate.total} capabilities demonstrated · pass with{' '}
            {definition ? criteriaWords(definition.pass_criteria) : 'independent demonstrations'}
          </p>
        )}
        {gate.skills.length > 0 && (
          <ul className={styles.skills}>
            {gate.skills.map((skill) => (
              <li key={skill.skill_id} className={styles.skill}>
                <Link to={`/skills/${skill.skill_id}`} className={styles.skillLink}>
                  <MasteryBadge state={skill.state} />
                  <span>{skillTitle(skill.skill_id)}</span>
                </Link>
                {skill.passes ? (
                  <span className={styles.skillNote}>Passed</span>
                ) : skill.available ? null : (
                  <span className={styles.skillNote}>
                    after {joinWords(skill.unsatisfied_prerequisites.map((id) => skillTitle(id)))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </li>
  );
}

/**
 * The campaign in capability terms (spec §8, PRD-007): gates, what each asks for, where the
 * learner stands. The pace hint is content copy — nothing here is locked to a day.
 */
export default function CampaignScreen() {
  const snapshot = useLearnerSnapshot();
  const campaignId = defaultCampaignId(content);
  const definition = content.campaigns.find((c) => c.id === campaignId);
  const evaluation = snapshot?.campaigns.find((c) => c.campaign_id === campaignId) ?? null;

  if (!definition) {
    return (
      <Stack as="section" gap={4} className={styles.screen} aria-labelledby="campaign-title">
        <h1 id="campaign-title" className={styles.title}>
          Campaign
        </h1>
        <p className={styles.muted}>This content build has no campaign.</p>
      </Stack>
    );
  }

  const passed = evaluation?.passed_gates.length ?? 0;
  const gatesWithSkills = evaluation?.gates.filter((g) => g.total > 0 && g.status !== 'optional');

  return (
    <Stack as="section" gap={6} className={styles.screen} aria-labelledby="campaign-title">
      <header className={styles.header}>
        <h1 id="campaign-title" className={styles.title}>
          {definition.title}
        </h1>
        <p className={styles.pace}>Campaign · {definition.pace_hint}</p>
        <p className={styles.lead}>{definition.summary}</p>
        {evaluation && gatesWithSkills && (
          <p className={styles.standing}>
            {evaluation.complete
              ? 'Every gate passed.'
              : `${passed} of ${gatesWithSkills.length} gates passed · ${plural(evaluation.work_ahead.length, 'capability', 'capabilities')} open to work ahead`}
          </p>
        )}
      </header>

      {!evaluation ? (
        <p className={styles.muted} role="status">
          Reading your progress…
        </p>
      ) : (
        <ol className={styles.gates}>
          {evaluation.gates.map((gate) => (
            <Gate
              key={gate.gate}
              gate={gate}
              definition={definition.gates.find((g) => g.id === gate.gate)}
              current={gate.gate === evaluation.current_gate}
            />
          ))}
        </ol>
      )}
    </Stack>
  );
}
