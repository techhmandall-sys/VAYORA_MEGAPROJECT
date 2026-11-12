import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api, idempotencyKey, messageOf } from '../../src/api';
import { formatDateTime, formatTime, rupees } from '../../src/format';
import { RideMap } from '../../src/RideMap';
import { useT } from '../../src/settings';
import { colors } from '../../src/theme';
import type { Booking, Ride } from '../../src/types';
import { Button, Card, Heading, Loading, Muted, Notice, Row, Screen } from '../../src/ui';
import { useLoad } from '../../src/useLoad';

/** A ride in full before booking: its route, stops and driver, and what the stretch costs. */
export default function Book() {
  const t = useT();
  const params = useLocalSearchParams<{ rideId: string; fromSeq: string; toSeq: string; seats: string }>();
  const fromSeq = Number(params.fromSeq);
  const toSeq = Number(params.toSeq);
  const seats = Number(params.seats) || 1;
  // One key for this screen: pressing Book twice, or a retry, makes one booking.
  const key = useRef(idempotencyKey()).current;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<string | null>(null);

  const { data: ride, error: loadError } = useLoad(() => api<Ride>(`/rides/${params.rideId}`), [params.rideId]);

  const stretch = useMemo(() => {
    if (!ride) return null;
    const legs = ride.segments.filter((leg) => leg.seq >= fromSeq && leg.seq < toSeq);
    return {
      fare: legs.reduce((sum, leg) => sum + leg.price, 0) * seats,
      seatsLeft: Math.min(...legs.map((leg) => leg.seatsAvailable)),
    };
  }, [ride, fromSeq, toSeq, seats]);

  const stops = useMemo(() => ride?.stops.map(({ name, lat, lon }) => ({ name, lat, lon })) ?? [], [ride]);

  const book = async () => {
    setBusy(true);
    setError(null);
    try {
      const booking = await api<Booking>('/bookings', {
        method: 'POST',
        body: { rideId: Number(params.rideId), fromSeq, toSeq, seats },
        headers: { 'Idempotency-Key': key },
      });
      setBooked(
        booking.status === 'CONFIRMED'
          ? t('Booked. {from} to {to}, leaving {time}.', {
              from: t(booking.fromStop),
              to: t(booking.toStop),
              time: formatDateTime(booking.boardingTime),
            })
          : t('Request sent. Your seats are held while the driver decides; see My bookings.'),
      );
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setBusy(false);
    }
  };

  if (!ride) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('Your ride') }} />
        <Notice text={loadError} />
        {!loadError ? <Loading /> : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t('Your ride') }} />
      <RideMap stops={stops} path={ride.path} />
      <Card>
        <Heading>
          {t(ride.stops[fromSeq]?.name ?? '')} → {t(ride.stops[toSeq]?.name ?? '')}
        </Heading>
        <Muted>{formatDateTime(ride.stops[fromSeq]?.departureTime ?? ride.departureTime)}</Muted>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={styles.driver}>{ride.driverName}</Text>
          {stretch ? <Text style={styles.fare}>{rupees(stretch.fare)}</Text> : null}
        </Row>
        <Muted>
          {t(seats === 1 ? '{n} seat' : '{n} seats', { n: seats })}
          {stretch ? ` · ${t(stretch.seatsLeft === 1 ? '{n} seat left' : '{n} seats left', { n: stretch.seatsLeft })}` : ''}
        </Muted>
        {ride.notes ? <Text style={styles.notes}>{ride.notes}</Text> : null}
      </Card>
      <Card>
        {ride.stops.map((stop) => {
          const mine = stop.seq >= fromSeq && stop.seq <= toSeq;
          return (
            <View key={stop.seq} style={styles.stop}>
              <View style={[styles.dot, mine && styles.dotMine]} />
              <Text style={[styles.stopTime, !mine && styles.faded]}>{formatTime(stop.departureTime)}</Text>
              <Text style={[styles.stopName, !mine && styles.faded]}>{t(stop.name)}</Text>
            </View>
          );
        })}
      </Card>
      <Notice text={error} />
      {booked ? (
        <>
          <Notice text={booked} tone="success" />
          <Button title={t('My bookings')} onPress={() => router.replace('/bookings')} />
        </>
      ) : (
        <Button
          title={ride.instantBooking ? t('Book') : t('Request')}
          onPress={book}
          busy={busy}
          disabled={ride.status !== 'SCHEDULED' && ride.status !== 'IN_PROGRESS'}
        />
      )}
      <Muted style={{ textAlign: 'center' }}>{t('Nothing is paid now. You pay the driver directly after the ride, in cash or by UPI.')}</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  driver: { fontSize: 16, fontWeight: '600', color: colors.text },
  fare: { fontSize: 22, fontWeight: '800', color: colors.brand },
  notes: { fontSize: 14, color: colors.text, fontStyle: 'italic' },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.line },
  dotMine: { backgroundColor: colors.brand },
  stopTime: { width: 72, fontSize: 14, fontWeight: '600', color: colors.text },
  stopName: { fontSize: 15, color: colors.text },
  faded: { color: colors.muted },
});
