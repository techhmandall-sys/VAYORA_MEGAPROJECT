import { useMutation, useQuery } from '@tanstack/react-query';
import { Phone } from 'lucide-react';
import { Link } from 'react-router-dom';

import { api } from '../lib/api';
import { useT } from '../lib/i18n';
import type { EmergencyContact, SosRaised } from '../lib/types';
import { Button } from './ui';

const EMERGENCY_NUMBER = '112';

/** Where the device says it is, or nothing: an alert must not wait long for a position. */
function position(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (found) => resolve({ lat: found.coords.latitude, lon: found.coords.longitude }),
      () => resolve(null),
      { timeout: 3000, maximumAge: 60_000 },
    );
  });
}

/**
 * The emergency panel. It puts calling the emergency number first, because an alert here
 * reaches an administrator's queue and, while messages are simulated, nobody else.
 */
export function SosPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const raise = useMutation({
    mutationFn: async () => api<SosRaised>('/sos', { method: 'POST', body: (await position()) ?? {} }),
  });
  const raised = raise.data;
  // The member's own people, a tap away: the same list as on the account page.
  const contacts = useQuery({ queryKey: ['me', 'contacts'], queryFn: () => api<EmergencyContact[]>('/me/emergency-contacts') });

  return (
    <section aria-label={t('Emergency')} className="mx-auto max-w-5xl animate-sheet-in px-4 pt-4 sm:px-6">
      <div className="space-y-3 rounded-3xl bg-red-50 p-5 text-sm text-red-900 shadow-float ring-1 ring-inset ring-red-200">
        <p className="text-lg font-bold">{t('If you are in danger, call 112 now.')}</p>
        <p>
          <a
            href={`tel:${EMERGENCY_NUMBER}`}
            className="inline-flex items-center rounded-full bg-danger px-6 py-3 text-base font-bold text-white shadow-lg shadow-danger/30 transition-transform hover:bg-danger-strong active:scale-[0.96] focus:outline-none focus-visible:ring-4 focus-visible:ring-red-600/40"
          >
            {t('Call 112')}
          </a>
        </p>
        {contacts.data && contacts.data.length > 0 && (
          <div>
            <p className="font-semibold">{t('Your emergency contacts')}</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {contacts.data.map((contact) => (
                <li key={contact.id}>
                  <a
                    href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-[15px] font-semibold text-red-900 shadow-sm ring-1 ring-inset ring-red-200 transition-transform active:scale-[0.97] focus:outline-none focus-visible:ring-4 focus-visible:ring-red-600/40"
                  >
                    <Phone aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
                    {t('Call {name}', { name: contact.name })}
                    {/* Read as "Call Meera (Sister)"; a flex container draws no space. */}{' '}
                    {contact.relation &&<span className="font-normal text-red-800">{`(${contact.relation})`}</span>}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {contacts.data?.length === 0 && (
          <p>
            <Link to="/account#emergency-contacts" onClick={onClose} className="font-semibold underline underline-offset-2">
              {t('Add someone to tell in an emergency')}
            </Link>
          </p>
        )}
        {!raised && (
          <>
            <p>{t('You can also alert the VAYORA administrators. They see it in a queue; they are not an emergency service.')}</p>
            {raise.error && <p role="alert">{raise.error.message}</p>}
            <div className="flex flex-wrap gap-2">
              <Button tone="danger" disabled={raise.isPending} onClick={() => raise.mutate()}>
                {raise.isPending ? t('Sending…') : t('Send an alert')}
              </Button>
              <Button tone="secondary" onClick={onClose}>
                {t('Close')}
              </Button>
            </div>
          </>
        )}
        {raised && (
          <div role="status" className="space-y-2">
            <p className="font-medium">{t('Your alert is recorded and the administrators can see it.')}</p>
            {raised.reallySent ? (
              <>
                <p>{t('A message was sent to {n} of your emergency contacts.', { n: raised.contactsTold })}</p>
                {(raised.contactsMissed ?? 0) > 0 && (
                  <p className="font-semibold">
                    {t('{n} of your emergency contacts could not be messaged. Call them yourself, or call 112.', { n: raised.contactsMissed ?? 0 })}
                  </p>
                )}
              </>
            ) : (
              <p className="font-semibold">
                {t('Text messages are simulated in this project: your emergency contacts were NOT messaged. Call them yourself, or call 112.')}
              </p>
            )}
            <Button tone="secondary" onClick={onClose}>
              {t('Close')}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
