import { CALL_LIMITS, CALL_MIME_TYPES, type CallMime } from '@bloomlab/shared';

export interface CapturedAudio {
  blob: Blob;
  mime_type: CallMime;
  duration_ms: number;
  stop_reason: 'manual' | 'duration' | 'size';
}
export interface Capture {
  stop(): void;
  finished: Promise<CapturedAudio>;
}
export function recordingMime(
  recorder: Pick<typeof MediaRecorder, 'isTypeSupported'> | undefined,
): CallMime | null {
  return recorder ? (CALL_MIME_TYPES.find((mime) => recorder.isTypeSupported(mime)) ?? null) : null;
}
/** Called only by an intentional Record action. No microphone permission on mount or resume. */
export async function captureAudio(
  media: Pick<MediaDevices, 'getUserMedia'> = navigator.mediaDevices,
  Recorder: typeof MediaRecorder | undefined = globalThis.MediaRecorder,
): Promise<Capture> {
  const mime = recordingMime(Recorder);
  if (!mime || !media?.getUserMedia || !Recorder)
    throw new Error(
      'This browser cannot record a supported audio format. Try a browser with WebM Opus or MP4 AAC recording.',
    );
  let stream: MediaStream;
  try {
    stream = await media.getUserMedia({ audio: true, video: false });
  } catch {
    throw new Error(
      'Microphone permission was not granted. Allow microphone access for this site, then choose Record again.',
    );
  }
  const release = () => stream.getTracks().forEach((track) => track.stop());
  let recorder: MediaRecorder;
  try {
    recorder = new Recorder(stream, { mimeType: mime, audioBitsPerSecond: 96_000 });
  } catch {
    release();
    throw new Error('Recording could not start in this browser. Your call is saved.');
  }
  const parts: Blob[] = [];
  let size = 0;
  let reason: CapturedAudio['stop_reason'] = 'manual';
  let timer: ReturnType<typeof setTimeout>;
  const started = performance.now();
  const stop = () => {
    if (recorder.state !== 'inactive') recorder.stop();
  };
  const finished = new Promise<CapturedAudio>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size) {
        parts.push(event.data);
        size += event.data.size;
      }
      // Leave room for the final container chunk; an oversize final chunk is rejected below.
      if (size >= CALL_LIMITS.maxBytes - 256 * 1024) {
        reason = 'size';
        stop();
      }
    };
    recorder.onerror = () => {
      clearTimeout(timer);
      release();
      reject(new Error('Recording was interrupted. Your call is saved; record this turn again.'));
    };
    recorder.onstop = () => {
      clearTimeout(timer);
      release();
      const blob = new Blob(parts, { type: mime });
      if (!blob.size || blob.size > CALL_LIMITS.maxBytes) {
        reject(new Error('This recording is empty or too large. Record a shorter reply.'));
        return;
      }
      resolve({
        blob,
        mime_type: mime,
        duration_ms: Math.max(
          1,
          Math.min(CALL_LIMITS.maxDurationMs, Math.round(performance.now() - started)),
        ),
        stop_reason: reason,
      });
    };
    try {
      recorder.start(250);
      timer = setTimeout(() => {
        reason = 'duration';
        stop();
      }, CALL_LIMITS.maxDurationMs);
    } catch {
      release();
      reject(new Error('Recording could not start. Try again.'));
    }
  });
  return { stop, finished };
}
