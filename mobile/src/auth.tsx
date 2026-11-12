import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { api, configureApi } from './api';
import { useSettings } from './settings';
import type { Role, Session, User } from './types';

// The signed-in member. The token is kept in the phone's secure storage, so the app opens signed
// in until the token expires or the member signs out.

const KEY = 'vayora.session';

interface Stored {
  token: string;
  /** Milliseconds since the epoch. */
  expiresAt: number;
  user: User;
}

async function readStored(): Promise<Stored | null> {
  try {
    const text = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    if (!text) return null;
    const stored = JSON.parse(text) as Stored;
    return stored.expiresAt > Date.now() ? stored : null;
  } catch {
    return null;
  }
}

async function writeStored(stored: Stored | null): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (stored) globalThis.localStorage?.setItem(KEY, JSON.stringify(stored));
      else globalThis.localStorage?.removeItem(KEY);
    } else if (stored) {
      await SecureStore.setItemAsync(KEY, JSON.stringify(stored));
    } else {
      await SecureStore.deleteItemAsync(KEY);
    }
  } catch {
    // The session then lasts only while the app is open.
  }
}

export interface SignUp {
  fullName: string;
  login: string;
  password: string;
  role: Exclude<Role, 'ADMIN'>;
}

interface AuthValue {
  user: User | null;
  token: string | null;
  signIn: (login: string, password: string) => Promise<User>;
  signUp: (form: SignUp) => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/** An email address goes as `email`, anything else as `phone`, as the web app sends it. */
const byLogin = (login: string) => (login.includes('@') ? { email: login.trim() } : { phone: login.trim() });

export function AuthProvider({ children }: { children: ReactNode }) {
  const { apiUrl } = useSettings();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Stored | null>(null);

  // Set during render, so a screen's first request already goes to the right place.
  configureApi({ base: apiUrl });

  const clear = useCallback(() => {
    configureApi({ token: null });
    setSession(null);
    void writeStored(null);
  }, []);

  useEffect(() => {
    configureApi({ onUnauthorized: clear });
  }, [clear]);

  useEffect(() => {
    readStored().then((stored) => {
      configureApi({ token: stored?.token ?? null });
      setSession(stored);
      setReady(true);
    });
  }, []);

  const begin = useCallback(async (started: Session): Promise<User> => {
    const stored: Stored = {
      token: started.accessToken,
      expiresAt: Date.now() + started.expiresInSeconds * 1000,
      user: started.user,
    };
    configureApi({ token: stored.token });
    setSession(stored);
    await writeStored(stored);
    return started.user;
  }, []);

  const signIn = useCallback(
    async (login: string, password: string) =>
      begin(await api<Session>('/auth/login', { method: 'POST', body: { ...byLogin(login), password } })),
    [begin],
  );

  const signUp = useCallback(
    async ({ fullName, login, password, role }: SignUp) =>
      begin(
        await api<Session>('/auth/register', {
          method: 'POST',
          body: { ...byLogin(login), password, fullName: fullName.trim(), role },
        }),
      ),
    [begin],
  );

  const signOut = useCallback(async () => {
    // Ends the session on the server too; signing out works even when that cannot be reached.
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    clear();
  }, [clear]);

  const value = useMemo(
    () => ({ user: session?.user ?? null, token: session?.token ?? null, signIn, signUp, signOut }),
    [session, signIn, signUp, signOut],
  );
  return <AuthContext.Provider value={value}>{ready ? children : null}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth outside AuthProvider');
  return value;
}
