import { NegotiationThread } from './work/NegotiationThread';
import { NORMAL_RUN } from './attempt';
import { useMemo } from 'react';
import { Link } from 'react-router';

import { Button, MasteryBadge, StatusPill, Surface, cx } from '@bloomlab/design-system';
import {
  ASSERTION_TIERS,
  SCORING_DIMENSIONS,
  type AssertionResult,
  type AssertionTier,
} from '@bloomlab/exercise-engine';
import { nextStepForSkill } from '@bloomlab/mastery-engine';

import { content } from '../content/bundle';
import { sessionContentOf, type LearnerSnapshot } from '../data/learning';
import type { ExerciseAttemptRecord } from '../data/types';
import { describeStep, skillTitle, stepDestination } from '../screens/learningCopy';
import { pricingOf } from './response';
import { DealReveal } from './work/DealReveal';
import {
  ASSISTANCE_WORDS,
  DIMENSION_WORDS,
  OUTCOME_WORDS,
  reasonSentence,
  TIER_WORDS,
} from './runnerCopy';
import styles from './ExerciseRunner.module.css';
import { SignatureMoment } from '../moments/SignatureMoment';

/** One check, with what was expected beside what actually happened (EXR-002). */
function CheckRow({ result }: { result: AssertionResult }) {
  const state = result.unevaluated ? 'unevaluated' : result.passed ? 'passed' : 'failed';
  const label = result.unevaluated ? 'Not evaluated' : result.passed ? 'Held' : 'Diverged';
  return (
    <li className={styles.check} data-state={state}>
      <div className={styles.checkHead}>
        <StatusPill
          label={label}
          tone={result.unevaluated ? 'neutral' : result.passed ? 'success' : 'warning'}
          glyph={result.unevaluated ? 'dash' : result.passed ? 'check' : 'cross'}
        />
        <p className={styles.checkDescription}>{result.description}</p>
      </div>
      {!result.passed && (
        <dl className={styles.diff}>
          <dt>Expected</dt>
          <dd>{result.expected}</dd>
          <dt>Observed</dt>
          <dd>{result.observed}</dd>
        </dl>
      )}
    </li>
  );
}

function Tier({ tier, results }: { tier: AssertionTier; results: AssertionResult[] }) {
  if (results.length === 0) return null;
  return (
    <section aria-labelledby={`tier-${tier}`} className={styles.tier}>
      <h3 id={`tier-${tier}`} className={styles.tierTitle}>
        {TIER_WORDS[tier]}
        <span className={styles.tierCount}>
          {results.filter((result) => result.passed).length} of {results.length}
        </span>
      </h3>
      <ul className={styles.checks}>
        {results.map((result) => (
          <CheckRow key={result.id} result={result} />
        ))}
      </ul>
    </section>
  );
}

/** What to do next, from the engine rather than from a guess. */
function NextStep({ skillId, snapshot }: { skillId: string; snapshot: LearnerSnapshot }) {
  const sessionContent = useMemo(() => sessionContentOf(content), []);
  const skill = content.skills.find((candidate) => candidate.id === skillId);
  const evaluation = snapshot.evaluations.get(skillId);
  if (!skill || !evaluation) return null;
  const step = nextStepForSkill({
    skill,
    evaluation,
    content: sessionContent,
    recent_evidence: snapshot.evidence,
  });
  const described = step ? describeStep(step) : null;
  return (
    <section aria-labelledby="next-title" className={styles.next}>
      <h3 id="next-title" className={styles.tierTitle}>
        Next
      </h3>
      <p className={styles.state}>
        <MasteryBadge state={evaluation.state} />
        <span>{skillTitle(skillId)}</span>
      </p>
      {step && described ? (
        <p className={styles.nextStep}>
          <Link to={stepDestination(step, skillId)} className={styles.inlineLink}>
            {described.verb} · {described.title}
          </Link>
          <span className={styles.help}>
            {step.minutes} min · {step.reason}
          </span>
        </p>
      ) : (
        <p className={styles.help}>No further step is authored for this capability yet.</p>
      )}
      <p className={styles.nextLinks}>
        <Link to={`/skills/${skillId}`} className={styles.inlineLink}>
          {skillTitle(skillId)} on the Skill Map
        </Link>
        <Link to="/" className={styles.inlineLink}>
          What should I do next?
        </Link>
      </p>
    </section>
  );
}

/**
 * The result (spec §158): what happened, where reality differed from the expectation, what it
 * cost in assistance, and what to do next — in that order, with the critical issue first and
 * never buried under a percentage.
 */
