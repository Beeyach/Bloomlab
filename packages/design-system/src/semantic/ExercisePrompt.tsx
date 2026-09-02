import type { ReactNode } from 'react';

import { cx } from '../utils/cx';
import {
  ASSISTANCE_LABELS,
  EXERCISE_LABELS,
  type AssistanceLevel,
  type ExerciseType,
} from './domain';
import styles from './ExercisePrompt.module.css';

export interface ExercisePromptProps {
  family: ExerciseType;
  title: string;
  /** Instructions; short paragraphs, real GHL terms. */
  children: ReactNode;
  skills?: string[];
  /** Rebuild Blind / Capstone: no hint controls at all (spec §27, §155). */
  noHints?: boolean;
  /** Assistance meter state, shown quietly (spec §34). */
  assistance?: AssistanceLevel;
  className?: string;
}

/** The objective of an exercise: family, title, instructions, skills, hint policy. */
export function ExercisePrompt({
  family,
  title,
  children,
  skills = [],
  noHints = false,
  assistance,
  className,
}: ExercisePromptProps) {
  return (
    <section
      className={cx(styles.prompt, className)}
      aria-label={`${EXERCISE_LABELS[family]}: ${title}`}
    >
      <p className={styles.family}>{EXERCISE_LABELS[family]}</p>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.body}>{children}</div>
      {(skills.length > 0 || noHints || assistance) && (
        <div className={styles.foot}>
          {skills.length > 0 && (
            <ul className={styles.skills} aria-label="Skills">
              {skills.map((skill) => (
                <li key={skill} className={styles.skill}>
                  {skill}
                </li>
              ))}
            </ul>
          )}
          {noHints && <span className={styles.noHints}>No hints this time.</span>}
          {assistance && !noHints && (
            <span className={styles.assistance}>{ASSISTANCE_LABELS[assistance]}</span>
          )}
        </div>
      )}
    </section>
  );
}
