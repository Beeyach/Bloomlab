import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import {
  Button,
  Cluster,
  HoloMaterial,
  IconArrowRight,
  IconRefresh,
  MasteryBadge,
  Stack,
  StatusPill,
  Surface,
  type StatusGlyph,
  type StatusTone,
} from '@bloomlab/design-system';
import {
  SESSION_RULES,
  effectiveAssistance,
  isFailure,
  isPass,
  nextStepForSkill,
  type CampaignEvaluation,
  type ReviewItem,
  type SessionLength,
  type SessionPlan,
  type SkillEvidence,
} from '@bloomlab/mastery-engine';

import { content } from '../content/bundle';
import {
  buildLearnerSession,
  clearFocus,
  defaultCampaignId,
  sessionContentOf,
  useFocus,
  useLearnerSnapshot,
  type LearnerSnapshot,
} from '../data/learning';
import styles from './CommandCenter.module.css';
import {
  KIND_WORDS,
  SESSION_LENGTH_LABELS,
  describeStep,
  evidenceWord,
  isDemonstrated,
  plural,
  relativeDay,
  skillTitle,
  stateSentence,
} from './learningCopy';

const SESSION_LENGTHS: SessionLength[] = ['30m', '1h', '2h', 'deep'];
const RECENT_LIMIT = 5;
const LIST_LIMIT = 4;

const REVIEW_PILL: Record<
  ReviewItem['reason'],
  { label: string; tone: StatusTone; glyph: StatusGlyph }
> = {
  overdue: { label: 'Overdue', tone: 'warning', glyph: 'clock' },
  due: { label: 'Due', tone: 'info', glyph: 'clock' },
  needs_refresh: { label: 'Needs refresh', tone: 'warning', glyph: 'ring' },
};

const byNewest = (a: SkillEvidence, b: SkillEvidence) =>
  b.occurred_at.localeCompare(a.occurred_at) || b.id.localeCompare(a.id);

/** The capability the learner should continue with: their focus while it is unfinished, else the campaign's next required skill, else work ahead. */
function continueSkillId(
  snapshot: LearnerSnapshot,
  campaign: CampaignEvaluation | null,
  focusId: string | undefined,
): string | null {
  if (focusId && snapshot.evaluations.get(focusId)?.state !== 'MASTERED') return focusId;
  return campaign?.next_required[0] ?? campaign?.work_ahead[0] ?? null;
}

/** Recent attempts that failed, or passed only with help on a capability not yet independent. */
function needsAnotherRun(snapshot: LearnerSnapshot): { evidence: SkillEvidence; word: string }[] {
  const since = snapshot.now.getTime() - SESSION_RULES.recent_window_days * 86_400_000;
  const seen = new Set<string>();
  const rows: { evidence: SkillEvidence; word: string }[] = [];
  for (const evidence of [...snapshot.evidence].sort(byNewest)) {
    if (Date.parse(evidence.occurred_at) < since || seen.has(evidence.skill_id)) continue;
    const assisted =
      isPass(evidence) &&
      (effectiveAssistance(evidence) === 'guided' || effectiveAssistance(evidence) === 'heavy') &&
      !isDemonstrated(snapshot.evaluations.get(evidence.skill_id));
    if (!isFailure(evidence) && !assisted) continue;
    seen.add(evidence.skill_id);
    rows.push({ evidence, word: isFailure(evidence) ? 'Needs another run' : 'Passed with help' });
  }
  return rows.slice(0, LIST_LIMIT);
}

function ContinueObject({
  snapshot,
  campaign,
  skillId,
  focused,
}: {
  snapshot: LearnerSnapshot;
  campaign: CampaignEvaluation | null;
  skillId: string;
  focused: boolean;
}) {
  const navigate = useNavigate();
  const skill = content.skills.find((s) => s.id === skillId);
  const evaluation = snapshot.evaluations.get(skillId);
  const sessionContent = useMemo(() => sessionContentOf(content), []);
  if (!skill || !evaluation) return null;
  const step = nextStepForSkill({
    skill,
    evaluation,
    content: sessionContent,
    recent_evidence: snapshot.evidence,
  });
  const described = step ? describeStep(step) : null;
  const campaignContent = content.campaigns.find((c) => c.id === campaign?.campaign_id);
  const gate = campaign?.gates.find((g) => g.gate === campaign.current_gate) ?? null;
  const inGate = gate?.skills.some((s) => s.skill_id === skillId) ?? false;
  const demonstrated = [...snapshot.evaluations.values()].filter(isDemonstrated).length;

  return (
    <section aria-labelledby="continue-title" className={styles.continue}>
      <HoloMaterial variant="collectible" radius="xl" className={styles.object}>
        <div className={styles.objectBody}>
          <p className={styles.eyebrow}>
            {campaignContent ? `${campaignContent.title} campaign` : 'Next capability'}
            {gate && ` · Gate ${gate.number} · ${gate.name}`}
            {focused && ' · Your focus'}
            {!focused && !inGate && campaign?.work_ahead.includes(skillId) && ' · Work ahead'}
          </p>
          <h2 id="continue-title" className={styles.objectTitle}>
            {skill.title}
          </h2>
          <p className={styles.state}>
            <MasteryBadge state={evaluation.state} />
            <span>{stateSentence(evaluation)}</span>
          </p>
          {described && step && (
            <p className={styles.step}>
              <span className={styles.stepVerb}>Next · {described.verb}</span>
              <span className={styles.stepTitle}>{described.title}</span>
              <span className={styles.stepMeta}>
                {step.minutes} min{described.detail ? ` · ${described.detail}` : ''}
              </span>
            </p>
          )}
          {step ? (
            <p className={styles.reason}>{step.reason}</p>
          ) : (
            <p className={styles.reason}>
              No suitable next exercise is authored for this capability yet.
            </p>
          )}
          <p className={styles.progress}>
            {gate &&
              `Gate ${gate.number}: ${gate.passed_count} of ${gate.total} capabilities demonstrated · `}
            {plural(demonstrated, 'capability', 'capabilities')} demonstrated across the map
          </p>
          <div className={styles.objectActions}>
            <Button
              variant="primary"
              iconEnd={<IconArrowRight size={16} />}
              onClick={() => navigate(`/skills/${skillId}`)}
            >
              Continue
            </Button>
            {focused && (
              <Button variant="ghost" onClick={() => void clearFocus()}>
                Clear focus
              </Button>
            )}
          </div>
        </div>
      </HoloMaterial>
    </section>
  );
}

