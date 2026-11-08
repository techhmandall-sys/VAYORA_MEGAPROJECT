import { useEffect, useRef } from 'react';

/**
 * Marks a row that scrolls sideways with which of its ends has more to show, so the CSS class
 * `scroll-fade` can fade that edge (index.css). Without it, a cut-off chip looks like a mistake
 * rather than a row to swipe.
 */
export function useScrollFade<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const row = ref.current;
    if (!row) return undefined;
    const update = () => {
      row.dataset.fadeStart = String(row.scrollLeft > 4);
      row.dataset.fadeEnd = String(row.scrollLeft + row.clientWidth < row.scrollWidth - 4);
    };
    update();
    row.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(row);
    return () => {
      row.removeEventListener('scroll', update);
      observer?.disconnect();
    };
  }, []);
  return ref;
}
