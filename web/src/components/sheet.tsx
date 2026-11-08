import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useT } from '../lib/i18n';
import { PHONE, useMediaQuery } from '../lib/media';

/**
 * A modal sheet: on a phone it rises from the bottom and can be swiped down to close, as in
 * iOS; on a wider screen it is a centred dialog. Escape and the backdrop close it, focus moves
 * into it and returns to whatever opened it.
 *
 * @param swipe false where the sheet's content scrolls, which the same gesture would close it on;
 *              the sheet then has a close button instead
 */
export function Sheet({ open, onClose, title, children, swipe = true }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  swipe?: boolean;
}) {
  const t = useT();
  const phone = useMediaQuery(PHONE);
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  // The latest close handler, so opening and closing alone drive the effect below.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    opener.current = document.activeElement;
    const first = panel.current?.querySelector<HTMLElement>('button, [href], input, select, textarea');
    first?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [open]);

  const dragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 650) onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full max-w-md rounded-t-[28px] bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-float sm:rounded-[28px] sm:pt-5"
            initial={phone ? { y: '100%' } : { opacity: 0, scale: 0.94, y: 12 }}
            animate={phone ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={phone ? { y: '100%' } : { opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            drag={phone && swipe ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={dragEnd}
          >
            {swipe && <div aria-hidden="true" className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden" />}
            <div className="flex items-start justify-between gap-3">
              <h2 id={titleId} className="text-lg font-bold tracking-tight text-slate-900">
                {title}
              </h2>
              {!swipe && (
                <button
                  type="button"
                  aria-label={t('Close')}
                  onClick={onClose}
                  className="-mr-2 -mt-2 flex h-11 w-11 flex-none items-center justify-center rounded-full text-slate-500 hover:bg-slate-900/[0.06] hover:text-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              )}
            </div>
            <div className="mt-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
