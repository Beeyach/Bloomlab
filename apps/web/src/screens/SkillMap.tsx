import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';

import {
  Button,
  HoloTerritory,
  MasteryBadge,
  MASTERY_LABELS,
  Sheet,
  SkillCard,
  Stack,
  StatusPill,
  Surface,
  TERRITORY_LABELS,
  cx,
  type StatusGlyph,
  type StatusTone,
  type Territory,
} from '@bloomlab/design-system';
import {
  nextStepForSkill,
  type CampaignEvaluation,
  type SkillEvaluation,
  type SkillEvidence,
} from '@bloomlab/mastery-engine';

import { content } from '../content/bundle';
import {
  clearFocus,
  defaultCampaignId,
  sessionContentOf,
  setFocus,
  useFocus,
  useLearnerSnapshot,
  type LearnerSnapshot,
} from '../data/learning';
import {
  KIND_WORDS,
  TERRITORY_SCOPE,
  describeStep,
  evidenceWord,
  exerciseOf,
  isDemonstrated,
  joinWords,
  relativeDay,
  skillTitle,
  stateSentence,
  stepDestination,
} from './learningCopy';
import styles from './SkillMap.module.css';

/** Reading order: JUDGMENT sits fifth of ten, so it is central in every composition. */
const TERRITORIES: Territory[] = [
  'STRATEGIZE',
  'BUILD',
  'AUTOMATE',
  'ARCHITECT',
  'JUDGMENT',
  'DIAGNOSE',
  'CONNECT',
  'SELL',
  'DELIVER',
  'SCALE',
];

const EVIDENCE_LIMIT = 6;
const EXCERPT_LENGTH = 220;
const NARROW = '(max-width: 767px)';

type Skill = (typeof content.skills)[number];

interface Availability {
  label: string;
  tone: StatusTone;
  glyph: StatusGlyph;
  locked: boolean;
  after: string[];
}

/** Availability in words: prerequisites, never dates (spec §7). */
function availabilityOf(
  skill: Skill,
  snapshot: LearnerSnapshot,
  campaign: CampaignEvaluation | null,
): Availability {
  const evaluation = snapshot.evaluations.get(skill.id);
  const after = skill.prerequisites.filter((id) => !isDemonstrated(snapshot.evaluations.get(id)));
  if (after.length > 0) {
    return { label: 'Locked', tone: 'neutral', glyph: 'dash', locked: true, after };
  }
  if (evaluation?.state === 'NEEDS_REFRESH') {
    return { label: 'Needs refresh', tone: 'warning', glyph: 'ring', locked: false, after };
  }
  if (isDemonstrated(evaluation)) {
    return { label: 'Demonstrated', tone: 'success', glyph: 'check', locked: false, after };
  }
  if (campaign?.next_required.includes(skill.id)) {
    return { label: 'Next required', tone: 'info', glyph: 'dot', locked: false, after };
  }
  if (campaign?.work_ahead.includes(skill.id)) {
    return { label: 'Work ahead', tone: 'info', glyph: 'ring', locked: false, after };
  }
  if (evaluation && evaluation.state !== 'UNSEEN') {
    return { label: 'In progress', tone: 'info', glyph: 'clock', locked: false, after };
  }
  return { label: 'Available', tone: 'neutral', glyph: 'ring', locked: false, after };
}

