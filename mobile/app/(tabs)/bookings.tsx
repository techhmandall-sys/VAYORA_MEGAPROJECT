import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api, messageOf } from '../../src/api';
import { confirmAction } from '../../src/confirm';
import { formatDateTime, rupees } from '../../src/format';
import { useT } from '../../src/settings';
import { colors } from '../../src/theme';
import type { BoardingPass, Booking } from '../../src/types';
import { Button, Card, Chip, Chips, Empty, Loading, Muted, Notice, Row, Screen, StatusBadge } from '../../src/ui';
import { useLoad } from '../../src/useLoad';

const LIVE = new Set(['PENDING', 'CONFIRMED']);

/** Upcoming bookings first, soonest at the top; past ones after, newest first. */
function inOrder(bookings: Booking[]): Booking[] {
  const now = Date.now();
  const upcoming = (b: Booking) => LIVE.has(b.status) && new Date(b.boardingTime).getTime() > now - 6 * 3600_000;
  return [
    ...bookings.filter(upcoming).sort((a, b) => a.boardingTime.localeCompare(b.boardingTime)),
    ...bookings.filter((b) => !upcoming(b)).sort((a, b) => b.boardingTime.localeCompare(a.boardingTime)),
  ];
}

export default function Bookings() {
  const t = useT();
  const { data, error, loading, reload } = useLoad(() => api<Booking[]>('/bookings').then(inOrder), []);

  return (
    <Screen refreshing={loading && !!data} onRefresh={reload}>
      <Notice text={error} />
      {loading && !data ? <Loading /> : null}
      {data && data.length === 0 ? (
        <>
          <Empty text={t('No bookings yet.')} />
          <Button title={t('Find a ride')} onPress={() => router.push('/search')} />
        </>
      ) : null}
      {data?.map((booking) => <BookingCard key={booking.id} booking={booking} changed={reload} />)}
    </Screen>
  );
}

function BookingCard({ booking, changed }: { booking: Booking; changed: () => void }) {
  const t = useT();
  const [pass, setPass] = useState<BoardingPass | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upcoming = LIVE.has(booking.status) && new Date(booking.boardingTime).getTime() > Date.now();

  const act = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    const sure = await confirmAction(
      t('Cancel booking'),
      t('The driver is told at once. What you owe follows the cancellation terms you agreed to.'),
      t('Cancel booking'),
      t('Keep it'),
    );
    if (sure) await act(async () => {
      await api(`/bookings/${booking.id}/cancel`, { method: 'POST' });
      changed();
    });
  };

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={styles.route}>
          {t(booking.fromStop)} → {t(booking.toStop)}
        </Text>
        <StatusBadge status={booking.status} />
      </Row>
      <Muted>{formatDateTime(booking.boardingTime)}</Muted>
      <Muted>
        {t(booking.seats === 1 ? '{n} seat' : '{n} seats', { n: booking.seats })} · {rupees(booking.price)}
        {booking.driverName ? ` · ${booking.driverName}` : ''}
      </Muted>
      {booking.vehicle ? <Muted>{booking.vehicle}</Muted> : null}
      {booking.paymentStatus === 'DUE' && booking.amountDue ? (
        <Notice tone="info" text={t('Pay your driver {amount}, in cash or by UPI.', { amount: rupees(booking.amountDue) })} />
      ) : null}
      <Notice text={error} />
      {pass ? (
        <View style={styles.pass}>
          <Muted>{t('Reference {reference}. Boarding code', { reference: pass.reference })}</Muted>
          <Text style={styles.code}>{pass.code}</Text>
          <Muted>{t('Show the code to the driver when you board.')}</Muted>
        </View>
      ) : null}
      <View style={styles.actions}>
        {booking.status === 'CONFIRMED' ? (
          <Button title={t('Messages')} tone="secondary" onPress={() => router.push(`/chat/${booking.rideId}`)} />
        ) : null}
        {booking.status === 'CONFIRMED' && !pass ? (
          <Button
            title={t('Show my boarding code')}
            tone="secondary"
            busy={busy}
            onPress={() => act(async () => setPass(await api<BoardingPass>(`/bookings/${booking.id}/boarding-pass`)))}
          />
        ) : null}
        {upcoming ? <Button title={t('Cancel booking')} tone="danger" busy={busy} onPress={cancel} /> : null}
      </View>
      {booking.status === 'COMPLETED' && !booking.passengerRated ? (
        <View style={{ gap: 8 }}>
          <Muted>{t('Rate your driver')}</Muted>
          <Chips>
            {[1, 2, 3, 4, 5].map((stars) => (
              <Chip key={stars} label={'★'.repeat(stars)} selected={rating === stars} onPress={() => setRating(stars)} />
            ))}
          </Chips>
          {rating ? (
            <Button
              title={t('Send')}
              busy={busy}
              onPress={() =>
                act(async () => {
                  await api(`/bookings/${booking.id}/rating`, { method: 'POST', body: { stars: rating, comment: null } });
                  changed();
                })
              }
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  route: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  actions: { gap: 8, marginTop: 4 },
  pass: { backgroundColor: colors.brandSoft, borderRadius: 14, padding: 12, gap: 4, alignItems: 'center' },
  code: { fontSize: 32, fontWeight: '800', letterSpacing: 6, color: colors.brand },
});
