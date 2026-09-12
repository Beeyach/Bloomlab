import { ExportData } from '../backup/ExportData';
import { useLiveQuery } from 'dexie-react-hooks';
import QRCode from 'qrcode';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import {
  Button,
  Cluster,
  Field,
  Input,
  StatusPill,
  Stack,
  Surface,
  type StatusTone,
} from '@bloomlab/design-system';
import { formatSyncKey, type DeviceSummary } from '@bloomlab/shared';

import {
  SYNC_STATE_KEY,
  createSyncKey,
  db,
  isLinked,
  linkThisDevice,
  syncApi,
  syncNow,
  unlinkThisDevice,
  useDevice,
  useSyncStatus,
  type DeviceRecord,
  type SyncStatus,
} from '../data';
import { reopenConflictPrompt } from '../app/conflictPrompt';
import { DeviceIdentity } from './DeviceIdentity';
import styles from './SyncScreen.module.css';

const RECOVERY_WARNING =
  'There is no account and no password reset. If you lose every connected device and this key, nothing on the server can be recovered. Save the key somewhere safe before you continue.';

const TONES: Record<SyncStatus, StatusTone> = {
  offline: 'warning',
  'saved-locally': 'neutral',
  syncing: 'info',
  synced: 'success',
};

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return 'never';
  return new Date(iso).toLocaleString();
}

// ---------------------------------------------------------------- key panel (SYNC-002, SYNC-006)

