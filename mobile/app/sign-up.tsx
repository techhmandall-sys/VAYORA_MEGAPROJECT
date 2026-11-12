import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { messageOf } from '../src/api';
import { useAuth } from '../src/auth';
import { Brand, ServerCard } from '../src/authParts';
import { useSettings } from '../src/settings';
import { colors, radius } from '../src/theme';
import { Button, Card, Field, Label, Muted, Notice, Screen } from '../src/ui';

type Kind = 'PASSENGER' | 'DRIVER';

export default function SignUp() {
  const { signUp } = useAuth();
  const { t, apiUrl, setApiUrl } = useSettings();
  const [fullName, setFullName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Kind | null>(null);
  const [server, setServer] = useState(apiUrl);
  const [editingServer, setEditingServer] = useState(!apiUrl);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!role) return setError('Choose whether you travel as a passenger or drive.');
    if (!fullName.trim()) return setError('Enter your name');
    if (!login.trim()) return setError('Enter your email or phone number');
    if (password.length < 8) return setError('Use at least 8 characters');
    setBusy(true);
    try {
      await signUp({ fullName, login, password, role });
      router.replace('/');
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Brand />
      <Card>
        <Text style={styles.title} accessibilityRole="header">
          {t('Create an account')}
        </Text>
        <Notice text={error} />
        <Label>{t('I want to')}</Label>
        <View style={styles.roles}>
          <RoleCard
            title={t('Passenger')}
            body={t('Find a seat in a car already making the trip.')}
            selected={role === 'PASSENGER'}
            onPress={() => setRole('PASSENGER')}
          />
          <RoleCard
            title={t('Driver')}
            body={t('Offer the empty seats in your car.')}
            selected={role === 'DRIVER'}
            onPress={() => setRole('DRIVER')}
          />
        </View>
        <Field label={t('Full name')} value={fullName} onChangeText={setFullName} autoCapitalize="words" />
        <Field
          label={t('Email or phone number')}
          value={login}
          onChangeText={setLogin}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field label={t('Password')} value={password} onChangeText={setPassword} secure autoCapitalize="none" />
        <Muted>{t('Use at least 8 characters')}</Muted>
        <Button title={t('Create an account')} onPress={submit} busy={busy} />
        <View style={styles.switch}>
          <Muted>{t('Already have an account?')} </Muted>
          <Link href="/sign-in" style={styles.link}>
            {t('Sign in')}
          </Link>
        </View>
      </Card>
      <ServerCard
        server={server}
        setServer={setServer}
        editing={editingServer}
        setEditing={setEditingServer}
        save={() => {
          setApiUrl(server);
          setEditingServer(false);
        }}
      />
    </Screen>
  );
}

function RoleCard({ title, body, selected, onPress }: { title: string; body: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={[styles.role, selected && styles.roleSelected]}
    >
      <Text style={[styles.roleTitle, selected && { color: colors.brand }]}>{title}</Text>
      <Text style={styles.roleBody}>{body}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  roles: { flexDirection: 'row', gap: 10 },
  role: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: radius.control,
    padding: 12,
    gap: 4,
    backgroundColor: colors.surface,
  },
  roleSelected: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  roleTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  roleBody: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  switch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 4 },
  link: { color: colors.brand, fontWeight: '700', fontSize: 15 },
});
