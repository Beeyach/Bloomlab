import { z } from 'zod';

export const RECOVERY_MAGIC = new TextEncoder().encode('BLMR2V1\n');
export const RECOVERY_MEDIA_TYPE = 'application/vnd.bloomlab.recovery-v1';
export const RECOVERY_MAX_BYTES = 25 * 1024 * 1024;
export const RECOVERY_MAX_HEADER_BYTES = 128 * 1024;
export const RECOVERY_MAX_ASSETS = 64;

const checksum = z.string().regex(/^[a-f0-9]{64}$/);
const uuid = z.string().uuid();
const date = z.string().datetime();
const common = {
  byte_length: z
    .number()
    .int()
    .positive()
    .max(8 * 1024 * 1024),
  checksum,
  offset: z.number().int().nonnegative().max(RECOVERY_MAX_BYTES),
};

const evidence = z.strictObject({
  kind: z.literal('evidence_image'),
  id: uuid,
  mime_type: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  ...common,
  metadata: z.strictObject({
    attempt_id: uuid,
    exercise_id: z.string().min(1).max(120),
    item_key: z.string().regex(/^[a-z][a-z0-9_]{0,59}$/),
    width: z.number().int().positive().max(8192),
    height: z.number().int().positive().max(8192),
    updated_at: date,
  }),
});
const recording = z.strictObject({
  kind: z.literal('call_recording'),
  id: uuid,
  mime_type: z.enum([
    'audio/webm;codecs=opus',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]),
  ...common,
  metadata: z.strictObject({
    attempt_id: uuid,
    exercise_id: z.string().min(1).max(120),
    turn: z.number().int().min(0).max(19),
    duration_ms: z.number().int().min(1).max(55_000),
    created_at: date,
    updated_at: date,
    status: z.enum(['uploaded', 'stt_failed', 'review', 'confirmed']),
    original_transcript: z.string().max(20_000).nullable(),
    confirmed_transcript: z.string().max(20_000).nullable(),
    retain: z.boolean(),
  }),
});
const callVoice = z.strictObject({
  kind: z.literal('call_voice'),
  id: z.string().regex(/^CV-[a-f0-9]{64}$/),
  mime_type: z.literal('audio/mpeg'),
  ...common,
  metadata: z.strictObject({ attempt_id: uuid, created_at: date }),
});
const attachment = z.strictObject({
  kind: z.literal('scenario_attachment'),
  id: uuid,
  mime_type: z.enum(['application/pdf', 'text/plain', 'text/csv']),
  ...common,
  metadata: z.strictObject({
    scenario_id: z.string().min(1).max(160),
    name: z.string().min(1).max(100),
    created_at: date,
    updated_at: date,
  }),
});

export const RecoveryAssetSchema = z.discriminatedUnion('kind', [
  evidence,
  recording,
  callVoice,
  attachment,
]);
export type RecoveryAsset = z.infer<typeof RecoveryAssetSchema>;
export type RecoveryAssetInput = RecoveryAsset extends infer Asset
  ? Asset extends RecoveryAsset
    ? Omit<Asset, 'offset'> & { bytes: Uint8Array }
    : never
  : never;

const callAttempt = z.strictObject({
  attempt_id: uuid,
  exercise_id: z.string().min(1).max(120),
  content_version: z.string().min(1).max(100),
  revision: z.number().int().nonnegative(),
  state_json: z
    .string()
    .min(2)
    .max(128 * 1024),
  created_at: date,
  updated_at: date,
});

export const RecoveryHeaderSchema = z.strictObject({
  format: z.literal('bloomlab-private-binary-recovery'),
  schema_version: z.literal(1),
  backup_id: uuid,
  learner_id: uuid,
  created_at: date,
  call_attempts: z.array(callAttempt).max(64),
  assets: z.array(RecoveryAssetSchema).max(RECOVERY_MAX_ASSETS),
});
export type RecoveryHeader = z.infer<typeof RecoveryHeaderSchema>;

export class RecoveryFormatError extends Error {}

