import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { api } from '../../src/api';
import { formatDateTime } from '../../src/format';
import { useT } from '../../src/settings';
import { colors } from '../../src/theme';
import type { Ride } from '../../src/types';
import { Button, Card, Empty, Loading, Muted, Notice, Row, Screen, StatusBadge } from '../../src/ui';
import { useLoad } from '../../src/useLoad';

const AHEAD = new Set(['SCHEDULED', 'IN_PROGRESS']);

/** Seats taken on the fullest stretch of a ride. */
const seatsBooked = (ride: Ride): number =>
  ride.segments.length ? Math.max(...ride.segments.map((leg) => leg.seatsTotal - leg.seatsAvailable)) : 0;

/** A driver's rides: those still ahead first, soonest at the top; the rest after, newest first. */
export default function Rides() {
  const t = useT();
  const { data, error, loading, reload } = useLoad(async () => {
    const rides = await api<Ride[]>('/rides/mine');
    return [
      ...rides.filter((r) => AHEAD.has(r.status)).sort((a, b) => a.departureTime.localeCompare(b.departureTime)),
      ...rides.filter((r) => !AHEAD.has(r.status)).sort((a, b) => b.departureTime.localeCompare(a.departureTime)),
    ];
  }, []);

  return (
    <Screen refreshing={loading && !!data} onRefresh={reload}>
      <Button title={t('My vehicles')} tone="secondary" onPress={() => router.push('/vehicles')} />
      <Notice text={error} />
      {loading && !data ? <Loading /> : null}
      {data && data.length === 0 ? (
        <>
          <Empty text={t('No rides.')} />
          <Button title={t('Publish a ride')} onPress={() => router.push('/publish')} />
        </>
      ) : null}
      {data?.map((ride) => (
        <Card key={ride.id} onPress={() => router.push(`/ride/${ride.id}`)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={styles.route} numberOfLines={1}>
              {t(ride.stops[0]?.name ?? '')} → {t(ride.stops[ride.stops.length - 1]?.name ?? '')}
            </Text>
            <StatusBadge status={ride.status} />
          </Row>
          <Muted>{formatDateTime(ride.departureTime)}</Muted>
          <Muted>
            {t('Seats booked')}: {seatsBooked(ride)} / {ride.seatsOffered}
          </Muted>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  route: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
});
