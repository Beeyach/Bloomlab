import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SIDEBAR_KEY, useSidebarPreference } from './useSidebarPreference';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
it('defaults expanded and persists both device choices across remount', () => {
  const first = renderHook(useSidebarPreference);
  expect(first.result.current.collapsed).toBe(false);
  act(() => first.result.current.toggle());
  expect(localStorage.getItem(SIDEBAR_KEY)).toBe('collapsed');
  first.unmount();
  const second = renderHook(useSidebarPreference);
  expect(second.result.current.collapsed).toBe(true);
  act(() => second.result.current.toggle());
  second.unmount();
  expect(renderHook(useSidebarPreference).result.current.collapsed).toBe(false);
  expect(localStorage.getItem(SIDEBAR_KEY)).toBe('expanded');
});
it('storage refusal preserves an operable in-session toggle', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  const hook = renderHook(useSidebarPreference);
  act(() => hook.result.current.toggle());
  expect(hook.result.current.collapsed).toBe(true);
  act(() => hook.result.current.toggle());
  expect(hook.result.current.collapsed).toBe(false);
});
it('follows same-device tab changes and safely ignores unknown values', () => {
  localStorage.setItem(SIDEBAR_KEY, 'unknown');
  const hook = renderHook(useSidebarPreference);
  expect(hook.result.current.collapsed).toBe(false);
  localStorage.setItem(SIDEBAR_KEY, 'collapsed');
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: SIDEBAR_KEY })));
  expect(hook.result.current.collapsed).toBe(true);
  localStorage.clear();
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })));
  expect(hook.result.current.collapsed).toBe(false);
});
