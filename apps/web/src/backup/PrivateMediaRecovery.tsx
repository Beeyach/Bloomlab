import { useEffect, useRef, useState } from 'react';
import { Button, Cluster, Field, Input } from '@bloomlab/design-system';
import {
  cancelPrivateMedia,
  confirmPrivateMedia,
  exportPrivateMedia,
  previewPrivateMedia,
  type PrivateMediaPreview,
} from '../data/privateMediaRecovery';

const kindName = {
  evidence_image: 'Evidence screenshots',
  call_recording: 'Call recordings',
  call_voice: 'Generated call audio',
  scenario_attachment: 'Scenario files',
};

export function PrivateMediaRecovery() {
  const input = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const pending = useRef(false);
  const [preview, setPreview] = useState<PrivateMediaPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (preview) heading.current?.focus();
  }, [preview]);

  async function run(task: () => Promise<void>, progress: string, done: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(false);
    setMessage(progress);
    try {
      await task();
      setMessage(done);
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : 'Private-media recovery failed. Retry.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function read(file?: File) {
    if (!file || pending.current) return;
    await run(
      async () => {
        const next = await previewPrivateMedia(file);
        setPreview(next);
      },
      'Validating private media. Saved assets are unchanged…',
      'Archive validated. Review before confirming.',
    );
    if (input.current) input.current.value = '';
  }

  async function restore() {
    if (!preview) return;
    await run(
      async () => {
        await confirmPrivateMedia(preview.stage_id);
        setPreview(null);
      },
      'Restoring missing private media…',
      'Private-media recovery completed. Existing and deleted assets were kept.',
    );
  }

  return (
    <section aria-labelledby="private-media-title">
      <h2 id="private-media-title">Private media recovery</h2>
      <p>
        Export screenshots, raw call recordings, generated call audio and scenario files from
        private storage. This separate archive complements the JSON data backup. It contains no sync
        key or provider credential.
      </p>
      <p>
        Link this device first. An imported archive is validated and previewed without changing
        saved assets; confirmation adds or repairs matching missing media and never replaces a
        different or deleted asset.
      </p>
      <Cluster>
        <Button
          loading={busy}
          onClick={() =>
            void run(
              exportPrivateMedia,
              'Packaging private media…',
              'Private-media archive prepared. Keep it private.',
            )
          }
        >
          Export Private Media
        </Button>
      </Cluster>
      <Field
        label="Choose private-media archive"
        hint="Bloomlab .blb archive, up to 25 MB. Choosing a file does not change saved media."
      >
        <Input
          ref={input}
          type="file"
          accept="application/vnd.bloomlab.recovery-v1,.blb"
          disabled={busy}
          onChange={(event) => void read(event.target.files?.[0])}
        />
      </Field>
      {preview && (
        <div>
          <h3 ref={heading} tabIndex={-1}>
            Review private-media restore
          </h3>
          <p>
            Add {preview.counts.add}; repair {preview.counts.repair}; keep {preview.counts.keep};
            deleted {preview.counts.deleted}.
          </p>
          <ul>
            {Object.entries(kindName).map(([kind, label]) => {
              const rows = preview.assets.filter((asset) => asset.kind === kind);
              return rows.length ? <li key={kind}>{`${label}: ${rows.length}`}</li> : null;
            })}
          </ul>
          <Cluster>
            <Button
              loading={busy}
              disabled={preview.counts.add + preview.counts.repair === 0}
              onClick={() => void restore()}
            >
              Confirm media restore
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                void run(
                  async () => {
                    await cancelPrivateMedia(preview.stage_id);
                    setPreview(null);
                    input.current?.focus();
                  },
                  'Cancelling recovery preview…',
                  'Recovery preview cancelled. Saved media is unchanged.',
                )
              }
            >
              Cancel media restore
            </Button>
          </Cluster>
        </div>
      )}
      <p role={error ? 'alert' : 'status'}>{message}</p>
    </section>
  );
}
