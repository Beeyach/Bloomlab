import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import {
  MasteryBadge,
  Button,
  Stack,
  StatusPill,
  Surface,
  cx,
  type StatusGlyph,
  type StatusTone,
} from '@bloomlab/design-system';
import type { GateEvaluation, GateStatus } from '@bloomlab/mastery-engine';

import { content } from '../content/bundle';
import { defaultCampaignId, evaluateLearner } from '../data/learning';
import { db } from '../data/db';
import { fieldReadyCompletion } from '../clients/completion';
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
              : ' take placement to show what you already know, or begin wherever your prerequisites allow.'}
          </p>
        ) : gate.total === 0 && !definition?.projects_required ? (
          <p className={styles.criteria}>
            The capabilities for this gate are authored in a later content phase.
          </p>
        ) : (
          <p className={styles.criteria}>
            {gate.total > 0
              ? `${gate.passed_count} of ${gate.total} capabilities demonstrated · pass with `
              : 'Complete the required project evidence. '}
            {gate.total > 0
              ? definition
                ? criteriaWords(definition.pass_criteria)
                : 'independent demonstrations'
              : ''}
          </p>
        )}
        {definition?.placement && (
          <ul className={styles.skills}>
            {content.exercises
              .filter((exercise) => exercise.placement_area)
              .map((exercise) => (
                <li key={exercise.id} className={styles.skill}>
                  <Link className={styles.skillLink} to={`/exercise/${exercise.id}`}>
                    {exercise.title}
                  </Link>
                  <span className={styles.skillNote}>{exercise.estimated_minutes} min</span>
                </li>
              ))}
          </ul>
        )}
        {definition && definition.projects.length > 0 && (
          <ul className={styles.skills}>
            {definition.projects.map((id) => (
              <li key={id} className={styles.skill}>
                <Link className={styles.skillLink} to={`/projects/${id}`}>
                  {content.projects.find((row) => row.id === id)?.title ?? 'Project'}
                </Link>
                <span className={styles.skillNote}>
                  {definition.projects_required
                    ? gate.missing_projects?.includes(id)
                      ? 'Project evidence required'
                      : 'Project evidence complete'
                    : 'Practical project'}
                </span>
              </li>
            ))}
          </ul>
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
  const [params, setParams] = useSearchParams();
  const [retry, setRetry] = useState(0);
  const result = useLiveQuery(async () => {
    try {
      if (!(await db.device.toCollection().first())) return undefined;
      return { value: await evaluateLearner(), error: false };
    } catch {
      return { value: null, error: true };
    }
  }, [retry]);
  const snapshot = result?.value;
  const requested = params.get('path');
  const unknown = requested !== null && !content.campaigns.some((c) => c.id === requested);
  const campaignId = !unknown && requested ? requested : defaultCampaignId(content);
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
  const gatesWithSkills = evaluation?.gates.filter((g) => g.status !== 'optional');

  return (
    <Stack as="section" gap={6} className={styles.screen} aria-labelledby="campaign-title">
      <label className={styles.pathPicker}>
        Campaign or path
        <select value={definition.id} onChange={(event) => setParams({ path: event.target.value })}>
          <optgroup label="Foundations">
            {content.campaigns
              .filter((path) => !path.post_field_ready)
              .map((path) => (
                <option key={path.id} value={path.id}>
                  {path.title}
                </option>
              ))}
          </optgroup>
          <optgroup label="Post-Field-Ready paths">
            {content.campaigns
              .filter((path) => path.post_field_ready)
              .map((path) => (
                <option key={path.id} value={path.id}>
                  {path.title}
                  {path.recommended ? ' · Recommended' : ''}
                </option>
              ))}
          </optgroup>
        </select>
      </label>
      {unknown && (
        <p role="status">
          That path is not in this content build. Showing Field Ready; choose a path above.
        </p>
      )}
      <header className={styles.header}>
        <h1 id="campaign-title" className={styles.title}>
          {definition.title}
        </h1>
        <p className={styles.pace}>Campaign · {definition.pace_hint}</p>
        <p className={styles.lead}>{definition.summary}</p>
        {definition.post_field_ready && (
          <>
            <p className={styles.summary} data-testid="path-boundary">
              {snapshot && fieldReadyCompletion(snapshot, content).complete
                ? 'Post-Field-Ready path. Your required Field Ready training evidence is recorded; real-GHL proof remains learner-supplied, not automatically verified.'
                : 'Post-Field-Ready path · preview and work ahead. Choosing or passing this path does not mark Field Ready complete.'}{' '}
              Shared capabilities keep the same evidence in every path. Path gates do not replace
              skill mastery or personal acceptance.
            </p>
            <nav aria-label="Path foundations" className={styles.foundations}>
              {definition.requires_campaigns.map((id) => (
                <Link key={id} className={styles.skillLink} to={`/campaign?path=${id}`}>
                  {content.campaigns.find((path) => path.id === id)?.title}
                </Link>
              ))}
            </nav>
          </>
        )}
        <Link className={styles.skillLink} to="/field-ready">
          View Field Ready evidence and completion
        </Link>
        {evaluation && gatesWithSkills && (
          <p className={styles.standing}>
            {evaluation.complete
              ? 'Every gate passed.'
              : `${passed} of ${gatesWithSkills.length} gates passed · ${plural(evaluation.work_ahead.length, 'capability', 'capabilities')} open to work ahead`}
          </p>
        )}
      </header>

      {result?.error ? (
        <div>
          <p role="alert">
            Your evidence could not be read. Retry when device storage is available.
          </p>
          <Button onClick={() => setRetry((value) => value + 1)}>Retry</Button>
        </div>
      ) : !evaluation ? (
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
      <section className={styles.pathDirectory} aria-labelledby="paths-title">
        <h2 id="paths-title" className={styles.gateName}>
          Post-Field-Ready paths
        </h2>
        <p className={styles.summary}>
          Seven curated routes through one master graph. Preview any route; prerequisites and
          missing evidence remain visible.
        </p>
        <ul className={styles.skills}>
          {content.campaigns
            .filter((path) => path.post_field_ready)
            .map((path) => (
              <li key={path.id}>
                <Link
                  className={styles.skillLink}
                  to={`/campaign?path=${path.id}`}
                  aria-current={path.id === campaignId ? 'page' : undefined}
                >
                  {path.title}
                  {path.recommended ? ' · Recommended' : ''}
                </Link>
                <p className={styles.summary}>{path.summary}</p>
              </li>
            ))}
        </ul>
      </section>
    </Stack>
  );
}
