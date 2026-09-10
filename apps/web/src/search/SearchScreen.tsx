import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Field, Input, Select, StatusPill } from '@bloomlab/design-system';
import { content } from '../content/bundle';
import { db } from '../data/db';
import { ResultView } from '../exercise/ResultView';
import {
  SEARCH_KINDS,
  SEARCH_LABELS,
  searchDocuments,
  searchLocal,
  type SearchKind,
} from './search';
import styles from './SearchScreen.module.css';

const fidelity = {
  A: 'Close behavioral reproduction',
  B: 'Training-equivalent approximation',
  C: 'Conceptual training',
  REAL_GHL: 'Practice in real GHL; not simulated',
};
export default function SearchScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  // Fragments never reach the Worker/access logs when a private query is bookmarked or reloaded.
  const params = useMemo(() => new URLSearchParams(location.hash.slice(1)), [location.hash]);
  const setParams = (next: URLSearchParams | Record<string, string>, options = {}) =>
    navigate(`/search#${new URLSearchParams(next)}`, options);
  const [retry, setRetry] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const query = params.get('q') ?? '';
  const selectedKind = params.get('kind');
  const kind = SEARCH_KINDS.includes(selectedKind as SearchKind)
    ? (selectedKind as SearchKind)
    : 'all';
  const entry = params.get('entry'),
    attemptId = params.get('attempt');
  const history = useLiveQuery(async () => {
    try {
      const learner = (await db.device.toCollection().first())?.learner_id ?? '';
      const attempts = await db.exercise_attempts
        .filter((a) => a.learner_id === learner && a.deleted_at === null)
        .toArray();
      return { learner, attempts, error: false };
    } catch {
      return { learner: '', attempts: [], error: true };
    }
  }, [retry]);
  const documents = useMemo(
    () => searchDocuments(content, history?.attempts ?? [], history?.learner ?? ''),
    [history],
  );
  const matches = useMemo(() => searchLocal(documents, query, kind), [documents, query, kind]);
  useEffect(() => {
    if (entry || attemptId) heading.current?.focus();
    else input.current?.focus();
  }, [entry, attemptId]);
  const feature = content.ghl_features.find((f) => f.id === entry);
  const term = content.glossary.find((g) => g.id === entry);
  const attempt = history?.attempts.find((a) => a.id === attemptId);
  const exercise = content.exercises.find((e) => e.id === attempt?.exercise_id);
  function change(key: 'q' | 'kind', value: string) {
    const next = new URLSearchParams(params);
    next.delete('entry');
    next.delete('attempt');
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }
  const detail = Boolean(entry || attemptId);
  const back = new URLSearchParams(params);
  back.delete('entry');
  back.delete('attempt');
  const open = (destination: string) => {
    if (!destination.startsWith('/search#')) return destination;
    const next = new URLSearchParams(destination.slice('/search#'.length));
    if (query) next.set('q', query);
    if (kind !== 'all') next.set('kind', kind);
    return `/search#${next}`;
  };
  return (
    <div className={styles.screen}>
      {detail && (
        <p>
          <Link to={`/search#${back}`}>Back to search</Link>
        </p>
      )}
      <h1 ref={heading} tabIndex={-1} className={styles.title}>
        {feature?.official_name ??
          term?.term ??
          (attemptId
            ? (exercise?.title ?? 'Saved attempt')
            : entry
              ? 'Entry unavailable'
              : 'Search Bloomlab')}
      </h1>
      {!detail && (
        <>
          <p className={styles.intro}>
            Find a capability, GHL feature, lesson, glossary term, client or saved exercise. Search
            stays on this device.
          </p>
          <div className={styles.tools} role="search" aria-label="Bloomlab">
            <Field label="Search Bloomlab">
              <Input
                ref={input}
                type="search"
                data-global-search
                maxLength={200}
                value={query}
                onChange={(e) => change('q', e.target.value)}
              />
            </Field>
            <Field label="Look in">
              <Select value={kind} onChange={(e) => change('kind', e.target.value)}>
                <option value="all">Everything</option>
                {SEARCH_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {SEARCH_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              variant="ghost"
              onClick={() => {
                setParams({});
                input.current?.focus();
              }}
            >
              Clear search
            </Button>
          </div>
          <p role="status">
            {!query.trim() && kind === 'all'
              ? 'Type to search, or choose a category to browse.'
              : `${matches.length} results`}
          </p>
          {history === undefined && (
            <p role="status">Opening saved attempts… Curriculum search is ready.</p>
          )}
          {history?.error && (
            <div role="alert">
              <p>
                Saved attempts could not be read. Curriculum search still works; your history has
                not been changed.
              </p>
              <Button onClick={() => setRetry((n) => n + 1)}>Retry history</Button>
            </div>
          )}
          {!query.trim() && kind === 'all' && (
            <p>
              <Link to="/search#kind=glossary">Browse the glossary</Link> · Ctrl/⌘ K opens search.
            </p>
          )}
          {(query.trim() || kind !== 'all') && matches.length === 0 && (
            <p>
              No matches. Try fewer words or another category. Saved attempts appear only after you
              submit work.
            </p>
          )}
          <ol className={styles.results}>
            {matches.map((match) => (
              <li
                className={styles.result}
                key={`${match.kind}:${match.id}`}
                data-search-kind={match.kind}
              >
                <Link to={open(match.destination)}>{match.title}</Link>
                <p>
                  {SEARCH_LABELS[match.kind]} ·{' '}
                  {match.kind === 'attempts'
                    ? 'View this saved attempt'
                    : match.kind === 'ghl-features'
                      ? 'Read registry guidance'
                      : match.kind === 'glossary'
                        ? 'Read definition'
                        : match.kind === 'exercises'
                          ? 'Open exercise'
                          : 'Open'}
                </p>
                {match.description && <p>{match.description}</p>}
              </li>
            ))}
          </ol>
        </>
      )}
      {feature && (
        <section className={styles.detail} aria-label="GHL registry guidance">
          <StatusPill label={feature.status.replaceAll('_', ' ')} tone="neutral" />
          <p>{fidelity[feature.simulation_fidelity]}</p>
          {feature.approximation_note && <p>{feature.approximation_note}</p>}
          {feature.verification_note && (
            <>
              <h2>Verification context</h2>
              <p>{feature.verification_note}</p>
            </>
          )}
          <h2>Known limitations</h2>
          {feature.known_limitations.length ? (
            <ul>
              {feature.known_limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>No additional limitation is recorded.</p>
          )}
          <p>
            Verified {feature.last_verified}.{' '}
            <a href={feature.source_url} target="_blank" rel="noreferrer">
              Official documentation (opens a new tab)
            </a>
          </p>
          <div className={styles.links}>
            {feature.skills.map((id) => (
              <Link key={id} to={`/skills/${id}`}>
                {content.skills.find((s) => s.id === id)?.title ?? id}
              </Link>
            ))}
          </div>
        </section>
      )}
      {term && (
        <section className={styles.detail} aria-label="Glossary definition">
          <p>{term.definition}</p>
          {term.aliases.length > 0 && <p>Also called: {term.aliases.join(', ')}.</p>}
          <div className={styles.links}>
            {term.related_skills.map((id) => (
              <Link key={id} to={`/skills/${id}`}>
                {content.skills.find((s) => s.id === id)?.title ?? id}
              </Link>
            ))}
            {term.ghl_features.map((id) => (
              <Link key={id} to={open(`/search#entry=${encodeURIComponent(id)}`)}>
                {content.ghl_features.find((f) => f.id === id)?.official_name ?? id}
              </Link>
            ))}
          </div>
        </section>
      )}
      {entry && !feature && !term && (
        <p>
          This entry is not in the current compiled content. Nothing has been removed from your
          history.
        </p>
      )}
      {attemptId && !attempt && (
        <p role={history?.error ? 'alert' : 'status'}>
          {!history
            ? 'Opening saved attempt…'
            : history.error
              ? 'Saved history could not be read. Return to search and retry.'
              : 'This saved attempt is not available for this learner on this device.'}
        </p>
      )}
      {attempt && (
        <div className={styles.detail}>
          <p>
            Saved attempt · {new Date(attempt.completed_at).toLocaleString()} · {attempt.result}.
            This is historical work, not a new result.
          </p>
          <ResultView attempt={attempt} skillId={null} snapshot={undefined} />
          {attempt.response && (
            <section aria-label="Saved written work">
              <h2>Your saved writing</h2>
              {attempt.response.text && <p className={styles.savedText}>{attempt.response.text}</p>}
              <dl>
                {Object.entries(attempt.response.written ?? {})
                  .filter(([, text]) => text)
                  .map(([key, text]) => (
                    <div key={key}>
                      <dt>
                        {exercise?.written_fields.find((f) => f.key === key)?.label ??
                          key.replaceAll('_', ' ')}
                      </dt>
                      <dd className={styles.savedText}>{text}</dd>
                    </div>
                  ))}
              </dl>
            </section>
          )}
          {exercise && (
            <p>
              <Link to={`/exercise/${exercise.id}`}>Open exercise</Link> — this saved attempt stays
              unchanged.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