function subscribeNarrow(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(NARROW);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const isNarrow = () => typeof window.matchMedia === 'function' && window.matchMedia(NARROW).matches;

function excerpt(markdown: string): string {
  const plain = markdown
    .replace(/[#*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > EXCERPT_LENGTH ? `${plain.slice(0, EXCERPT_LENGTH).trimEnd()}…` : plain;
}

function SkillDetail({
  skill,
  snapshot,
  campaign,
  focused,
  onClose,
}: {
  skill: Skill;
  snapshot: LearnerSnapshot;
  campaign: CampaignEvaluation | null;
  focused: boolean;
  onClose: () => void;
}) {
  const narrow = useSyncExternalStore(subscribeNarrow, isNarrow, () => false);
  const sessionContent = useMemo(() => sessionContentOf(content), []);
  const evaluation = snapshot.evaluations.get(skill.id);
  if (!evaluation) return null;
  const availability = availabilityOf(skill, snapshot, campaign);
  const step = nextStepForSkill({
    skill,
    evaluation,
    content: sessionContent,
    recent_evidence: snapshot.evidence,
  });
  const described = step ? describeStep(step) : null;
  const stepExercise = step?.kind === 'exercise' ? exerciseOf(step.content_id) : null;
  const unlocks = content.graph.dependents[skill.id] ?? [];
  const history = snapshot.evidence
    .filter((e) => e.skill_id === skill.id)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, EVIDENCE_LIMIT);

  return (
    <Sheet
      open
      onClose={onClose}
      title={skill.title}
      side={narrow ? 'bottom' : 'end'}
      className={styles.sheet}
      footer={
        <div className={styles.sheetActions}>
          <Button
            variant={focused ? 'secondary' : 'primary'}
            onClick={() => void (focused ? clearFocus() : setFocus(skill.id))}
          >
            {focused ? 'Clear focus' : 'Set as focus'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className={styles.detail} data-testid="skill-detail">
        <div className={styles.detailState}>
          <MasteryBadge state={evaluation.state} size="lg" />
          <div>
            <p className={styles.detailTerritory}>
              {TERRITORY_LABELS[skill.territory as Territory]}
              {focused && ' · Your focus'}
            </p>
            <StatusPill
              label={availability.label}
              tone={availability.tone}
              glyph={availability.glyph}
            />
          </div>
        </div>
        <p className={styles.detailSummary}>{skill.summary}</p>
        <p className={styles.detailSentence}>{stateSentence(evaluation)}</p>
        {availability.locked && (
          <p className={styles.detailSentence}>
            Opens after {joinWords(availability.after.map((id) => skillTitle(id)))} — demonstrate
            those first. Nothing here waits for a date.
          </p>
        )}
        {evaluation.review_due && evaluation.state !== 'NEEDS_REFRESH' && (
          <p className={styles.detailMeta}>
            Retrieval due {relativeDay(evaluation.review_due, snapshot.now)}
            {evaluation.last_demonstrated &&
              ` · last demonstrated ${relativeDay(evaluation.last_demonstrated, snapshot.now)}`}
          </p>
        )}

        {step && described && (
          <Surface tone="mist" padding="sm" className={styles.next}>
            <p className={styles.nextTitle}>{described.title}</p>
            <p className={styles.detailMeta}>
              Next · {described.verb} · {step.minutes} min
              {described.detail ? ` · ${described.detail}` : ''} · {step.reason}
            </p>
            {stepExercise && (
              <p className={styles.nextText}>{excerpt(stepExercise.instructions)}</p>
            )}
            {step.kind === 'unit' ? (
              <Link
                to={`/academy/${step.content_id}?skill=${skill.id}`}
                className={styles.nextLink}
                data-testid="open-unit"
              >
                Read this unit
              </Link>
            ) : (
              <Link
                to={stepDestination(step, skill.id)}
                className={styles.nextLink}
                data-testid="open-exercise"
              >
                {step.kind === 'retrieval' ? 'Run this retrieval' : 'Run this exercise'}
              </Link>
            )}
          </Surface>
        )}
        {!step && evaluation.state !== 'MASTERED' && (
          <p className={styles.detailMeta}>
            No suitable next exercise is authored for this capability yet.
          </p>
        )}

        {skill.prerequisites.length > 0 && (
          <section aria-labelledby={`${skill.id}-prereqs`} className={styles.detailSection}>
            <h3 id={`${skill.id}-prereqs`} className={styles.detailHeading}>
              Needs first
            </h3>
            <ul className={styles.detailList}>
              {skill.prerequisites.map((id) => {
                const prerequisite = snapshot.evaluations.get(id);
                return (
                  <li key={id}>
                    <Link to={`/skills/${id}`} className={styles.detailLink}>
                      {prerequisite && <MasteryBadge state={prerequisite.state} />}
                      <span>{skillTitle(id)}</span>
                    </Link>
                    <span className={styles.detailMeta}>
                      {isDemonstrated(prerequisite) ? 'demonstrated' : 'not yet demonstrated'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {unlocks.length > 0 && (
          <section aria-labelledby={`${skill.id}-unlocks`} className={styles.detailSection}>
            <h3 id={`${skill.id}-unlocks`} className={styles.detailHeading}>
              Opens
            </h3>
            <ul className={styles.detailList}>
              {unlocks.map((id) => (
                <li key={id}>
                  <Link to={`/skills/${id}`} className={styles.detailLink}>
                    <span>{skillTitle(id)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby={`${skill.id}-evidence`} className={styles.detailSection}>
          <h3 id={`${skill.id}-evidence`} className={styles.detailHeading}>
            Evidence
          </h3>
          {history.length === 0 ? (
            <p className={styles.detailMeta}>No evidence yet.</p>
          ) : (
            <ul className={styles.detailList}>
              {history.map((evidence: SkillEvidence) => (
                <li key={evidence.id} className={styles.evidenceRow}>
                  <span className={styles.evidenceWord}>{evidenceWord(evidence)}</span>
                  <span className={styles.detailMeta}>
                    {KIND_WORDS[evidence.kind]} · {relativeDay(evidence.occurred_at, snapshot.now)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className={styles.detailMeta}>
          Complete the next exercise to record evidence for this capability. Saved results keep
          their assistance level and any remaining requirements visible.{' '}
          <Link to="/" className={styles.detailBack}>
            Back to what to do next
          </Link>
        </p>
      </div>
    </Sheet>
  );
}

/**
 * Skill Map (spec §75, DES-011, PRD-013): nine territories around JUDGMENT, each a holographic
 * object counting real demonstrated capabilities; a territory opens to its skills; a skill opens
 * to its state, prerequisites, next step and evidence.
 */
export default function SkillMap() {
  const snapshot = useLearnerSnapshot();
  const focus = useFocus();
  const { skillId } = useParams();
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();

  const campaignId = defaultCampaignId(content);
  const campaign = snapshot?.campaigns.find((c) => c.campaign_id === campaignId) ?? null;
  const detail = skillId ? (content.skills.find((s) => s.id === skillId) ?? null) : null;

  const requested = search.get('territory');
  const selected: Territory =
    (detail?.territory as Territory | undefined) ??
    (TERRITORIES.includes(requested as Territory) ? (requested as Territory) : null) ??
    (content.skills.find((s) => s.id === campaign?.next_required[0])?.territory as
      Territory | undefined) ??
    'JUDGMENT';

  const skillsOf = (territory: Territory): Skill[] =>
    content.graph.order
      .map((id) => content.skills.find((s) => s.id === id))
      .filter((s): s is Skill => s !== undefined && s.territory === territory);

  const evaluationsOf = (territory: Territory): SkillEvaluation[] =>
    snapshot ? skillsOf(territory).flatMap((s) => snapshot.evaluations.get(s.id) ?? []) : [];

  const select = (territory: Territory) => {
    setSearch({ territory }, { replace: true });
  };

  const back = () => navigate(`/skills?territory=${selected}`);

  const lastOpened = useRef<string | null>(null);
  useEffect(() => {
    if (detail) {
      lastOpened.current = detail.id;
      return;
    }
    if (lastOpened.current) {
      document.querySelector<HTMLElement>(`[data-skill="${lastOpened.current}"]`)?.focus();
      lastOpened.current = null;
    }
  }, [detail]);

  const selectedSkills = skillsOf(selected);
  const selectedDemonstrated = evaluationsOf(selected).filter(isDemonstrated).length;

  return (
    <Stack as="section" gap={6} className={styles.screen} aria-labelledby="map-title">
      <header className={styles.header}>
        <h1 id="map-title" className={styles.title}>
          Skill Map
        </h1>
        <p className={styles.lead}>
          Nine territories with judgment at the centre. Every capability, where it stands, and what
          it opens. Prerequisites decide what is available; no date does.
        </p>
      </header>

      {!snapshot && (
        <p className={styles.muted} role="status">
          Reading your progress…
        </p>
      )}

      <div className={styles.map} role="group" aria-label="Territories">
        {TERRITORIES.map((territory) => {
          const skills = skillsOf(territory);
          const demonstrated = evaluationsOf(territory).filter(isDemonstrated).length;
          return (
            <HoloTerritory
              key={territory}
              territory={territory}
              scope={TERRITORY_SCOPE[territory]}
              demonstrated={demonstrated}
              total={skills.length}
              aria-pressed={selected === territory}
              data-territory={territory}
              className={cx(styles.territory, styles[territory.toLowerCase()])}
              onClick={() => select(territory)}
            />
          );
        })}
      </div>

      <section
        aria-labelledby="territory-title"
        className={styles.panel}
        data-testid="territory-panel"
      >
        <header className={styles.panelHeader}>
          <div>
            <h2 id="territory-title" className={styles.panelTitle}>
              {TERRITORY_LABELS[selected]}
            </h2>
            <p className={styles.panelScope}>{TERRITORY_SCOPE[selected]}</p>
          </div>
          <p className={styles.panelCount}>
            {selectedSkills.length === 0
              ? 'No capabilities authored yet'
              : `${selectedDemonstrated} of ${selectedSkills.length} capabilities demonstrated`}
          </p>
        </header>
        {selectedSkills.length === 0 ? (
          <p className={styles.muted}>
            This territory's capabilities are authored in a later content phase.
          </p>
        ) : !snapshot ? null : (
          <ul className={styles.skills}>
            {selectedSkills.map((skill) => {
              const evaluation = snapshot?.evaluations.get(skill.id);
              const availability = snapshot ? availabilityOf(skill, snapshot, campaign) : null;
              return (
                <li key={skill.id} className={styles.skill}>
                  <SkillCard
                    title={skill.title}
                    territory={skill.territory as Territory}
                    state={evaluation?.state ?? 'UNSEEN'}
                    summary={skill.summary}
                    demonstrations={evaluation?.counts.independent_demonstrations ?? 0}
                    aria-describedby={`${skill.id}-availability`}
                    data-skill={skill.id}
                    data-locked={availability?.locked ? 'true' : undefined}
                    className={styles.card}
                    onClick={() => navigate(`/skills/${skill.id}`)}
                  />
                  <div id={`${skill.id}-availability`} className={styles.availability}>
                    {availability && (
                      <StatusPill
                        label={availability.label}
                        tone={availability.tone}
                        glyph={availability.glyph}
                      />
                    )}
                    {availability?.locked && (
                      <span className={styles.after}>
                        after {joinWords(availability.after.map((id) => skillTitle(id)))}
                      </span>
                    )}
                    {evaluation?.state === 'NEEDS_REFRESH' && (
                      <span className={styles.after}>
                        was {MASTERY_LABELS[evaluation.refresh_from ?? 'INDEPENDENT']}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {detail && snapshot && (
        <SkillDetail
          skill={detail}
          snapshot={snapshot}
          campaign={campaign}
          focused={focus?.skill_id === detail.id}
          onClose={back}
        />
      )}
    </Stack>
  );
}
