import { describe, expect, it } from 'vitest';

import { freshDatabase } from './testing';
import {
  DEVICE_LABEL_MAX,
  defaultDeviceLabel,
  ensureDevice,
  renameDevice,
  requestPersistentStorage,
} from './device';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('device identity', () => {
  it('creates one device record on first run and keeps it afterwards', async () => {
    const database = freshDatabase();
    const first = await ensureDevice(database);
    expect(first.device_id).toMatch(UUID);
    expect(first.learner_id).toMatch(/^local:[0-9a-f-]{36}$/);
    expect(first.created_at).toBe(first.last_seen_at);
    expect(first.storage_persisted).toBeNull();

    const second = await ensureDevice(database);
    expect(second.device_id).toBe(first.device_id);
    expect(second.learner_id).toBe(first.learner_id);
    expect(second.last_seen_at >= first.last_seen_at).toBe(true);
    expect(await database.device.count()).toBe(1);
  });

  it('derives a friendly default label from the platform', () => {
    expect(
      defaultDeviceLabel({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/152' }),
    ).toBe('Windows desktop');
    expect(
      defaultDeviceLabel({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Chrome' }),
    ).toBe('Android phone');
    expect(defaultDeviceLabel({ userAgentData: { platform: 'Android', mobile: false } })).toBe(
      'Android tablet',
    );
    expect(defaultDeviceLabel({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0)' })).toBe('iPad');
    expect(defaultDeviceLabel({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)' })).toBe(
      'Mac desktop',
    );
    expect(defaultDeviceLabel({ userAgent: 'SomethingElse/1.0' })).toBe('This device');
  });

  it('renames the device, trimming and capping the label', async () => {
    const database = freshDatabase();
    const renamed = await renameDevice('  Studio laptop  ', database);
    expect(renamed.label).toBe('Studio laptop');
    expect((await ensureDevice(database)).label).toBe('Studio laptop');

    const long = await renameDevice('x'.repeat(DEVICE_LABEL_MAX + 10), database);
    expect(long.label).toHaveLength(DEVICE_LABEL_MAX);

    await expect(renameDevice('   ', database)).rejects.toThrow(/needs a name/);
  });

  it('records the persistent-storage answer without ever blocking', async () => {
    const database = freshDatabase();
    expect(await requestPersistentStorage(database, undefined)).toBeNull();
    expect(await requestPersistentStorage(database, { persist: async () => true })).toBe(true);
    expect((await ensureDevice(database)).storage_persisted).toBe(true);
    expect(
      await requestPersistentStorage(database, {
        persist: async () => {
          throw new Error('denied');
        },
      }),
    ).toBeNull();
  });
});
