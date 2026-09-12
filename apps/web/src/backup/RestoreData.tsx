import { useEffect, useRef, useState } from 'react';
import { Button, Cluster, Field, Input } from '@bloomlab/design-system';
import { cancelRestore, confirmRestore, previewRestore, type RestorePreview } from './restore';
import { MAX_BACKUP_BYTES } from './restoreSchema';

const names: Record<string, string> = {
  notes: 'Notes',
  client_progress: 'Client work',
  portfolio_projects: 'Portfolio projects',
  portfolio_assets: 'Portfolio references',
  skill_evidence: 'Evidence',
  exercise_attempts: 'Attempts',
  sim_projects: 'Simulator runs',
  sim_events: 'Simulator events',
  sim_snapshots: 'Simulator checkpoints',
};
export function RestoreData() {
  const input = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const pending = useRef(false);
  const returnFocus = useRef(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!preview) return;
    // Focus only after React has committed the newly mounted review heading.
    const frame = requestAnimationFrame(() => heading.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [preview]);
  useEffect(() => {
    if (busy || preview || !returnFocus.current) return;
    // The chooser must be enabled in the committed DOM before it can receive focus.
    returnFocus.current = false;
    input.current?.focus();
  }, [busy, preview]);
  async function read(file?: File) {
    if (!file || pending.current) return;
    if (preview) cancelRestore(preview);
    setPreview(null);
    pending.current = true;
    setBusy(true);
    setError(false);
    setMessage('Validating backup. Saved data is unchanged…');
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Choose a JSON backup up to 25 MB.');
      const next = await previewRestore(await file.text());
      setPreview(next);
      setMessage('Backup validated. Review before confirming.');
    } catch (e) {
      setError(true);
      setMessage(e instanceof Error ? e.message : 'Backup could not be read. No data was changed.');
    } finally {
      pending.current = false;
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  async function restore() {
    if (!preview || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(false);
    setMessage('Restoring on this device…');
    try {
      const count = await confirmRestore(preview);
      returnFocus.current = true;
      setPreview(null);
      setMessage(
        `Restored ${count} missing records on this device. Existing records were kept. Progress was recalculated; changes are queued for normal sync. Restore private media separately below.`,
      );
    } catch (e) {
      setError(true);
      setMessage(
        `${e instanceof Error ? e.message : 'Restore failed.'} No partial restore was saved. Choose the backup again to review and retry.`,
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="restore-title">
      <h2 id="restore-title">Restore Backup</h2>
      <p>
        Restore missing records from a private Bloomlab JSON export. Existing records and deleted
        records are kept, never overwritten. On another device, link with the original Bloomlab Sync
        Key first.
      </p>
      <p>
        Progress is recalculated from evidence. This JSON restore does not include private media,
        connection keys or unfinished drafts; private files use the separate archive below. Old
        simulator saves must still match the available simulator and content.
      </p>
      <Field
        label="Choose Bloomlab backup"
        hint="JSON, up to 25 MB. Choosing a file does not change saved data."
      >
        <Input
          ref={input}
          type="file"
          accept="application/json,.json"
          disabled={busy}
          onChange={(e) => void read(e.target.files?.[0])}
        />
      </Field>
      {preview && (
        <div>
          <h3 ref={heading} tabIndex={-1}>
            Review restore
          </h3>
          <p>
            Exported {new Date(preview.exportedAt).toLocaleString()} · Content{' '}
            {preview.contentVersion}
          </p>
          <p>
            {preview.add} missing records to add; {preview.keep} existing records or existing-run
            history to keep unchanged.
          </p>
          <ul>
            {preview.groups
              .filter((g) => g.add + g.keep > 0)
              .map((g) => (
                <li key={g.name}>
                  {names[g.name]}: add {g.add}, keep {g.keep}
                </li>
              ))}
          </ul>
          <p>
            {preview.mediaReferences} private image references in this backup; the images themselves
            are not included. This will not verify uploads or server sync.
          </p>
          <Cluster>
            <Button loading={busy} disabled={preview.add === 0} onClick={() => void restore()}>
              Confirm restore
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                cancelRestore(preview);
                setPreview(null);
                setError(false);
                setMessage('Restore cancelled. Saved data is unchanged.');
                input.current?.focus();
              }}
            >
              Cancel restore
            </Button>
          </Cluster>
        </div>
      )}
      <p role={error ? 'alert' : 'status'}>{message}</p>
    </section>
  );
}
