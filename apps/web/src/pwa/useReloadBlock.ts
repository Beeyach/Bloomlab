import { useLayoutEffect } from 'react';
import { updates } from './updates';

export function useReloadBlock(blocked: boolean) {
  useLayoutEffect(() => (blocked ? updates.hold() : undefined), [blocked]);
}
