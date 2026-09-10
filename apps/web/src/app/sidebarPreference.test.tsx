import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SIDEBAR_KEY, useSidebarPreference } from './useSidebarPreference';
import { SIDEBAR_WIDTH_KEY, sidebarWidth } from './sidebarWidth';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each([
  [null, 200],
  ['', 200],
  ['garbage', 200],
  ['200px', 200],
  ['{}', 200],
  ['NaN', 200],
  ['Infinity', 200],
  [Infinity, 200],
  ['-20', 176],
  ['999', 280],
  ['224', 224],
  ['201.6', 202],
])('normalizes width preference %s to %i', (stored, expected) => {
  expect(sidebarWidth(stored)).toBe(expected);
});

it('persists the chosen width independently of collapse and viewport constraints', () => {
  vi.stubGlobal('innerWidth', 1440);
  const first = renderHook(useSidebarPreference);
  expect(first.result.current.width).toBe(200);
  act(() => first.result.current.resize(280));
  act(() => first.result.current.toggle());
  expect(localStorage.getItem(SIDEBAR_WIDTH_KEY)).toBe('280');
  first.unmount();
  vi.stubGlobal('innerWidth', 768);
  const second = renderHook(useSidebarPreference);
  expect(second.result.current.collapsed).toBe(true);
  expect(second.result.current.width).toBe(232);
  act(() => second.result.current.toggle());
  expect(second.result.current.width).toBe(232);
  expect(localStorage.getItem(SIDEBAR_WIDTH_KEY)).toBe('280');
  act(() => {
    vi.stubGlobal('innerWidth', 1024);
    window.dispatchEvent(new Event('resize'));
  });
  expect(second.result.current.width).toBe(280);
});

it('follows width changes in another tab and restores default after storage clears', () => {
  const hook = renderHook(useSidebarPreference);
  localStorage.setItem(SIDEBAR_WIDTH_KEY, '224');
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: SIDEBAR_WIDTH_KEY })));
  expect(hook.result.current.width).toBe(224);
  localStorage.clear();
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })));
  expect(hook.result.current.width).toBe(200);
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
  act(() => hook.result.current.resize(216));
  expect(hook.result.current.width).toBe(216);
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
