import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ToastTone = 'success' | 'error' | 'info';

interface ToastOptions {
  /** Pressing the toast does this: where it is about. */
  onClick?: () => void;
  lingerMs?: number;
}

interface Toast extends ToastOptions {
  id: number;
  text: string;
  tone: ToastTone;
}

type ShowToast = (text: string, tone?: ToastTone, options?: ToastOptions) => void;

// Outside a provider a toast simply does not show: nothing breaks.
const ToastContext = createContext<ShowToast>(() => {});

const SHOWN_FOR_MS = 3600;

const icons = { success: CheckCircle2, error: XCircle, info: Info };
const tones = { success: 'text-emerald-800', error: 'text-red-700', info: 'text-teal-800' };

/**
 * Brief confirmations that float in at the top and leave on their own, like an iOS banner.
 * They are announced politely; anything a reader must act on stays on the page instead.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);

  const show = useCallback<ShowToast>((text, tone = 'success', options = {}) => {
    const id = ++next.current;
    setToasts((shown) => [...shown.slice(-2), { id, text, tone, ...options }]);
    window.setTimeout(() => setToasts((shown) => shown.filter((toast) => toast.id !== id)), options.lingerMs ?? SHOWN_FOR_MS);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {createPortal(
        // A polite live region, not a second "status" role beside the page's own notices.
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4"
        >
          <AnimatePresence initial={false}>
            {toasts.map((toast) => {
              const Icon = icons[toast.tone];
              const body = (
                <>
                  <Icon aria-hidden="true" className={`mt-0.5 h-5 w-5 flex-none ${tones[toast.tone]}`} />
                  <span>{toast.text}</span>
                </>
              );
              return (
                <motion.div
                  key={toast.id}
                  layout
                  initial={{ opacity: 0, y: -24, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -16, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                  className="glass pointer-events-auto max-w-md rounded-[1.4rem] text-sm font-semibold text-slate-900 shadow-float ring-1 ring-slate-900/[0.06]"
                >
                  {toast.onClick ? (
                    <button
                      type="button"
                      onClick={toast.onClick}
                      className="flex w-full items-start gap-2.5 rounded-[1.4rem] px-4 py-2.5 text-left hover:bg-slate-900/[0.04] focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30"
                    >
                      {body}
                    </button>
                  ) : (
                    <div className="flex items-start gap-2.5 px-4 py-2.5">{body}</div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
