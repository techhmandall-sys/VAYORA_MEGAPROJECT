import { msg } from './i18n';
import type { DueReason, PaymentMethod } from './types';

/** How a driver was paid, wherever it is named. */
export const methodLabels: Record<PaymentMethod, string> = {
  CASH: msg('Cash to the driver'),
  UPI: msg('UPI'),
};

/** What a passenger paid for, told to that passenger. */
export const dueReasons: Record<DueReason, string> = {
  TRIP_COMPLETED: msg('The trip'),
  PASSENGER_NO_SHOW: msg('A seat you did not take up'),
  PASSENGER_CANCELLED: msg('Cancelling late'),
};
