import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function audioMock(state = 'running') {
  const oscillators: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  const gain = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
  };
  const audio = {
    state,
    currentTime: 10,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createGain: vi.fn(() => gain),
    createOscillator: vi.fn(() => {
      const oscillator = {
        start: vi.fn(),
        stop: vi.fn(),
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      oscillators.push(oscillator);
      return oscillator;
    }),
  };
  const Constructor = vi.fn(function () {
    return audio;
  });
  vi.stubGlobal('AudioContext', Constructor);
  return { audio, gain, oscillators, Constructor };
}
it('defaults off with no audio context, provider or network work', async () => {
  const { Constructor } = audioMock();
  const fetch = vi.spyOn(globalThis, 'fetch');
  const sound = await import('./sound');
  expect(sound.soundEnabled()).toBe(false);
  expect(await sound.playSound('completion')).toBe(false);
  expect(Constructor).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it('persists explicit opt-in and synthesizes only bounded quiet one-shots for all five cues', async () => {
  const { audio, gain, oscillators } = audioMock();
  let now = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => (now += 100));
  const sound = await import('./sound');
  sound.setSoundEnabled(true);
  expect(localStorage.getItem(sound.SOUND_KEY)).toBe('on');
  for (const cue of ['snap', 'connect', 'execution', 'selection', 'completion'] as const)
    expect(await sound.playSound(cue)).toBe(true);
  expect(oscillators).toHaveLength(6);
  expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.018, 10.008);
  expect(oscillators.at(-1)!.stop).toHaveBeenCalledWith(10.13);
  sound.setSoundEnabled(false);
  expect(sound.soundEnabled()).toBe(false);
  expect(oscillators.every((o) => o.stop.mock.calls.some((args) => args.length === 0))).toBe(true);
  expect(audio.close).toHaveBeenCalled();
  expect(await sound.playSound('execution')).toBe(false);
});
it('throttles rapid events rather than generating constant chatter', async () => {
  const { oscillators } = audioMock();
  vi.spyOn(performance, 'now').mockReturnValue(1000);
  const sound = await import('./sound');
  sound.setSoundEnabled(true);
  expect(await sound.playSound('snap')).toBe(false);
  expect(oscillators).toHaveLength(1);
});
it('cannot sound after mute while an audio resume is pending', async () => {
  const { audio } = audioMock('suspended');
  let resume!: () => void;
  audio.resume.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        resume = resolve;
      }),
  );
  const sound = await import('./sound');
  sound.setSoundEnabled(true);
  sound.setSoundEnabled(false);
  audio.state = 'running';
  resume();
  await Promise.resolve();
  expect(audio.createOscillator).not.toHaveBeenCalled();
});
it('fails safely when audio or local storage is unavailable', async () => {
  const { Constructor } = audioMock();
  Constructor.mockImplementation(() => {
    throw new Error('Audio unavailable');
  });
  const sound = await import('./sound');
  sound.setSoundEnabled(true);
  await expect(sound.playSound('completion')).resolves.toBe(false);
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Storage denied');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Storage denied');
  });
  expect(() => sound.setSoundEnabled(true)).not.toThrow();
  expect(sound.soundEnabled()).toBe(false);
});
it('honors cross-tab mute and clears active audio immediately', async () => {
  const { audio } = audioMock();
  const sound = await import('./sound');
  const listener = vi.fn();
  const off = sound.subscribeSound(listener);
  sound.setSoundEnabled(true);
  localStorage.setItem(sound.SOUND_KEY, 'off');
  window.dispatchEvent(new StorageEvent('storage', { key: sound.SOUND_KEY }));
  expect(audio.close).toHaveBeenCalled();
  expect(sound.soundEnabled()).toBe(false);
  off();
});
