import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureAudio, recordingMime } from './recording';
import { CALL_LIMITS } from '@bloomlab/shared';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function microphone() {
  const stop = vi.fn();
  const media = { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) };
  class Recorder {
    static isTypeSupported = (mime: string) => mime.startsWith('audio/webm');
    state = 'inactive';
    ondataavailable?: (event: { data: Blob }) => void;
    onstop?: () => void;
    start() {
      this.state = 'recording';
    }
    stop() {
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])]) });
      this.onstop?.();
    }
  }
  return { media, stop, Recorder: Recorder as unknown as typeof MediaRecorder };
}
describe('CALL-002 bounded microphone capture', () => {
  it('negotiates WebM Opus first, MP4 AAC next, and refuses unsupported formats', () => {
    expect(recordingMime({ isTypeSupported: () => true })).toBe('audio/webm;codecs=opus');
    expect(recordingMime({ isTypeSupported: (mime) => mime.startsWith('audio/mp4') })).toBe(
      'audio/mp4;codecs=mp4a.40.2',
    );
    expect(recordingMime({ isTypeSupported: (mime) => mime === 'audio/mp4' })).toBe('audio/mp4');
    expect(recordingMime({ isTypeSupported: () => false })).toBeNull();
    expect(recordingMime(undefined)).toBeNull();
  });
  it('records only after invocation, produces the negotiated format, and releases every track', async () => {
    vi.stubGlobal('Blob', NodeBlob);
    const mic = microphone();
    expect(mic.media.getUserMedia).not.toHaveBeenCalled();
    const capture = await captureAudio(mic.media, mic.Recorder);
    expect(mic.media.getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
    capture.stop();
    const saved = await capture.finished;
    expect(saved.mime_type).toBe('audio/webm;codecs=opus');
    expect(saved.blob.type).toBe(saved.mime_type);
    expect(saved.stop_reason).toBe('manual');
    expect(mic.stop).toHaveBeenCalledTimes(1);
  });
  it('stops at 55 seconds and explains why without exceeding the upload duration limit', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Blob', NodeBlob);
    const mic = microphone();
    const capture = await captureAudio(mic.media, mic.Recorder);
    await vi.advanceTimersByTimeAsync(CALL_LIMITS.maxDurationMs);
    const saved = await capture.finished;
    expect(saved.stop_reason).toBe('duration');
    expect(saved.duration_ms).toBeLessThanOrEqual(55_000);
    expect(mic.stop).toHaveBeenCalledTimes(1);
  });
  it('handles denied permission without creating a recording or inventing saved audio', async () => {
    const mic = microphone();
    mic.media.getUserMedia.mockRejectedValue(new Error('NotAllowedError'));
    await expect(captureAudio(mic.media, mic.Recorder)).rejects.toThrow(
      'Microphone permission was not granted',
    );
    expect(mic.stop).not.toHaveBeenCalled();
  });
});
