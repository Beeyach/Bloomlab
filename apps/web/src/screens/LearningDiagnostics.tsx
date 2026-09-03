import { useState, type FormEvent } from 'react';

import {
  Button,
  Cluster,
  Field,
  MasteryBadge,
  Select,
  Stack,
  Surface,
} from '@bloomlab/design-system';
import {
  EVIDENCE_KINDS,
  HINT_LEVELS,
  SESSION_LENGTHS,
  type EvidenceKind,
  type EvidenceResult,
  type HintLevel,
  type SessionLength,
  type SessionPlan,
} from '@bloomlab/mastery-engine';

import { content } from '../content/bundle';
import {
  buildLearnerSession,
  currentVersions,
  recordEvidence,
  useCampaignProgress,
  useRecentEvidence,
  useReviewQueue,
  useSkillProgress,
} from '../data';
import styles from './LearningDiagnostics.module.css';
import shared from './SystemDiagnostics.module.css';

const skillTitle = (id: string) => content.skills.find((s) => s.id === id)?.title ?? id;
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '—');

const KIND_LABELS: Record<EvidenceKind, string> = {
  exposure: 'Instructional exposure (read a unit)',
  quiz: 'Quiz',
  guided_practice: 'Guided practice',
  deterministic_exercise: 'Deterministic exercise',
  independent_exercise: 'Independent exercise',
  pressure_test: 'Pressure test',
  explanation: 'Explanation',
  sales_use: 'Sales use',
  fieldwork: 'Fieldwork',
  real_ghl: 'Real-GHL evidence',
  retrieval: 'Retrieval challenge',
};

const modeFor = (kind: EvidenceKind) =>
  kind === 'guided_practice'
    ? 'guided'
    : kind === 'independent_exercise'
      ? 'independent'
      : kind === 'pressure_test'
        ? 'pressure'
        : kind === 'exposure' || kind === 'quiz'
          ? null
          : 'practice';

