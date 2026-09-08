export class CallError extends Error {
  constructor(
    public code: string,
    public status = 503,
  ) {
    super(code);
  }
}
export function callJson(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' },
  });
}
/** Never expose upstream responses, credentials, transcript text or request headers in errors. */
export function callFailure(error: unknown): Response {
  return callJson(
    { error: error instanceof CallError ? error.code : 'call_unavailable' },
    error instanceof CallError ? error.status : 503,
  );
}
export async function boundedBody(
  body: ReadableStream<Uint8Array> | null,
  limit: number,
): Promise<ArrayBuffer> {
  if (!body) throw new CallError('empty_body', 400);
  const reader = body.getReader();
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new CallError('body_too_large', 413);
      }
      parts.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return bytes.buffer;
}
export async function callBody(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json')
    throw new CallError('json_required', 415);
  try {
    return JSON.parse(new TextDecoder().decode(await boundedBody(request.body, 24_000)));
  } catch (error) {
    if (error instanceof CallError) throw error;
    throw new CallError('invalid_json', 400);
  }
}
