import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { addDays, formatDayOf, todayInIndia } from '../../src/format';
import { PlacePicker } from '../../src/PlacePicker';
import { useT } from '../../src/settings';
import { placeNamed, type Place } from '../../src/shared/places';
import { colors } from '../../src/theme';
import { Button, Card, Chip, Chips, Label, Muted, Notice, Screen } from '../../src/ui';

const KOLHAPUR = placeNamed('Kolhapur')!;
const PUNE = placeNamed('Pune')!;

/** A passenger's search: two towns, a day in the coming week, and how many seats. */
export default function Search() {
  const t = useT();
  const [from, setFrom] = useState<Place>(KOLHAPUR);
  const [to, setTo] = useState<Place>(PUNE);
  const today = todayInIndia();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const [day, setDay] = useState(today);
  const [seats, setSeats] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const search = () => {
    if (from.name === to.name) return setError('Choose two different places.');
    setError(null);
    router.push({ pathname: '/results', params: { from: from.name, to: to.name, date: day, seats: String(seats) } });
  };

  return (
    <Screen>
      <Card>
        <PlacePicker label={t('From')} value={from} onChange={setFrom} />
        <View style={styles.swapRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Swap')}
            onPress={() => {
              setFrom(to);
              setTo(from);
            }}
            style={styles.swap}
          >
            <Ionicons name="swap-vertical" size={20} color={colors.brand} />
          </Pressable>
        </View>
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
        <Label>{t('Seats')}</Label>
        <Chips>
          {[1, 2, 3, 4].map((n) => (
            <Chip key={n} label={String(n)} selected={n === seats} onPress={() => setSeats(n)} />
          ))}
        </Chips>
      </Card>
      <Notice text={error} />
      <Button title={t('Search')} onPress={search} />
      <Muted style={{ textAlign: 'center' }}>{t('The research behind VAYORA was run on the Kolhapur to Pune route.')}</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  swapRow: { alignItems: 'center', marginVertical: -4 },
  swap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
