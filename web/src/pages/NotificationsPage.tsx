import { useQuery } from '@tanstack/react-query';
import { BellOff } from 'lucide-react';

import { LiveStatus } from '../components/live';
import { Button, Card, Notice, Page, QueryState } from '../components/ui';
import { api } from '../lib/api';
import { formatAgo, formatDateTime } from '../lib/format';
import { useT } from '../lib/i18n';
import { LIVE_MS, useNow } from '../lib/live';
import { useMarkRead } from '../lib/notifications';
import { translatedNotification } from '../lib/notificationText';
import type { AppNotification } from '../lib/types';

export function NotificationsPage() {
  const t = useT();
  const now = useNow(30_000);
  const notifications = useQuery({ queryKey: ['notifications'], queryFn: () => api<AppNotification[]>('/notifications'), refetchInterval: LIVE_MS.lists });
  const markRead = useMarkRead();
  const anyUnread = notifications.data?.some((notification) => !notification.read) ?? false;

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
      <ul className="space-y-3">
        {notifications.data?.map((notification) => {
          const translated = translatedNotification(t, notification.text);
          return (
          <li key={notification.id}>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 gap-3">
                <span aria-hidden="true" className={`mt-2 h-2 w-2 flex-none rounded-full ${notification.read ? 'bg-slate-200' : 'bg-teal-600'}`} />
                <div className="min-w-0">
                  {/* Older notifications have only the server's English, and say so to a screen reader. */}
                  <p
                    className={notification.read ? 'text-slate-700' : 'font-semibold text-slate-900'}
                    lang={translated === null ? 'en' : undefined}
                  >
                    {!notification.read && <span className="sr-only">{t('Unread:')} </span>}
                    {translated ?? notification.message}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatAgo(notification.createdAt, now)} · {formatDateTime(notification.createdAt)}
                  </p>
                </div>
                </div>
                {!notification.read && (
                  <Button tone="secondary" disabled={markRead.isPending} onClick={() => markRead.mutate(notification.id)}>
                    {t('Mark as read')}
                  </Button>
                )}
              </div>
            </Card>
          </li>
          );
        })}
      </ul>
    </Page>
  );
}
