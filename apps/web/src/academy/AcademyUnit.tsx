import { Suspense, useEffect, useMemo, useState, type ElementType } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { Button, StatusPill, TERRITORY_LABELS, cx, type Territory } from '@bloomlab/design-system';
import type { LearningUnit } from '@bloomlab/content-schema';
import { nextStepForSkill, type SessionItem } from '@bloomlab/mastery-engine';

import { content } from '../content/bundle';
import { sessionContentOf, useLearnerSnapshot, type LearnerSnapshot } from '../data/learning';
import {
  describeStep,
  joinWords,
  plural,
  relativeDay,
  skillTitle,
  stepDestination,
} from '../screens/learningCopy';
import styles from './AcademyUnit.module.css';
import { completeUnit, useUnitCompletion, type UnitCompletion } from './completion';
import { Callout, Depth, Diagram, Exercise, Feature, Interactive, Simulation } from './embeds';
import { PROSE_COMPONENTS } from './prose';
import { slugify } from './slug';
import { UNIT_COMPONENTS } from './unitModules';

/** Prose elements plus the embed vocabulary a unit body may use (validated by the compiler). */
const COMPONENTS: Record<string, ElementType> = {
  ...PROSE_COMPONENTS,
  Callout,
  Depth,
  Feature,
  Exercise,
  Simulation,
  Diagram,
  Interactive,
};

interface Section {
  id: string;
  text: string;
}

/** Tracks which section heading is nearest the top of the viewport (for the contents list). */
function useCurrentSection(sections: Section[]): string | null {
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || sections.length === 0) return;
    const headings = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setCurrent(visible.target.id);
      },
      { rootMargin: '-10% 0px -70% 0px' },
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [sections]);
  return current;
}

function NextStep({
  unit,
  skillId,
  snapshot,
}: {
  unit: LearningUnit;
  skillId: string;
  snapshot: LearnerSnapshot;
}) {
  const sessionContent = useMemo(() => sessionContentOf(content), []);
  const skill = content.skills.find((candidate) => candidate.id === skillId);
  const evaluation = snapshot.evaluations.get(skillId);
  const step: SessionItem | null =
    skill && evaluation
      ? nextStepForSkill({
          skill,
          evaluation,
          content: sessionContent,
          recent_evidence: snapshot.evidence,
        })
      : null;
  const described = step ? describeStep(step) : null;
  const others = unit.skills.filter((id) => id !== skillId);

  return (
    <div className={styles.next} data-testid="next-step">
      {step && described ? (
        <>
          <p className={styles.nextEyebrow}>Next · {described.verb}</p>
          <p className={styles.nextTitle}>{described.title}</p>
          <p className={styles.nextMeta}>
            {step.minutes} min{described.detail ? ` · ${described.detail}` : ''} · {step.reason}
          </p>
          {step.kind === 'unit' ? (
            <Link to={stepDestination(step, skillId)} className={styles.nextAction}>
              Continue reading
            </Link>
          ) : (
            <p className={styles.nextMeta}>
              {step.kind === 'exercise' ? 'Exercises' : 'Retrieval challenges'} run in the exercise
              runner, which arrives with Phase 9. Until then, this is where {skillTitle(skillId)}{' '}
              stands.
            </p>
          )}
        </>
      ) : (
        <p className={styles.nextMeta}>
          {evaluation?.state === 'MASTERED'
            ? `${skillTitle(skillId)} is mastered; retrieval keeps it current.`
            : 'No suitable next exercise is authored for this capability yet.'}
        </p>
      )}
      <p className={styles.nextLinks}>
        <Link to={`/skills/${skillId}`} className={styles.nextLink}>
          {skillTitle(skillId)} on the Skill Map
        </Link>
        <Link to="/" className={styles.nextLink}>
          What should I do next?
        </Link>
      </p>
      {others.length > 0 && (
        <p className={styles.nextMeta}>
          This unit also covers{' '}
          {others.map((id, index) => (
            <span key={id}>
              {index > 0 && ', '}
              <Link to={`/skills/${id}`} className={styles.inlineLink}>
                {skillTitle(id)}
              </Link>
            </span>
          ))}
          .
        </p>
      )}
    </div>
  );
}

