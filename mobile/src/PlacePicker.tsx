import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useT } from './settings';
import { PLACES, type Place } from './shared/places';
import { colors, radius } from './theme';
import { Label } from './ui';

/** A town from the 126 the web app lists, chosen from a searchable list. */
export function PlacePicker({ label, value, onChange }: { label: string; value: Place; onChange: (place: Place) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PLACES;
    return PLACES.filter((place) => place.name.toLowerCase().includes(q) || t(place.name).toLowerCase().includes(q));
  }, [query, t]);

  return (
    <View>
      <Label>{label}</Label>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${t(value.name)}`}
        onPress={() => setOpen(true)}
        style={styles.field}
      >
        <Text style={styles.value}>{t(value.name)}</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{label}</Text>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} hitSlop={12}>
              <Text style={styles.close}>{t('Close')}</Text>
            </Pressable>
          </View>
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={t('Search')}
            placeholderTextColor="#9aa7b6"
            accessibilityLabel={t('Search')}
            style={styles.search}
          />
          <FlatList
            data={matches}
            keyExtractor={(place) => place.name}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onChange(item);
                  setQuery('');
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.brandSoft }]}
              >
                <Text style={[styles.optionText, item.name === value.name && { color: colors.brand, fontWeight: '700' }]}>
                  {t(item.name)}
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.none}>{t('Nothing matches that.')}</Text>}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  value: { fontSize: 16, color: colors.text, fontWeight: '600' },
  sheet: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  close: { fontSize: 16, fontWeight: '600', color: colors.brand },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  option: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  optionText: { fontSize: 16, color: colors.text },
  none: { padding: 20, color: colors.muted },
});
