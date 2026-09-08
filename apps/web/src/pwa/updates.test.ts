import { describe, expect, it, vi } from 'vitest';
import { createUpdates } from './updates';

function setup() {
  const reload = vi.fn();
  const fetchBuild = vi.fn().mockResolvedValue('new-build');
  const controller = createUpdates('old-build', fetchBuild, reload);
  const registration = {
    update: vi.fn().mockResolvedValue(undefined),
    waiting: {},
  } as unknown as ServiceWorkerRegistration;
  controller.registered(registration);
  const activate = vi.fn(async () => controller.controlled());
  controller.activator(activate);
  return { controller, registration, reload, activate };
}
describe('DATA-003 update freshness without destructive reloads', () => {
  it('announces a waiting update and requires a deliberate safe reload', async () => {
    const a = setup();
    expect(a.controller.snapshot().available).toBe(true);
    expect(a.reload).not.toHaveBeenCalled();
    await a.controller.apply();
    expect(a.activate).toHaveBeenCalledOnce();
    expect(a.reload).toHaveBeenCalledOnce();
    // Native controllerchange and the registration helper may both announce activation.
    a.controller.controlled();
    expect(a.controller.snapshot().applying).toBe(true);
    expect(a.reload).toHaveBeenCalledOnce();
  });
  it('defers external activation during held work until a later explicit reload', async () => {
    const a = setup();
    const release = a.controller.hold();
    a.controller.controlled();
    await a.controller.apply();
    expect(a.controller.snapshot()).toMatchObject({ available: true, blocked: 1, applying: false });
    expect(a.activate).not.toHaveBeenCalled();
    expect(a.reload).not.toHaveBeenCalled();
    release();
    release();
    expect(a.controller.snapshot().blocked).toBe(0);
    expect(a.reload).not.toHaveBeenCalled();
    await a.controller.apply();
    expect(a.reload).toHaveBeenCalledOnce();
  });
  it('rechecks safety if a recording starts while activation is in flight', async () => {
    const a = setup();
    let finish!: () => void;
    a.controller.activator(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const applying = a.controller.apply();
    await vi.waitFor(() => expect(a.controller.snapshot().applying).toBe(true));
    const release = a.controller.hold();
    Object.defineProperty(a.registration, 'waiting', { value: null });
    a.controller.controlled();
    finish();
    await applying;
    expect(a.reload).not.toHaveBeenCalled();
    release();
    expect(a.reload).not.toHaveBeenCalled();
    await a.controller.apply();
    expect(a.reload).toHaveBeenCalledOnce();
  });
  it('shows an old browser build after the network update check even if no worker event arrives', async () => {
    const reload = vi.fn();
    const controller = createUpdates('old', async () => 'deployed', reload);
    await controller.check();
    expect(controller.snapshot()).toMatchObject({
      available: true,
      latestBuild: 'deployed',
      checking: false,
    });
    expect(reload).not.toHaveBeenCalled();
  });
  it('allows explicit reload when an updated worker took control before this page attached its listener', async () => {
    const a = setup();
    Object.defineProperty(a.registration, 'waiting', { value: null });
    await a.controller.apply();
    expect(a.activate).not.toHaveBeenCalled();
    expect(a.reload).toHaveBeenCalledOnce();
  });
  it('activates the newest waiting worker even after an earlier external activation', async () => {
    const a = setup();
    a.controller.controlled();
    expect(a.reload).not.toHaveBeenCalled();
    await a.controller.apply();
    expect(a.activate).toHaveBeenCalledOnce();
    expect(a.reload).toHaveBeenCalledOnce();
  });
  it('keeps the update visible and work intact when checking or activation fails', async () => {
    const a = setup();
    vi.mocked(a.registration.update).mockRejectedValue(new Error('offline'));
    await a.controller.apply();
    expect(a.controller.snapshot()).toMatchObject({
      available: true,
      applying: false,
      error: expect.stringContaining('retry'),
    });
    expect(a.reload).not.toHaveBeenCalled();
  });
});