function SessionBuilder({ focusId }: { focusId: string | undefined }) {
  const [length, setLength] = useState<SessionLength>('1h');
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [exclude, setExclude] = useState<string[]>([]);
  const [building, setBuilding] = useState(false);
  const [failed, setFailed] = useState(false);

  async function build(excluding: string[]) {
    setBuilding(true);
    setFailed(false);
    try {
      const next = await buildLearnerSession(length, undefined, {
        focus: focusId ? { skill_id: focusId } : null,
        exclude: excluding,
      });
      setExclude(excluding);
      setPlan(next);
    } catch {
      setFailed(true);
    } finally {
      setBuilding(false);
    }
  }

  const planned = plan?.blocks.flatMap((block) => block.items.map((item) => item.id)) ?? [];

  return (
    <section aria-labelledby="session-title" className={styles.section}>
      <h2 id="session-title" className={styles.heading}>
        Build my session
      </h2>
      <fieldset className={styles.lengths}>
        <legend className={styles.legend}>How long do you have?</legend>
        {SESSION_LENGTHS.map((option) => (
          <label key={option} className={styles.length}>
            <input
              type="radio"
              name="session-length"
              value={option}
              checked={length === option}
              onChange={() => setLength(option)}
            />
            <span>{SESSION_LENGTH_LABELS[option]}</span>
          </label>
        ))}
      </fieldset>
      <Cluster gap={2}>
        <Button
          variant={plan ? 'secondary' : 'primary'}
          loading={building}
          onClick={() => void build([])}
        >
          {plan ? 'Build again' : 'Build my session'}
        </Button>
        {plan && planned.length > 0 && (
          <Button
            variant="primary"
            loading={building}
            iconEnd={<IconArrowRight size={16} />}
            onClick={() => void build([...exclude, ...planned])}
          >
            Continue
          </Button>
        )}
      </Cluster>
      {failed && (
        <p className={styles.problem} role="alert">
          The session could not be built from your progress. Try again.
        </p>
      )}
      {plan && (
        <div className={styles.plan} data-testid="session-plan">
          <p className={styles.planMeta}>
            {plan.planned_minutes} of {plan.budget_minutes} min planned
            {plan.assistance_dependence >= SESSION_RULES.assistance_dependence_threshold &&
              ' · recent passes leaned on help, so this plan repeats them with fewer hints'}
          </p>
          {planned.length === 0 && (
            <p className={styles.muted}>
              Nothing left to plan: every capability within reach is demonstrated and nothing is
              due. Come back after new evidence.
            </p>
          )}
          <ol className={styles.blocks}>
            {plan.blocks.map((block) => (
              <li key={block.kind}>
                <h3 className={styles.blockTitle}>{block.title}</h3>
                <ul className={styles.items}>
                  {block.items.map((item) => {
                    const described = describeStep(item);
                    return (
                      <li key={item.id} className={styles.item}>
                        <Link to={`/skills/${item.skill_id}`} className={styles.itemLink}>
                          <span className={styles.itemVerb}>{described.verb}</span>
                          <span className={styles.itemTitle}>{described.title}</span>
                        </Link>
                        <span className={styles.itemMeta}>
                          {item.minutes} min · {skillTitle(item.skill_id)}
                        </span>
                        <span className={styles.itemReason}>{item.reason}</span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function DueRetrieval({ snapshot }: { snapshot: LearnerSnapshot }) {
  const { due, upcoming } = snapshot.review;
  return (
    <section aria-labelledby="review-title" className={styles.section}>
      <h2 id="review-title" className={styles.heading}>
        Due for retrieval
      </h2>
      {due.length === 0 ? (
        <p className={styles.muted}>
          Nothing due. Demonstrated capabilities come back here as short challenges before they fade
          {upcoming[0] ? `; the next is ${relativeDay(upcoming[0].due_at, snapshot.now)}` : ''}.
        </p>
      ) : (
        <ul className={styles.rows}>
          {due.slice(0, LIST_LIMIT).map((item) => (
            <li key={item.skill_id} className={styles.row}>
              <Link to={`/skills/${item.skill_id}`} className={styles.rowLink}>
                {skillTitle(item.skill_id)}
              </Link>
              <StatusPill {...REVIEW_PILL[item.reason]} />
              <span className={styles.rowMeta}>
                {item.last_demonstrated
                  ? `last demonstrated ${relativeDay(item.last_demonstrated, snapshot.now)}`
                  : 'not yet demonstrated'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SkillRows({
  title,
  id,
  intro,
  rows,
}: {
  title: string;
  id: string;
  intro?: string;
  rows: { skill_id: string; word: string; meta?: string }[];
}) {
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby={id} className={styles.section}>
      <h2 id={id} className={styles.heading}>
        {title}
      </h2>
      {intro && <p className={styles.muted}>{intro}</p>}
      <ul className={styles.rows}>
        {rows.map((row) => (
          <li key={`${row.skill_id}:${row.word}`} className={styles.row}>
            <Link to={`/skills/${row.skill_id}`} className={styles.rowLink}>
              {skillTitle(row.skill_id)}
            </Link>
            <span className={styles.rowWord}>{row.word}</span>
            {row.meta && <span className={styles.rowMeta}>{row.meta}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Command Center (spec §74, DES-010, PRD-012): the answer to "what should I do next?" from the
 * learner's real evidence. Nothing here is a placeholder: sections with nothing to say are absent.
 */
export default function CommandCenter() {
  const snapshot = useLearnerSnapshot();
  const focus = useFocus();

  if (!snapshot) {
    return (
      <Stack as="section" gap={4} className={styles.screen} aria-labelledby="home-title">
        <h1 id="home-title" className={styles.title}>
          What should I do next?
        </h1>
        <p className={styles.muted} role="status">
          Reading your progress…
        </p>
      </Stack>
    );
  }

  const campaignId = defaultCampaignId(content);
  const campaign = snapshot.campaigns.find((c) => c.campaign_id === campaignId) ?? null;
  const focusId = focus?.skill_id;
  const continueId = continueSkillId(snapshot, campaign, focusId);
  const gateOf = (skillId: string) =>
    campaign?.gates.find((g) => g.skills.some((s) => s.skill_id === skillId)) ?? null;
  const recent = [...snapshot.evidence].sort(byNewest).slice(0, RECENT_LIMIT);

  return (
    <Stack as="section" gap={8} className={styles.screen} aria-labelledby="home-title">
      <h1 id="home-title" className={styles.title}>
        What should I do next?
      </h1>

      {continueId ? (
        <ContinueObject
          snapshot={snapshot}
          campaign={campaign}
          skillId={continueId}
          focused={focusId === continueId}
        />
      ) : (
        <Surface padding="md" className={styles.complete}>
          <p>
            Every gate in this campaign is passed. Retrieval keeps the capabilities current; the
            next campaign opens on the <Link to="/campaign">Campaign</Link> screen.
          </p>
        </Surface>
      )}

      <div className={styles.columns}>
        <SessionBuilder focusId={focusId} />
        <div className={styles.side}>
          <DueRetrieval snapshot={snapshot} />
          <SkillRows
            id="repair-title"
            title="Needs another run"
            rows={needsAnotherRun(snapshot).map(({ evidence, word }) => ({
              skill_id: evidence.skill_id,
              word,
              meta: relativeDay(evidence.occurred_at, snapshot.now),
            }))}
          />
          <SkillRows
            id="ahead-title"
            title="Work ahead"
            intro="Prerequisites met. Nothing here waits for a date."
            rows={(campaign?.work_ahead ?? []).slice(0, LIST_LIMIT).map((skillId) => {
              const gate = gateOf(skillId);
              return {
                skill_id: skillId,
                word: gate ? `Gate ${gate.number} · ${gate.name}` : 'Available',
              };
            })}
          />
        </div>
      </div>

      {recent.length > 0 && (
        <section aria-labelledby="recent-title" className={styles.section}>
          <h2 id="recent-title" className={styles.heading}>
            Recent evidence
          </h2>
          <ul className={styles.rows}>
            {recent.map((evidence) => (
              <li key={evidence.id} className={styles.row}>
                <span className={styles.rowWord}>{evidenceWord(evidence)}</span>
                <Link to={`/skills/${evidence.skill_id}`} className={styles.rowLink}>
                  {skillTitle(evidence.skill_id)}
                </Link>
                <span className={styles.rowMeta}>
                  {KIND_WORDS[evidence.kind]} · {relativeDay(evidence.occurred_at, snapshot.now)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className={styles.footnote}>
        <IconRefresh size={14} aria-hidden="true" /> Everything above is read from your evidence on
        this device and updates as you work. Nothing is locked to a date.
      </p>
    </Stack>
  );
}
