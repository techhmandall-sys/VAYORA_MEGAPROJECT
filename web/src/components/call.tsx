import { useMutation } from '@tanstack/react-query';
import { Phone } from 'lucide-react';

import { api } from '../lib/api';
import { useT } from '../lib/i18n';
import { ActionTile, Button, Notice } from './ui';

/** The server's answer: it names the other side and never carries a phone number. */
interface Relay {
  provider: string;
  calleeName: string;
}

/**
 * A masked call to the other side of a booking (feature 61): through Twilio when the server
 * has an account, simulated otherwise. Either way the answer says which, and carries no number.
 */
/**
 * @param tile laid out as one of a row of ActionTiles; what the call did then shows across the
 *             whole row below it (the parent is a grid)
 */
export function CallButton({ bookingId, label, tile = false }: { bookingId: number; label: string; tile?: boolean }) {
  const t = useT();
  const call = useMutation({ mutationFn: () => api<Relay>(`/bookings/${bookingId}/call`, { method: 'POST' }) });

  return (
    <div className={tile ? 'contents' : 'space-y-2'}>
      {tile ? (
        <ActionTile icon={Phone} label={label} disabled={call.isPending} onClick={() => call.mutate()} />
      ) : (
        <Button tone="secondary" disabled={call.isPending} onClick={() => call.mutate()}>
          {label}
        </Button>
      )}
      {call.data && (
        <div className={tile ? 'col-span-full' : undefined}>
        <Notice tone="info">
          {call.data.provider === 'twilio'
            ? t("Your phone will ring now from VAYORA's number. Answer it to be connected to {name}: neither of you sees the other's number.", { name: call.data.calleeName })
            : t(
            "Calling is simulated. With a real phone service you would now be connected to {name} through a masked number, so neither of you sees the other's number. No call was placed, and {name} has been told you tried.",
            { name: call.data.calleeName },
          )}
        </Notice>
        </div>
      )}
      {call.error && (
        <div className={tile ? 'col-span-full' : undefined}>
          <Notice tone="error">{call.error.message}</Notice>
        </div>
      )}
    </div>
  );
}
