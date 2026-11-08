import { Sparkles } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { useT } from '../lib/i18n';
import { load, preload } from '../pageLoaders';
import { Sheet } from './sheet';

// The chat's code arrives when the panel is first opened, or a moment before, on a point or focus.
const AssistantChat = lazy(() => load.assistant().then((module) => ({ default: module.AssistantChat })));

/**
 * The assistant one tap away on every screen: it opens over the screen, so a question never
 * costs the reader their place. Not on the Assistant page, which is the same conversation.
 */
export function AssistantBubble() {
  const t = useT();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  if (pathname === '/assistant') return null;
  const warm = () => preload('/assistant');
  return (
    <>
      <button
        type="button"
        aria-label={t('Open the assistant')}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        onMouseEnter={warm}
        onFocus={warm}
        onTouchStart={warm}
        // Above a phone's tab bar; in the corner on a wider screen.
        className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 min-w-14 items-center justify-center gap-2 rounded-full bg-accent px-4 text-white shadow-float transition-transform duration-150 ease-settle active:scale-[0.94] focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/40 sm:bottom-6 sm:right-6 print:hidden"
      >
        <Sparkles aria-hidden="true" className="h-6 w-6" />
        <span className="hidden text-[15px] font-semibold sm:inline">{t('Assistant')}</span>
      </button>
      {/* No swipe to close: on a phone the same gesture scrolls the conversation. */}
      <Sheet open={open} onClose={() => setOpen(false)} title={t('Assistant')} swipe={false}>
        <Suspense fallback={<p className="text-sm text-slate-500">{t('Loading…')}</p>}>
          <AssistantChat inPanel />
        </Suspense>
      </Sheet>
    </>
  );
}
