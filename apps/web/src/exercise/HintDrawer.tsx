import type { Exercise } from '@bloomlab/content-schema';
import { assistanceFromHints, type HintLevel } from '@bloomlab/mastery-engine';

import { Markdown } from './markdown';
import { ASSISTANCE_WORDS, HINT_WORDS } from './runnerCopy';
import styles from './ExerciseRunner.module.css';

/**
 * The hint ladder (EXR-022): Nudge, then Concept Reminder, then Worked Example, revealed one at
 * a time and recorded on the attempt. A pressure exercise authors no hints and the schema
 * enforces it, so there is nothing to draw — and no other control in the runner offers help.
 *
 * The assistance line is the mastery engine's own roll-up, shown plainly. It is a fact about the
 * attempt, not a scolding (MAS-007).
 */
export function HintDrawer({
  exercise,
  revealed,
  onReveal,
}: {
  exercise: Exercise;
  revealed: HintLevel[];
  onReveal: (level: HintLevel) => void;
}) {
  if (exercise.hints.length === 0) {
    return (
      <section aria-labelledby="hints-title" className={styles.hints}>
        <h2 id="hints-title" className={styles.sectionTitle}>
          Assistance
        </h2>
        <p className={styles.help}>
          {exercise.mode === 'pressure' ? 'No hints this time.' : 'This one offers no hints.'}
        </p>
      </section>
    );
  }
  const next = exercise.hints.find((hint) => !revealed.includes(hint.level));
  return (
    <section aria-labelledby="hints-title" className={styles.hints}>
      <h2 id="hints-title" className={styles.sectionTitle}>
        Assistance
      </h2>
      <p className={styles.assistance}>
        <span className={styles.assistanceLabel}>Assistance</span>
        <span className={styles.assistanceValue}>
          {ASSISTANCE_WORDS[assistanceFromHints(revealed)]}
        </span>
      </p>
      <ol className={styles.hintList}>
        {exercise.hints.map((hint) => {
          const open = revealed.includes(hint.level);
          return (
            <li key={hint.level} className={styles.hint}>
              <p className={styles.hintLevel}>{HINT_WORDS[hint.level]}</p>
              {open ? (
                <Markdown text={hint.text} className={styles.hintText} />
              ) : (
                <p className={styles.hintText}>
                  {next?.level === hint.level ? 'Not revealed.' : 'Take the one above first.'}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {next && (
        <button type="button" className={styles.hintButton} onClick={() => onReveal(next.level)}>
          Show the {HINT_WORDS[next.level].toLowerCase()}
        </button>
      )}
    </section>
  );
}