async function digest(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function encodeRecoveryArchive(
  input: Omit<RecoveryHeader, 'assets'> & {
    assets: RecoveryAssetInput[];
  },
): Promise<Uint8Array> {
  if (input.assets.length > RECOVERY_MAX_ASSETS) throw new RecoveryFormatError('too_many_assets');
  let offset = 0;
  const assets: RecoveryAsset[] = [];
  for (const { bytes, ...asset } of input.assets) {
    if (bytes.byteLength !== asset.byte_length || (await digest(bytes)) !== asset.checksum)
      throw new RecoveryFormatError('asset_checksum_mismatch');
    assets.push(RecoveryAssetSchema.parse({ ...asset, offset }));
    offset += bytes.byteLength;
    if (offset > RECOVERY_MAX_BYTES) throw new RecoveryFormatError('archive_too_large');
  }
  const header = RecoveryHeaderSchema.parse({ ...input, assets });
  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  if (headerBytes.byteLength > RECOVERY_MAX_HEADER_BYTES)
    throw new RecoveryFormatError('header_too_large');
  const total = RECOVERY_MAGIC.byteLength + 4 + headerBytes.byteLength + offset;
  if (total > RECOVERY_MAX_BYTES) throw new RecoveryFormatError('archive_too_large');
  const archive = new Uint8Array(total);
  archive.set(RECOVERY_MAGIC);
  new DataView(archive.buffer).setUint32(RECOVERY_MAGIC.byteLength, headerBytes.byteLength, false);
  const bodyStart = RECOVERY_MAGIC.byteLength + 4 + headerBytes.byteLength;
  archive.set(headerBytes, RECOVERY_MAGIC.byteLength + 4);
  for (let index = 0; index < input.assets.length; index += 1)
    archive.set(input.assets[index]!.bytes, bodyStart + assets[index]!.offset);
  return archive;
}

export async function decodeRecoveryArchive(
  archive: Uint8Array,
  expectedLearnerId: string,
): Promise<{ header: RecoveryHeader; bytes: (asset: RecoveryAsset) => Uint8Array }> {
  if (archive.byteLength > RECOVERY_MAX_BYTES) throw new RecoveryFormatError('archive_too_large');
  if (archive.byteLength < RECOVERY_MAGIC.byteLength + 4)
    throw new RecoveryFormatError('malformed_archive');
  if (RECOVERY_MAGIC.some((value, index) => archive[index] !== value))
    throw new RecoveryFormatError('unsupported_archive');
  const headerLength = new DataView(
    archive.buffer,
    archive.byteOffset,
    archive.byteLength,
  ).getUint32(RECOVERY_MAGIC.byteLength, false);
  if (!headerLength || headerLength > RECOVERY_MAX_HEADER_BYTES)
    throw new RecoveryFormatError('malformed_header');
  const bodyStart = RECOVERY_MAGIC.byteLength + 4 + headerLength;
  if (bodyStart > archive.byteLength) throw new RecoveryFormatError('malformed_header');
  let raw: unknown;
  try {
    raw = JSON.parse(
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(
        archive.subarray(RECOVERY_MAGIC.byteLength + 4, bodyStart),
      ),
    );
  } catch {
    throw new RecoveryFormatError('malformed_header');
  }
  const parsed = RecoveryHeaderSchema.safeParse(raw);
  if (!parsed.success) throw new RecoveryFormatError('unsupported_schema');
  const header = parsed.data;
  if (header.learner_id !== expectedLearnerId) throw new RecoveryFormatError('foreign_learner');
  let expectedOffset = 0;
  for (const asset of header.assets) {
    if (asset.offset !== expectedOffset) throw new RecoveryFormatError('malformed_offsets');
    const end = bodyStart + asset.offset + asset.byte_length;
    if (end > archive.byteLength) throw new RecoveryFormatError('truncated_asset');
    const body = archive.subarray(bodyStart + asset.offset, end);
    if ((await digest(body)) !== asset.checksum)
      throw new RecoveryFormatError('asset_checksum_mismatch');
    expectedOffset += asset.byte_length;
  }
  if (bodyStart + expectedOffset !== archive.byteLength)
    throw new RecoveryFormatError('unexpected_archive_bytes');
  return {
    header,
    bytes: (asset) =>
      archive.subarray(bodyStart + asset.offset, bodyStart + asset.offset + asset.byte_length),
  };
}

export async function recoveryChecksum(archive: Uint8Array): Promise<string> {
  return digest(archive);
}
