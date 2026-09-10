import { useSyncExternalStore } from 'react';
import { Button } from '@bloomlab/design-system';
import { setSoundEnabled, soundEnabled, subscribeSound } from './sound';
import styles from './moments.module.css';

export function SoundToggle() {
  const enabled = useSyncExternalStore(subscribeSound, soundEnabled, () => false);
  return (
    <Button
      className={styles.sound}
      size="sm"
      variant="ghost"
      aria-label="Sound cues"
      aria-pressed={enabled}
      onClick={() => setSoundEnabled(!enabled)}
    >
      Sound {enabled ? 'on' : 'off'}
    </Button>
  );
}
