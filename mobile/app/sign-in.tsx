import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { messageOf } from '../src/api';
import { useAuth } from '../src/auth';
import { authStyles, Brand, ServerCard } from '../src/authParts';
import { useSettings } from '../src/settings';
import { Button, Card, Field, Muted, Notice, Screen } from '../src/ui';

export default function SignIn() {
  const { signIn, signOut } = useAuth();
  const { t, apiUrl, setApiUrl } = useSettings();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState(apiUrl);
  const [editingServer, setEditingServer] = useState(!apiUrl);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!apiUrl) {
      setEditingServer(true);
      setError('Enter the address of the VAYORA server first.');
      return;
    }
    if (!login.trim() || !password) {
      setError('Enter your email or phone number and your password.');
      return;
    }
    setBusy(true);
    try {
      const user = await signIn(login, password);
      if (user.role === 'ADMIN') {
        await signOut();
        setError('Administrators use the VAYORA website.');
        return;
      }
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
        <Text style={authStyles.title} accessibilityRole="header">
          {t('Sign in')}
        </Text>
        <Muted>{t('Welcome back. Your bookings and rides are where you left them.')}</Muted>
        <Notice text={error} />
        <Field
          label={t('Email or phone number')}
          value={login}
          onChangeText={setLogin}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field label={t('Password')} value={password} onChangeText={setPassword} secure autoCapitalize="none" />
        <Button title={busy ? t('Signing in…') : t('Sign in')} onPress={submit} busy={busy} />
        <View style={authStyles.switch}>
          <Muted>{t('New here?')} </Muted>
          <Link href="/sign-up" style={authStyles.link}>
            {t('Create an account')}
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
