import type { Exercise } from '@bloomlab/content-schema';

import {
  emptyFinding,
  findingVerdict,
  FINDING_CLASSIFICATIONS,
  type AuditFindingResponse,
  type FindingClassification,
  type SalesResponse,
} from '../sales';
import { EvidencePack } from './EvidencePack';
import { CLASSIFICATION_HELP, CLASSIFICATION_WORDS, FINDING_PROBLEM_WORDS } from './words';
import styles from './work.module.css';

/**
 * AUDIT IT (EXR-013, SAL-001).
 *
 * The learner writes their own findings — this is not a list of prewritten claims to tick — and
 * every one of them is forced into Verified, Likely or Unknown. There is no fourth option and no
 * "other": that constraint is the lesson. What makes a claim stand up is the evidence attached to
 * it, so an unsupported Verified is visible here before it is ever graded, and an Unknown is a
 * good answer that says what would settle it.
 */
export function AuditDesk({
  exercise,
  sales,
  onChange,
  disabled,
  mintId,
}: {
  exercise: Exercise;
  sales: SalesResponse;
  onChange: (findings: AuditFindingResponse[]) => void;
  disabled: boolean;
  mintId: () => string;
}) {
  const findings = sales.findings;
  const update = (id: string, change: Partial<AuditFindingResponse>) =>
    onChange(findings.map((row) => (row.id === id ? { ...row, ...change } : row)));

  return (
    <div className={styles.desk} data-testid="audit-desk">
      <EvidencePack items={exercise.sales.evidence} title="What you have looked at" />

      <div className={styles.findings}>
        <p className={styles.deskNote} data-testid="findings-target">
          {findings.length} of at least {exercise.sales.min_findings} findings written.
        </p>
        {findings.map((finding, index) => {
          const verdict = findingVerdict(exercise, finding);
          const evidence = exercise.sales.evidence;
          const problem =
            verdict.problem &&
            verdict.problem !== 'no_claim' &&
            verdict.problem !== 'no_classification'
              ? FINDING_PROBLEM_WORDS[verdict.problem]
              : null;
          return (
            <section
              key={finding.id}
              className={styles.finding}
              aria-label={`Finding ${index + 1}`}
              data-testid={`finding-${index}`}
            >
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Finding {index + 1}</span>
                <textarea
                  className={styles.textarea}
                  rows={2}
                  value={finding.claim}
                  disabled={disabled}
                  data-testid={`finding-claim-${index}`}
                  onChange={(event) => update(finding.id, { claim: event.target.value })}
                />
              </label>

              <fieldset className={styles.choices} disabled={disabled}>
                <legend className={styles.legend}>How sure are you</legend>
                {FINDING_CLASSIFICATIONS.map((value: FindingClassification) => (
                  <label key={value} className={styles.choice}>
                    <input
                      type="radio"
                      name={`finding-class-${finding.id}`}
                      value={value}
                      checked={finding.classification === value}
                      data-testid={`finding-${index}-${value}`}
                      onChange={() => update(finding.id, { classification: value })}
                    />
                    <span className={styles.choiceBody}>
                      <span className={styles.choiceName}>{CLASSIFICATION_WORDS[value]}</span>
                      <span className={styles.choiceHelp}>{CLASSIFICATION_HELP[value]}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              <EvidencePack
                items={evidence}
                title="What this rests on"
                name={`finding-${index}`}
                selected={finding.evidence}
                disabled={disabled}
                onToggle={(id) =>
                  update(finding.id, {
                    evidence: finding.evidence.includes(id)
                      ? finding.evidence.filter((item) => item !== id)
                      : [...finding.evidence, id],
                  })
                }
              />

              {finding.classification === 'unknown' && (
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>How you would confirm it</span>
                  <textarea
                    className={styles.textarea}
                    rows={2}
                    value={finding.verification}
                    disabled={disabled}
                    data-testid={`finding-plan-${index}`}
                    onChange={(event) => update(finding.id, { verification: event.target.value })}
                  />
                </label>
              )}

              {problem && (
                <p className={styles.problemNote} data-testid={`finding-note-${index}`}>
                  {problem}
                </p>
              )}

              <button
                type="button"
                className={styles.quietButton}
                disabled={disabled}
                data-testid={`finding-remove-${index}`}
                onClick={() => onChange(findings.filter((row) => row.id !== finding.id))}
              >
                Remove this finding
              </button>
            </section>
          );
        })}
      </div>

      <button
        type="button"
        className={styles.addButton}
        disabled={disabled}
        data-testid="finding-add"
        onClick={() => onChange([...findings, emptyFinding(mintId())])}
      >
        Add a finding
      </button>
    </div>
  );
}
