import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { Button, IconRefresh, Stack, Surface } from '@bloomlab/design-system';
import { APP_VERSION, FEATURE_FLAGS } from '@bloomlab/shared';
import { SIMULATOR_VERSION } from '@bloomlab/simulator-core';

import { useFeatureFlags } from '../app/featureFlagsContext';
import { getRuntimeEnvironment } from '../app/runtime';
import { CONTENT_VERSION } from '../content/bundle';
import { ContentDiagnostics } from './ContentDiagnostics';
import { LearningDiagnostics } from './LearningDiagnostics';
import { LocalDataDiagnostics } from './LocalDataDiagnostics';
import styles from './SystemDiagnostics.module.css';

interface HealthPayload {
  ok: boolean;
  environment: string;
  versions: { app: string; content: string | null; simulator: string };
}

type HealthResult = { status: 'ok'; payload: HealthPayload } | { status: 'error'; message: string };

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

/**
 * Developer surface behind the `system_diagnostics` flag (off in production). Confirms the
 * client and the Worker agree on versions and environment — the first real end-to-end wire.
 */
export default function SystemDiagnostics() {
  const flags = useFeatureFlags();
  // Results are keyed by attempt so "loading" is derived rather than set inside the effect.
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; value: HealthResult } | null>(null);
  const health: HealthResult | { status: 'loading' } =
    result?.attempt === attempt ? result.value : { status: 'loading' };

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/health', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`API responded ${response.status}`);
        const payload = (await response.json()) as HealthPayload;
        setResult({ attempt, value: { status: 'ok', payload } });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setResult({ attempt, value: { status: 'error', message: describeError(error) } });
      });

    return () => controller.abort();
  }, [attempt]);

  const environment = getRuntimeEnvironment();

  return (
    <Stack as="section" gap={3} className={styles.screen} aria-labelledby="system-title">
      <p className={styles.back}>
        <Link to="/">← Bloomlab</Link>
      </p>
      <h1 id="system-title" className={styles.title}>
        System diagnostics
      </h1>

      <h2 className={styles.heading}>Harnesses</h2>
      <Surface as="ul" padding="sm" className={styles.list}>
        <li>
          <Link to="/system/simulator">Simulator</Link> — drive the engine: clock, queue, log,
          checkpoints, replay and reset.
        </li>
        <li>
          <Link to="/system/holo">Holographic corners</Link> — the same card nine ways, to find on a
          real tablet which one stops the sharp corner appearing.
        </li>
      </Surface>

      <h2 className={styles.heading}>Client</h2>
      <Surface as="dl" padding="sm" className={styles.list}>
        <dt>App version</dt>
        <dd>{APP_VERSION}</dd>
        <dt>Content version</dt>
        <dd>{CONTENT_VERSION}</dd>
        <dt>Simulator version</dt>
        <dd>{SIMULATOR_VERSION}</dd>
        <dt>Environment</dt>
        <dd>{environment}</dd>
        <dt>Vite mode</dt>
        <dd>{import.meta.env.MODE}</dd>
      </Surface>

      <h2 className={styles.heading}>API</h2>
      {health.status === 'loading' && (
        <p className={styles.muted} role="status">
          Checking the API…
        </p>
      )}
      {health.status === 'error' && (
        <Surface padding="sm" className={styles.problem} role="alert">
          <p>API unreachable: {health.message}</p>
          <Button
            variant="primary"
            size="sm"
            icon={<IconRefresh size={16} />}
            onClick={() => setAttempt((n) => n + 1)}
          >
            Retry
          </Button>
        </Surface>
      )}
      {health.status === 'ok' && (
        <Surface as="dl" padding="sm" className={styles.list}>
          <dt>Status</dt>
          <dd>{health.payload.ok ? 'API reachable' : 'API reported a problem'}</dd>
          <dt>Worker environment</dt>
          <dd>
            {health.payload.environment}
            {health.payload.environment !== environment && (
              <span className={styles.warning}> — differs from client</span>
            )}
          </dd>
          <dt>Worker app version</dt>
          <dd>{health.payload.versions.app}</dd>
          <dt>Worker content version</dt>
          <dd>
            {health.payload.versions.content ?? 'none'}
            {health.payload.versions.content !== CONTENT_VERSION && (
              <span className={styles.warning}> — differs from client</span>
            )}
          </dd>
          <dt>Worker simulator version</dt>
          <dd>{health.payload.versions.simulator}</dd>
        </Surface>
      )}

      <h2 className={styles.heading}>Feature flags</h2>
      <Surface as="dl" padding="sm" className={styles.list}>
        {FEATURE_FLAGS.map((flag) => (
          <div key={flag} className={styles.row}>
            <dt>{flag}</dt>
            <dd>{flags[flag] ? 'on' : 'off'}</dd>
          </div>
        ))}
      </Surface>

      <h2 className={styles.heading}>Content</h2>
      <ContentDiagnostics />

      <h2 className={styles.heading}>Learning</h2>
      <LearningDiagnostics />

      <h2 className={styles.heading}>Local data</h2>
      <LocalDataDiagnostics />
    </Stack>
  );
}
