import type { EvidenceItem } from '@bloomlab/content-schema';

import { EVIDENCE_SOURCE_WORDS } from './words';
import styles from './work.module.css';

/**
 * What the learner can see (SAL-001, §23 of the phase brief).
 *
 * This is the whole evidence API of a sales exercise. Nothing else about the business is on
 * screen, because an audit you can only do by remembering hidden numbers is not an audit. An item
 * says where it came from and whether it was observed first-hand, and only the first-hand ones can
 * carry a Verified finding — so the difference between "the reply took 22 hours" and "their sales
 * team is slow" is visible before the learner writes anything.
 */
export function EvidencePack({
  items,
  title = 'What you can see',
  selected,
  onToggle,
  disabled = false,
  name,
}: {
  items: readonly EvidenceItem[];
  title?: string;
  /** When given, each item is selectable and this is what is currently cited. */
  selected?: readonly string[];
  onToggle?: (id: string) => void;
  disabled?: boolean;
  /** Distinguishes several selectable packs on one screen. */
  name?: string;
}) {
  if (items.length === 0) return null;
  const selectable = selected !== undefined && onToggle !== undefined;
  return (
    <div className={styles.evidence}>
      <p className={styles.evidenceTitle}>{title}</p>
      <ul className={styles.evidenceList}>
        {items.map((item) => {
          const id = `${name ?? 'evidence'}-${item.id}`;
          const label = (
            <>
              <span className={styles.evidenceSource}>{EVIDENCE_SOURCE_WORDS[item.source]}</span>
              <span className={styles.evidenceText}>{item.observation}</span>
              <span className={styles.evidenceKind}>
                {item.direct ? 'You saw this yourself' : 'Second-hand'}
              </span>
            </>
          );
          return (
            <li key={item.id} className={styles.evidenceItem}>
              {selectable ? (
                <label className={styles.evidenceChoice} htmlFor={id}>
                  <input
                    id={id}
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    disabled={disabled}
                    onChange={() => onToggle(item.id)}
                    data-testid={`cite-${name ?? 'evidence'}-${item.id}`}
                  />
                  <span className={styles.evidenceBody}>{label}</span>
                </label>
              ) : (
                <span className={styles.evidenceBody}>{label}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
