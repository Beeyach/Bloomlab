import { describe, expect, it } from 'vitest';
import {
  decodeRecoveryArchive,
  encodeRecoveryArchive,
  RECOVERY_MAGIC,
  RECOVERY_MAX_BYTES,
} from './format';

const learner = '00000000-0000-4000-8000-000000000001';
const backup = '00000000-0000-4000-8000-000000000002';
const asset = '00000000-0000-4000-8000-000000000003';
const bytes = new TextEncoder().encode('case notes');
const checksum = '10b6d45d5ae1eede2ed63109edf0084363f860b6a55db00bf434dd917d47cf87';

async function archive() {
  return encodeRecoveryArchive({
    format: 'bloomlab-private-binary-recovery',
    schema_version: 1,
    backup_id: backup,
    learner_id: learner,
    created_at: '2026-09-10T12:00:00.000Z',
    call_attempts: [],
    assets: [
      {
        kind: 'scenario_attachment',
        id: asset,
        mime_type: 'text/plain',
        byte_length: bytes.byteLength,
        checksum,
        metadata: {
          scenario_id: 'SC-test',
          name: 'notes.txt',
          created_at: '2026-09-10T12:00:00.000Z',
          updated_at: '2026-09-10T12:00:00.000Z',
        },
        bytes,
      },
    ],
  });
}

describe('DATA-006 bounded binary recovery format', () => {
  it('round-trips a strict v1 manifest without base64, sync key or provider secret fields', async () => {
    const value = await archive();
    const decoded = await decodeRecoveryArchive(value, learner);
    expect(decoded.header.assets).toHaveLength(1);
    expect(decoded.bytes(decoded.header.assets[0]!)).toEqual(bytes);
    const headerLength = new DataView(value.buffer).getUint32(RECOVERY_MAGIC.byteLength, false);
    const header = new TextDecoder().decode(
      value.subarray(RECOVERY_MAGIC.byteLength + 4, RECOVERY_MAGIC.byteLength + 4 + headerLength),
    );
    expect(header).not.toMatch(/sync.?key|session.?token|provider.?key|base64/i);
  });

  it('rejects malformed/versionless, foreign, wrong-checksum, unsupported and oversized input', async () => {
    const valid = await archive();
    await expect(decodeRecoveryArchive(valid, crypto.randomUUID())).rejects.toThrow(
      'foreign_learner',
    );
    const changed = valid.slice();
    changed[changed.length - 1] = changed[changed.length - 1]! ^ 1;
    await expect(decodeRecoveryArchive(changed, learner)).rejects.toThrow(
      'asset_checksum_mismatch',
    );
    const magic = valid.slice();
    magic[0] = magic[0]! ^ 1;
    await expect(decodeRecoveryArchive(magic, learner)).rejects.toThrow('unsupported_archive');
    await expect(
      decodeRecoveryArchive(new Uint8Array(RECOVERY_MAX_BYTES + 1), learner),
    ).rejects.toThrow('archive_too_large');
    await expect(
      encodeRecoveryArchive({
        format: 'bloomlab-private-binary-recovery',
        schema_version: 1,
        backup_id: backup,
        learner_id: learner,
        created_at: '2026-09-10T12:00:00.000Z',
        call_attempts: [],
        assets: [
          {
            kind: 'scenario_attachment',
            id: asset,
            mime_type: 'application/zip',
            byte_length: bytes.length,
            checksum,
            metadata: {
              scenario_id: 'SC-test',
              name: 'bad.zip',
              created_at: '2026-09-10T12:00:00.000Z',
              updated_at: '2026-09-10T12:00:00.000Z',
            },
            bytes,
          },
        ],
      } as never),
    ).rejects.toThrow();
  });
});
