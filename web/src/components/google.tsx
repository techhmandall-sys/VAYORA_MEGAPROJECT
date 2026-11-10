import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { Button, Card, Notice } from './ui';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useT } from '../lib/i18n';
import type { Role } from '../lib/types';

// Google's own script draws the button and hands back a signed ID token; core-api checks it.
const SCRIPT = 'https://accounts.google.com/gsi/client';

interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
      renderButton: (parent: HTMLElement, options: Record<string, string>) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

function loadScript(): Promise<GoogleIdentity> {
  if (window.google) return Promise.resolve(window.google);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => (window.google ? resolve(window.google) : reject(new Error('Google did not load')));
    script.onerror = () => reject(new Error('Google did not load'));
    document.head.appendChild(script);
  });
}

/**
 * "Sign in with Google", shown only when the server has a Google client ID. Someone with no
 * account yet is asked whether they will travel or drive, as on the sign-up form.
 */
export function GoogleSignIn() {
  const t = useT();
  const { google } = useAuth();
  const settings = useQuery({ queryKey: ['auth', 'google'], queryFn: () => api<{ clientId: string | null }>('/auth/google') });
  const button = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const clientId = settings.data?.clientId ?? null;

  const finish = async (credential: string, role?: Role) => {
    setFailure(null);
    try {
      // Signed in: the page this button is on moves on by itself.
      await google(credential, role);
    } catch (error) {
      // No account yet: ask for the role, then try again with the same token.
      if (error instanceof ApiError && error.status === 409 && !role) setPending(credential);
      else setFailure((error as Error).message);
    }
  };

  // The latest of each, so a sign-in that finishes after a re-render, or a change of
  // language, uses what is current; the button itself is drawn once per client.
  const latest = useRef({ finish, t });
  latest.current = { finish, t };

  useEffect(() => {
    if (!clientId || !button.current) return;
    let cancelled = false;
    loadScript()
      .then((identity) => {
        if (cancelled || !button.current) return;
        identity.accounts.id.initialize({ client_id: clientId, callback: ({ credential }) => void latest.current.finish(credential) });
        identity.accounts.id.renderButton(button.current, { theme: 'outline', size: 'large', text: 'continue_with' });
      })
      .catch(() => setFailure(latest.current.t('Google sign-in could not be loaded. Use your email or phone instead.')));
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // Nothing at all when Google sign-in is off: not even an empty card.
  if (!clientId) return null;
  return (
    <Card>
      <div className="space-y-3">
        <p className="text-center text-sm text-slate-500">{t('or')}</p>
        <div ref={button} />
        {pending && (
          <div className="space-y-2">
            <p className="text-sm">{t('No VAYORA account uses this Google address yet. How will you use VAYORA?')}</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void finish(pending, 'PASSENGER')}>{t('Find rides as a passenger')}</Button>
              <Button tone="secondary" onClick={() => void finish(pending, 'DRIVER')}>
                {t('Offer rides as a driver')}
              </Button>
            </div>
            <p className="text-xs text-slate-500">{t('An account is either a passenger or a driver. This cannot be changed later.')}</p>
          </div>
        )}
        {failure && <Notice tone="error">{failure}</Notice>}
      </div>
    </Card>
  );
}
