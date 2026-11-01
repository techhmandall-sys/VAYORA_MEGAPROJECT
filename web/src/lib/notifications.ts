import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './api';
import type { AppNotification } from './types';

/** Marks one notification read, or all with null. Shown as read at once, and put back if the server refuses. */
export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string | null) =>
      api<void>(id === null ? '/notifications/read-all' : `/notifications/${id}/read`, { method: 'POST' }),
    // Shown as read at once, the badge in the navigation too.
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const list = queryClient.getQueryData<AppNotification[]>(['notifications']);
      const unread = queryClient.getQueryData<{ unread: number }>(['notifications', 'unread-count']);
      const marked = list?.filter((notification) => !notification.read && (id === null || notification.id === id)).length ?? 0;
      if (list) {
        queryClient.setQueryData<AppNotification[]>(['notifications'], list.map((notification) =>
          id === null || notification.id === id ? { ...notification, read: true } : notification));
      }
      if (unread) queryClient.setQueryData(['notifications', 'unread-count'], { unread: Math.max(0, unread.unread - marked) });
      return { list, unread };
    },
    onError: (_error, _id, before) => {
      if (before?.list) queryClient.setQueryData(['notifications'], before.list);
      if (before?.unread) queryClient.setQueryData(['notifications', 'unread-count'], before.unread);
    },
    // Covers the list and the unread count in the navigation.
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
