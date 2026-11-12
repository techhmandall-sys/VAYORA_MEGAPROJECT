import { Stack } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { api, messageOf } from '../src/api';
import { useT } from '../src/settings';
import { colors } from '../src/theme';
import type { Vehicle } from '../src/types';
import { Button, Card, Chip, Chips, Field, Heading, Label, Loading, Muted, Notice, Screen } from '../src/ui';
import { useLoad } from '../src/useLoad';

/** A driver's vehicles, and adding one: a ride is published in a vehicle. */
export default function Vehicles() {
  const t = useT();
  const { data, error, loading, reload } = useLoad(() => api<Vehicle[]>('/vehicles'), []);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [colour, setColour] = useState('');
  const [seats, setSeats] = useState(5);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const add = async () => {
    setFormError(null);
    setAdded(null);
    if (!make.trim() || !model.trim()) return setFormError('Enter the make and model');
    const madeIn = year.trim() ? Number(year.trim()) : null;
    if (madeIn !== null && (!Number.isInteger(madeIn) || madeIn < 1980 || madeIn > 2100)) return setFormError('Enter a year from 1980');
    setBusy(true);
    try {
      const vehicle = await api<Vehicle>('/vehicles', {
        method: 'POST',
        body: {
          make: make.trim(),
          model: model.trim(),
          year: madeIn,
          colour: colour.trim() || null,
          seats,
          comfort: null,
          luggage: null,
          electric: false,
          batteryKwh: null,
          consumptionKwhPer100Km: null,
        },
      });
      setAdded(t('{vehicle} added.', { vehicle: `${vehicle.make} ${vehicle.model}` }));
      setMake('');
      setModel('');
      setYear('');
      setColour('');
      await reload();
    } catch (failure) {
      setFormError(messageOf(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('My vehicles') }} />
      <Notice text={error} />
      {loading && !data ? <Loading /> : null}
      {data?.map((vehicle) => (
        <Card key={vehicle.id}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
            {vehicle.make} {vehicle.model}
          </Text>
          <Muted>
            {[vehicle.colour, vehicle.year, t('{n} seats', { n: vehicle.seats })].filter(Boolean).join(' · ')}
          </Muted>
        </Card>
      ))}
      <Card>
        <Heading>{t('Add a vehicle')}</Heading>
        <Field label={t('Make')} value={make} onChangeText={setMake} autoCapitalize="words" placeholder="Maruti Suzuki" />
        <Field label={t('Model')} value={model} onChangeText={setModel} autoCapitalize="words" placeholder="Ertiga" />
        <Field label={t('Year (optional)')} value={year} onChangeText={setYear} keyboardType="number-pad" />
        <Field label={t('Colour (optional)')} value={colour} onChangeText={setColour} autoCapitalize="words" />
        <Label>{t('Seats in the car, yours included')}</Label>
        <Chips>
          {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <Chip key={n} label={String(n)} selected={n === seats} onPress={() => setSeats(n)} />
          ))}
        </Chips>
        <Notice text={formError} />
        <Notice text={added} tone="success" />
        <Button title={t('Add a vehicle')} onPress={add} busy={busy} />
      </Card>
    </Screen>
  );
}
