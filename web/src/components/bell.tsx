import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../lib/api';
import { formatAgo } from '../lib/format';
import { useT } from '../lib/i18n';
import { useNow } from '../lib/live';
import { useMarkRead } from '../lib/notifications';
import { translatedNotification } from '../lib/notificationText';
import type { AppNotification } from '../lib/types';
import { useUnread } from './live';
import { Button } from './ui';

const SHOWN = 6;

function Recent({ onLeave }: { onLeave: () => void }) {
  const t = useT();
  const now = useNow(30_000);
  const notifications = useQuery({ queryKey: ['notifications'], queryFn: () => api<AppNotification[]>('/notifications') });
  const markRead = useMarkRead();
  const anyUnread = notifications.data?.some((notification) => !notification.read) ?? false;

  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-[min(23rem,calc(100vw-2rem))] origin-top-right animate-menu-in overflow-hidden rounded-2xl bg-surface shadow-float ring-1 ring-slate-900/[0.08]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-900/[0.07] px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{t('Notifications')}</h2>
        {anyUnread && (
          <Button tone="secondary" className="px-3 py-1 text-xs" disabled={markRead.isPending} onClick={() => markRead.mutate(null)}>
            {t('Mark all as read')}
          </Button>
        )}
      </div>
      <ul className="thin-scroll max-h-96 divide-y divide-slate-900/[0.05] overflow-y-auto">
        {notifications.isPending && <li className="skeleton m-3 h-16" />}
        {notifications.isError && <li className="px-4 py-6 text-center text-sm text-slate-600">{t('Could not refresh')}</li>}
        {notifications.data?.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-600">{t('You have no notifications.')}</li>}
        {notifications.data?.slice(0, SHOWN).map((notification) => {
          const translated = translatedNotification(t, notification.text);
          return (
            <li key={notification.id} className="flex gap-3 px-4 py-3">
              <span aria-hidden="true" className={`mt-1.5 h-2 w-2 flex-none rounded-full ${notification.read ? 'bg-transparent' : 'bg-teal-600'}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm leading-snug ${notification.read ? 'text-slate-600' : 'font-medium text-slate-900'}`} lang={translated === null ? 'en' : undefined}>
                  {!notification.read && <span className="sr-only">{t('Unread:')} </span>}
                  {translated ?? notification.message}
                </p>
                <p className="mt-1 text-xs text-slate-500">{formatAgo(notification.createdAt, now)}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <Link
        to="/notifications"
        onClick={onLeave}
        className="block border-t border-slate-900/[0.07] px-4 py-3 text-center text-sm font-semibold text-teal-800 hover:bg-slate-900/[0.03] focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-teal-600/30"
      >
        {t('See all notifications')}
      </Link>
    </div>
  );
}

/** The newest notifications, a press away from anywhere. Read only when opened. */
export function NotificationBell() {
  const t = useT();
  const count = useUnread() ?? 0;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPress = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPress);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPress);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={t('Recent notifications')}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/[0.05] text-slate-700 hover:bg-slate-900/[0.09] active:scale-90 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30"
      >
        <Bell aria-hidden="true" className="h-4 w-4" />
        {count > 0 && (
          <span
            key={count}
            aria-hidden="true"
            className="absolute -right-1 -top-1 inline-flex min-w-[1.1rem] animate-badge-pop items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-[1.1rem] text-white ring-2 ring-surface"
          >
            {count}
          </span>
        )}
      </button>
      {open && <Recent onLeave={() => setOpen(false)} />}
    </div>
  );
}
