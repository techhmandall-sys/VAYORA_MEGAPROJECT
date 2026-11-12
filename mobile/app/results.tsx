import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '../src/api';
import { formatDayOf, formatTime, minutesBetween, rupees } from '../src/format';
import { useT } from '../src/settings';
import { placeNamed } from '../src/shared/places';
import { colors } from '../src/theme';
import type { Candidate } from '../src/types';
import { Card, Empty, Loading, Muted, Notice, Row, Screen } from '../src/ui';
import { useLoad } from '../src/useLoad';

/** Rides with a stop near each end on the day, soonest first, for the stretch asked about. */
export default function Results() {
  const t = useT();
  const params = useLocalSearchParams<{ from: string; to: string; date: string; seats: string }>();
  const from = placeNamed(params.from);
  const to = placeNamed(params.to);
  const seats = Number(params.seats) || 1;

  const { data, error, loading, reload } = useLoad(async () => {
    if (!from || !to) return [];
    return api<Candidate[]>('/rides/search', {
      query: {
        originLat: from.lat,
        originLon: from.lon,
        destLat: to.lat,
        destLon: to.lon,
        date: params.date,
        seats,
      },
    });
  }, [params.from, params.to, params.date, seats]);

  return (
    <Screen refreshing={loading && !!data} onRefresh={reload}>
      <Stack.Screen options={{ title: `${t(params.from)} → ${t(params.to)}` }} />
      <Muted>
        {formatDayOf(params.date)} · {t(seats === 1 ? '{n} seat' : '{n} seats', { n: seats })}
      </Muted>
      <Notice text={error} />
      {loading && !data ? <Loading /> : null}
      {data && data.length === 0 ? (
        <Empty text={t('No rides have a stop near both ends on that day with that many seats. Try another date or other points.')} />
      ) : null}
      {data?.map((ride) => (
        <Card
          key={`${ride.rideId}:${ride.fromSeq}:${ride.toSeq}`}
          onPress={() =>
            router.push({
              pathname: '/book/[rideId]',
              params: { rideId: String(ride.rideId), fromSeq: String(ride.fromSeq), toSeq: String(ride.toSeq), seats: String(seats) },
            })
          }
        >
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={styles.times}>
              {formatTime(ride.boardingTime)} → {formatTime(ride.arrivalTime)}
            </Text>
            <Text style={styles.fare}>{rupees(ride.fare)}</Text>
          </Row>
          <Text style={styles.route}>
            {t(ride.fromStop)} → {t(ride.toStop)}
          </Text>
          <Muted>
            {t('{h} h {m} min', {
              h: Math.floor(minutesBetween(ride.boardingTime, ride.arrivalTime) / 60),
              m: minutesBetween(ride.boardingTime, ride.arrivalTime) % 60,
            })}
            {' · '}
            {t(ride.seatsAvailable === 1 ? '{n} seat left' : '{n} seats left', { n: ride.seatsAvailable })}
          </Muted>
          <View style={styles.driver}>
            <Text style={styles.driverName}>{ride.driverName}</Text>
            {ride.driverRating !== null ? (
              <Text style={styles.rating}>
                ★ {ride.driverRating.toFixed(1)} ({ride.driverRatingCount})
              </Text>
            ) : null}
          </View>
          <Muted>{ride.vehicle}</Muted>
          <Text style={[styles.mode, ride.instantBooking ? styles.instant : styles.request]}>
            {ride.instantBooking ? t('Instant booking') : t('The driver answers each request')}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  times: { fontSize: 18, fontWeight: '700', color: colors.text },
  fare: { fontSize: 18, fontWeight: '800', color: colors.brand },
  route: { fontSize: 15, fontWeight: '600', color: colors.text },
  driver: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  driverName: { fontSize: 15, fontWeight: '600', color: colors.text },
  rating: { fontSize: 14, color: colors.warn, fontWeight: '600' },
  mode: { fontSize: 13, fontWeight: '700', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  instant: { backgroundColor: colors.okSoft, color: colors.ok },
  request: { backgroundColor: colors.infoSoft, color: colors.info },
});
