import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  BellOff,
  CalendarX,
  CircleCheck,
  CircleX,
  Flag,
  Gift,
  Hourglass,
  IndianRupee,
  Lightbulb,
  Phone,
  Siren,
  Star,
  TriangleAlert,
  Undo2,
  UserPlus,
  UserX,
  type LucideIcon,
} from 'lucide-react';

import { LiveStatus } from '../components/live';
import { Button, Notice, Page, QueryState } from '../components/ui';
import { api } from '../lib/api';
import { formatAgo, formatDate, formatTime, todayInIndia } from '../lib/format';
import { useT } from '../lib/i18n';
import { LIVE_MS, useNow } from '../lib/live';
import { useMarkRead } from '../lib/notifications';
import { translatedNotification } from '../lib/notificationText';
import type { AppNotification } from '../lib/types';

/** What a notification is about, as an icon and its colour; one the app does not know gets a bell. */
const kinds: Record<string, [LucideIcon, string]> = {
  BOOKING_REQUESTED: [UserPlus, 'bg-sky-100 text-sky-800'],
  BOOKING_CONFIRMED: [CircleCheck, 'bg-emerald-100 text-emerald-800'],
  BOOKING_DECLINED: [CircleX, 'bg-red-100 text-red-800'],
  BOOKING_CANCELLED: [CalendarX, 'bg-amber-100 text-amber-900'],
  RIDE_CANCELLED: [CalendarX, 'bg-red-100 text-red-800'],
  TRIP_COMPLETED: [Flag, 'bg-emerald-100 text-emerald-800'],
  MARKED_NO_SHOW: [UserX, 'bg-amber-100 text-amber-900'],
  ACCOUNT_NOTICE: [TriangleAlert, 'bg-amber-100 text-amber-900'],
  SOS_RAISED: [Siren, 'bg-red-100 text-red-800'],
  REQUEST_EXPIRED: [Hourglass, 'bg-slate-100 text-slate-700'],
  TRIP_DISPUTED: [TriangleAlert, 'bg-red-100 text-red-800'],
  RATING_REMINDER: [Star, 'bg-amber-100 text-amber-900'],
  SUPPLY_NUDGE: [Lightbulb, 'bg-teal-100 text-teal-900'],
  CALL_REQUESTED: [Phone, 'bg-sky-100 text-sky-800'],
  REFERRAL_REWARD: [Gift, 'bg-teal-100 text-teal-900'],
  RELEASE_REMINDER: [Undo2, 'bg-sky-100 text-sky-800'],
  PAYMENT_RECEIVED: [IndianRupee, 'bg-emerald-100 text-emerald-800'],
};

/** The day a notification came on, in India, as YYYY-MM-DD: the list is grouped by it. */
const dayOf = (iso: string) => todayInIndia(new Date(iso));

export function NotificationsPage() {
  const t = useT();
  const now = useNow(30_000);
  const notifications = useQuery({ queryKey: ['notifications'], queryFn: () => api<AppNotification[]>('/notifications'), refetchInterval: LIVE_MS.lists });
  const markRead = useMarkRead();
  const anyUnread = notifications.data?.some((notification) => !notification.read) ?? false;
  const today = todayInIndia(new Date(now));
  const yesterday = todayInIndia(new Date(now - 86_400_000));
  // Newest first, as the server sends them, in runs of one day each.
  const days: { day: string; items: AppNotification[] }[] = [];
  for (const notification of notifications.data ?? []) {
    const day = dayOf(notification.createdAt);
    if (days.at(-1)?.day === day) days.at(-1)!.items.push(notification);
    else days.push({ day, items: [notification] });
  }
  const dayName = (day: string, first: AppNotification) =>
    day === today ? t('Today') : day === yesterday ? t('Yesterday') : formatDate(first.createdAt);

  return (
    <Page title={t('Notifications')} aside={notifications.data && notifications.data.length > 0 ? <LiveStatus query={notifications} /> : undefined}>
      {markRead.error && <Notice tone="error">{markRead.error.message}</Notice>}
      {anyUnread && (
        <Button tone="secondary" disabled={markRead.isPending} onClick={() => markRead.mutate(null)}>
          {t('Mark all as read')}
        </Button>
      )}
      <QueryState
        isPending={notifications.isPending}
        error={notifications.error}
        isEmpty={notifications.data?.length === 0}
        empty={t('You have no notifications.')}
        icon={BellOff}
        onRetry={() => void notifications.refetch()}
      />
      {days.map(({ day, items }) => (
        <section key={day} aria-labelledby={`day-${day}`} className="space-y-2">
          <h2 id={`day-${day}`} className="px-1 text-[13px] font-semibold uppercase tracking-wider text-slate-500">
            {dayName(day, items[0])}
          </h2>
          <ul className="divide-y divide-slate-900/[0.06] overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-slate-900/[0.04]">
            {items.map((notification) => {
              const translated = translatedNotification(t, notification.text);
              const [Icon, tone] = kinds[notification.type] ?? [Bell, 'bg-slate-100 text-slate-700'];
              return (
                <li key={notification.id} className={`flex items-start gap-3 px-4 py-3.5 ${notification.read ? '' : 'bg-teal-600/[0.04]'}`}>
                  <span aria-hidden="true" className={`relative mt-0.5 flex h-10 w-10 flex-none items-center justify-center rounded-full ${tone}`}>
                    <Icon className="h-5 w-5" strokeWidth={2.2} />
                    {!notification.read && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-teal-600 ring-2 ring-surface" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    {/* Older notifications have only the server's English, and say so to a screen reader. */}
                    <p className={`text-[15px] leading-snug ${notification.read ? 'text-slate-700' : 'font-semibold text-slate-900'}`} lang={translated === null ? 'en' : undefined}>
                      {!notification.read && <span className="sr-only">{t('Unread:')} </span>}
                      {translated ?? notification.message}
                    </p>
                    <p className="mt-1 text-[13px] text-slate-500">
                      {formatAgo(notification.createdAt, now)} · {formatTime(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.read && (
                    <button
                      type="button"
                      disabled={markRead.isPending}
                      onClick={() => markRead.mutate(notification.id)}
                      className="-mr-1 inline-flex min-h-11 flex-none items-center rounded-full px-3 text-[13px] font-semibold text-teal-800 hover:bg-teal-600/[0.08] focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30 disabled:opacity-40"
                    >
                      {t('Mark as read')}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Page>
  );
}
