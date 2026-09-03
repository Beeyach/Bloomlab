import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { Button, Stack, Surface, cx } from '@bloomlab/design-system';
import type { Exercise } from '@bloomlab/content-schema';
import type { HintLevel } from '@bloomlab/mastery-engine';

import { content } from '../content/bundle';
import { db } from '../data/db';
import { useLearnerSnapshot } from '../data/learning';
import { joinWords, skillTitle } from '../screens/learningCopy';
import {
  discardAttempt,
  resolveRunContext,
  revealHint,
  saveResponse,
  startAttempt,
  useActiveAttempt,
  type ActiveAttempt,
  type AttemptContext,
} from './attempt';
import { finalizeAttempt, gradeAttempt, RuntimeUnavailableError } from './finalize';
import { HintDrawer } from './HintDrawer';
import { Markdown } from './markdown';
import { predictionFields } from './response';
import { ResultView } from './ResultView';
import { canGradeNow, missingSources, SOURCE_DEPENDENCY, SOURCE_PHASE } from './runtime';
import { MODE_WORDS, treatmentFor } from './runnerCopy';
import styles from './ExerciseRunner.module.css';
import { useAttemptHistory } from './useAttemptHistory';

/** What the exercise needs that nothing can supply yet, in the learner's words (EXR-024). */
function RuntimeRequired({ exercise }: { exercise: Exercise }) {
  const missing = missingSources(exercise);
  if (missing.length === 0) return null;
  return (
    <Surface padding="md" className={styles.runtime} role="note">
      <p className={styles.runtimeTitle}>This one is not runnable yet.</p>
      <p className={styles.runtimeText}>
        Grading it needs {joinWords(missing.map((source) => SOURCE_DEPENDENCY[source]))}, which
        arrives with {joinWords([...new Set(missing.map((source) => SOURCE_PHASE[source]))])}. Your
        work below is saved, and nothing is graded until the real run exists.
      </p>
    </Surface>
  );
}

