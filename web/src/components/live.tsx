import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, WifiOff } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../lib/api';
import { formatAgo } from '../lib/format';
import { useT, useUnits } from '../lib/i18n';
import { LIVE_MS, useNow, useOnline } from '../lib/live';
import { translatedNotification } from '../lib/notificationText';
import type { AppNotification } from '../lib/types';
import { useToast } from './toast';

/** A small dot that pulses while something is really live, and is still when it is not. */
export function LiveDot({ state = 'live' }: { state?: 'live' | 'waiting' | 'lost' }) {
  const colour = state === 'live' ? 'bg-emerald-500' : state === 'waiting' ? 'bg-amber-500' : 'bg-red-500';
  return (
    <span aria-hidden="true" className="relative flex h-2 w-2 flex-none">
      {state === 'live' && <span className={`absolute inline-flex h-full w-full animate-live-ping rounded-full ${colour}`} />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${colour}`} />
    </span>
  );
}

/**
 * Says how current what is on screen is, as a query knows it: when it was last read, whether
 * that failed, and a way to read it again now. "Live" here means re-read on a timer, and it
 * stops saying so as soon as a read fails.
 */
export function LiveStatus({ query, label }: {
  query: { dataUpdatedAt: number; isFetching: boolean; isError: boolean; refetch: () => unknown };
  /** What is kept current, if not the whole screen. */
  label?: string;
}) {
  const t = useT();
  const now = useNow(5000);
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-surface/80 py-1 pl-3 pr-1 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-900/[0.06]">
      <LiveDot state={query.isError ? 'lost' : 'live'} />
      <span>{query.isError ? t('Could not refresh') : (label ?? t('Live'))}</span>
      {query.dataUpdatedAt > 0 && (
        <span className="hidden text-slate-500 sm:inline">
          {t('updated {time}', { time: formatAgo(query.dataUpdatedAt, now) })}
        </span>
      )}
      <button
        type="button"
        aria-label={t('Refresh now')}
        title={t('Refresh now')}
        onClick={() => void query.refetch()}
        className="relative flex h-6 w-6 items-center justify-center rounded-full text-slate-500 touch:after:absolute touch:after:-inset-2.5 touch:after:content-[''] hover:bg-slate-900/[0.06] hover:text-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30"
      >
        <RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${query.isFetching ? 'animate-spin' : ''}`} />
      </button>
    </span>
  );
}

/** A span of time ahead, in the largest units that help: "3 days", "2 h 14 min", "9 min". */
export function useTimeAhead(): (milliseconds: number) => string {
  const t = useT();
  const units = useUnits();
  return (milliseconds) => {
    const minutes = Math.max(1, Math.ceil(milliseconds / 60_000));
    if (minutes >= 48 * 60) return t('{n} days', { n: Math.floor(minutes / (24 * 60)) });
    return units.duration(minutes);
  };
}

/**
 * How long until a ride leaves, ticking down, more urgent as it nears. Nothing once it has gone.
 * `onDark` is for a dark card, where the light card's green would not read.
 */
export function LeavesIn({ time, onDark = false }: { time: string; onDark?: boolean }) {
  const t = useT();
  const ahead = useTimeAhead();
  const now = useNow(30_000);
  const left = Date.parse(time) - now;
  if (left <= 0) return null;
  const soon = left < 2 * 3_600_000;
  const calm = onDark ? 'bg-white/15 text-white' : 'bg-teal-600/[0.12] text-teal-800';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
        soon ? 'bg-amber-100 text-amber-900' : calm
      }`}
    >
      {soon && <LiveDot state="waiting" />}
      {t('Leaves in {time}', { time: ahead(left) })}
    </span>
  );
}

/** Told plainly when there is no connection, and once when it comes back. */
export function OfflineBanner() {
  const t = useT();
  const online = useOnline();
  const toast = useToast();
  const wasOnline = useRef(online);
  useEffect(() => {
    if (online && !wasOnline.current) toast(t('Back online'), 'success');
    wasOnline.current = online;
  }, [online, t, toast]);
  if (online) return null;
  return (
    <p role="status" className="flex animate-fade-in items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900 print:hidden">
      <WifiOff aria-hidden="true" className="h-4 w-4 flex-none" />
      {t('You are offline. What you see may be out of date.')}
    </p>
  );
}

/** How many notifications are unread, read often: it is what tells the app something happened. */
export function useUnread(): number | undefined {
  const unread = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api<{ unread: number }>('/notifications/unread-count'),
    refetchInterval: LIVE_MS.unread,
  });
  return unread.data?.unread;
}

/**
 * Turns a new notification into a live screen. When the unread count grows, whatever could
 * have changed is read again at once and the newest message floats in, so a driver's answer
 * or a new request shows without a reload. Rendered once, for a signed-in member.
 */
export function NotificationWatcher() {
  const t = useT();
  const count = useUnread();
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const seen = useRef<number | undefined>(undefined);

  // The count in the tab's title, as a mail app shows it, for a tab in the background.
  useEffect(() => {
    document.title = count ? `(${count}) VAYORA` : 'VAYORA';
    return () => {
      document.title = 'VAYORA';
    };
  }, [count]);

  useEffect(() => {
    if (count === undefined) return;
    const before = seen.current;
    seen.current = count;
    if (before === undefined || count <= before) return;
    for (const queryKey of [['bookings'], ['rides'], ['settlements'], ['admin']]) void queryClient.invalidateQueries({ queryKey });
    void queryClient
      .fetchQuery({ queryKey: ['notifications'], queryFn: () => api<AppNotification[]>('/notifications'), staleTime: 0 })
      .then((list) => {
        const newest = list.find((notification) => !notification.read);
        if (newest) {
          toast(translatedNotification(t, newest.text) ?? newest.message, 'info', { onClick: () => navigate('/notifications'), lingerMs: 7000 });
        }
      })
      // The count has already said something happened; the words are a courtesy.
      .catch(() => {});
  }, [count, navigate, queryClient, t, toast]);

  return null;
}
