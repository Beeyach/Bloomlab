// Local synthesized cues, never voice/assets/providers. Optional sound cannot reject a learner action.
export type SoundCue = 'snap' | 'connect' | 'execution' | 'selection' | 'completion';
export const SOUND_KEY = 'bloomlab.sound.v1';
let context: AudioContext | null = null;
let lastCue = -Infinity;
const active = new Set<OscillatorNode>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === 'on';
  } catch {
    return false;
  }
}
export function subscribeSound(listener: () => void) {
  listeners.add(listener);
  const changed = (event: StorageEvent) => {
    if (event.key === SOUND_KEY || event.key === null) {
      if (!soundEnabled()) stopSound();
      notify();
    }
  };
  window.addEventListener('storage', changed);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', changed);
  };
}
function stopSound() {
  for (const oscillator of active) {
    try {
      oscillator.stop();
    } catch {
      /* already stopped */
    }
  }
  active.clear();
  const old = context;
  context = null;
  try {
    void old?.close().catch(() => undefined);
  } catch {
    /* unavailable */
  }
}
export function setSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off');
  } catch {
    /* stays off if storage is unavailable */
  }
  if (!enabled) stopSound();
  notify();
  if (enabled) void playSound('selection');
}
export async function playSound(cue: SoundCue): Promise<boolean> {
  if (!soundEnabled() || document.visibilityState === 'hidden') return false;
  const now = performance.now();
  if (now - lastCue < 80) return false;
  lastCue = now;
  try {
    context ??= new AudioContext();
    const audio = context;
    if (audio.state === 'suspended') await audio.resume();
    if (!soundEnabled() || context !== audio || audio.state !== 'running') return false;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = audio.currentTime;
    const duration = cue === 'completion' ? 0.13 : 0.055;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(
      { snap: 260, connect: 390, execution: 440, selection: 330, completion: 520 }[cue],
      start,
    );
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.018, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    active.add(oscillator);
    oscillator.onended = () => {
      active.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + duration);
    return true;
  } catch {
    return false;
  }
}