function Brief({ exercise }: { exercise: Exercise }) {
  const client = content.clients.find((candidate) => candidate.id === exercise.client);
  const scenario = content.scenarios.find((candidate) => candidate.id === exercise.scenario);
  const features = exercise.allowed_features
    .map((id) => content.ghl_features.find((feature) => feature.id === id))
    .filter((feature) => feature !== undefined);
  return (
    <section aria-labelledby="brief-title" className={styles.brief}>
      <h2 id="brief-title" className={styles.sectionTitle}>
        The job
      </h2>
      {(scenario ?? client) && (
        <p className={styles.context}>
          {scenario?.title ?? client?.business_name}
          {scenario && client ? ` · ${client.business_name}` : ''}
        </p>
      )}
      <Markdown text={exercise.instructions} className={styles.instructions} />
      {exercise.starting_state.notes && (
        <p className={styles.startingState}>{exercise.starting_state.notes}</p>
      )}
      {features.length > 0 && (
        <div className={styles.features}>
          <h3 className={styles.featuresTitle}>You may use</h3>
          <ul className={styles.featureList}>
            {features.map((feature) => (
              <li key={feature.id}>{feature.official_name}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function WorkSurface({
  exercise,
  attempt,
  context,
  disabled,
}: {
  exercise: Exercise;
  attempt: ActiveAttempt;
  context: AttemptContext;
  disabled: boolean;
}) {
  const treatment = treatmentFor(exercise);
  const fields = useMemo(() => predictionFields(exercise), [exercise]);
  // Keyed on the attempt id by the caller, so starting again remounts with empty work.
  const [draft, setDraft] = useState(attempt.response);

  const update = (change: Partial<typeof draft>) => {
    const next = { ...draft, ...change };
    setDraft(next);
    void saveResponse(exercise.id, context, change);
  };

  return (
    <section aria-labelledby="work-title" className={styles.work}>
      <h2 id="work-title" className={styles.sectionTitle}>
        {treatment.workTitle}
      </h2>

      {exercise.decision_options.length > 0 && (
        <fieldset className={styles.options} disabled={disabled}>
          <legend className={styles.optionsLegend}>Where it lives</legend>
          {exercise.decision_options.map((option) => (
            <label key={option.value} className={styles.option}>
              <input
                type="radio"
                name="decision-choice"
                value={option.value}
                checked={draft.choice === option.value}
                onChange={() => update({ choice: option.value })}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      )}

      {fields.length > 0 && (
        <div className={styles.predictions}>
          {fields.map((field) => (
            <label key={field.key} className={styles.field}>
              <span className={styles.fieldLabel}>{field.label}</span>
              <input
                type="text"
                value={draft.prediction[field.key] ?? ''}
                disabled={disabled}
                onChange={(event) =>
                  update({ prediction: { ...draft.prediction, [field.key]: event.target.value } })
                }
              />
            </label>
          ))}
        </div>
      )}

      <label className={styles.field}>
        <span className={styles.fieldLabel}>{treatment.responseLabel}</span>
        <textarea
          className={styles.response}
          rows={7}
          value={draft.text}
          disabled={disabled}
          aria-describedby="response-help"
          onChange={(event) => update({ text: event.target.value })}
        />
      </label>
      <p id="response-help" className={styles.help}>
        {treatment.responseHelp}
      </p>
    </section>
  );
}

/**
 * The exercise runner (spec §27, EXR-001 … EXR-003, EXR-022). One route for every family: the
 * brief, the work area, the assistance the exercise authored, the submit, the result. It reads
 * the compiled exercise and branches on its **type**, never on its id.
 */
export default function ExerciseRunner() {
  const { exerciseId = '' } = useParams();
  const [search] = useSearchParams();
  const exercise = content.exercises.find((candidate) => candidate.id === exerciseId) ?? null;
  // A retrieval is honoured only when it names a capability the exercise teaches; the context
  // then keeps this run's draft and result apart from an ordinary run of the same exercise.
  const context = resolveRunContext(exercise ?? { skills: [] }, {
    run: search.get('run'),
    skill: search.get('skill'),
  });
  const run = context.run;
  const skillId = context.skill_id;

  const attempt = useActiveAttempt(exerciseId, context);
  const history = useAttemptHistory(exerciseId, context);
  const snapshot = useLearnerSnapshot();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const finished = history?.[0] ?? null;
  const gradable = exercise ? canGradeNow(exercise) : false;

  // Resume the attempt in progress, or open a new one — but never over a finished result the
  // learner has not chosen to leave (that would hide their own history).
  useEffect(() => {
    if (!exercise || attempt === undefined || history === undefined) return;
    if (attempt === null && history.length === 0) {
      void startAttempt(exercise, context);
    }
  }, [exercise, attempt, history, context.run, context.skill_id]);

  if (!exercise) {
    return (
      <Stack as="section" gap={3} className={styles.screen} aria-labelledby="missing-title">
        <h1 id="missing-title" className={styles.title}>
          No exercise at this address.
        </h1>
        <p className={styles.help}>
          <Link to="/skills">Open the Skill Map</Link> to find the capability you were working on.
        </p>
      </Stack>
    );
  }

  const treatment = treatmentFor(exercise);
  const preview = attempt ? gradeAttempt(exercise, attempt) : null;

  async function submit() {
    if (!attempt || !exercise) return;
    setBusy(true);
    setFailure(null);
    try {
      await finalizeAttempt(exercise, attempt, db);
    } catch (error) {
      // The learner's work is untouched: the draft is only cleared once the attempt is recorded.
      setFailure(
        error instanceof RuntimeUnavailableError
          ? 'This one is graded from your CRM account, and there is no account on this device yet. Open the CRM, do the work there, then come back.'
          : 'This attempt could not be saved on this device. Your work is still here.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function tryAgain() {
    if (!exercise) return;
    // A new attempt in the same context: the finished one keeps its place in the history.
    await discardAttempt(exercise.id, context, db);
    await startAttempt(exercise, context);
  }

  return (
    <Stack
      as="article"
      gap={6}
      className={cx(styles.screen, styles[treatment.tone])}
      aria-labelledby="exercise-title"
    >
      <header className={styles.masthead}>
        <h1 id="exercise-title" className={styles.title}>
          {exercise.title}
        </h1>
        <p className={styles.stance}>{treatment.stance}</p>
        <p className={styles.meta}>
          {treatment.family} · {MODE_WORDS[exercise.mode]} · {exercise.estimated_minutes} min
          {run === 'retrieval' && ' · Retrieval'}
        </p>
        {skillId && (
          <p className={styles.for}>
            {run === 'retrieval' ? 'Reviewing ' : 'For '}
            <Link to={`/skills/${skillId}`} className={styles.inlineLink}>
              {skillTitle(skillId)}
            </Link>
            {run === 'retrieval' && ' · a review challenge, not a new demonstration'}
          </p>
        )}
      </header>

      <RuntimeRequired exercise={exercise} />

      <div className={styles.columns}>
        <Brief exercise={exercise} />
        <div className={styles.side}>
          {attempt && (
            <WorkSurface
              key={attempt.attempt_id}
              exercise={exercise}
              attempt={attempt}
              context={context}
              disabled={busy}
            />
          )}
          {attempt && (
            <HintDrawer
              exercise={exercise}
              revealed={attempt.hints_revealed}
              onReveal={(level: HintLevel) => void revealHint(exercise.id, context, level)}
            />
          )}
          {attempt && (
            <section aria-labelledby="submit-title" className={styles.submit}>
              <h2 id="submit-title" className={styles.sectionTitle}>
                Submit
              </h2>
              {gradable ? (
                <>
                  <Button variant="primary" loading={busy} onClick={() => void submit()}>
                    Run it
                  </Button>
                  <p className={styles.help}>
                    {preview?.rubric_pending
                      ? 'The deterministic checks run now. The written half waits for its rubric.'
                      : 'Graded against the checks this exercise authored.'}
                  </p>
                </>
              ) : (
                <p className={styles.help}>
                  Nothing is submitted until this exercise can actually be run. Your work is saved
                  on this device.
                </p>
              )}
              {failure && (
                <p className={styles.problem} role="alert">
                  {failure}
                </p>
              )}
            </section>
          )}
          {!attempt && finished && (
            <ResultView
              attempt={finished}
              skillId={skillId}
              snapshot={snapshot}
              onTryAgain={() => void tryAgain()}
            />
          )}
          {treatment.offersLesson && skillId && <UnitLink exercise={exercise} skillId={skillId} />}
        </div>
      </div>
    </Stack>
  );
}

/** The unit behind the capability — offered only where the exercise's own rules allow support. */
function UnitLink({ exercise, skillId }: { exercise: Exercise; skillId: string }) {
  // Guided and practice work may look something up; independent and pressure work may not.
  if (exercise.mode !== 'guided' && exercise.mode !== 'practice') return null;
  const unitId = content.indexes.units_by_skill[skillId]?.[0];
  const unit = content.learning_units.find((candidate) => candidate.id === unitId);
  if (!unit) return null;
  return (
    <p className={styles.lesson}>
      <Link to={`/academy/${unit.id}?skill=${skillId}`} className={styles.inlineLink}>
        Read {unit.title}
      </Link>
    </p>
  );
}
