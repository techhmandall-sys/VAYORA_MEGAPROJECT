import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Smartphone } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { api } from '../lib/api';
import { formatPercent, formatRupees } from '../lib/format';
import { useT } from '../lib/i18n';
import { useMediaQuery } from '../lib/media';
import type { Booking, DriverPaymentDetails, HowToPay, PaymentMethod, PaymentTerms } from '../lib/types';
import { usePhotoUrl } from './photo';
import { Button, ConfirmButton, Notice, TextField } from './ui';

// The terms change only with a redeploy; one fetch per visit is enough.
export const usePaymentTerms = () =>
  useQuery({ queryKey: ['payment-terms'], queryFn: () => api<PaymentTerms>('/payment-terms'), staleTime: Infinity });

/** The same sharp picture for both sides, on white so that it scans in the dark theme too. */
function QrImage({ url, alt }: { url: string; alt: string }) {
  return <img src={url} alt={alt} className="h-56 w-56 rounded-2xl border border-slate-200 bg-white object-contain p-2" />;
}

/** A driver's UPI ID, to copy or to open in the passenger's own app. */
function UpiId({ upiId, name, amount }: { upiId: string; name: string; amount: number }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  // Only a phone has a UPI app to open.
  const onPhone = useMediaQuery('(pointer: coarse)');
  const link = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount.toFixed(2)}&cu=INR`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-slate-600">{t('UPI ID')}</span>
      <span className="break-all font-mono font-semibold text-slate-900">{upiId}</span>
      <Button
        tone="secondary"
        // Where the browser will not copy, the ID is on the screen to select.
        onClick={() => void navigator.clipboard?.writeText(upiId).then(() => setCopied(true), () => undefined)}
      >
        {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
        {copied ? t('Copied') : t('Copy')}
      </Button>
      {onPhone && (
        <a href={link} className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-800 underline underline-offset-2 touch:min-h-11">
          <Smartphone aria-hidden="true" className="h-4 w-4" />
          {t('Open in my UPI app')}
        </a>
      )}
    </div>
  );
}

/** Where a passenger pays their driver: the driver's UPI ID and QR code, or cash when they gave neither. */
export function HowToPayDriver({ bookingId, amount }: { bookingId: number; amount: number }) {
  const t = useT();
  const how = useQuery({
    queryKey: ['bookings', bookingId, 'pay-driver'],
    queryFn: () => api<HowToPay>(`/bookings/${bookingId}/pay-driver`),
  });
  const qr = usePhotoUrl(`/bookings/${bookingId}/pay-driver/qr`, how.data?.hasQr === true);
  if (how.error) return <Notice tone="error">{how.error.message}</Notice>;
  if (!how.data) return null;
  const { driverName, upiId, hasQr } = how.data;
  return (
    <div className="space-y-3 text-sm text-slate-700">
      <p>
        {upiId || hasQr
          ? t('Pay {name} {amount} in cash, or by UPI from your own app.', { name: driverName, amount: formatRupees(amount) })
          : t('Pay {name} {amount} in cash: they have not given a UPI ID or QR code.', { name: driverName, amount: formatRupees(amount) })}
      </p>
      {upiId && <UpiId upiId={upiId} name={driverName} amount={amount} />}
      {qr.url && <QrImage url={qr.url} alt={t('UPI QR code of {name}', { name: driverName })} />}
      {(upiId || hasQr) && <p className="text-slate-500">{t('Check the name your UPI app shows before you pay. VAYORA never sees this money and cannot get it back.')}</p>}
    </div>
  );
}

/** Where a driver says they were paid. It rests on their word: VAYORA never sees the money. */
export function PaymentReceivedButtons({ bookingId, amount }: { bookingId: number; amount: number }) {
  const t = useT();
  const queryClient = useQueryClient();
  const received = useMutation({
    mutationFn: (method: PaymentMethod) => api<Booking>(`/bookings/${bookingId}/payment-received`, { method: 'POST', body: { method } }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['rides'] });
      void queryClient.invalidateQueries({ queryKey: ['earnings'] });
    },
  });
  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmButton
        label={t('Paid in cash')}
        confirmLabel={t('Yes, I was paid {amount} in cash', { amount: formatRupees(amount) })}
        tone="primary"
        disabled={received.isPending}
        onConfirm={() => received.mutate('CASH')}
      />
      <ConfirmButton
        label={t('Paid by UPI')}
        confirmLabel={t('Yes, I was paid {amount} by UPI', { amount: formatRupees(amount) })}
        tone="primary"
        disabled={received.isPending}
        onConfirm={() => received.mutate('UPI')}
      />
      {received.error && <Notice tone="error">{received.error.message}</Notice>}
    </div>
  );
}

/** A driver's own UPI ID and QR code, from their account. */
export function DriverPaymentEditor() {
  const t = useT();
  const queryClient = useQueryClient();
  const details = useQuery({ queryKey: ['me', 'payment-details'], queryFn: () => api<DriverPaymentDetails>('/me/payment-details') });
  const [upiId, setUpiId] = useState('');
  useEffect(() => {
    if (details.data) setUpiId(details.data.upiId ?? '');
  }, [details.data]);
  const save = useMutation({
    mutationFn: () => api<DriverPaymentDetails>('/me/payment-details', { method: 'PUT', body: { upiId } }),
    onSuccess: (saved) => queryClient.setQueryData(['me', 'payment-details'], saved),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">
        {t('Passengers pay you directly after the ride, in cash or by UPI, and VAYORA takes nothing. They see these only once their booking is confirmed.')}
      </p>
      <form onSubmit={submit} className="max-w-md space-y-2">
        <TextField
          label={t('Your UPI ID')}
          hint={t('As your UPI app shows it, like name@bank.')}
          value={upiId}
          onChange={(event) => setUpiId(event.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={321}
        />
        <Button type="submit" tone="secondary" busy={save.isPending} disabled={save.isPending}>
          {t('Save UPI ID')}
        </Button>
        {save.isSuccess && !save.isPending && <Notice tone="success">{upiId.trim() ? t('Your UPI ID is saved.') : t('Your UPI ID is removed.')}</Notice>}
        {save.error && <Notice tone="error">{save.error.message}</Notice>}
      </form>
      <QrEditor />
    </div>
  );
}

function QrEditor() {
  const t = useT();
  const queryClient = useQueryClient();
  const path = '/me/payment-details/qr';
  const input = useRef<HTMLInputElement>(null);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['photo', path] });
    void queryClient.invalidateQueries({ queryKey: ['me', 'payment-details'] });
  };
  const upload = useMutation({ mutationFn: (file: File) => api<void>(path, { method: 'PUT', body: file }), onSettled: refresh });
  const remove = useMutation({ mutationFn: () => api<void>(path, { method: 'DELETE' }), onSettled: refresh });
  const { url } = usePhotoUrl(path);
  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium text-slate-700">{t('Your UPI QR code')}</p>
      {url && <QrImage url={url} alt={t('Your UPI QR code')} />}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        aria-label={t('Choose your UPI QR code')}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload.mutate(file);
          event.target.value = '';
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button tone="secondary" disabled={upload.isPending} busy={upload.isPending} onClick={() => input.current?.click()}>
          {url ? t('Replace QR code') : t('Add a QR code')}
        </Button>
        {url && <ConfirmButton label={t('Remove QR code')} confirmLabel={t('Yes, remove it')} disabled={remove.isPending} onConfirm={() => remove.mutate()} />}
      </div>
      <p className="text-slate-500">{t('A screenshot from your UPI app, as a JPEG or PNG up to 5 MB. Scan it yourself once it is up, to check it still works.')}</p>
      {(upload.error ?? remove.error) && <Notice tone="error">{(upload.error ?? remove.error)!.message}</Notice>}
    </div>
  );
}

/** What cancelling costs, in words, built from what the server will actually apply. */
export function CancellingTerms() {
  const t = useT();
  const terms = usePaymentTerms();
  if (!terms.data) return null;
  const tiers = terms.data.cancellationTiers;
  return (
    <div className="rounded-2xl border border-slate-200 bg-surface px-4 py-3 text-sm text-slate-700">
      <p className="font-medium text-slate-900">{t('If you cancel')}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        <li>{t('Before the driver accepts: nothing to pay.')}</li>
        {tiers.map((tier, index) => {
          const when =
            index === 0
              ? t('{hours} hours or more before boarding', { hours: tier.atLeastHoursBefore })
              : t('{from} to {to} hours before boarding', { from: tier.atLeastHoursBefore, to: tiers[index - 1].atLeastHoursBefore });
          return (
            <li key={tier.atLeastHoursBefore}>
              {tier.owedShare === 0
                ? t('{when}: nothing to pay.', { when })
                : t('{when}: {share} of the fare to your driver.', { when, share: formatPercent(tier.owedShare) })}
            </li>
          );
        })}
        {tiers.length > 0 && (
          <li>{t('Less than {hours} hours before boarding, or if you do not turn up: the whole fare to your driver.', { hours: tiers[tiers.length - 1].atLeastHoursBefore })}</li>
        )}
        <li>{t('If the driver cancels or declines: nothing to pay.')}</li>
        <li>{t('You cannot book again until your driver marks what you owe as paid.')}</li>
      </ul>
    </div>
  );
}