function Completion({
  unit,
  skillId,
  completion,
  snapshot,
}: {
  unit: LearningUnit;
  skillId: string;
  completion: UnitCompletion | null;
  snapshot: LearnerSnapshot | undefined;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function finish() {
    setBusy(true);
    setFailed(false);
    try {
      await completeUnit(unit);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="finish" className={styles.finish} aria-labelledby="finish-title">
      {completion ? (
        <>
          <StatusPill label="Recorded" tone="success" glyph="check" />
          <h2 id="finish-title" className={styles.finishTitle}>
            You finished this unit {relativeDay(completion.occurred_at)}.
          </h2>
          <p className={styles.finishText}>
            That is recorded as exposure for {joinWords(unit.skills.map((id) => skillTitle(id)))}.
            Reading it again is welcome; it does not add evidence — the next demonstration does.
          </p>
          {snapshot && <NextStep unit={unit} skillId={skillId} snapshot={snapshot} />}
        </>
      ) : (
        <>
          <h2 id="finish-title" className={styles.finishTitle}>
            Finished reading?
          </h2>
          <p className={styles.finishText}>
            Finishing records that you read this unit — exposure for{' '}
            {joinWords(unit.skills.map((id) => skillTitle(id)))}, not a demonstration. Opening the
            page records nothing.
          </p>
          <Button variant="primary" loading={busy} onClick={() => void finish()}>
            Finish this unit
          </Button>
          {failed && (
            <p className={styles.problem} role="alert">
              The completion could not be saved on this device. Try again.
            </p>
          )}
        </>
      )}
    </section>
  );
}

/**
 * Academy unit (spec §76, CUR-036, DES-020): the authored MDX rendered as an editorial reading
 * surface with real embeds, a contents list, and an explicit "Finish this unit" that records
 * exposure evidence through the learning engine's write path.
 */
export default function AcademyUnit() {
  const { unitId = '' } = useParams();
  const [search] = useSearchParams();
  const unit = content.learning_units.find((candidate) => candidate.id === unitId) ?? null;
  const Content = unit ? (UNIT_COMPONENTS[unit.id] ?? null) : null;
  const snapshot = useLearnerSnapshot();
  const completion = useUnitCompletion(unitId);
  const requestedSkill = search.get('skill');
  const skillId =
    unit && requestedSkill && unit.skills.includes(requestedSkill)
      ? requestedSkill
      : (unit?.skills[0] ?? '');
  const sections = useMemo<Section[]>(
    () =>
      (unit?.headings ?? [])
        .filter((heading) => heading.depth === 2)
        .map((heading) => ({ id: slugify(heading.text), text: heading.text })),
    [unit],
  );
  const current = useCurrentSection(sections);

  if (!unit || !Content) {
    return (
      <section className={styles.missing} aria-labelledby="unit-missing">
        <h1 id="unit-missing" className={styles.title}>
          No unit at this address.
        </h1>
        <p>
          <Link to="/skills">Open the Skill Map</Link> to find every capability and its units.
        </p>
      </section>
    );
  }

  return (
    <article className={styles.unit} aria-labelledby="unit-title">
      <header className={styles.masthead}>
        <p className={styles.eyebrow}>
          Academy · {TERRITORY_LABELS[unit.territory as Territory]} · {unit.estimated_minutes} min
          read
        </p>
        <h1 id="unit-title" className={styles.title}>
          {unit.title}
        </h1>
        <p className={styles.lede}>{unit.summary}</p>
        <p className={styles.for}>
          For{' '}
          {unit.skills.map((id, index) => (
            <span key={id}>
              {index > 0 && ' and '}
              <Link to={`/skills/${id}`} className={styles.inlineLink}>
                {skillTitle(id)}
              </Link>
            </span>
          ))}
          {completion && (
            <>
              {' '}
              ·{' '}
              <span className={styles.finished}>
                finished {relativeDay(completion.occurred_at)}
              </span>
            </>
          )}
        </p>
      </header>

      <div className={styles.layout}>
        <nav className={styles.contents} aria-label="In this unit">
          <p className={styles.contentsLabel}>In this unit</p>
          <ol className={styles.contentsList}>
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className={cx(
                    styles.contentsLink,
                    current === section.id && styles.contentsCurrent,
                  )}
                  aria-current={current === section.id ? 'location' : undefined}
                >
                  {section.text}
                </a>
              </li>
            ))}
            <li>
              <a href="#finish" className={styles.contentsLink}>
                Finish
              </a>
            </li>
          </ol>
          {unit.depth_sections.length > 0 && (
            <p className={styles.contentsMeta}>
              {plural(unit.depth_sections.length, 'optional deeper section')}
            </p>
          )}
        </nav>

        <div className={styles.reading}>
          <Suspense
            fallback={
              <p className={styles.loading} role="status">
                Opening the unit…
              </p>
            }
          >
            <Content components={COMPONENTS} />
          </Suspense>
          {completion !== undefined && (
            <Completion unit={unit} skillId={skillId} completion={completion} snapshot={snapshot} />
          )}
        </div>
      </div>
    </article>
  );
}
