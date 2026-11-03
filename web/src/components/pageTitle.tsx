import { createContext, useContext, useEffect, useRef, useState } from 'react';

/**
 * iOS's large titles: a screen's title starts large in the page, and once it has scrolled under
 * the bar the bar shows it small instead. The page reports which; the bar shows it.
 */
export const BarTitleContext = createContext<(title: string | null) => void>(() => {});

/** The bar's height in pixels: a title scrolled under it counts as gone. */
const BAR = 56;

/** Watches a screen's large title and tells the bar whenever it has scrolled out of sight. */
export function useLargeTitle(title: string) {
  const ref = useRef<HTMLHeadingElement>(null);
  const show = useContext(BarTitleContext);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => show(!entry.isIntersecting && entry.boundingClientRect.top < BAR ? title : null),
      { rootMargin: `-${BAR}px 0px 0px 0px` },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      show(null);
    };
  }, [title, show]);
  return ref;
}

/** Whether the page has scrolled at all: the bar is clear at the top and frosted once content is under it. */
export function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 2);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  return scrolled;
}

/**
 * The small title in the bar, in whatever room the bar's own buttons leave, so it can never run
 * under the emergency button. Kept while it fades out, so it never blanks first. Hidden from
 * screen readers: the page's own heading is the real one.
 */
export function BarTitle({ title }: { title: string | null }) {
  const [last, setLast] = useState(title);
  useEffect(() => {
    if (title) setLast(title);
  }, [title]);
  return (
    <span aria-hidden="true" className="pointer-events-none min-w-0 flex-1">
      <span
        className={`block truncate text-[17px] font-semibold tracking-tight text-slate-900 transition-[opacity,transform] duration-300 ease-settle ${
          title ? 'translate-y-0 opacity-100' : 'translate-y-1.5 opacity-0'
        }`}
      >
        {last}
      </span>
    </span>
  );
}
