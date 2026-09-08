import type { VoiceAssetStatus } from '@bloomlab/shared';
import { db } from '../data/db';

async function mediaRequest(path: string, signal: AbortSignal): Promise<Response> {
  const device = await db.device.toCollection().first();
  if (!device?.session_token)
    throw new Error('Link this device to review the saved voice library.');
  const response = await fetch(path, {
    signal,
    headers: { authorization: `Bearer ${device.session_token}` },
    cache: 'no-store',
  });
  if (!response.ok) {
    if (response.status === 401)
      throw new Error('This device is not linked or its session was revoked.');
    if (response.status === 404)
      throw new Error('This audio has not been saved. The authored text is shown below.');
    throw new Error('The voice library is unavailable. The authored text is still available.');
  }
  return response;
}
export async function voiceLibrary(
  character: string,
  signal: AbortSignal,
): Promise<VoiceAssetStatus[]> {
  const response = await mediaRequest(
    `/api/voice/library?character=${encodeURIComponent(character)}`,
    signal,
  );
  const result = (await response.json()) as { assets: VoiceAssetStatus[] };
  return result.assets;
}
export async function voiceAudio(asset: string, signal: AbortSignal): Promise<Blob> {
  if (!/^VA-[a-f0-9]{64}$/.test(asset)) throw new Error('Unknown voice asset.');
  const response = await mediaRequest(`/api/media/voice/${asset}`, signal);
  if (response.headers.get('content-type') !== 'audio/mpeg')
    throw new Error('Saved audio is unavailable.');
  return response.blob();
}
