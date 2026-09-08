import { BUILD_ID } from '@bloomlab/shared';

interface UpdateState {
  available: boolean;
  applying: boolean;
  checking: boolean;
  blocked: number;
  latestBuild: string | null;
  error: string | null;
  checkError: string | null;
}

/** Reload is always an explicit action. A service worker taking control never grants
 * permission to throw away the page's in-memory work, including work in another open tab. */
export function createUpdates(
  buildId = BUILD_ID,
  fetchBuild = async (): Promise<string | null> => {
    const response = await fetch('/api/health', {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('Update check unavailable');
    const data = (await response.json()) as { build_id?: unknown };
    return typeof data.build_id === 'string' && /^[a-zA-Z0-9._-]{1,80}$/.test(data.build_id)
      ? data.build_id
      : null;
  },
  reload = () => window.location.reload(),
) {
  let state: UpdateState = {
    available: false,
    applying: false,
    checking: false,
    blocked: 0,
    latestBuild: null,
    error: null,
    checkError: null,
  };
  let registration: ServiceWorkerRegistration | undefined;
  let activate: (() => Promise<void>) | undefined;
  let controlled = false;
  let requested = false;
  let reloading = false;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<UpdateState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  function finish() {
    if (reloading) return;
    clearTimeout(deadline);
    if (requested && !state.blocked) {
      reloading = true;
      reload();
    } else {
      requested = false;
      publish({ available: true, applying: false });
    }
  }
  const api = {
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    hold() {
      let held = true;
      publish({ blocked: state.blocked + 1 });
      return () => {
        if (!held) return;
        held = false;
        publish({ blocked: state.blocked - 1 });
      };
    },
    available() {
      publish({ available: true });
    },
    controlled() {
      controlled = true;
      publish({ available: true });
      finish();
    },
    registered(value: ServiceWorkerRegistration | undefined) {
      registration = value;
      if (value?.waiting) api.available();
      void api.check();
    },
    activator(value: () => Promise<void>) {
      activate = value;
    },
    async check() {
      if (state.checking) return;
      publish({ checking: true });
      const [worker, build] = await Promise.allSettled([registration?.update(), fetchBuild()]);
      if (registration?.waiting) api.available();
      if (build.status === 'fulfilled' && build.value) {
        publish({
          latestBuild: build.value,
          ...(build.value !== buildId ? { available: true } : {}),
        });
      }
      publish({
        checking: false,
        checkError:
          worker.status === 'rejected' || build.status === 'rejected'
            ? 'Could not check for updates. Reconnect and try again.'
            : null,
      });
    },
    async apply() {
      if (!state.available || state.blocked || state.applying) return;
      requested = true;
      publish({ applying: true, error: null, checkError: null });
      if (!registration || (controlled && !registration.waiting && !registration.installing)) {
        finish();
        return;
      }
      try {
        await registration.update();
        if (state.blocked) {
          requested = false;
          publish({ applying: false });
          return;
        }
        if (registration.waiting && activate) {
          deadline = setTimeout(() => {
            requested = false;
            publish({
              applying: false,
              error: 'The update is still downloading. Try again when connected.',
            });
          }, 10000);
          await activate();
        } else if (controlled || !registration.installing) finish();
        else {
          requested = false;
          publish({
            applying: false,
            error: 'The update is still downloading. Try again when connected.',
          });
        }
      } catch {
        clearTimeout(deadline);
        requested = false;
        publish({
          applying: false,
          error: 'The update could not finish. Your work is still here; retry when connected.',
        });
      }
    },
  };
  return api;
}

export const updates = createUpdates();

/** Safari may keep a page alive across deployments. Check on return, reconnect and once per
 * minute while visible; neither this poll nor controllerchange reloads an unconsenting page. */
export function watchUpdates() {
  const check = () => {
    if (document.visibilityState === 'visible') void updates.check();
  };
  let hadController = Boolean(navigator.serviceWorker?.controller);
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (hadController) updates.controlled();
    hadController = true;
  });
  window.addEventListener('online', check);
  window.addEventListener('focus', check);
  document.addEventListener('visibilitychange', check);
  setInterval(check, 60000);
  check();
}
