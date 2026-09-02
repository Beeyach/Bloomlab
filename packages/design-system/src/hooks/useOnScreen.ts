import { useEffect, useState, type RefObject } from 'react';

/**
 * True while the element intersects the viewport. Live animations use it so nothing animates
 * off-screen (MOT-004, PERF-003). Environments without IntersectionObserver report visible.
 */
export function useOnScreen(ref: RefObject<Element | null>): boolean {
  const [onScreen, setOnScreen] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      setOnScreen(entry?.isIntersecting ?? true);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return onScreen;
}
