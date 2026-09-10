import { useCallback, useEffect, useState } from 'react';
import { SIDEBAR_WIDTH_KEY, sidebarWidth, useSidebarMaximum } from './sidebarWidth';

// Device presentation only, like bloomlab.sound.v1. Never learner progress or sync evidence.
export const SIDEBAR_KEY = 'bloomlab.sidebar.v1';
function readCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

function readWidth() {
  try {
    return sidebarWidth(localStorage.getItem(SIDEBAR_WIDTH_KEY));
  } catch {
    return sidebarWidth(null);
  }
}

export function useSidebarPreference() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [preferredWidth, setPreferredWidth] = useState(readWidth);
  const maximum = useSidebarMaximum();
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === SIDEBAR_KEY || event.key === null) setCollapsed(readCollapsed());
      if (event.key === SIDEBAR_WIDTH_KEY || event.key === null) setPreferredWidth(readWidth());
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? 'collapsed' : 'expanded');
    } catch {
      // Storage refusal must not prevent navigation; retain the preference for this session.
    }
  };
  const resize = useCallback((value: number) => {
    const width = sidebarWidth(value);
    setPreferredWidth(width);
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
    } catch {
      // Like the collapsed choice, width remains usable when device storage is blocked.
    }
  }, []);
  return { collapsed, toggle, width: Math.min(preferredWidth, maximum), maximum, resize };
}
