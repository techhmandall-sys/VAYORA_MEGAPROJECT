import { StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/api';
import { formatDateTime } from '../../src/format';
import { notificationText } from '../../src/notificationText';
import { useT } from '../../src/settings';
import { colors } from '../../src/theme';
import type { AppNotification } from '../../src/types';
import { Card, Empty, Loading, Muted, Notice, Row, Screen } from '../../src/ui';
import { useLoad } from '../../src/useLoad';

/** The newest 50, in the reader's language. Opening the list marks them read. */
export default function Notifications() {
  const t = useT();
  const { data, error, loading, reload } = useLoad(async () => {
    const list = await api<AppNotification[]>('/notifications');
    if (list.some((n) => !n.read)) await api('/notifications/read-all', { method: 'POST' }).catch(() => undefined);
    return list;
  }, []);

  return (
    <Screen refreshing={loading && !!data} onRefresh={reload}>
      <Notice text={error} />
      {loading && !data ? <Loading /> : null}
      {data && data.length === 0 ? <Empty text={t('Nothing yet.')} /> : null}
      {data?.map((notification) => (
        <Card key={notification.id}>
          <Row style={{ alignItems: 'flex-start' }}>
            {!notification.read ? <View style={styles.unread} accessibilityLabel={t('unread')} /> : null}
            <Text style={styles.text}>{notificationText(t, notification)}</Text>
          </Row>
          <Muted>{formatDateTime(notification.createdAt)}</Muted>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  unread: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.brand, marginTop: 6 },
  text: { flex: 1, fontSize: 15, lineHeight: 21, color: colors.text },
});
