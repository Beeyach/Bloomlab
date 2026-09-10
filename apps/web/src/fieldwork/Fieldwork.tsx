import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { Button } from '@bloomlab/design-system';
import { reasoningItems, type Exercise } from '@bloomlab/content-schema';
import type { FieldworkResponse } from '@bloomlab/shared';
import { db } from '../data/db';
import { editFieldwork, type ActiveAttempt, type AttemptContext } from '../exercise/attempt';
import { Markdown } from '../exercise/markdown';
import { checkpointProof } from './checkpoint';
import { completionMissing, contractFor, emptyFieldwork, proofMissing } from './proof';
import {
  deleteEvidence,
  evidenceFetch,
  localEvidence,
  localEvidenceForAttempt,
  readEvidence,
  selectEvidence,
  uploadEvidence,
} from './assets';
import styles from './fieldwork.module.css';

function Screenshot({
  id,
  prompt,
  locked,
  onRemove,
  onBusy,
}: {
  id: string;
  prompt: string;
  locked: boolean;
  onRemove: () => Promise<unknown>;
  onBusy: (busy: boolean) => void;
}) {
  const local = useLiveQuery(() => localEvidence(id), [id]);
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('Checking screenshot…');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    const load = async () => {
      if (local?.status === 'deleted') {
        setStatus('Deleted');
        setUrl('');
        return;
      }
      if (local?.status === 'deleting') {
        setStatus('Deletion pending — retry delete');
        setUrl('');
        return;
      }
      if (local?.blob) {
        objectUrl = URL.createObjectURL(local.blob);
        if (active) setUrl(objectUrl);
      }
      if (local?.status === 'local') {
        setStatus('Saved on this device · ready to upload');
        return;
      }
      try {
        const remote = await readEvidence(id);
        if (!active) return;
        setStatus(
          remote.status === 'ready'
            ? 'Private screenshot saved'
            : remote.status === 'deleted'
              ? 'Deleted'
              : 'Screenshot unavailable',
        );
        if (remote.status !== 'ready') {
          setUrl('');
          return;
        }
        if (!local?.blob) {
          const image = await evidenceFetch(id, {}, true);
          objectUrl = URL.createObjectURL(await image.blob());
          if (active) setUrl(objectUrl);
        }
      } catch {
        if (active) setStatus('Remote status unavailable · retry when connected');
      }
    };
    void load();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, local]);
  async function act(work: () => Promise<unknown>) {
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Screenshot could not be saved. Retry.');
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <div className={styles.asset}>
      {url && <img src={url} alt={`Your proof: ${prompt}`} />}
      <p role="status">{busy ? 'Saving screenshot…' : status}</p>
      {local?.status === 'local' && (
        <Button disabled={locked || busy} onClick={() => void act(() => uploadEvidence(id))}>
          Upload saved screenshot
        </Button>
      )}
      <Button
        disabled={locked || busy}
        onClick={() =>
          void act(async () => {
            await deleteEvidence(id);
            await onRemove();
          })
        }
      >
        {local?.status === 'deleting' ? 'Retry delete' : 'Delete screenshot'}
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function Fieldwork({
  exercise,
  attempt,
  context,
  saved,
  submitting,
  submissionError,
  onSubmit,
  children,
}: {
  exercise: Exercise;
  attempt: ActiveAttempt | null;
  context: AttemptContext;
  saved?: FieldworkResponse;
  submitting: boolean;
  submissionError: string | null;
  onSubmit: () => void;
  children?: React.ReactNode;
}) {
  const [draft, setDraft] = useState(
    (attempt ? attempt.response.fieldwork : saved) ?? emptyFieldwork(exercise),
  );
  const current = useRef(draft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const config = exercise.fieldwork?.proof;
  const completed = !attempt && Boolean(saved);
  const locked = busy || submitting || completed || Boolean(attempt?.submitted);
  const localAssets = useLiveQuery(
    () => (attempt ? localEvidenceForAttempt(attempt.attempt_id) : []),
    [attempt?.attempt_id],
  );
  const change = (mutate: (value: FieldworkResponse) => FieldworkResponse) => {
    const next = mutate(current.current);
    current.current = next;
    setDraft(next);
    setSaving((n) => n + 1);
    setError('');
    return editFieldwork(exercise, context, mutate)
      .catch(() => {
        setError(
          'This edit could not be saved on this device. Keep this page open and edit the answer again before continuing.',
        );
        throw new Error('Local save failed.');
      })
      .finally(() => setSaving((n) => n - 1));
  };
  const patchProof = (mutate: (value: FieldworkResponse) => FieldworkResponse) =>
    change((value) => ({ ...mutate(value), checkpoint: null, confirmed: false }));
  const updateText = (
    group: 'configuration' | 'explanations' | 'reasoning',
    key: string,
    value: string,
  ) => {
    const mutate = (p: FieldworkResponse) => ({ ...p, [group]: { ...p[group], [key]: value } });
    void (group === 'reasoning' ? change(mutate) : patchProof(mutate)).catch(() => undefined);
  };
  async function action(work: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your work could not be saved. Retry.');
    } finally {
      setBusy(false);
    }
  }
  async function checkpoint() {
    if (!attempt) return;
    await change(() => current.current);
    const savedAttempt = await checkpointProof(exercise, context, attempt.attempt_id);
    if (savedAttempt?.response.fieldwork) {
      current.current = savedAttempt.response.fieldwork;
      setDraft(current.current);
    }
    requestAnimationFrame(() => heading.current?.focus());
  }
  const missing =
    draft.phase === 'reasoning'
      ? completionMissing(exercise, draft)
      : proofMissing(exercise, draft);
  if (!config) return <p>This saved fieldwork definition needs an updated proof contract.</p>;
  const textFields = (group: 'configuration' | 'explanations' | 'reasoning') =>
    (group === 'reasoning' ? reasoningItems(exercise.fieldwork!) : config[group]).map((item) => (
      <label className={styles.field} key={item.key}>
        <span>
          {item.prompt}
          {!item.required && ' (optional)'}
        </span>
        <textarea
          data-proof={`${group}.${item.key}`}
          rows={group === 'configuration' ? 2 : 4}
          maxLength={4000}
          value={draft[group][item.key] ?? ''}
          disabled={locked}
          onChange={(e) => updateText(group, item.key, e.target.value)}
        />
      </label>
    ));
  return (
    <section className={styles.work} aria-label="Fieldwork">
      <ol className={styles.steps} aria-label="Fieldwork stages">
        {['Build in GHL', 'Capture proof', 'Reasoning', 'Complete'].map((label, i) => (
          <li
            key={label}
            aria-current={
              (completed ? 3 : ['build', 'proof', 'reasoning'].indexOf(draft.phase)) === i
                ? 'step'
                : undefined
            }
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>
      <p>
        Work manually in your GHL training/subaccount. Bloomlab records your proof; it does not
        inspect GHL or verify your reasoning automatically. AI is not needed.
      </p>
      <p className={styles.note}>
        Use fictional records. Crop or redact customer details from screenshots where possible. Do
        not include passwords, tokens, session cookies or account URLs in your proof. Screenshots
        stay private to your Bloomlab learner.
      </p>
      {!completed && (
        <p role="status">
          {saving
            ? 'Saving on this device…'
            : error
              ? 'Save needs attention'
              : 'Draft saved on this device'}
        </p>
      )}
      {draft.contract !== contractFor(exercise) && !completed && (
        <Button
          onClick={() =>
            void action(() =>
              change((p) => ({
                ...p,
                contract: contractFor(exercise),
                phase: 'build',
                checkpoint: null,
                confirmed: false,
              })),
            )
          }
        >
          Review updated task with saved answers
        </Button>
      )}
      {draft.phase === 'build' && !completed && (
        <>
          <h2 ref={heading} tabIndex={-1}>
            Build in GHL
          </h2>
          <ol className={styles.tasks}>
            {exercise.fieldwork!.tasks.map((task) => (
              <li key={task}>
                <Markdown text={task} />
              </li>
            ))}
          </ol>
          <h3>What to test</h3>
          <ul>
            {config.tests.map((test) => (
              <li key={test.key}>{test.prompt}</li>
            ))}
          </ul>
          <Button
            variant="primary"
            disabled={locked || saving > 0}
            onClick={() => void action(() => change((p) => ({ ...p, phase: 'proof' })))}
          >
            Capture proof
          </Button>
        </>
      )}
      {(draft.phase === 'proof' || completed) && (
        <>
          <h2 ref={heading} tabIndex={-1}>
            {completed ? 'Submitted proof' : 'Capture proof'}
          </h2>
          {config.screenshots.map((item) => {
            const id = draft.screenshots[item.key];
            const recovery = localAssets?.find(
              (a) =>
                a.item_key === item.key &&
                !Object.values(draft.screenshots).includes(a.asset_id) &&
                a.status !== 'deleted',
            );
            return (
              <div key={item.key} className={styles.screenshot}>
                <h3>
                  {item.prompt}
                  {!item.required && ' (optional)'}
                </h3>
                {id ? (
                  <Screenshot
                    id={id}
                    prompt={item.prompt}
                    locked={busy || submitting}
                    onBusy={setBusy}
                    onRemove={async () => {
                      if (!completed)
                        await patchProof((p) => ({
                          ...p,
                          screenshots: Object.fromEntries(
                            Object.entries(p.screenshots).filter(([key]) => key !== item.key),
                          ),
                        }));
                    }}
                  />
                ) : completed ? (
                  <p>No screenshot supplied.</p>
                ) : (
                  <label className={styles.field}>
                    <span>Choose screenshot</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={locked}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file && attempt)
                          void action(async () => {
                            const id = crypto.randomUUID();
                            await selectEvidence(file, {
                              asset_id: id,
                              attempt_id: attempt.attempt_id,
                              exercise_id: exercise.id,
                              item_key: item.key,
                            });
                            await patchProof((p) => ({
                              ...p,
                              screenshots: { ...p.screenshots, [item.key]: id },
                            }));
                          });
                      }}
                    />
                  </label>
                )}
                {!id && recovery && !completed && (
                  <Button
                    onClick={() =>
                      void action(() =>
                        patchProof((p) => ({
                          ...p,
                          screenshots: { ...p.screenshots, [item.key]: recovery.asset_id },
                        })),
                      )
                    }
                  >
                    Recover saved screenshot
                  </Button>
                )}
                {!completed && id && (
                  <p>To replace this screenshot, delete it, then choose another.</p>
                )}
              </div>
            );
          })}
          <h3>Configuration</h3>
          {textFields('configuration')}
          <h3>Explanation</h3>
          {textFields('explanations')}
          <h3>Test results</h3>
          <p>
            Record what you actually observed. Fix and rerun a failed required test before
            continuing.
          </p>
          {config.tests.map((item) => (
            <fieldset key={item.key} disabled={locked} className={styles.test}>
              <legend>
                {item.prompt}
                {!item.required && ' (optional)'}
              </legend>
              <label className={styles.field}>
                <span>Observed result</span>
                <textarea
                  data-proof={`test.${item.key}`}
                  maxLength={4000}
                  rows={3}
                  value={draft.tests[item.key]?.observed ?? ''}
                  onChange={(e) =>
                    void patchProof((p) => ({
                      ...p,
                      tests: {
                        ...p.tests,
                        [item.key]: {
                          status: p.tests[item.key]?.status ?? 'unrecorded',
                          observed: e.target.value,
                        },
                      },
                    })).catch(() => undefined)
                  }
                />
              </label>
              <label className={styles.field}>
                <span>Test status</span>
                <select
                  data-test={item.key}
                  value={draft.tests[item.key]?.status ?? 'unrecorded'}
                  onChange={(e) => {
                    const status = e.target.value as 'unrecorded' | 'passed' | 'failed';
                    void patchProof((p) => ({
                      ...p,
                      tests: {
                        ...p.tests,
                        [item.key]: { observed: p.tests[item.key]?.observed ?? '', status },
                      },
                    })).catch(() => undefined);
                  }}
                >
                  <option value="unrecorded">Not recorded</option>
                  <option value="passed">Passed — observed expected result</option>
                  <option value="failed">Failed — needs fixing</option>
                </select>
              </label>
            </fieldset>
          ))}
          {!completed && (
            <div className={styles.actions}>
              <Button
                disabled={locked}
                onClick={() => void action(() => change((p) => ({ ...p, phase: 'build' })))}
              >
                Review task
              </Button>
              <Button
                variant="primary"
                disabled={locked || saving > 0 || Boolean(error)}
                onClick={() => void action(checkpoint)}
              >
                Save proof checkpoint
              </Button>
            </div>
          )}
        </>
      )}
      {(draft.phase === 'reasoning' || completed) && (
        <>
          <h2 ref={heading} tabIndex={-1}>
            Reasoning
          </h2>
          <p>Your practical proof has been checkpointed. Explain the decisions behind it.</p>
          {textFields('reasoning')}
          {!completed && (
            <>
              <label className={styles.confirm}>
                <input
                  type="checkbox"
                  checked={draft.confirmed}
                  disabled={locked}
                  onChange={(e) =>
                    void change((p) => ({ ...p, confirmed: e.target.checked })).catch(
                      () => undefined,
                    )
                  }
                />
                <span>
                  I performed this work and these tests in my real GHL training/subaccount.
                </span>
              </label>
              <div className={styles.actions}>
                <Button
                  disabled={locked}
                  onClick={() => void action(() => change((p) => ({ ...p, phase: 'proof' })))}
                >
                  Review proof
                </Button>
                <Button
                  variant="primary"
                  loading={submitting}
                  disabled={locked || saving > 0 || missing.length > 0 || Boolean(error)}
                  onClick={onSubmit}
                >
                  Complete fieldwork
                </Button>
              </div>
            </>
          )}
        </>
      )}
      {!completed && draft.phase !== 'build' && missing.length > 0 && (
        <details className={styles.remaining} open>
          <summary>Still needed ({missing.length})</summary>
          <ul>
            {missing.map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
        </details>
      )}
      {error && <p role="alert">{error}</p>}
      {submissionError && <p role="alert">{submissionError}</p>}
      {completed && (
        <>
          <p>
            Manual proof submitted. The result records the evidence present at submission; deleted
            screenshots remain marked as deleted. Reasoning is saved for review, without a semantic
            correctness score.
          </p>
          {children}
          <Link to={`/skills/${exercise.skills[0]}`}>View capability evidence</Link>
        </>
      )}
    </section>
  );
}
