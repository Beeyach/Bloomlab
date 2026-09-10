import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { Button } from '@bloomlab/design-system';
import { content } from '../content/bundle';
import { db } from '../data/db';
import styles from './CommandCenter.module.css';

/** A projection of actual saved client work, never the most recently seeded client. */
export function ActiveClient() {
  const [retry, setRetry] = useState(0);
  const data = useLiveQuery(async () => {
    try {
      const device = await db.device.toCollection().first();
      const records = await db.client_progress.toArray();
      const record = records
        .filter(
          (row) =>
            row.learner_id === device?.learner_id &&
            !row.deleted_at &&
            (row.journal.length > 0 ||
              Object.values(row.engagements).some((engagement) =>
                Object.values(engagement.stage_attempts).some(
                  (attempts) => Object.keys(attempts).length > 0,
                ),
              )) &&
            content.clients.some((client) => client.id === row.client_id),
        )
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id))[0];
      return { record, error: false };
    } catch {
      return { record: undefined, error: true };
    }
  }, [retry]);
  const client = content.clients.find((client) => client.id === data?.record?.client_id);
  return (
    <section aria-labelledby="active-client-title" className={styles.section}>
      <h2 id="active-client-title" className={styles.heading}>
        Active client
      </h2>
      {!data ? (
        <p role="status" className={styles.muted}>
          Reading saved client work…
        </p>
      ) : data.error ? (
        <>
          <p role="alert" className={styles.problem}>
            Saved client work could not be read. Other study is still available.
          </p>
          <Button onClick={() => setRetry((value) => value + 1)}>Retry client work</Button>
        </>
      ) : client && data.record ? (
        <>
          <Link className={styles.rowLink} to={`/clients/${client.id}`}>
            {client.business_name}
          </Link>
          <p className={styles.muted}>
            Most recently worked with · {data.record.relationship.replaceAll('_', ' ')} · fictional
            training client.
          </p>
        </>
      ) : (
        <>
          <p className={styles.muted}>
            No saved client work yet. Start a project or save a relationship note.
          </p>
          <Link className={styles.rowLink} to="/clients">
            Explore clients and projects
          </Link>
        </>
      )}
    </section>
  );
}
