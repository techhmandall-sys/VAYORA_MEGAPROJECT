import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSettings } from './settings';
import { colors } from './theme';
import { Button, Card, Field, Label, Muted } from './ui';

// What sign-in and sign-up share: the brand at the top, and the server the app talks to.

export function Brand() {
  const { t } = useSettings();
  return (
    <View style={styles.brand}>
      <View style={styles.logo}>
        <Text style={styles.logoMark}>V</Text>
      </View>
      <Text style={styles.name}>VAYORA</Text>
      <Text style={styles.tagline}>{t('Your Journey. Shared Better.')}</Text>
    </View>
  );
}

/** Which VAYORA the app talks to: the laptop running it, or the address it is online at. */
export function ServerCard({
  server,
  setServer,
  editing,
  setEditing,
  save,
}: {
  server: string;
  setServer: (value: string) => void;
  editing: boolean;
  setEditing: (value: boolean) => void;
  save: () => void;
}) {
  const { t, apiUrl } = useSettings();
  return (
    <Card>
      <Label>{t('Server')}</Label>
      {editing ? (
        <>
          <Field
            label={t('Address of the VAYORA server')}
            value={server}
            onChangeText={setServer}
            autoCapitalize="none"
            keyboardType="url"
            placeholder="http://192.168.1.5:8080"
          />
          <Muted>{t("On the same Wi-Fi as the laptop running VAYORA: its address and port 8080. Online: the site's https address.")}</Muted>
          <Button title={t('Save')} tone="secondary" onPress={save} />
        </>
      ) : (
        <View style={styles.serverRow}>
          <Text style={styles.server} numberOfLines={1}>
            {apiUrl}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => setEditing(true)} hitSlop={10}>
            <Text style={styles.link}>{t('Change')}</Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
}

export const authStyles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  switch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 4 },
  link: { color: colors.brand, fontWeight: '700', fontSize: 15 },
});

const styles = StyleSheet.create({
  brand: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMark: { color: '#fff', fontSize: 34, fontWeight: '800' },
  name: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: 1 },
  tagline: { fontSize: 15, color: colors.muted },
  link: { color: colors.brand, fontWeight: '700', fontSize: 15 },
  serverRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  server: { flex: 1, fontSize: 15, color: colors.text },
});
