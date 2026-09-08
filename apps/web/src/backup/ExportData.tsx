import { useRef, useState } from 'react';
import { Button } from '@bloomlab/design-system';
import { createBackup, downloadBackup } from './export';

export function ExportData() {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(false);
  async function run() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(false);
    setStatus('Preparing your data…');
    try {
      downloadBackup(await createBackup());
      setStatus('Export prepared. Your browser will save the JSON file.');
    } catch {
      setError(true);
      setStatus('The export could not be prepared. Your saved data is unchanged. Try again.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="export-title">
      <h2 id="export-title">Your data</h2>
      <p>
        Save progress, evidence, projects, notes, simulator saves and portfolio metadata from this
        device. Sync first if you need recent work from another device.
      </p>
      <p>
        Private images, raw call audio and connection keys are excluded. Your written work remains
        in the file; keep it private. Restore is not available yet.
      </p>
      <Button loading={busy} onClick={() => void run()}>
        Export Bloomlab Data
      </Button>
      <p role={error ? 'alert' : 'status'}>{status}</p>
    </section>
  );
}
