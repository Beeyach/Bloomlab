import type { SequenceStep } from '../sequence';
import styles from '../ExerciseRunner.module.css';
export function SequencePlan({
  steps,
  value,
  disabled,
  onChange,
}: {
  steps: readonly SequenceStep[];
  value?: string[];
  disabled: boolean;
  onChange: (value: string[]) => void;
}) {
  const order = value ?? steps.map((step) => step.key);
  const move = (index: number, direction: number) => {
    const next = [...order];
    [next[index], next[index + direction]] = [next[index + direction]!, next[index]!];
    onChange(next);
  };
  return (
    <fieldset disabled={disabled} className={styles.options}>
      <legend className={styles.optionsLegend}>Build plan</legend>
      <p>
        Arrange the work in an order you can deliver. Read each dependency brief, then explain the
        plan below.
      </p>
      <ol>
        {order.map((key, index) => {
          const step = steps.find((candidate) => candidate.key === key);
          if (!step) return null;
          return (
            <li key={key}>
              <h3>{step.label}</h3>
              <p>{step.brief}</p>
              <button
                className={styles.hintButton}
                type="button"
                disabled={disabled || index === 0}
                aria-label={`Move ${step.label} earlier`}
                onClick={() => move(index, -1)}
              >
                Move earlier
              </button>{' '}
              <button
                className={styles.hintButton}
                type="button"
                disabled={disabled || index === order.length - 1}
                aria-label={`Move ${step.label} later`}
                onClick={() => move(index, 1)}
              >
                Move later
              </button>
            </li>
          );
        })}
      </ol>
    </fieldset>
  );
}
