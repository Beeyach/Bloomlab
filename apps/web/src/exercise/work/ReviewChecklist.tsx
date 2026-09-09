import { emptyReview, type ReviewResponse } from '../review';
import styles from '../ExerciseRunner.module.css';
export function ReviewChecklist({
  checks,
  value,
  disabled,
  onChange,
}: {
  checks: readonly { key: string; prompt: string }[];
  value?: ReviewResponse;
  disabled: boolean;
  onChange: (value: ReviewResponse) => void;
}) {
  const current = value ?? emptyReview();
  return (
    <fieldset disabled={disabled} className={styles.options}>
      <legend className={styles.optionsLegend}>QA test record</legend>
      <p>
        Record what you tested and observed. A blocked test is still unresolved; Bloomlab does not
        inspect GHL for you.
      </p>
      {checks.map((check) => {
        const row = current.checks[check.key] ?? { status: '', observation: '' };
        const update = (change: Partial<typeof row>) =>
          onChange({
            ...current,
            checks: { ...current.checks, [check.key]: { ...row, ...change } },
          });
        return (
          <div key={check.key}>
            <h3>{check.key.replaceAll('_', ' ')}</h3>
            <p>{check.prompt}</p>
            <label className={styles.field}>
              <span>Test status</span>
              <select
                aria-label={`${check.key.replaceAll('_', ' ')} test status`}
                value={row.status}
                onChange={(event) => update({ status: event.target.value as typeof row.status })}
              >
                <option value="">Choose a status</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
                <option value="blocked">Blocked</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Expected result, observation and evidence</span>
              <textarea
                className={styles.response}
                aria-label={`${check.key.replaceAll('_', ' ')} expected result, observation and evidence`}
                rows={3}
                value={row.observation}
                onChange={(event) => update({ observation: event.target.value })}
              />
            </label>
          </div>
        );
      })}
      <label className={styles.field}>
        <span>Release decision</span>
        <select
          value={current.decision}
          onChange={(event) =>
            onChange({ ...current, decision: event.target.value as ReviewResponse['decision'] })
          }
        >
          <option value="">Choose a decision</option>
          <option value="hold">Hold for resolution</option>
          <option value="release">Release</option>
        </select>
      </label>
    </fieldset>
  );
}
