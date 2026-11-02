import { useQuery } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ReceiptLinks } from '../components/receipt';
import { Card, Notice, Page, QueryState } from '../components/ui';
import { api } from '../lib/api';
import { formatDateTime, formatRupees } from '../lib/format';
import { useT } from '../lib/i18n';
import { methodLabels } from '../lib/payments';
import type { PassengerPayment } from '../lib/types';

/** What a passenger has paid their drivers, and what they still owe, newest first. */
export function PaymentsPage() {
  const t = useT();
  const payments = useQuery({ queryKey: ['payments'], queryFn: () => api<PassengerPayment[]>('/payments') });
  const total = (status: PassengerPayment['status']) =>
    payments.data?.filter((payment) => payment.status === status).reduce((sum, payment) => sum + (payment.amountDue ?? 0), 0) ?? 0;
  const owed = total('DUE');

  return (
    <Page title={t('Payments')}>
      <Notice tone="info">{t('You pay your driver directly after the ride, in cash or by UPI. VAYORA charges nothing.')}</Notice>
      {owed > 0 && (
        <Notice tone="error">
          {t('You owe {amount}. You can book again once your driver marks it paid.', { amount: formatRupees(owed) })}{' '}
          <Link to="/bookings" className="font-medium underline underline-offset-2">
            {t('See My bookings')}
          </Link>
        </Notice>
      )}
      <QueryState
        isPending={payments.isPending}
        error={payments.error}
        isEmpty={payments.data?.length === 0}
        empty={t('You have not booked anything yet.')}
        icon={Wallet}
        onRetry={() => void payments.refetch()}
      />
      {payments.data && payments.data.length > 0 && (
        <Card>
          <p className="text-sm text-slate-600">{t('Paid to your drivers')}</p>
          <p className="text-2xl font-semibold">{formatRupees(total('SETTLED'))}</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t('Payments, newest first')}</caption>
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">{t('Booked')}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t('Trip')}</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">{t('Fare')}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t('Where it stands')}</th>
                  <th scope="col" className="py-2 font-medium">
                    <span className="sr-only">{t('Receipt')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.data.map((payment) => (
                  <tr key={payment.bookingId} className="border-b border-slate-100 align-top last:border-0">
                    <td className="py-2 pr-4">{formatDateTime(payment.createdAt)}</td>
                    <td className="py-2 pr-4">
                      {t(payment.fromStop)} → {t(payment.toStop)}
                    </td>
                    <td className="py-2 pr-4 text-right font-medium">{formatRupees(payment.fare)}</td>
                    <td className="py-2 pr-4">
                      {payment.status === 'DUE' && payment.amountDue != null
                        ? t('{amount} owed to your driver', { amount: formatRupees(payment.amountDue) })
                        : payment.status === 'SETTLED' && payment.amountDue != null && payment.method
                          ? `${t('{amount} paid', { amount: formatRupees(payment.amountDue) })} · ${t(methodLabels[payment.method])}`
                          : payment.status === 'VOID'
                            ? t('Nothing owed')
                            : t('Pay after the ride')}
                    </td>
                    <td className="py-2">
                      {/* There is a receipt once the driver says they were paid, and not before. */}
                      {payment.status === 'SETTLED' && <ReceiptLinks id={payment.bookingId} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Page>
  );
}
