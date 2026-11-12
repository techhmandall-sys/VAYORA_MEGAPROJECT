import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api, messageOf } from '../../src/api';
import { confirmAction } from '../../src/confirm';
import { formatDateTime, formatTime, rupees } from '../../src/format';
import { RideMap } from '../../src/RideMap';
import { useT } from '../../src/settings';
import { colors } from '../../src/theme';
import type { Booking, Ride } from '../../src/types';
import { Button, Card, Heading, Loading, Muted, Notice, Row, Screen, StatusBadge } from '../../src/ui';
import { useLoad } from '../../src/useLoad';

/** One of the driver's rides: its passengers, their requests, and starting and ending the trip. */
export default function ManageRide() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, error: loadError, loading, reload } = useLoad(async () => {
    const [ride, bookings] = await Promise.all([api<Ride>(`/rides/${id}`), api<Booking[]>(`/rides/${id}/bookings`)]);
    return { ride, bookings };
  }, [id]);

  const stops = useMemo(() => data?.ride.stops.map(({ name, lat, lon }) => ({ name, lat, lon })) ?? [], [data?.ride]);

  const act = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      await reload();
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setBusy(false);
    }
  };

  const ask = (title: string, message: string, yes: string, work: () => Promise<unknown>) => async () => {
    if (await confirmAction(title, message, yes, t('Keep it'))) await act(work);
  };

  if (!data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('Your ride') }} />
        <Notice text={loadError} />
        {!loadError ? <Loading /> : null}
      </Screen>
    );
  }

  const { ride, bookings } = data;
  const live = bookings.filter((b) => b.status !== 'CANCELLED' && b.status !== 'REJECTED');

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Stack.Screen options={{ title: t('Your ride') }} />
      <RideMap stops={stops} path={ride.path} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Heading>
            {t(ride.stops[0]?.name ?? '')} → {t(ride.stops[ride.stops.length - 1]?.name ?? '')}
          </Heading>
          <StatusBadge status={ride.status} />
        </Row>
        <Muted>{formatDateTime(ride.departureTime)}</Muted>
        {ride.stops.map((stop) => (
          <View key={stop.seq} style={styles.stop}>
            <Text style={styles.stopTime}>{formatTime(stop.departureTime)}</Text>
            <Text style={styles.stopName}>{t(stop.name)}</Text>
          </View>
        ))}
      </Card>

      <Notice text={error} />
      {ride.status === 'SCHEDULED' ? (
        <Button title={t('Start ride')} busy={busy} onPress={() => act(() => api(`/rides/${ride.id}/start`, { method: 'POST' }))} />
      ) : null}
      {ride.status === 'IN_PROGRESS' ? (
        <Button
          title={t('Complete ride')}
          busy={busy}
          onPress={ask(t('Complete ride'), t('Every passenger still on board is marked as having travelled.'), t('Complete ride'), () =>
            api(`/rides/${ride.id}/complete`, { method: 'POST' }),
          )}
        />
      ) : null}
      {ride.status === 'SCHEDULED' || ride.status === 'IN_PROGRESS' ? (
        <Button title={t('Messages')} tone="secondary" onPress={() => router.push(`/chat/${ride.id}`)} />
      ) : null}

      <Text style={styles.section}>{t('Passengers')}</Text>
      {live.length === 0 ? <Muted>{t('No bookings yet.')}</Muted> : null}
      {live.map((booking) => (
        <Card key={booking.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={styles.passenger}>{booking.passengerName}</Text>
            <StatusBadge status={booking.status} />
          </Row>
          <Muted>
            {t(booking.fromStop)} → {t(booking.toStop)} · {t(booking.seats === 1 ? '{n} seat' : '{n} seats', { n: booking.seats })} ·{' '}
            {rupees(booking.price)}
          </Muted>
          {booking.status === 'PENDING' ? (
            <Row>
              <View style={{ flex: 1 }}>
                <Button
                  title={t('Accept')}
                  busy={busy}
                  onPress={() => act(() => api(`/bookings/${booking.id}/accept`, { method: 'POST' }))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title={t('Decline')}
                  tone="danger"
                  busy={busy}
                  onPress={() => act(() => api(`/bookings/${booking.id}/reject`, { method: 'POST' }))}
                />
              </View>
            </Row>
          ) : null}
        </Card>
      ))}

      {ride.status === 'SCHEDULED' ? (
        <Button
          title={t('Cancel ride')}
          tone="danger"
          busy={busy}
          onPress={ask(
            t('Cancel ride'),
            t('Your passengers are told at once and owe nothing, and they are shown other rides.'),
            t('Cancel ride'),
            () => api(`/rides/${ride.id}/cancel`, { method: 'POST' }),
          )}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stop: { flexDirection: 'row', gap: 10, paddingVertical: 2 },
  stopTime: { width: 72, fontSize: 14, fontWeight: '600', color: colors.text },
  stopName: { fontSize: 15, color: colors.text },
  section: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 8 },
  passenger: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
});
