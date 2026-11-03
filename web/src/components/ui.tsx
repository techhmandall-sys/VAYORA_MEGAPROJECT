import { AlertCircle, CheckCircle2, ChevronDown, Inbox, Info, Loader2, Minus, Plus, type LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { forwardRef, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

import { msg, useT } from '../lib/i18n';
import { translateServerMessage } from '../lib/serverMessages';
import type { BookingStatus, RideStatus } from '../lib/types';
import { useLargeTitle } from './pageTitle';
import { Sheet } from './sheet';

// Fields as iOS draws them: rounded, quiet until touched, a soft glow of the tint when focused.
export const controlBase =
  'block w-full rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5 text-[15px] text-slate-900 shadow-sm ' +
  'placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/15 ' +
  'aria-[invalid=true]:border-red-600 aria-[invalid=true]:ring-red-600/15';
const control = `mt-1.5 ${controlBase}`;

interface FieldShell {
  label: string;
  error?: string;
  hint?: string;
}

export function useFieldIds(error?: string, hint?: string) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return { id, describedBy };
}

export function FieldFrame({ id, label, error, hint, children }: FieldShell & { id: string; children: ReactNode }) {
  // Validation messages come from the schemas in English; this is where they are translated.
  const t = useT();
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-slate-600">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-[13px] leading-snug text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 animate-fade-in text-[13px] font-medium text-red-700">
          {t(error)}
        </p>
      )}
    </div>
  );
}

export const TextField = forwardRef<HTMLInputElement, FieldShell & InputHTMLAttributes<HTMLInputElement>>(
  function TextField({ label, error, hint, ...input }, ref) {
    const { id, describedBy } = useFieldIds(error, hint);
    return (
      <FieldFrame id={id} label={label} error={error} hint={hint}>
        <input ref={ref} id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy} className={control} {...input} />
      </FieldFrame>
    );
  },
);

export const SelectField = forwardRef<HTMLSelectElement, FieldShell & SelectHTMLAttributes<HTMLSelectElement>>(
  function SelectField({ label, error, hint, children, ...select }, ref) {
    const { id, describedBy } = useFieldIds(error, hint);
    return (
      <FieldFrame id={id} label={label} error={error} hint={hint}>
        <select ref={ref} id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy} className={`select-ios ${control}`} {...select}>
          {children}
        </select>
      </FieldFrame>
    );
  },
);

const stepButton =
  'flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-slate-100 text-slate-900 ring-1 ring-inset ring-slate-900/[0.06] ' +
  'hover:bg-slate-200 active:scale-90 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30';

/** A number with iOS-style minus and plus beside it; the field can still be typed in. */
export const StepperField = forwardRef<
  HTMLInputElement,
  FieldShell & InputHTMLAttributes<HTMLInputElement> & { onStep: (delta: 1 | -1) => void; decreaseLabel: string; increaseLabel: string }
>(function StepperField({ label, error, hint, onStep, decreaseLabel, increaseLabel, ...input }, ref) {
  const { id, describedBy } = useFieldIds(error, hint);
  return (
    <FieldFrame id={id} label={label} error={error} hint={hint}>
      <div className="mt-1.5 flex items-center gap-2">
        <button type="button" aria-label={decreaseLabel} className={stepButton} onClick={() => onStep(-1)}>
          <Minus aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
        </button>
        <input ref={ref} id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy} className={`${controlBase} text-center tabular-nums`} {...input} />
        <button type="button" aria-label={increaseLabel} className={stepButton} onClick={() => onStep(1)}>
          <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>
    </FieldFrame>
  );
});

type Tone = 'primary' | 'secondary' | 'danger';

const tones: Record<Tone, string> = {
  primary: 'bg-accent text-white shadow-md shadow-accent/25 hover:bg-accent-strong',
  secondary: 'bg-slate-100 text-slate-900 ring-1 ring-inset ring-slate-900/[0.06] hover:bg-slate-200',
  danger: 'bg-danger text-white shadow-md shadow-danger/25 hover:bg-danger-strong',
};

/**
 * A capsule that gives under the finger, as iOS buttons do.
 *
 * @param busy the button's action is under way: it shows a spinner and cannot be pressed again
 */
