import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router';
import { Button } from '@bloomlab/design-system';
import { RELATIONSHIP_STAGES, type ClientProgressRecord } from '@bloomlab/content-schema';
import { content } from '../content/bundle';
import { db } from '../data/db';
import { Markdown } from '../exercise/markdown';
import { clientProgressId, ensureClients, saveClientNote, selectProjectAttempt } from './store';
import { projectProgress } from './progression';
import styles from './clients.module.css';

function Relationship({ record }: { record: ClientProgressRecord }) {
  const [text, setText] = useState('');
  const [relationship, setRelationship] = useState(record.relationship);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await saveClientNote(record.client_id, text, relationship);
      setText('');
      setStatus('Relationship note saved on this device.');
    } catch {
      setStatus('Could not save. Your note is still here; retry.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.section}>
      <h2>Your training relationship</h2>
      <p>
        Record decisions and what to verify next. These notes describe your fictional engagement;
        they are not evidence of real client outcomes.
      </p>
      <label>
        Relationship stage
        <select
          value={relationship}
          onChange={(event) => setRelationship(event.target.value as typeof relationship)}
        >
          {RELATIONSHIP_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {stage.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </label>
      <label>
        Relationship note
        <textarea
          rows={4}
          maxLength={2000}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <Button disabled={!text.trim()} loading={busy} onClick={() => void save()}>
        Save note
      </Button>
      <p role="status">{status}</p>
      {record.journal.length ? (
        <ol className={styles.journal}>
          {[...record.journal].reverse().map((entry) => (
            <li key={entry.id}>
              <time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>
              <p>{entry.text}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p>No relationship notes yet.</p>
      )}
    </section>
  );
}

export default function ClientsScreen() {
  const { clientId, projectId } = useParams();
  const [query, setQuery] = useState('');
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const initialize = () => {
    setError('');
    setRetry((value) => value + 1);
    void ensureClients().catch(() =>
      setError('Client records could not be opened. Retry when device storage is available.'),
    );
  };
  useEffect(() => {
    void ensureClients().catch(() =>
      setError('Client records could not be opened. Retry when device storage is available.'),
    );
  }, []);
  const data = useLiveQuery(async () => {
    try {
      const [device, records, attempts, evidence] = await Promise.all([
        db.device.toCollection().first(),
        db.client_progress.toArray(),
        db.exercise_attempts.toArray(),
        db.skill_evidence.toArray(),
      ]);
      return { device, records, attempts, evidence, error: '' };
    } catch {
      return {
        device: undefined,
        records: [],
        attempts: [],
        evidence: [],
        error: 'Saved client work could not be read. Retry when device storage is available.',
      };
    }
  }, [retry]);
  const project = content.projects.find((row) => row.id === projectId);
  const client = content.clients.find((row) => row.id === (project?.client ?? clientId));
  const record = data?.records.find(
    (row) =>
      row.id === clientProgressId(client?.id ?? '') &&
      row.learner_id === data.device?.learner_id &&
      !row.deleted_at,
  );
  const progress =
    project && data?.device
      ? projectProgress(
          project,
          record,
          data.attempts,
          data.evidence,
          data.device.learner_id,
          content,
        )
      : null;
  async function select(stage: string, exercise: string, attempt: string) {
    setBusy(exercise);
    setNotice('');
    try {
      await selectProjectAttempt(project!.id, stage, exercise, attempt);
      setNotice(
        'Saved result selected. Later selections must be reviewed again if an earlier decision changed.',
      );
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Could not save the selection. Retry.');
    } finally {
      setBusy('');
    }
  }
  if (error || data?.error)
    return (
      <section className={styles.page}>
        <h1>Clients</h1>
        <p role="alert">{error || data?.error}</p>
        <Button onClick={initialize}>Retry</Button>
      </section>
    );
  if (!data || !data.device)
    return (
      <section className={styles.page}>
        <h1>Clients</h1>
        <p role="status">Opening saved client work…</p>
      </section>
    );
  if ((clientId && !client) || (projectId && !project))
    return (
      <section className={styles.page}>
        <h1>Client work unavailable</h1>
        <p>This authored client or project could not be found.</p>
        <Link to="/clients">Return to Clients</Link>
      </section>
    );
  if (project && progress)
    return (
      <section className={styles.page}>
        <Link to={`/clients/${project.client}`}>Back to {client?.business_name}</Link>
        <h1>{project.title}</h1>
        <p>
          {project.boss_client
            ? 'A persistent fictional engagement. Each stage uses your saved work; earlier choices can add later obligations.'
            : 'A practical project assembled from your saved exercise results.'}
        </p>
        <Markdown text={project.brief} />
        {project.capstone && (
          <p>
            Work independently. Hints are unavailable in capstone work; assisted attempts cannot
            complete it. Real-GHL proof remains a manual fieldwork step.
          </p>
        )}
        {project.inputs.length > 0 && (
          <section className={styles.section}>
            <h2>The client brief</h2>
            {project.inputs.map((input) => (
              <details key={input.category}>
                <summary>{input.category.replaceAll('_', ' ')}</summary>
                <Markdown text={input.brief} />
              </details>
            ))}
          </section>
        )}
        <p role="status">
          {progress.complete
            ? 'Project evidence complete. This records training work, not a real client outcome.'
            : `${progress.stages.filter((stage) => stage.complete).length} of ${progress.stages.length} stages have complete evidence.`}
        </p>
        <ol className={styles.stages}>
          {progress.stages.map((stage, index) => (
            <li key={stage.id}>
              <h2>{stage.name}</h2>
              <p>
                {stage.complete
                  ? 'Evidence complete'
                  : stage.unlocked
                    ? 'Ready for your work'
                    : 'Complete the earlier stage first'}
              </p>
              <p>{project.stages[index]!.deliverable}</p>
              {stage.consequences.map((text) => (
                <p key={text} className={styles.consequence}>
                  {text}
                </p>
              ))}
              <ul className={styles.work}>
                {stage.exercises.map((id) => {
                  const exercise = content.exercises.find((row) => row.id === id)!;
                  const candidates = data.attempts
                    .filter((attempt) => {
                      if (!record || !data.device || attempt.exercise_id !== id) return false;
                      const candidate = {
                        ...record,
                        engagements: {
                          ...record.engagements,
                          [project.id]: {
                            content_version: content.content_version,
                            stage_attempts: {
                              ...record.engagements[project.id]?.stage_attempts,
                              [stage.id]: {
                                ...record.engagements[project.id]?.stage_attempts[stage.id],
                                [id]: attempt.id,
                              },
                            },
                          },
                        },
                      };
                      return !projectProgress(
                        project,
                        candidate,
                        data.attempts,
                        data.evidence,
                        data.device.learner_id,
                        content,
                      ).stages[index]!.missing.includes(id);
                    })
                    .sort((a, b) => b.completed_at.localeCompare(a.completed_at));
                  const selected = chosen[id] ?? candidates[0]?.id ?? '';
                  return (
                    <li key={id}>
                      <h3>{exercise.title}</h3>
                      {stage.unlocked ? (
                        <Link
                          to={`/exercise/${id}${project.capstone ? `?project=${project.id}` : ''}`}
                        >
                          Open exercise
                        </Link>
                      ) : (
                        <p>Available after the preceding stage.</p>
                      )}
                      <p>
                        {stage.missing.includes(id)
                          ? 'A completed result is required.'
                          : 'Saved evidence selected.'}
                      </p>
                      {stage.unlocked && candidates.length > 0 ? (
                        <div className={styles.selection}>
                          <label>
                            Saved result for {exercise.title}
                            <select
                              value={selected}
                              onChange={(event) =>
                                setChosen((value) => ({ ...value, [id]: event.target.value }))
                              }
                            >
                              {candidates.map((attempt) => (
                                <option key={attempt.id} value={attempt.id}>
                                  {new Date(attempt.completed_at).toLocaleString()} ·{' '}
                                  {attempt.assistance}
                                </option>
                              ))}
                            </select>
                          </label>
                          <Button
                            loading={busy === id}
                            disabled={!selected}
                            onClick={() => void select(stage.id, id, selected)}
                          >
                            Use saved result
                          </Button>
                        </div>
                      ) : (
                        stage.unlocked && (
                          <p>
                            No eligible result yet. Finish the exercise, then return here. Boss
                            Client stages need work started after the preceding stage; capstone work
                            must be independent.
                          </p>
                        )
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
        <p role="status">{notice}</p>
        {project.reasoning_questions.length > 0 && (
          <section className={styles.section}>
            <h2>Reasoning to defend</h2>
            <ol>
              {project.reasoning_questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ol>
            <p>
              Submit these answers in the project's reasoning exercise; reading this list records no
              evidence.
            </p>
          </section>
        )}
        {project.portfolio && (
          <Link to={`/portfolio/${project.portfolio}`}>View saved Portfolio work</Link>
        )}
      </section>
    );
  if (client)
    return (
      <section className={styles.page}>
        <Link to="/clients">All clients</Link>
        <h1>{client.business_name}</h1>
        <p>
          Fictional {client.industry.replaceAll('_', ' ')} client ·{' '}
          {client.locations.map((location) => location.city).join(', ')}
        </p>
        <section className={styles.section}>
          <h2>The business</h2>
          <ul>
            {client.offers.map((offer) => (
              <li key={offer.name}>
                {offer.name} · {offer.billing.replaceAll('_', ' ')}
                {offer.notes ? ` · ${offer.notes}` : ''}
              </li>
            ))}
          </ul>
          <h3>People and responsibilities</h3>
          <ul>
            {client.team.map((person) => (
              <li key={person.name}>
                {person.name}, {person.role}. {person.notes}
              </li>
            ))}
          </ul>
          <h3>Current systems</h3>
          <ul>
            {client.current_systems.map((system) => (
              <li key={system}>{system}</li>
            ))}
          </ul>
          <h3>Problems to investigate</h3>
          <ul>
            {client.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </section>
        <section className={styles.section}>
          <h2>Project work</h2>
          {content.projects.filter((row) => row.client === client.id).length ? (
            <ul className={styles.directory}>
              {content.projects
                .filter((row) => row.client === client.id)
                .map((row) => (
                  <li key={row.id}>
                    <Link to={`/projects/${row.id}`}>{row.title}</Link>
                    <p>
                      {row.stages.length} practical stages{row.boss_client ? ' · Boss Client' : ''}
                    </p>
                  </li>
                ))}
            </ul>
          ) : (
            <p>
              This client is available for relationship notes and business judgment. No completed
              project is claimed.
            </p>
          )}
        </section>
        <section className={styles.section}>
          <h2>Authored background</h2>
          <ol>
            {client.history.map((entry, index) => (
              <li key={index}>
                <time>{entry.date}</time> · {entry.event}
              </li>
            ))}
          </ol>
        </section>
        {record ? (
          <Relationship key={record.id} record={record} />
        ) : (
          <p role="status">Preparing this client's local record…</p>
        )}
      </section>
    );
  const visible = content.clients.filter((row) =>
    `${row.business_name} ${row.industry.replaceAll('_', ' ')}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <section className={styles.page}>
      <h1>Clients</h1>
      <p>
        Fictional businesses with different systems, constraints and people. Keep your decisions and
        relationship history here.
      </p>
      <section className={styles.section}>
        <h2>Starter projects</h2>
        <ul className={styles.directory}>
          {content.projects
            .filter((row) => row.tier === 'field_ready')
            .map((row) => (
              <li key={row.id}>
                <Link to={`/projects/${row.id}`}>{row.title}</Link>
                <p>
                  {row.stages.length} stages{row.boss_client ? ' · Boss Client engagement' : ''}
                </p>
              </li>
            ))}
        </ul>
      </section>
      <label>
        Find a client or industry
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {visible.length ? (
        <ul className={styles.directory}>
          {visible.map((row) => (
            <li key={row.id}>
              <Link to={`/clients/${row.id}`}>{row.business_name}</Link>
              <p>
                {row.industry.replaceAll('_', ' ')} · {row.problems[0]}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p role="status">No clients match this search.</p>
      )}
    </section>
  );
}
