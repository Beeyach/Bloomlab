import { useEffect, useState } from 'react';

// Device presentation only, like bloomlab.sound.v1. Never learner progress or sync evidence.
export const SIDEBAR_KEY = 'bloomlab.sidebar.v1';
function readCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

export function useSidebarPreference() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === SIDEBAR_KEY || event.key === null) setCollapsed(readCollapsed());
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
  return { collapsed, toggle };
}