export function Button({ tone = 'primary', className = '', busy = false, disabled, children, ...button }: { tone?: Tone; busy?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={
        `inline-flex select-none items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ` +
        `transition-[transform,background-color,box-shadow,opacity] duration-150 ease-settle active:scale-[0.96] ` +
        `focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30 ` +
        `disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none ${tones[tone]} ${className}`
      }
      {...button}
    >
      {busy && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/** Someone's initials on the role's tint. */
export function Avatar({ initials, size = 'md' }: { initials: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base' };
  return (
    <span aria-hidden="true" className={`inline-flex flex-none items-center justify-center rounded-full bg-tint font-bold text-white shadow-sm ${sizes[size]}`}>
      {initials}
    </span>
  );
}

/** One choice of a few, drawn as pills, with a marker that slides to the one chosen. */
export function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div>
      <p id={id} className="text-[13px] font-medium text-slate-600">
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={id} className="no-scrollbar mt-1.5 flex gap-1 overflow-x-auto rounded-full bg-slate-900/[0.05] p-1">
        {options.map((option) => {
          const chosen = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={chosen}
              onClick={() => onChange(option.value)}
              className={`relative shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30 ${
                chosen ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {chosen && (
                <motion.span
                  layoutId={`segment-${id}`}
                  aria-hidden="true"
                  transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                  className="absolute inset-0 rounded-full bg-surface shadow-sm ring-1 ring-slate-900/[0.06]"
                />
              )}
              <span className="relative">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** How full something is, as a thin bar that glides when it changes. */
export function Meter({ fraction, tone = 'tint', label }: { fraction: number; tone?: 'tint' | 'amber' | 'red'; label: string }) {
  const colour = { tint: 'bg-teal-600', amber: 'bg-amber-500', red: 'bg-red-500' }[tone];
  const percent = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-1.5 overflow-hidden rounded-full bg-slate-900/[0.08]">
      <div className={`h-full rounded-full transition-[width] duration-700 ease-settle ${colour}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

/** A figure that matters, with what it counts beneath it. */
export function Stat({ icon: Icon, label, tone = 'bg-teal-100 text-teal-900', children }: { icon: LucideIcon; label: string; tone?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-slate-900/[0.04] transition-transform duration-300 ease-settle hover:-translate-y-0.5">
      <span aria-hidden="true" className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-[28px] font-bold leading-tight tracking-tight tabular-nums text-slate-900">{children}</p>
      <p className="text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}

/** More to read, folded away until asked for. It stays in the page for find-in-page and screen readers. */
export function More({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="more">
      <summary className="inline-flex items-center gap-1 rounded-full py-1 text-sm font-medium text-teal-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30">
        {label}
        <ChevronDown aria-hidden="true" className="more-chevron h-4 w-4" />
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

/** A button for actions that cannot be undone: it asks first, in a sheet, and acts only on yes. */
export function ConfirmButton({ label, confirmLabel, onConfirm, disabled, tone = 'danger' }: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  tone?: Tone;
}) {
  const t = useT();
  const [asking, setAsking] = useState(false);
  return (
    <>
      <Button tone="secondary" disabled={disabled} onClick={() => setAsking(true)}>
        {label}
      </Button>
      <Sheet open={asking} onClose={() => setAsking(false)} title={label}>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button tone="secondary" className="w-full py-3 sm:w-auto sm:py-2" onClick={() => setAsking(false)}>
            {t('Keep it')}
          </Button>
          <Button
            tone={tone}
            disabled={disabled}
            className="w-full py-3 sm:w-auto sm:py-2"
            onClick={() => {
              setAsking(false);
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </Sheet>
    </>
  );
}

const noticeIcons: Record<'error' | 'success' | 'info', LucideIcon> = { error: AlertCircle, success: CheckCircle2, info: Info };

export function Notice({ tone, children }: { tone: 'error' | 'success' | 'info'; children: ReactNode }) {
  const t = useT();
  // An error is often the server's own words: shown translated when the tables know them,
  // with any numbers kept, and as they came when not.
  const content = tone === 'error' && typeof children === 'string' ? translateServerMessage(children, t) : children;
  const style = {
    error: 'bg-red-50 text-red-800 ring-red-200',
    success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    info: 'bg-slate-100/80 text-slate-700 ring-slate-900/[0.05]',
  }[tone];
  const Icon = noticeIcons[tone];
  // Errors interrupt a screen reader; everything else waits its turn.
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex animate-pop-in items-start gap-2.5 rounded-2xl px-4 py-3 text-sm leading-relaxed ring-1 ring-inset ${style}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] flex-none" strokeWidth={2.2} />
      <span className="min-w-0 flex-1">{content}</span>
    </p>
  );
}

/** The three states every list has before it has rows. */
export function QueryState({ isPending, error, isEmpty, empty, onRetry, icon }: {
  isPending: boolean;
  error: Error | null;
  isEmpty: boolean;
  empty: string;
  onRetry: () => void;
  /** What the empty list would hold, drawn on its empty state. */
  icon?: LucideIcon;
}) {
  const t = useT();
  if (isPending) {
    // Shapes of the rows to come while they load; the words are for screen readers.
    return (
      <div role="status" className="space-y-3">
        <span className="sr-only">{t('Loading…')}</span>
        <div aria-hidden="true" className="skeleton h-20" />
        <div aria-hidden="true" className="skeleton h-20 opacity-70" />
        <div aria-hidden="true" className="skeleton h-20 opacity-40" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-3">
        <Notice tone="error">{error.message}</Notice>
        <Button tone="secondary" onClick={onRetry}>
          {t('Try again')}
        </Button>
      </div>
    );
  }
  if (isEmpty) return <EmptyState text={empty} icon={icon} />;
  return null;
}

/** The shape of a screen while its code arrives: a title and two blocks, shimmering. */
export function PageSkeleton() {
  const t = useT();
  return (
    <div aria-busy="true" className="space-y-5">
      <span className="sr-only">{t('Loading…')}</span>
      <div aria-hidden="true" className="skeleton h-9 w-56" />
      <div aria-hidden="true" className="skeleton h-36" />
      <div aria-hidden="true" className="skeleton h-24 opacity-70" />
    </div>
  );
}

/** Nothing here yet, said with a small coloured illustration instead of a bare line of text. */
export function EmptyState({ text, icon: Icon = Inbox }: { text: string; icon?: LucideIcon }) {
  return (
    <div role="status" className="flex flex-col items-center gap-4 rounded-3xl bg-surface px-6 py-10 text-center shadow-card ring-1 ring-slate-900/[0.04]">
      <div aria-hidden="true" className="relative h-20 w-20">
        <div className="absolute inset-0 rotate-6 rounded-[26px] bg-gradient-to-br from-teal-200 via-sky-100 to-amber-100" />
        <div className="absolute inset-0 -rotate-3 rounded-[26px] bg-gradient-to-tr from-amber-100/70 to-teal-100/70" />
        <div className="absolute inset-0 flex items-center justify-center rounded-[26px] bg-surface/80 shadow-sm ring-1 ring-slate-900/5">
          <Icon className="h-9 w-9 text-teal-700" strokeWidth={1.8} />
        </div>
      </div>
      <p className="max-w-sm text-[15px] leading-relaxed text-slate-600">{text}</p>
    </div>
  );
}

const statusLabel: Record<BookingStatus | RideStatus, [string, string]> = {
  PENDING: [msg('Waiting for the driver'), 'bg-amber-100 text-amber-900'],
  CONFIRMED: [msg('Confirmed'), 'bg-emerald-100 text-emerald-900'],
  REJECTED: [msg('Declined by the driver'), 'bg-slate-100 text-slate-700'],
  CANCELLED: [msg('Cancelled'), 'bg-slate-100 text-slate-700'],
  COMPLETED: [msg('Completed'), 'bg-teal-100 text-teal-900'],
  NO_SHOW: [msg('Did not board'), 'bg-red-100 text-red-900'],
  SCHEDULED: [msg('Scheduled'), 'bg-sky-100 text-sky-900'],
  IN_PROGRESS: [msg('On the road'), 'bg-amber-100 text-amber-900'],
};

/** What a status is called, to pass through `t`. */
export const statusText = (status: BookingStatus | RideStatus): string => statusLabel[status][0];

export function StatusBadge({ status }: { status: BookingStatus | RideStatus }) {
  const t = useT();
  const [label, style] = statusLabel[status];
  return (
    // Keyed by the status, so a booking that changes while on screen pops into its new state.
    <span key={status} className={`inline-flex animate-badge-pop items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}>
      {status === 'IN_PROGRESS' ? (
        <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-live-ping rounded-full bg-current" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      ) : (
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      )}
      {t(label)}
    </span>
  );
}

type ChipTone = 'slate' | 'teal' | 'amber' | 'emerald' | 'sky' | 'red';

const chipTones: Record<ChipTone, string> = {
  slate: 'bg-slate-100 text-slate-700',
  teal: 'bg-teal-100 text-teal-900',
  amber: 'bg-amber-100 text-amber-900',
  emerald: 'bg-emerald-100 text-emerald-900',
  sky: 'bg-sky-100 text-sky-900',
  red: 'bg-red-100 text-red-900',
};

/** A fact at a glance: an icon and a few words in a coloured pill. */
export function Chip({ icon: Icon, tone = 'slate', children }: { icon: LucideIcon; tone?: ChipTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${chipTones[tone]}`}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5 flex-none" strokeWidth={2.2} />
      {children}
    </span>
  );
}

/** One line of detail with its icon, as a list row in iOS would have. */
export function Detail({ icon: Icon, tone = 'text-slate-600', children }: { icon: LucideIcon; tone?: string; children: ReactNode }) {
  return (
    <p className={`flex items-start gap-2 text-sm ${tone}`}>
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none opacity-70" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/**
 * A screen: a large title, as in iOS, and its sections arriving one after another.
 *
 * @param aside beside the title: how current the screen is, or its main action
 */
export function Page({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  const heading = useLargeTitle(title);
  return (
    <section className="stagger space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 ref={heading} className="text-[28px] font-bold leading-tight tracking-tight text-slate-900 sm:text-[34px]">{title}</h1>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** @param glow what is under way right now stands out, in the role's tint */
export function Card({ children, glow = false }: { children: ReactNode; glow?: boolean }) {
  return (
    <div
      className={`rounded-2xl bg-surface p-4 transition-shadow duration-300 sm:p-5 ${
        glow ? 'shadow-glow ring-2 ring-teal-600/40' : 'shadow-card ring-1 ring-slate-900/[0.04] hover:shadow-float'
      }`}
    >
      {children}
    </div>
  );
}
