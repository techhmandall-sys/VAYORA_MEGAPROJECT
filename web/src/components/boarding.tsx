import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { api } from '../lib/api';
import { useT } from '../lib/i18n';
import { Button } from './ui';

interface BoardingPass {
  bookingId: number;
  reference: string;
  code: string;
}

/** The passenger's reference and boarding code, fetched when asked for. */
export function BoardingPassView({ bookingId }: { bookingId: number }) {
  const t = useT();
  const pass = useMutation({ mutationFn: () => api<BoardingPass>(`/bookings/${bookingId}/boarding-pass`) });
  if (pass.data) {
    return (
      <p className="mt-2 text-sm" role="status">
        {t('Reference {reference}. Boarding code', { reference: pass.data.reference })}{' '}
        <span className="font-mono text-lg font-semibold tracking-widest">{pass.data.code}</span>
        <span className="block text-slate-600">{t('Show the code to the driver when you board.')}</span>
      </p>
    );
  }
  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={pass.isPending}
        onClick={() => pass.mutate()}
        className="inline-flex items-center text-sm font-medium text-teal-800 underline underline-offset-2 touch:min-h-11 disabled:opacity-50"
      >
        {t('Show my boarding code')}
      </button>
      {pass.error && (
        <p role="alert" className="text-sm text-red-700">
          {pass.error.message}
        </p>
      )}
    </div>
  );
}

/** Lets a driver check the code a passenger shows. It changes nothing about the booking. */
export function CheckCode({ bookingId }: { bookingId: number }) {
  const t = useT();
  const [code, setCode] = useState('');
  const check = useMutation({
    mutationFn: () => api<{ matches: boolean }>(`/bookings/${bookingId}/check-code`, { method: 'POST', body: { code } }),
  });
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (code.length === 4) check.mutate();
      }}
    >
      <label className="text-sm">
        <span className="sr-only">{t('Boarding code shown by the passenger')}</span>
        <input
          inputMode="numeric"
          maxLength={4}
          placeholder={t('Code')}
          value={code}
          onChange={(event) => {
            setCode(event.target.value.replace(/\D/g, ''));
            check.reset();
          }}
          className="w-24 rounded-xl border border-slate-200 bg-surface px-3 py-1.5 font-mono shadow-sm touch:min-h-11 focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/15"
        />
      </label>
      <Button tone="secondary" type="submit" disabled={code.length !== 4 || check.isPending}>
        {t('Check code')}
      </Button>
      {check.data && (
        <span role="status" className={`text-sm font-medium ${check.data.matches ? 'text-emerald-800' : 'text-red-700'}`}>
          {check.data.matches ? t('Matches this booking') : t('Does not match this booking')}
        </span>
      )}
      {check.error && (
        <span role="alert" className="text-sm text-red-700">
          {check.error.message}
        </span>
      )}
    </form>
  );
}
