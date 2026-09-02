import { useState, type FormEvent } from 'react';

import { Button, Cluster, Field, Input, Surface } from '@bloomlab/design-system';

import { DEVICE_LABEL_MAX, renameDevice, useDevice } from '../data';
import styles from './DeviceIdentity.module.css';

/**
 * "This device": the local identity created on first run (spec §89) and the first local-first
 * interaction — renaming it writes IndexedDB immediately and survives reload and offline use.
 */
export function DeviceIdentity() {
  const device = useDevice();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await renameDevice(draft ?? '');
      setDraft(null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the name');
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(null);
    setError(null);
  }

  return (
    <Surface as="section" padding="sm" className={styles.device} aria-labelledby="device-title">
      <h2 id="device-title" className={styles.title}>
        This device
      </h2>
      {!device && (
        <p className={styles.muted} role="status">
          Preparing this device…
        </p>
      )}
      {device && draft === null && (
        <div className={styles.row}>
          <p className={styles.label}>{device.label}</p>
          <Button size="sm" onClick={() => setDraft(device.label)}>
            Rename
          </Button>
        </div>
      )}
      {device && draft !== null && (
        <form className={styles.form} onSubmit={save}>
          <Field
            label="Device name"
            hint="How this device will appear in Connected devices."
            error={error ?? undefined}
          >
            <Input
              value={draft}
              maxLength={DEVICE_LABEL_MAX}
              autoComplete="off"
              onChange={(event) => setDraft(event.target.value)}
            />
          </Field>
          <Cluster gap={2}>
            <Button type="submit" variant="primary" size="sm" loading={saving}>
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={cancel}>
              Cancel
            </Button>
          </Cluster>
        </form>
      )}
      <p className={styles.muted}>
        Everything you do is saved on this device first and keeps working offline.
      </p>
    </Surface>
  );
}
