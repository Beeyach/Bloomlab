// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type { SyncEnvelope } from './sync';
import { decideMerge } from './syncMerge';

const envelope = (overrides: Partial<SyncEnvelope> = {}): SyncEnvelope => ({
  id: 'r1',
  learner_id: 'L',
  created_at: '2026-09-02T10:00:00.000Z',
  updated_at: '2026-09-02T10:00:00.000Z',
  revision: 3,
  device_id: 'A',
  deleted_at: null,
  ...overrides,
});

describe('decideMerge (SYNC-008 / SYNC-009 rules)', () => {
  it('inserts unknown records at revision 1 and fast-forwards when the base matches', () => {
    expect(decideMerge('simple', null, envelope(), 0)).toEqual({ action: 'apply', revision: 1 });
    expect(decideMerge('snapshot', envelope(), envelope({ device_id: 'B' }), 3)).toEqual({
      action: 'apply',
      revision: 4,
    });
  });

  it('simple progress: the newest valid write wins when two devices diverge', () => {
    const server = envelope({ updated_at: '2026-09-02T10:05:00.000Z' });
    const older = envelope({ device_id: 'B', updated_at: '2026-09-02T10:01:00.000Z' });
    const newer = envelope({ device_id: 'B', updated_at: '2026-09-02T10:09:00.000Z' });
    expect(decideMerge('simple', server, older, 2)).toEqual({ action: 'superseded' });
    expect(decideMerge('simple', server, newer, 2)).toEqual({ action: 'apply', revision: 4 });
  });

  it('append-only evidence merges to the union: an existing id is never rewritten', () => {
    expect(decideMerge('append', envelope(), envelope({ device_id: 'B' }), 0)).toEqual({
      action: 'superseded',
    });
  });

  it('snapshot work from another device on a stale base is a conflict, never a silent overwrite', () => {
    const server = envelope({ revision: 5, device_id: 'A' });
    expect(decideMerge('snapshot', server, envelope({ device_id: 'B' }), 4)).toEqual({
      action: 'conflict',
    });
    expect(decideMerge('snapshot', server, envelope({ device_id: 'A' }), 4)).toEqual({
      action: 'apply',
      revision: 6,
    });
    expect(decideMerge('snapshot', server, envelope({ device_id: 'B' }), 4, true)).toEqual({
      action: 'apply',
      revision: 6,
    });
  });
});
