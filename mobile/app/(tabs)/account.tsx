import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useAuth } from '../../src/auth';
import { confirmAction } from '../../src/confirm';
import { LANGUAGES, useSettings } from '../../src/settings';
import { colors } from '../../src/theme';
import { Button, Card, Chip, Chips, Heading, Label, Muted, Screen } from '../../src/ui';

/** Who is signed in, the language, the server, and signing out. */
export default function Account() {
  const { user, signOut } = useAuth();
  const { t, language, setLanguage, apiUrl } = useSettings();
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const leave = async () => {
    if (!(await confirmAction(t('Sign out'), t('You can sign in again at any time.'), t('Sign out'), t('Keep it')))) return;
    setBusy(true);
    await signOut();
    router.replace('/sign-in');
  };

  return (
    <Screen>
      <Card>
        <Heading>{user.fullName}</Heading>
        <Muted>{user.email ?? t('Signed up by phone')}</Muted>
        <Text style={styles.role}>{user.role === 'DRIVER' ? t('Driver') : t('Passenger')}</Text>
      </Card>
      <Card>
        <Label>{t('Language')}</Label>
        <Chips>
          {LANGUAGES.map((option) => (
            <Chip key={option.code} label={option.name} selected={option.code === language} onPress={() => setLanguage(option.code)} />
          ))}
        </Chips>
      </Card>
      {user.role === 'DRIVER' ? <Button title={t('My vehicles')} tone="secondary" onPress={() => router.push('/vehicles')} /> : null}
      <Card>
        <Label>{t('Server')}</Label>
        <Muted>{apiUrl}</Muted>
      </Card>
      <Muted>{t('Your profile, emergency contacts and everything else are on the VAYORA website.')}</Muted>
      <Button title={t('Sign out')} tone="danger" onPress={leave} busy={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  role: { alignSelf: 'flex-start', fontSize: 13, fontWeight: '700', color: colors.brand, backgroundColor: colors.brandSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
});