export function ResultView({
  attempt,
  skillId,
  snapshot,
  onTryAgain,
  fresh = false,
}: {
  attempt: ExerciseAttemptRecord;
  skillId: string | null;
  snapshot: LearnerSnapshot | undefined;
  onTryAgain?: () => void;
  /** Only the current successful save can recognise an outcome; saved history stays static. */
  fresh?: boolean;
}) {
  const report = attempt.grade ?? null;
  const failedCritical = report
    ? report.tiers.critical.filter((result) => !result.passed && !result.unevaluated)
    : [];
  const independent =
    report?.outcome === 'passed' &&
    attempt.assistance === 'independent' &&
    attempt.mode !== 'guided';
  // The hidden half of a priced deal, revealed now that the attempt is in (EXR-016). It is built
  // from the response kept with the finished attempt, so it survives the draft being cleared.
  const priced =
    content.exercises.find(
      (candidate) => candidate.id === attempt.exercise_id && candidate.pricing !== null,
    ) ?? null;

  const negotiated = content.exercises.find(
    (candidate) => candidate.id === attempt.exercise_id && candidate.negotiation && !candidate.call,
  );
  return (
    <section
      aria-labelledby="result-title"
      className={styles.result}
      data-outcome={report?.outcome}
    >
      <SignatureMoment
        key={attempt.id}
        kind={independent ? 'independent-pass' : 'failed-test'}
        active={fresh && (independent || report?.outcome === 'failed')}
      >
        <div className={cx(styles.resultHead, independent && styles.independent)}>
          <h2 id="result-title" className={styles.resultTitle}>
            {report ? OUTCOME_WORDS[report.outcome] : 'Recorded'}
          </h2>
          {report && (
            <p className={styles.resultMeta}>
              {report.score !== null && (
                <span className={styles.score}>
                  {report.score}% · pass mark {report.pass_threshold}%
                </span>
              )}
              <span>
                {attempt.exercise_type === 'FIELDWORK'
                  ? 'Manual proof completeness. GHL configuration and reasoning quality were not independently verified.'
                  : reasonSentence(report)}
              </span>
            </p>
          )}
          {independent && (
            <StatusPill label="Independent — no assistance used" tone="success" glyph="check" />
          )}
        </div>
      </SignatureMoment>

      {failedCritical.length > 0 && (
        <Surface padding="md" className={styles.critical} role="alert">
          <p className={styles.criticalLabel}>Critical</p>
          {failedCritical.map((result) => (
            <div key={result.id} className={styles.criticalItem}>
              <p className={styles.criticalText}>{result.description}</p>
              <dl className={styles.diff}>
                <dt>Expected</dt>
                <dd>{result.expected}</dd>
                <dt>Observed</dt>
                <dd>{result.observed}</dd>
              </dl>
            </div>
          ))}
        </Surface>
      )}

      {negotiated && attempt.response?.negotiation && (
        <NegotiationThread
          exercise={negotiated}
          saved={attempt.response.negotiation}
          context={NORMAL_RUN}
          readOnly
        />
      )}
      {priced && attempt.response && (
        <Surface padding="md" className={styles.tier}>
          <DealReveal exercise={priced} response={pricingOf(attempt.response)} />
        </Surface>
      )}

      {report?.dimensions && (
        <section aria-labelledby="dimensions-title" className={styles.tier}>
          <h3 id="dimensions-title" className={styles.tierTitle}>
            How the score was weighted
          </h3>
          <ul className={styles.dimensions} data-testid="dimensions">
            {SCORING_DIMENSIONS.map((dimension) => {
              const row = report.dimensions?.[dimension];
              if (!row) return null;
              return (
                <li key={dimension} className={styles.dimension}>
                  <span>{DIMENSION_WORDS[dimension]}</span>
                  <span className={styles.help}>
                    {row.total === 0
                      ? `weight ${row.weight}% · no checks, not counted`
                      : `weight ${row.weight}% · ${row.passed} of ${row.total} passed`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {report &&
        ASSERTION_TIERS.filter((tier) => tier !== 'critical').map((tier) => (
          <Tier key={tier} tier={tier} results={report.tiers[tier]} />
        ))}

      {report && report.tiers.critical.length > 0 && failedCritical.length === 0 && (
        <Tier tier="critical" results={report.tiers.critical} />
      )}

      {report?.rubric_evaluation && (
        <section aria-label="Rubric feedback">
          <h3>Rubric feedback</h3>
          <p>Rubric version: {report.rubric_evaluation.rubric_id}</p>
          <ul>
            {report.rubric_evaluation.result.rubric_results.map((item) => (
              <li key={item.id}>
                {item.passed ? 'Held' : 'Needs work'}: {item.reason}
              </li>
            ))}
          </ul>
          <p>{report.rubric_evaluation.result.next_probe}</p>
        </section>
      )}
      <section aria-labelledby="assistance-title" className={styles.tier}>
        <h3 id="assistance-title" className={styles.tierTitle}>
          Assistance used
        </h3>
        <p className={styles.assistance}>
          <span className={styles.assistanceValue}>{ASSISTANCE_WORDS[attempt.assistance]}</span>
          <span className={styles.help}>
            {attempt.hints_used.length === 0
              ? 'No hints taken.'
              : `${attempt.hints_used.length} hint${attempt.hints_used.length === 1 ? '' : 's'} taken.`}
          </span>
        </p>
        {report?.rubric_pending && (
          <p className={styles.help}>
            Rubric {report.rubric_pending} is not evaluated yet; the written half of this exercise
            was not evaluated in this historical attempt.
          </p>
        )}
        <p className={styles.help}>
          Graded by rules {report?.grader_version ?? attempt.versions.rules} · content{' '}
          {attempt.versions.content}
        </p>
      </section>

      {skillId && snapshot && <NextStep skillId={skillId} snapshot={snapshot} />}

      <div className={styles.resultActions}>
        {onTryAgain && (
          <Button variant="secondary" onClick={onTryAgain}>
            Try again
          </Button>
        )}
        <span className={styles.help}>
          This attempt stays in your history whatever the next one does.
        </span>
      </div>
    </section>
  );
}