function KeyPanel({ canonical }: { canonical: string }) {
  const display = formatSyncKey(canonical);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(display);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const file = {
      format: 'bloomlab-sync-key',
      version: 1,
      sync_key: display,
      created_at: new Date().toISOString(),
      note: 'Keep this file private. Anyone with the key can read and change your Bloomlab progress.',
    };
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'bloomlab-sync-key.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function showQr() {
    if (qr) {
      setQr(null);
      return;
    }
    setQr(await QRCode.toDataURL(display, { margin: 1, width: 220 }));
  }

  return (
    <div className={styles.keyPanel}>
      <p className={styles.keyLabel}>Bloomlab Sync Key</p>
      <p className={styles.key} data-testid="sync-key" data-review-private>
        {display}
      </p>
      <Cluster gap={2}>
        <Button size="sm" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy key'}
        </Button>
        <Button size="sm" onClick={download}>
          Download recovery file
        </Button>
        <Button size="sm" onClick={() => void showQr()} aria-pressed={qr !== null}>
          {qr ? 'Hide QR' : 'Show QR'}
        </Button>
      </Cluster>
      {qr && (
        <img
          data-review-private
          className={styles.qr}
          src={qr}
          alt="QR code of your Bloomlab Sync Key"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- not linked

function CreateKey({ onLinked }: { onLinked: () => void }) {
  const [key] = useState(createSyncKey);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function link() {
    setBusy(true);
    setError(null);
    try {
      await linkThisDevice(key.canonical);
      void syncNow();
      onLinked();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack gap={4}>
      <KeyPanel canonical={key.canonical} />
      <Surface padding="sm" className={styles.warning} role="note">
        <p>{RECOVERY_WARNING}</p>
      </Surface>
      <label className={styles.confirm}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={saved}
          onChange={(event) => setSaved(event.target.checked)}
        />
        <span>I saved my sync key</span>
      </label>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <Cluster gap={2}>
        <Button variant="primary" disabled={!saved} loading={busy} onClick={() => void link()}>
          Link this device
        </Button>
      </Cluster>
    </Stack>
  );
}

function EnterKey({ onLinked }: { onLinked: () => void }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await linkThisDevice(value);
      void syncNow();
      onLinked();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <Field
        label="Your sync key"
        hint="Paste the key from another device or your recovery file. Dashes and case do not matter."
        error={error ?? undefined}
      >
        <Input
          data-review-private
          value={value}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setValue(event.target.value)}
        />
      </Field>
      <Cluster gap={2}>
        <Button type="submit" variant="primary" loading={busy}>
          Link this device
        </Button>
      </Cluster>
    </form>
  );
}

function NotLinked({ onLinked }: { onLinked: () => void }) {
  const [mode, setMode] = useState<'choose' | 'create' | 'enter'>('choose');
  if (mode === 'create') return <CreateKey onLinked={onLinked} />;
  if (mode === 'enter') return <EnterKey onLinked={onLinked} />;
  return (
    <Stack gap={4}>
      <p className={styles.lede}>
        Bloomlab has no login. A Bloomlab Sync Key links your devices: everything stays saved on
        each device first and syncs quietly whenever there is a connection.
      </p>
      <Cluster gap={2}>
        <Button variant="primary" onClick={() => setMode('create')}>
          Create a sync key
        </Button>
        <Button onClick={() => setMode('enter')}>I already have a key</Button>
      </Cluster>
    </Stack>
  );
}

// ---------------------------------------------------------------- linked

function DevicesPanel({ device }: { device: DeviceRecord }) {
  const token = device.session_token as string;
  const [devices, setDevices] = useState<DeviceSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    syncApi
      .devices(token)
      .then((response) => {
        if (!cancelled) setDevices(response.devices);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(describeError(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function revoke(target: DeviceSummary) {
    setBusy(target.device_id);
    setError(null);
    try {
      const response = await syncApi.revoke(token, target.device_id);
      setDevices(response.devices);
      if (target.current) await unlinkThisDevice();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Stack gap={3}>
      <h2 className={styles.heading}>Connected devices</h2>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {!devices && !error && <p className={styles.muted}>Loading connected devices…</p>}
      {devices && (
        <ul className={styles.devices}>
          {devices.map((item) => (
            <li key={item.device_id} className={styles.deviceRow}>
              <div className={styles.deviceText}>
                <span className={styles.deviceName}>
                  {item.device_label}
                  {item.current && <span className={styles.tag}>This device</span>}
                </span>
                <span className={styles.muted}>
                  {item.revoked_at
                    ? `Revoked ${formatTime(item.revoked_at)}`
                    : `Last seen ${formatTime(item.last_seen_at)}`}
                </span>
              </div>
              {!item.revoked_at && (
                <Button
                  size="sm"
                  variant={item.current ? 'ghost' : 'danger'}
                  loading={busy === item.device_id}
                  onClick={() => void revoke(item)}
                >
                  {item.current ? 'Unlink this device' : 'Revoke'}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Stack>
  );
}

function Linked({ device }: { device: DeviceRecord }) {
  const { status, label } = useSyncStatus();
  const state = useLiveQuery(() => db.sync_state.get(SYNC_STATE_KEY), []);
  const conflicts = useLiveQuery(() => db.sync_conflicts.count(), []) ?? 0;
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);

  async function sync() {
    setBusy(true);
    await syncNow();
    setBusy(false);
  }

  return (
    <Stack gap={5}>
      <Surface padding="sm" className={styles.statusCard}>
        <Cluster gap={3} className={styles.statusRow}>
          <StatusPill
            label={label}
            tone={TONES[status]}
            glyph={status === 'synced' ? 'check' : 'dot'}
          />
          <span className={styles.muted}>Last synced {formatTime(state?.last_synced_at)}</span>
          <Button size="sm" loading={busy} onClick={() => void sync()}>
            Sync now
          </Button>
        </Cluster>
        {state?.last_error && (
          <p className={styles.error} role="status">
            Last attempt failed: {state.last_error}. Your work is safe on this device.
          </p>
        )}
        {conflicts > 0 && (
          <Cluster gap={3} className={styles.statusRow} role="status">
            <span className={styles.muted}>
              {conflicts === 1 ? 'One change needs' : `${conflicts} changes need`} your choice.
            </span>
            <Button size="sm" variant="primary" onClick={reopenConflictPrompt}>
              Choose now
            </Button>
          </Cluster>
        )}
      </Surface>

      <DevicesPanel device={device} />

      <Stack gap={3}>
        <h2 className={styles.heading}>Your sync key</h2>
        <p className={styles.muted}>
          Use it to link another device. Keep it private: it is the only way back in.
        </p>
        {device.sync_key && showKey ? (
          <Stack gap={3}>
            <KeyPanel canonical={device.sync_key} />
            <Surface padding="sm" className={styles.warning} role="note">
              <p>{RECOVERY_WARNING}</p>
            </Surface>
            <Cluster gap={2}>
              <Button size="sm" variant="ghost" onClick={() => setShowKey(false)}>
                Hide key
              </Button>
            </Cluster>
          </Stack>
        ) : (
          <Cluster gap={2}>
            <Button size="sm" onClick={() => setShowKey(true)} disabled={!device.sync_key}>
              Show key
            </Button>
            {!device.sync_key && (
              <span className={styles.muted}>This device was linked without keeping the key.</span>
            )}
          </Cluster>
        )}
      </Stack>
    </Stack>
  );
}

/**
 * Sync across devices (spec §88–§90; SYNC-001 … SYNC-006, SYNC-010): create or enter a
 * Bloomlab Sync Key, see connected devices, revoke them, and re-show the key.
 */
export default function SyncScreen() {
  const device = useDevice();
  const [, rerender] = useState(0);
  return (
    <Stack as="section" gap={4} className={styles.screen} aria-labelledby="sync-title">
      <p className={styles.back}>
        <Link to="/">← Bloomlab</Link>
      </p>
      <h1 id="sync-title" className={styles.title}>
        Sync across devices
      </h1>
      <Link to="/settings/ai">AI settings</Link>
      {!device && (
        <p className={styles.muted} role="status">
          Preparing this device…
        </p>
      )}
      {device && !isLinked(device) && <NotLinked onLinked={() => rerender((n) => n + 1)} />}
      {device && isLinked(device) && <Linked device={device} />}
      <ExportData />
      <DeviceIdentity />
    </Stack>
  );
}
