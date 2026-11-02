import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import { Button, Card, Page, QueryState, statusText } from '../components/ui';
import { api } from '../lib/api';
import { formatExactRupees, formatFullDateTime } from '../lib/format';
import { useT } from '../lib/i18n';
import { dueReasons, methodLabels } from '../lib/payments';
import type { BookingReceipt } from '../lib/types';

/**
 * Receipts in the reader's language (feature 50): the same facts as the PDF, with names and
 * stops as written, in any script. The browser prints it, or saves it as a PDF, with its
 * own fonts; the server's PDF has India's main scripts only, drawn so they cannot be selected.
 */
export function BookingReceiptPage() {
  const t = useT();
  const { id = '' } = useParams();
  const receipt = useQuery({ queryKey: ['receipt', 'booking', id], queryFn: () => api<BookingReceipt>(`/bookings/${id}/receipt-data`) });
  const r = receipt.data;
  return (
    <Page title={t('Receipt for booking {id}', { id })}>
      <QueryState isPending={receipt.isPending} error={receipt.error} isEmpty={false} empty="" onRetry={() => void receipt.refetch()} />
      {r && (
        <>
          <Card>
            <dl className="text-sm">
              <Line label={t('Passenger')} value={r.passenger} />
              <Line label={t('Driver')} value={r.driver} />
              <Line
                label={t('Trip')}
                value={
                  r.seats === 1
                    ? t('{from} to {to}, {n} seat', { from: t(r.fromStop), to: t(r.toStop), n: r.seats })
                    : t('{from} to {to}, {n} seats', { from: t(r.fromStop), to: t(r.toStop), n: r.seats })
                }
              />
              <Line label={t('Boarding')} value={formatFullDateTime(r.boarding)} />
              <Line label={t('Booking status')} value={t(statusText(r.status))} />
              <Line label={t('Paid')} value={t('{when}, by {method}', { when: formatFullDateTime(r.paidAt), method: t(methodLabels[r.method]) })} />
              <Line label={t('For')} value={t(dueReasons[r.reason])} />
              <Line label={t('Fare')} value={formatExactRupees(r.fare)} />
              <Line label={t('Paid to the driver')} value={formatExactRupees(r.paid)} strong />
            </dl>
            <div className="mt-4 space-y-1 border-t border-slate-200 pt-3 text-sm text-slate-600">
              <p className="font-medium text-slate-900">{t('Paid directly to the driver, as the driver recorded it. VAYORA took no part of it and charged nothing.')}</p>
              <p>{t('This is not a tax invoice.')}</p>
              <p>{t('Times are India Standard Time.')}</p>
              <p>{t('VAYORA, shared rides between cities')}</p>
            </div>
          </Card>
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <Button onClick={() => window.print()}>{t('Print or save as PDF')}</Button>
            <p className="text-sm text-slate-600">{t('To keep a copy, choose to save as PDF instead of a printer.')}</p>
          </div>
        </>
      )}
    </Page>
  );
}

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-1.5 last:border-0">
      <dt className="text-slate-600">{label}</dt>
      <dd className={strong ? 'text-right font-semibold' : 'text-right'}>{value}</dd>
    </div>
  );
}
