export class VoiceError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  constructor(code: string, status = 503, retryable = false) {
    super(code);
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}
export const voiceJson = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
export function voiceFailure(error: unknown): Response {
  return error instanceof VoiceError
    ? voiceJson({ error: error.code }, error.status)
    : voiceJson({ error: 'media_unavailable' }, 503);
}
