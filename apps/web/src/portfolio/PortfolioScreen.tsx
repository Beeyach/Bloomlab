import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '@bloomlab/design-system';
import { PORTFOLIO_ARTIFACT_KINDS } from '@bloomlab/content-schema';
import { content } from '../content/bundle';
import { db } from '../data/db';
import { collectPortfolio, saveReflection } from './store';
import { ARTIFACT_LABELS, readPortfolio, type PortfolioView, type ArtifactKind } from './view';
import { PrivateScreenshot } from './PrivateScreenshot';
import styles from './portfolio.module.css';

const featureName = (id: string | null) =>
  content.ghl_features.find((f) => f.id === id)?.official_name ?? 'Saved step';
const exerciseName = (id: string | null) =>
  content.exercises.find((e) => e.id === id)?.title ?? 'Saved exercise';
const skillName = (id: string) =>
  content.skills.find((s) => s.id === id)?.title ?? 'Saved capability';

function Reflection({ view }: { view: PortfolioView }) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? view.record.reflection;
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  async function save() {
    setBusy(true);
    try {
      await saveReflection(view.record.id, text);
      setDraft(null);
      setStatus('Reflection saved on this device.');
    } catch {
      setStatus('Reflection could not be saved. Your text is still here; retry.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.reflection}>
      <label htmlFor="portfolio-reflection">Your project reflection</label>
      <p>
        Add what you would change or verify next. This is your reflection, not verified evidence.
      </p>
      <textarea
        id="portfolio-reflection"
        rows={5}
        maxLength={8000}
        value={text}
        onChange={(e) => {
          setDraft(e.target.value);
          setStatus('Unsaved reflection');
        }}
      />
      <Button loading={busy} onClick={() => void save()}>
        Save reflection
      </Button>
      <p role="status">{status}</p>
    </div>
  );
}
function Artifact({ kind, view }: { kind: ArtifactKind; view: PortfolioView }) {
  switch (kind) {
    case 'brief':
      return <p>{view.brief}</p>;
    case 'business_problem':
      return (
        <ul>
          {view.problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      );
    case 'architecture':
      return (
        <>
          {view.captures
            .filter((c) => c.capture.workflows.length || c.capture.funnels.length)
            .map(({ attempt, capture }) => (
              <p key={attempt.id}>
                {exerciseName(attempt.exercise_id)}: saved structure includes{' '}
                {[
                  ...capture.workflows.map((w) => w.name),
                  ...capture.funnels.map((f) => f.name),
                ].join(', ')}
                . The representations below preserve what grading received.
              </p>
            ))}
          {view.attempts
            .filter((a) => a.response?.choice)
            .map((a) => (
              <p key={a.id}>
                {content.exercises
                  .find((e) => e.id === a.exercise_id)
                  ?.decision_options.find((o) => o.value === a.response?.choice)?.label ??
                  'Architecture choice recorded in the saved exercise.'}
              </p>
            ))}
          {!view.available.architecture && (
            <p>
              Not supplied. Earlier attempts without a captured build are not reconstructed from the
              current simulator.
            </p>
          )}
        </>
      );
    case 'workflows':
      return (
        <>
          {view.captures.flatMap(({ attempt, capture }) =>
            capture.workflows.map((w) => (
              <div className={styles.structure} key={`${attempt.id}:${w.id}`}>
                <h3>{w.name}</h3>
                <p>Trigger: {featureName(w.trigger)}</p>
                <ol>
                  {w.nodes.map((n) => (
                    <li key={n.id}>
                      {featureName(n.feature)}
                      {n.label ? ` — ${n.label}` : ''}
                    </li>
                  ))}
                </ol>
                <p className={styles.muted}>
                  Submitted structure · {exerciseName(attempt.exercise_id)}. Step order is the saved
                  definition order, not an execution trace; full configuration is not captured here.
                </p>
              </div>
            )),
          )}
          {!view.available.workflows && (
            <p>Not supplied. No learner workflow structure was preserved with this work.</p>
          )}
        </>
      );
    case 'funnel':
      return (
        <>
          {view.captures.flatMap(({ attempt, capture }) =>
            capture.funnels.map((f) => (
              <div className={styles.structure} key={`${attempt.id}:${f.id}`}>
                <h3>{f.name}</h3>
                <ol>
                  {f.steps.map((s) => (
                    <li key={s.id}>
                      <strong>{s.name}</strong> · {s.purpose}
                      <ul>
                        {s.blocks.map((b, i) => (
                          <li key={i}>
                            {b.role}
                            {b.connected === null
                              ? ''
                              : b.connected
                                ? ' · connected'
                                : ' · connection missing'}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
                <p className={styles.muted}>
                  Submitted conversion structure · {exerciseName(attempt.exercise_id)}
                </p>
              </div>
            )),
          )}
          {!view.available.funnel && (
            <p>Not supplied. A proposed system is not a saved funnel build.</p>
          )}
        </>
      );
    case 'screenshots':
      return (
        <>
          {!view.screenshots.length && (
            <p>Not supplied. Screenshots appear from saved Fieldwork proof.</p>
          )}
          {view.screenshots.map((s) => (
            <PrivateScreenshot key={s.asset_id} asset={s} />
          ))}
        </>
      );
    case 'learner_reasoning':
      return (
        <>
          {view.reasoning.map((r, i) => (
            <details key={i}>
              <summary>{r.title}</summary>
              <p className={styles.prose}>{r.text}</p>
            </details>
          ))}
          {!view.reasoning.length && <p>No reasoning was saved with these attempts.</p>}
          <Reflection view={view} />
        </>
      );
    case 'skills_demonstrated': {
      const ids = [
        ...new Set(
          view.evidence
            .filter((e) => e.result === 'passed' && !e.critical_failures.length)
            .map((e) => e.skill_id),
        ),
      ];
      return (
        <>
          {ids.length ? (
            <ul>
              {ids.map((id) => (
                <li key={id}>
                  <Link to={`/skills/${id}`}>{skillName(id)}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No passing capability evidence supplied. Saved work alone does not demonstrate
              mastery.
            </p>
          )}
          <p className={styles.muted}>
            Demonstrations from saved attempts; current mastery and independence remain in Skill
            Map.
          </p>
        </>
      );
    }
    case 'assistance_level':
      return (
        <ul>
          {view.attempts.map((a) => (
            <li key={a.id}>
              {exerciseName(a.exercise_id)} · {a.assistance.replace(/_/g, ' ')} assistance ·{' '}
              {a.result === 'passed'
                ? 'Passed'
                : a.result === 'failed'
                  ? 'Needs another run'
                  : 'Partly assessed'}
            </li>
          ))}
        </ul>
      );
    case 'real_ghl_evidence':
      return (
        <>
          {view.realGhl.length ? (
            <>
              <p>
                Manual real-GHL proof recorded at submission. Bloomlab did not independently inspect
                GHL.
              </p>
              <ul>
                {[...new Set(view.realGhl.map((e) => e.exercise_id))].map((id) => (
                  <li key={id}>{exerciseName(id)}</li>
                ))}
              </ul>
              <p>
                Historical completion remains recorded after an image is deleted. Open a screenshot
                above to check its current availability.
              </p>
            </>
          ) : (
            <p>No passing real-GHL evidence supplied. Simulation work does not stand in for it.</p>
          )}
        </>
      );
  }
}
function Detail({ view }: { view: PortfolioView }) {
  return (
    <article>
      <Link className={styles.back} to="/portfolio">
        ← Portfolio
      </Link>
      <header className={styles.heading}>
        <h1>{view.template.title}</h1>
        <p className={styles.truth}>{view.template.label}</p>
        <p>
          A working archive of saved evidence. Missing artifacts stay visible; this is not a
          completed-project certificate.
        </p>
      </header>
      <div className={styles.layout}>
        <nav className={styles.contents} aria-label="Project artifacts">
          {PORTFOLIO_ARTIFACT_KINDS.map((kind) => (
            <a key={kind} href={`#artifact-${kind}`}>
              {ARTIFACT_LABELS[kind]}
              <span>
                {kind === 'screenshots' && view.screenshots.some((s) => !s.deleted)
                  ? 'Private references'
                  : view.available[kind]
                    ? 'Recorded'
                    : 'Not supplied'}
              </span>
            </a>
          ))}
        </nav>
        <div>
          {PORTFOLIO_ARTIFACT_KINDS.map((kind) => (
            <section
              className={styles.artifact}
              id={`artifact-${kind}`}
              key={kind}
              data-artifact={kind}
            >
              <h2>{ARTIFACT_LABELS[kind]}</h2>
              <p className={styles.description}>
                {view.template.artifacts.find((a) => a.kind === kind)?.required
                  ? 'Required'
                  : 'Optional'}{' '}
                · {view.template.artifacts.find((a) => a.kind === kind)?.description}
              </p>
              <Artifact kind={kind} view={view} />
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
export default function PortfolioScreen() {
  const { templateId } = useParams();
  const [retry, setRetry] = useState(0);
  const [collectionError, setCollectionError] = useState(false);
  const state = useLiveQuery(async () => {
    try {
      // Observe new completed work even before it has a portfolio contribution.
      await db.exercise_attempts.toArray();
      await db.skill_evidence.toArray();
      return { views: await readPortfolio(), error: false };
    } catch {
      return { views: [] as PortfolioView[], error: true };
    }
  }, [retry]);
  useEffect(() => {
    let active = true;
    void collectPortfolio().then(
      () => {
        if (active) setCollectionError(false);
      },
      () => {
        if (active) setCollectionError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [state, retry]);
  if (!state)
    return (
      <section className={styles.screen}>
        <h1>Portfolio</h1>
        <p role="status">Gathering your saved work…</p>
      </section>
    );
  if (state.error || collectionError)
    return (
      <section className={styles.screen}>
        <h1>Portfolio</h1>
        <p role="alert">Your archive could not be read. Your saved work is preserved.</p>
        <Button onClick={() => setRetry((n) => n + 1)}>Try again</Button>
      </section>
    );
  const view = state.views.find((v) => v.template.id === templateId);
  if (templateId)
    return (
      <div className={styles.screen}>
        {view ? (
          <Detail key={view.record.id} view={view} />
        ) : (
          <>
            <h1>Portfolio item unavailable</h1>
            <p>
              This project has no assembled work on this device. Sync to retrieve saved work from
              another device.
            </p>
            <Link to="/portfolio">Back to Portfolio</Link>
          </>
        )}
      </div>
    );
  return (
    <section className={styles.screen} aria-labelledby="portfolio-title">
      <header className={styles.heading}>
        <h1 id="portfolio-title">Portfolio</h1>
        <p>Work you can explain. Evidence you can return to.</p>
        <Link to="/sync">Sync, devices and data export</Link>
      </header>
      {!state.views.length ? (
        <div className={styles.empty}>
          <h2>Your archive starts with the work.</h2>
          <p>
            Complete a project exercise to gather its saved answers, build structure and evidence
            here. Artifacts you have not supplied stay marked as missing.
          </p>
          <p>
            Everything here is a Simulation Project or Demonstration Build, with no claim of real
            client results.
          </p>
          <Link to="/campaign">Find project work in your campaign</Link>
        </div>
      ) : (
        <ol className={styles.archive}>
          {state.views.map((v) => (
            <li key={v.record.id}>
              <div className={styles.cover} aria-hidden="true">
                <span>{v.template.progression_number}</span>
              </div>
              <div>
                <h2>
                  <Link to={`/portfolio/${v.template.id}`}>{v.template.title}</Link>
                </h2>
                <p className={styles.truth}>{v.template.label}</p>
                <p>
                  {v.realGhl.length
                    ? 'Manual real-GHL proof recorded'
                    : 'Real-GHL evidence not supplied'}
                </p>
                <p className={styles.muted}>
                  Saved work assembled · missing artifacts remain visible
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
