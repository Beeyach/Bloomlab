/** Official API verified 2026-09-07; see the Phase 20 review for source links. Server only. */
export const VOICE_GENERATION = {
  version: 'v1',
  model: 'eleven_multilingual_v2',
  outputFormat: 'mp3_44100_128',
  mimeType: 'audio/mpeg',
  similarityBoost: 0.75,
  speakerBoost: true,
  maxBytes: 2 * 1024 * 1024,
  timeoutMs: 30_000,
} as const;
