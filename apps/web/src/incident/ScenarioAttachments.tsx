import { useRef, useState } from 'react';
import { Button, Field, Input } from '@bloomlab/design-system';
import {
  deleteScenarioAttachment,
  downloadScenarioAttachment,
  listScenarioAttachments,
  uploadScenarioAttachment,
  type ScenarioAttachment,
} from './attachments';
import styles from './incident.module.css';

export function ScenarioAttachments({ scenarioId }: { scenarioId: string }) {
  const file = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<ScenarioAttachment[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await task();
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : 'Scenario files are unavailable. Retry.');
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    const rows = await listScenarioAttachments(scenarioId);
    setAssets(rows);
    setMessage(
      rows.length
        ? `${rows.length} scenario file${rows.length === 1 ? '' : 's'} ready.`
        : 'No scenario files yet.',
    );
  }

  return (
    <section aria-labelledby="scenario-files-title" className={styles.panel}>
      <h2 id="scenario-files-title" className={styles.panelHeading}>
        Scenario files
      </h2>
      <p className={styles.muted}>
        Keep a client brief, CSV sample or PDF with this case. Files are private and require a
        linked device; include them in the separate private-media backup from Sync.
      </p>
      {assets === null ? (
        <Button variant="secondary" loading={busy} onClick={() => void run(refresh)}>
          Load case files
        </Button>
      ) : (
        <>
          <Field label="Add a case file" hint="PDF, plain text or CSV, up to 8 MB.">
            <Input
              ref={file}
              type="file"
              accept="application/pdf,text/plain,text/csv,.pdf,.txt,.csv"
              disabled={busy}
              onChange={(event) => {
                const chosen = event.target.files?.[0];
                if (!chosen) return;
                void run(async () => {
                  const saved = await uploadScenarioAttachment(scenarioId, chosen);
                  setAssets((current) => [...(current ?? []), saved]);
                  setMessage(`${saved.name} uploaded.`);
                  if (file.current) file.current.value = '';
                });
              }}
            />
          </Field>
          {assets.length === 0 ? (
            <p className={styles.body}>No case files have been added.</p>
          ) : (
            <ul className={styles.list}>
              {assets.map((asset) => (
                <li key={asset.attachment_id}>
                  {asset.name} · {Math.ceil(asset.byte_length / 1024)} KB{' '}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void run(() => downloadScenarioAttachment(asset))}
                  >
                    Download
                  </Button>{' '}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await deleteScenarioAttachment(asset.attachment_id);
                        setAssets((current) =>
                          (current ?? []).filter(
                            (candidate) => candidate.attachment_id !== asset.attachment_id,
                          ),
                        );
                        setMessage(`${asset.name} deleted.`);
                      })
                    }
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p role={error ? 'alert' : 'status'}>{message}</p>
    </section>
  );
}
