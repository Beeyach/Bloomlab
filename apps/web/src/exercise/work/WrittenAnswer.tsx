import type { EvidenceItem, Exercise } from '@bloomlab/content-schema';

import { wordCount } from '../sales';
import { EvidencePack } from './EvidencePack';
import { MESSAGE_TYPE_WORDS } from './words';
import styles from './work.module.css';

type WrittenField = Exercise['written_fields'][number];

/**
 * One named written answer (EXR-010, EXR-014, EXR-018).
 *
 * The same component serves a cold email and the owner half of an explanation, because they are
 * the same thing to the runner: a piece the exercise asked for by name, with a cap it stated, a
 * next step it may ask for, and evidence it may let the learner cite. The word count is the one
 * the grade uses, so "147 words, the brief caps it at 120" is not a hint — it is the fact.
 *
 * Nothing here writes for the learner. There is no suggestion, no rewrite and no example.
 */
export function WrittenAnswer({
  field,
  value,
  onChange,
  evidence,
  nextStep,
  onNextStep,
  citations,
  onToggleCitation,
  disabled,
}: {
  field: WrittenField;
  value: string;
  onChange: (value: string) => void;
  evidence: readonly EvidenceItem[];
  nextStep: string;
  onNextStep: (value: string) => void;
  citations: readonly string[];
  onToggleCitation: (id: string) => void;
  disabled: boolean;
}) {
  const words = wordCount(value);
  const over = field.max_words !== undefined && words > field.max_words;
  const counted =
    field.max_words === undefined
      ? `${words} ${words === 1 ? 'word' : 'words'}.`
      : over
        ? `Over the cap: ${words} words, and the brief allows ${field.max_words}.`
        : `${words} of ${field.max_words} words.`;

  return (
    <section
      className={styles.written}
      aria-label={field.label}
      data-testid={`written-${field.key}`}
    >
      <label className={styles.field}>
        <span className={styles.fieldLabel}>
          {field.label}
          {field.message_type && (
            <span className={styles.kind}> · {MESSAGE_TYPE_WORDS[field.message_type]}</span>
          )}
        </span>
        <textarea
          className={styles.textarea}
          rows={field.rows}
          value={value}
          disabled={disabled}
          data-testid={`write-${field.key}`}
          aria-describedby={`written-help-${field.key} written-count-${field.key}`}
          onChange={(event) => onChange(event.target.value)}
        />
        <span id={`written-help-${field.key}`} className={styles.help}>
          {field.help}
        </span>
      </label>
      <p
        id={`written-count-${field.key}`}
        className={over ? styles.countOver : styles.count}
        data-testid={`count-${field.key}`}
      >
        {counted}
      </p>

      {field.next_step && (
        <label className={styles.field}>
          <span className={styles.fieldLabel}>The one thing you are asking them to do</span>
          <input
            type="text"
            className={styles.input}
            value={nextStep}
            disabled={disabled}
            data-testid={`next-step-${field.key}`}
            onChange={(event) => onNextStep(event.target.value)}
          />
        </label>
      )}

      {field.cites_evidence && (
        <EvidencePack
          items={evidence}
          title="What this message leans on"
          name={`cite-${field.key}`}
          selected={citations}
          onToggle={onToggleCitation}
          disabled={disabled}
        />
      )}
    </section>
  );
}
