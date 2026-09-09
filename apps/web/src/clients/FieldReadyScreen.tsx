import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@bloomlab/design-system';
import { db } from '../data/db';
import { content } from '../content/bundle';
import { evaluateLearner } from '../data/learning/progress';
import { fieldReadyCompletion } from './completion';
import styles from './clients.module.css';

export default function FieldReadyScreen() {
  const [retry, setRetry] = useState(0);
  const result = useLiveQuery(async () => {
    try {
      if (!(await db.device.toCollection().first())) return undefined;
      return { value: fieldReadyCompletion(await evaluateLearner(), content), error: false };
    } catch {
      return { value: null, error: true };
    }
  }, [retry]);
  if (result?.error)
    return (
      <section className={styles.page}>
        <h1>Field Ready</h1>
        <p role="alert">Your evidence could not be read. Retry when device storage is available.</p>
        <Button onClick={() => setRetry((value) => value + 1)}>Retry</Button>
      </section>
    );
  if (!result?.value)
    return (
      <section className={styles.page}>
        <h1>Field Ready</h1>
        <p role="status">Reading saved evidence…</p>
      </section>
    );
  const { complete, evidence, path, copy } = result.value;
  return (
    <section className={styles.page} aria-labelledby="field-ready-title">
      <Link to="/campaign">Back to your campaign</Link>
      <h1 id="field-ready-title">{complete ? 'Field Ready' : 'Your Field Ready evidence'}</h1>
      <p role="status">
        {complete
          ? 'Your required training evidence and project records are complete.'
          : 'Completion requires every evidence area and all required project work. Missing work stays visible below.'}
      </p>
      <section
        className={complete ? styles.certificate : styles.section}
        aria-labelledby="capabilities-title"
      >
        <h2 id="capabilities-title">
          {complete ? 'Field Ready certificate' : 'What Field Ready means'}
        </h2>
        <p>{copy?.statement}</p>
        <ol>
          {copy?.capabilities.map((capability) => (
            <li key={capability}>{capability}</li>
          ))}
        </ol>
        {complete && (
          <p>
            Real-GHL evidence is learner-supplied manual proof. Bloomlab does not inspect the
            account. No real client outcome is certified.
          </p>
        )}
      </section>
      <section className={styles.section}>
        <h2>Independent evidence</h2>
        <ul className={styles.directory}>
          {evidence.areas.map((area) => (
            <li key={area.area}>
              <h3>{area.area.replaceAll('_', ' ')}</h3>
              <p>
                {area.satisfied
                  ? 'Independent evidence recorded'
                  : 'Independent evidence still needed'}
              </p>
              <ul>
                {(area.skill_ids.length
                  ? area.skill_ids
                  : content.skills
                      .filter(
                        (skill) =>
                          skill.tier === 'field_ready' && skill.evidence_areas.includes(area.area),
                      )
                      .map((skill) => skill.id)
                ).map((id) => (
                  <li key={id}>
                    <Link to={`/skills/${id}`}>
                      {content.skills.find((skill) => skill.id === id)?.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.section}>
        <h2>Campaign and project work</h2>
        <p>
          {path?.complete
            ? 'All campaign gates have the required evidence.'
            : `${path?.passed_gates.length ?? 0} of 12 required gates have passed.`}
        </p>
        <Link to="/campaign">Review remaining gates</Link>
        <br />
        <Link to="/clients">Open your practical projects</Link>
      </section>
    </section>
  );
}
