import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, getToken, setToken, setUnauthorizedHandler } from './api';
import type { LoginForm, RegisterForm } from './schemas';
import type { Role, Session, User } from './types';

// sessionStorage, not localStorage: the token dies with the tab. It is still readable
// by any script on the page, so the app must never render untrusted HTML.
const STORAGE_KEY = 'vayora.session';

interface AuthContextValue {
  user: User | null;
  login: (form: LoginForm) => Promise<User>;
  register: (form: RegisterForm) => Promise<User>;
  /** Signs in with a Google ID token; a role is needed only to create an account. */
  google: (idToken: string, role?: Role) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function stored(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const existing = stored();
    // Set before the first render so the first queries already carry the token.
    setToken(existing?.accessToken ?? null);
    return existing;
  });

  const open = useCallback((next: Session): User => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setToken(next.accessToken);
    setSession(next);
    return next.user;
  }, []);

  const logout = useCallback(() => {
    const currentToken = getToken();
    sessionStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setSession(null);
    if (currentToken) {
      fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentToken}` },
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      login: async ({ login, password }) =>
        open(
          await api<Session>('/auth/login', {
            method: 'POST',
            body: login.includes('@') ? { email: login, password } : { phone: login, password },
          }),
        ),
      register: async ({ method, email, phone, ...rest }) =>
        open(
          await api<Session>('/auth/register', {
            method: 'POST',
            body: method === 'email' ? { ...rest, email } : { ...rest, phone },
          }),
        ),
      google: async (idToken, role) =>
        open(await api<Session>('/auth/google', { method: 'POST', body: role ? { idToken, role } : { idToken } })),
      logout,
    }),
    [session, open, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
