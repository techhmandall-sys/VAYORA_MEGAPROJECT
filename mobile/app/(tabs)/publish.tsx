import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { api, messageOf } from '../../src/api';
import { addDays, formatDayOf, indiaToIso, todayInIndia } from '../../src/format';
import { PlacePicker } from '../../src/PlacePicker';
import { useT } from '../../src/settings';
import { PLACES, placeNamed, type Place } from '../../src/shared/places';
import { colors } from '../../src/theme';
import type { Ride, RoutePreview, Vehicle } from '../../src/types';
import { Button, Card, Chip, Chips, Field, Heading, Label, Loading, Muted, Notice, Row, Screen } from '../../src/ui';
import { useLoad } from '../../src/useLoad';

const KOLHAPUR = placeNamed('Kolhapur')!;
const PUNE = placeNamed('Pune')!;
const HOURS = Array.from({ length: 19 }, (_, i) => i + 5);
const MINUTES = [0, 15, 30, 45];
const twoDigits = (n: number) => String(n).padStart(2, '0');

/** A driver offers seats: the car, the stops, when, how many, and the price of each stretch. */
export default function Publish() {
  const t = useT();
  const vehicles = useLoad(() => api<Vehicle[]>('/vehicles'), []);
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const vehicle = vehicles.data?.find((v) => v.id === vehicleId) ?? vehicles.data?.[0] ?? null;

  const [from, setFrom] = useState<Place>(KOLHAPUR);
  const [to, setTo] = useState<Place>(PUNE);
  const [via, setVia] = useState<Place[]>([]);
  const today = todayInIndia();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const [day, setDay] = useState(addDays(today, 1));
  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(0);
  const [seats, setSeats] = useState(3);
  const [instant, setInstant] = useState(true);
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState<RoutePreview | null>(null);
  const [prices, setPrices] = useState<string[]>([]);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stops = useMemo(() => [from, ...via, to], [from, via, to]);
  const maxSeats = vehicle ? Math.max(1, Math.min(8, vehicle.seats - 1)) : 4;

  // The road route through the stops, worked out again whenever they change: it gives each
  // stop its time and each stretch a suggested price, as the web app's form does.
  const stopsKey = stops.map((s) => s.name).join('|');
  useEffect(() => {
    let current = true;
    setPreview(null);
    if (new Set(stops.map((s) => s.name)).size !== stops.length) {
      setRouteError('Each stop must be a different place.');
      return;
    }
    setRouteError(null);
    api<RoutePreview>('/rides/route-preview', {
      method: 'POST',
      body: { stops: stops.map(({ lat, lon }) => ({ lat, lon })) },
    })
      .then((found) => {
        if (!current) return;
        setPreview(found);
        setPrices(found.legs.map((leg) => String(Math.round(leg.suggestedPrice))));
      })
      .catch((failure) => current && setRouteError(messageOf(failure)));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopsKey]);

  useEffect(() => {
    if (seats > maxSeats) setSeats(maxSeats);
  }, [maxSeats, seats]);

  const offsets = useMemo(() => {
    const out = [0];
    preview?.legs.forEach((leg) => out.push(out[out.length - 1] + leg.durationMinutes));
    return out;
  }, [preview]);

  const addStop = () => {
    const used = new Set(stops.map((s) => s.name));
    const next = ['Satara', 'Karad'].map((name) => placeNamed(name)!).find((p) => !used.has(p.name)) ??
      PLACES.find((p) => !used.has(p.name))!;
    setVia([...via, next]);
  };

  const publish = async () => {
    setError(null);
    if (!vehicle) return setError('Add a vehicle first.');
    if (!preview) return setError(routeError ?? 'The route is still being worked out.');
    const amounts = prices.map((p) => Number(p.trim()));
    if (amounts.some((a) => !Number.isFinite(a) || a < 0 || prices.some((p) => p.trim() === ''))) {
      return setError('Enter a price for every stretch, 0 for free.');
    }
    setBusy(true);
    try {
      const ride = await api<Ride>('/rides', {
        method: 'POST',
        body: {
          vehicleId: vehicle.id,
          departureTime: indiaToIso(day, hour, minute),
          seatsOffered: seats,
          instantBooking: instant,
          stops: stops.map((stop, i) => ({ name: stop.name, lat: stop.lat, lon: stop.lon, offsetMinutes: offsets[i] })),
          segmentPrices: amounts,
          notes: notes.trim() || null,
          maxTwoInBack: false,
          returnDepartureTime: null,
          repeatWeeks: 0,
          womenOnly: false,
          maxDetourMinutes: null,
        },
      });
      router.replace(`/ride/${ride.id}`);
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setBusy(false);
    }
  };

  if (vehicles.loading && !vehicles.data) return <Screen><Loading /></Screen>;

  if (vehicles.data && vehicles.data.length === 0) {
    return (
      <Screen>
        <Card>
          <Heading>{t('Add a vehicle first.')}</Heading>
          <Muted>{t('A ride is published in one of your vehicles, so passengers know what to look for.')}</Muted>
          <Button title={t('Add a vehicle')} onPress={() => router.push('/vehicles')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Notice text={vehicles.error} />
      <Card>
        <Label>{t('Vehicle')}</Label>
        <Chips>
          {vehicles.data?.map((v) => (
            <Chip key={v.id} label={`${v.make} ${v.model}`} selected={v.id === vehicle?.id} onPress={() => setVehicleId(v.id)} />
          ))}
        </Chips>
      </Card>

      <Card>
        <PlacePicker label={t('From')} value={from} onChange={setFrom} />
        {via.map((stop, i) => (
          <View key={`${i}`} style={{ gap: 4 }}>
            <PlacePicker
              label={t('Stop {n}', { n: i + 1 })}
              value={stop}
              onChange={(place) => setVia(via.map((v, j) => (j === i ? place : v)))}
            />
            <Pressable accessibilityRole="button" onPress={() => setVia(via.filter((_, j) => j !== i))} hitSlop={8}>
              <Text style={styles.link}>{t('Remove')}</Text>
            </Pressable>
          </View>
        ))}
        {stops.length < 10 ? (
          <Pressable accessibilityRole="button" onPress={addStop} hitSlop={8}>
            <Text style={styles.link}>+ {t('Add a stop')}</Text>
          </Pressable>
        ) : null}
        <PlacePicker label={t('To')} value={to} onChange={setTo} />
      </Card>

      <Card>
        <Label>{t('Date')}</Label>
        <Chips>
          {days.map((d, i) => (
            <Chip
              key={d}
              label={i === 0 ? t('Today') : i === 1 ? t('Tomorrow') : formatDayOf(d)}
              selected={d === day}
              onPress={() => setDay(d)}
            />
          ))}
        </Chips>
        <Label>{t('Leaves at')}</Label>
        <Chips>
          {HOURS.map((h) => (
            <Chip key={h} label={`${twoDigits(h)}:`} selected={h === hour} onPress={() => setHour(h)} />
          ))}
        </Chips>
        <Chips>
          {MINUTES.map((m) => (
            <Chip key={m} label={`:${twoDigits(m)}`} selected={m === minute} onPress={() => setMinute(m)} />
          ))}
        </Chips>
        <Muted>
          {formatDayOf(day)}, {twoDigits(hour)}:{twoDigits(minute)}
        </Muted>
      </Card>

      <Card>
        <Label>{t('Seats offered')}</Label>
        <Chips>
          {Array.from({ length: maxSeats }, (_, i) => i + 1).map((n) => (
            <Chip key={n} label={String(n)} selected={n === seats} onPress={() => setSeats(n)} />
          ))}
        </Chips>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>{t('Instant booking')}</Text>
            <Muted>{instant ? t('Passengers are booked at once.') : t('You accept or decline each request.')}</Muted>
          </View>
          <Switch
            value={instant}
            onValueChange={setInstant}
            trackColor={{ true: colors.brand, false: colors.line }}
            accessibilityLabel={t('Instant booking')}
          />
        </Row>
      </Card>

      <Card>
        <Label>{t('Price per seat')}</Label>
        <Notice text={routeError} />
        {!preview && !routeError ? <Loading /> : null}
        {preview ? (
          <>
            <Muted>
              {Math.round(preview.distanceKm)} km · {t('{h} h {m} min', { h: Math.floor(preview.durationMinutes / 60), m: preview.durationMinutes % 60 })}
            </Muted>
            {preview.legs.map((_, i) => (
              <Field
                key={`${stopsKey}:${i}`}
                label={t('Price to {town} (₹)', { town: t(stops[i + 1].name) })}
                value={prices[i] ?? ''}
                onChangeText={(text) => setPrices(prices.map((p, j) => (j === i ? text.replace(/[^0-9.]/g, '') : p)))}
                keyboardType="decimal-pad"
              />
            ))}
          </>
        ) : null}
      </Card>

      <Card>
        <Field label={t('Notes for passengers')} value={notes} onChangeText={setNotes} multiline />
      </Card>

      <Notice text={error} />
      <Button title={t('Publish a ride')} onPress={publish} busy={busy} disabled={!preview} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { color: colors.brand, fontWeight: '700', fontSize: 15 },
  switchLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
});