function SkillRows() {
  const rows = useSkillProgress();
  if (!rows) return <p className={shared.muted}>Loading…</p>;
  if (rows.length === 0) return <p className={shared.muted}>No evidence yet.</p>;
  return (
    <ul className={styles.rows}>
      {rows.map((row) => {
        const needed = Math.max(
          2,
          content.skills.find((s) => s.id === row.skill_id)?.mastery_requirements
            .independent_evidence ?? 2,
        );
        return (
          <li key={row.id} className={styles.row} data-testid={`skill-${row.skill_id}`}>
            <div className={styles.rowHead}>
              <MasteryBadge state={row.state} />
              <span>{row.skill_id}</span>
            </div>
            <p className={styles.rowMeta}>
              {skillTitle(row.skill_id)} · confidence {row.confidence} · independent{' '}
              {row.counts.independent_passes}/{needed} · pressure {row.counts.pressure_passes} ·
              fieldwork {row.counts.fieldwork_passes} · attempts {row.counts.attempts} · review{' '}
              {day(row.review_due)}
              {row.refresh_from ? ` · refresh from ${row.refresh_from}` : ''}
              {row.missing_requirements.length > 0
                ? ` · missing: ${row.missing_requirements.join(', ')}`
                : ''}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function CampaignRows() {
  const rows = useCampaignProgress();
  if (!rows) return <p className={shared.muted}>Loading…</p>;
  if (rows.length === 0) return <p className={shared.muted}>No campaign started.</p>;
  return (
    <ul className={styles.rows}>
      {rows.map((row) => (
        <li key={row.id} className={styles.row} data-testid={`campaign-${row.campaign_id}`}>
          <div>
            <div className={styles.rowHead}>{row.campaign_id}</div>
            <p className={styles.rowMeta}>
              current gate {row.current_gate ?? 'complete'} · passed {row.passed_gates.length}/
              {row.gates.filter((g) => g.status !== 'optional').length} · next{' '}
              {row.next_required.join(', ') || '—'} · work ahead {row.work_ahead.join(', ') || '—'}
            </p>
          </div>
          <ul className={styles.gates}>
            {row.gates.map((gate) => (
              <li key={gate.gate} data-status={gate.status}>
                {gate.gate} {gate.status}{' '}
                {gate.total > 0 ? `${gate.passed_count}/${gate.total}` : ''}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function ReviewRows() {
  const rows = useReviewQueue();
  const [busy, setBusy] = useState<string | null>(null);

  async function retrieval(skillId: string, result: EvidenceResult) {
    setBusy(skillId);
    try {
      await recordEvidence({
        skill_ids: [skillId],
        kind: 'retrieval',
        result,
        source: { type: 'retrieval', id: null },
        difficulty: 2,
      });
    } finally {
      setBusy(null);
    }
  }

  if (!rows) return <p className={shared.muted}>Loading…</p>;
  if (rows.length === 0) return <p className={shared.muted}>Nothing scheduled.</p>;
  return (
    <ul className={styles.rows}>
      {rows.map((row) => (
        <li key={row.id} className={styles.row} data-testid={`review-${row.skill_id}`}>
          <div>
            <div className={styles.rowHead}>
              <span>{row.skill_id}</span>
              <span>
                {row.status === 'due'
                  ? `due · ${row.reason} · priority ${row.priority}`
                  : `upcoming ${day(row.due_at)}`}
              </span>
            </div>
            <p className={styles.rowMeta}>
              {skillTitle(row.skill_id)} · last demonstrated {day(row.last_demonstrated)} · state{' '}
              {row.state}
            </p>
          </div>
          {row.status === 'due' && (
            <Cluster gap={2}>
              <Button
                size="sm"
                variant="primary"
                loading={busy === row.skill_id}
                onClick={() => void retrieval(row.skill_id, 'passed')}
              >
                Passed retrieval
              </Button>
              <Button
                size="sm"
                loading={busy === row.skill_id}
                onClick={() => void retrieval(row.skill_id, 'failed')}
              >
                Failed retrieval
              </Button>
            </Cluster>
          )}
        </li>
      ))}
    </ul>
  );
}

function EvidenceForm() {
  const [skill, setSkill] = useState(content.skills[0]?.id ?? '');
  const [exerciseId, setExerciseId] = useState('');
  const [kind, setKind] = useState<EvidenceKind>('independent_exercise');
  const [result, setResult] = useState<EvidenceResult>('passed');
  const [difficulty, setDifficulty] = useState(3);
  const [hints, setHints] = useState<HintLevel[]>([]);
  const [realGhl, setRealGhl] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const exercises = content.exercises.filter((e) => e.skills.includes(skill));
  const exercise = exercises.find((e) => e.id === exerciseId) ?? null;
  const fieldworkKind = kind === 'fieldwork' || kind === 'real_ghl';

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const exposure = kind === 'exposure' || kind === 'quiz';
      const { evidence } = await recordEvidence({
        skill_ids: [skill],
        kind,
        result: exposure ? 'exposed' : result,
        source: exercise
          ? { type: 'exercise', id: exercise.id }
          : {
              type: exposure ? 'learning_unit' : kind === 'retrieval' ? 'retrieval' : 'manual',
              id: null,
            },
        exercise_id: exercise?.id ?? null,
        exercise_type: exercise?.type ?? null,
        mode: exercise?.mode ?? modeFor(kind),
        hints_used: hints,
        difficulty: exercise?.difficulty ?? difficulty,
        real_ghl: fieldworkKind
          ? { required: true, provided: realGhl, evidence: realGhl ? ['screenshot'] : [] }
          : null,
      });
      setMessage(
        `Recorded ${evidence.length} evidence row(s) for ${skill} (${evidence[0]?.assistance}).`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not record evidence');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <Field label="Skill">
        <Select
          data-testid="evidence-skill"
          value={skill}
          onChange={(event) => {
            setSkill(event.target.value);
            setExerciseId('');
          }}
        >
          {content.skills.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Exercise (optional)" hint="Sets the mode and difficulty from content">
        <Select
          data-testid="evidence-exercise"
          value={exerciseId}
          onChange={(event) => setExerciseId(event.target.value)}
        >
          <option value="">— none —</option>
          {exercises.map((e) => (
            <option key={e.id} value={e.id}>
              {e.id} ({e.mode})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Evidence kind">
        <Select
          data-testid="evidence-kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as EvidenceKind)}
        >
          {EVIDENCE_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Result">
        <Select
          data-testid="evidence-result"
          value={result}
          onChange={(event) => setResult(event.target.value as EvidenceResult)}
        >
          <option value="passed">passed</option>
          <option value="failed">failed</option>
          <option value="partial">partial</option>
        </Select>
      </Field>
      <Field label="Difficulty">
        <Select
          data-testid="evidence-difficulty"
          value={difficulty}
          onChange={(event) => setDifficulty(Number(event.target.value))}
          disabled={Boolean(exercise)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </Field>
      <div className={styles.formWide}>
        <div className={styles.hints}>
          {HINT_LEVELS.map((hint) => (
            <label key={hint}>
              <input
                type="checkbox"
                data-testid={`hint-${hint}`}
                checked={hints.includes(hint)}
                onChange={(event) =>
                  setHints(
                    event.target.checked ? [...hints, hint] : hints.filter((h) => h !== hint),
                  )
                }
              />
              {hint.replace('_', ' ')}
            </label>
          ))}
          {fieldworkKind && (
            <label>
              <input
                type="checkbox"
                data-testid="real-ghl-provided"
                checked={realGhl}
                onChange={(event) => setRealGhl(event.target.checked)}
              />
              real-GHL evidence provided
            </label>
          )}
        </div>
      </div>
      <Cluster gap={2} className={styles.formWide}>
        <Button type="submit" size="sm" variant="primary" loading={busy}>
          Record evidence
        </Button>
        {message && (
          <span className={shared.muted} role="status" data-testid="evidence-message">
            {message}
          </span>
        )}
      </Cluster>
    </form>
  );
}

function SessionBuilder() {
  const [length, setLength] = useState<SessionLength>('30m');
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [busy, setBusy] = useState(false);

  async function build(exclude: string[] = []) {
    setBusy(true);
    try {
      setPlan(await buildLearnerSession(length, undefined, { exclude }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack gap={2}>
      <Cluster gap={2}>
        <Field label="Session length">
          <Select
            data-testid="session-length"
            value={length}
            onChange={(event) => setLength(event.target.value as SessionLength)}
          >
            {SESSION_LENGTHS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
        <Button size="sm" variant="primary" loading={busy} onClick={() => void build()}>
          Build my session
        </Button>
        {plan && (
          <Button
            size="sm"
            loading={busy}
            onClick={() => void build(plan.blocks.flatMap((b) => b.items.map((i) => i.id)))}
          >
            Continue
          </Button>
        )}
      </Cluster>
      {plan && (
        <div data-testid="session-plan">
          <p className={shared.muted}>
            {plan.length} · {plan.planned_minutes} of {plan.budget_minutes} min · assistance
            dependence {plan.assistance_dependence} · rules {plan.rules_version}
          </p>
          {plan.blocks.length === 0 && <p className={shared.muted}>Nothing to plan.</p>}
          <ul className={styles.plan}>
            {plan.blocks.map((block) => (
              <li key={block.kind} className={styles.block}>
                <h4>{block.title}</h4>
                <ol>
                  {block.items.map((item) => (
                    <li key={item.id}>
                      {item.kind} {item.content_id} · {item.skill_id} · {item.minutes} min ·{' '}
                      {item.reason}
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
          <ul className={styles.notes}>
            {plan.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </Stack>
  );
}

function RecentEvidence() {
  const rows = useRecentEvidence(6);
  if (!rows || rows.length === 0) return null;
  return (
    <ul className={styles.rows} data-testid="recent-evidence">
      {rows.map((row) => (
        <li key={row.id} className={styles.row}>
          <div className={styles.rowHead}>
            {row.skill_id} · {row.kind} · {row.result} · {row.assistance}
          </div>
          <p className={styles.rowMeta}>
            {day(row.occurred_at)} · {row.exercise_id ?? 'no exercise'} · app {row.versions.app} ·
            content {row.versions.content} ({row.versions.content_hash.slice(0, 8)}) · simulator{' '}
            {row.versions.simulator} · rules {row.versions.rules} · device{' '}
            {row.device_id.slice(0, 8)}
          </p>
        </li>
      ))}
    </ul>
  );
}

/**
 * Developer view of the learning engine (Phase 6): the derived skill, campaign and review rows
 * as stored in IndexedDB, a way to record representative evidence and retrievals, and the
 * deterministic session builder. Diagnostic only — the learner-facing screens are Phase 7+.
 */
export function LearningDiagnostics() {
  const versions = currentVersions();
  return (
    <>
      <Surface as="dl" padding="sm" className={shared.list}>
        <dt>Evidence stamp</dt>
        <dd>
          app {versions.app} · content {versions.content} ({versions.content_hash.slice(0, 8)}) ·
          simulator {versions.simulator} · rules {versions.rules}
        </dd>
      </Surface>

      <Surface padding="sm">
        <p className={shared.muted}>Skills with evidence</p>
        <SkillRows />
      </Surface>

      <Surface padding="sm">
        <p className={shared.muted}>Campaign gates</p>
        <CampaignRows />
      </Surface>

      <Surface padding="sm">
        <p className={shared.muted}>Review queue</p>
        <ReviewRows />
      </Surface>

      <Surface padding="sm">
        <p className={shared.muted}>Record evidence</p>
        <EvidenceForm />
        <RecentEvidence />
      </Surface>

      <Surface padding="sm">
        <p className={shared.muted}>Build my session</p>
        <SessionBuilder />
      </Surface>
    </>
  );
}
