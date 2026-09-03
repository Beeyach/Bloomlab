import { Link } from 'react-router';

import { StatusPill, type StatusGlyph, type StatusTone } from '@bloomlab/design-system';

import { useSyncStatus, type SyncStatus } from '../data';
import styles from './SyncStatusIndicator.module.css';

const PRESENTATION: Readonly<
  Record<SyncStatus, { tone: StatusTone; glyph: StatusGlyph; live?: boolean }>
> = {
  offline: { tone: 'warning', glyph: 'dash' },
  'saved-locally': { tone: 'neutral', glyph: 'check' },
  syncing: { tone: 'info', glyph: 'clock', live: true },
  synced: { tone: 'success', glyph: 'check' },
};

/**
 * The small sync indicator (spec §86, TA§8): "Saved on this device", later "Synced". Text as
 * well as tone (A11Y-005); polite live region, never a modal. Links to the sync screen.
 */
export function SyncStatusIndicator({ className }: { className?: string }) {
  const { status, label } = useSyncStatus();
  const presentation = PRESENTATION[status];
  return (
    <div className={className} role="status" aria-live="polite">
      <Link to="/sync" className={styles.link} aria-label={`${label}. Open sync settings`}>
        <StatusPill
          label={label}
          tone={presentation.tone}
          glyph={presentation.glyph}
          live={presentation.live}
        />
      </Link>
    </div>
  );
}
