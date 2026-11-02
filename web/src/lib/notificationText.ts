import { formatDate, formatDateTime } from './format';
import { msg, type Translate } from './i18n';
import type { NotificationText, TextValue } from './types';

// Every template core-api's notifications can carry, exactly as it writes them. A core-api
// test (NotificationTemplatesTest) fails if the server uses one that is not listed here,
// and the translation test fails if one listed here has no Hindi or Marathi.
const TEMPLATES = new Set([
  msg('{passenger} booked {seats}.'),
  msg('{passenger} asked for {seats}.'),
  msg('The driver accepted your booking for {seats}.'),
  msg('The driver did not answer your request for {seats} in time, so it has been closed. You owe nothing.'),
  msg("{passenger}'s request for {seats} was closed because it was not answered in time."),
  msg('{passenger} cancelled {seats}.'),
  msg('The driver did not accept your request for {seats}. You owe nothing.'),
  msg('{n} seat, {from} to {to}'),
  msg('{n} seats, {from} to {to}'),
  msg('The driver reported that you did not board for {seats}.'),
  msg('Your trip from {from} to {to} is complete. You can rate your driver in My bookings.'),
  msg('The driver cancelled the ride you booked for {seats}. You owe nothing. {more}'),
  msg('No other ride with seats leaves near that time.'),
  msg('No other ride with seats leaves near that time. Buses listed by VAYORA staff (check with the operator before travelling): {buses}.'),
  msg('Other rides that could take you: {rides}. Search again to book one.'),
  msg('{time} from {stop} with {driver}'),
  msg('{time} {operator}, Rs {fare}'),
  msg('A passenger says a trip marked completed did not happen. See disputed trips.'),
  msg('How was your trip with {driver}? You can still rate it.'),
  msg('How was {passenger} as a passenger? You can still rate the trip.'),
  msg('An administrator reviewed a report about you.'),
  msg('An administrator reviewed a report about you: {note}'),
  msg('VAYORA staff have checked your identity document.'),
  msg('VAYORA staff could not confirm your identity document: {note}'),
  msg('VAYORA staff have checked the insurance for {vehicle}.'),
  msg('VAYORA staff could not confirm the insurance for {vehicle}: {note}'),
  msg('{name} pressed the emergency button. Open the emergency queue.'),
  msg('As you chose a flexible booking, you are booked on the {time} ride from {stop} with {driver}.'),
  msg('As you chose a flexible booking, you have asked for a seat on the {time} ride from {stop} with {driver}. The driver will answer.'),
  msg('You chose a flexible booking, but no other ride with seats fits it. Nothing new has been booked.'),
  msg('Passengers looked for a ride from {from} to {to} on {date} and found none. If you are driving then, you could offer seats.'),
  msg("{name} tried to call you through VAYORA. Calls are simulated, so no call came through. Reply in the ride's chat."),
  msg("{name} is calling you through VAYORA, from the platform's number. Neither of you sees the other's number."),
  msg('Your seat from {from} to {to} leaves {when}. If your plans have changed, cancelling now lets someone else take it, and you would owe nothing. If you are still travelling, there is nothing to do.'),
  msg('Your seat from {from} to {to} leaves {when}. If your plans have changed, cancelling now lets someone else take it, and you would owe your driver Rs {owed} of your Rs {fare} fare. If you are still travelling, there is nothing to do.'),
  msg('As you chose a flexible booking, you are booked on the {time} ride with {driver}, who will pick you up at your own point.'),
  msg('As you chose a flexible booking, you have asked for a seat on the {time} ride with {driver}, who would pick you up at your own point. The driver will answer.'),
  msg('{time} with {driver}, picking you up at your own point'),
  msg('Your trip from {from} to {to} is complete. Pay your driver Rs {amount}, in cash or by UPI: see My bookings.'),
  msg('The driver reported that you did not board for {seats}. The full Rs {amount} is owed to them: see My bookings.'),
  msg('{passenger} cancelled {seats}, late enough to owe you Rs {amount}.'),
  msg('Your driver recorded Rs {amount} paid in cash for {seats}.'),
  msg('Your driver recorded Rs {amount} paid by UPI for {seats}.'),
  msg('VAYORA staff cleared what you owed for {seats}, so you can book again.'),
  msg('VAYORA staff cleared what {passenger} owed you for {seats}.'),
]);

const known = (text: NotificationText): boolean =>
  TEMPLATES.has(text.template) &&
  Object.values(text.values).every((value) =>
    typeof value === 'string' ? true : Array.isArray(value) ? value.every(known) : known(value),
  );

function render(t: Translate, text: NotificationText): string {
  const values = Object.fromEntries(
    Object.entries(text.values).map(([name, value]) => [name, show(t, name, value)]),
  );
  return t(text.template, values);
}

// Only town names among the plain values are translated. A person's name, an operator, a
// time or an administrator's note is shown as written, even if it happens to match a word.
const TOWNS = new Set(['from', 'to', 'stop']);
// A moment or a day the server wrote in ISO-8601, shown in the reader's language.
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function show(t: Translate, name: string, value: TextValue): string {
  if (typeof value === 'string') {
    if (TOWNS.has(name)) return t(value);
    if (INSTANT.test(value)) return formatDateTime(value);
    return DAY.test(value) ? formatDate(value) : value;
  }
  if (Array.isArray(value)) return value.map((item) => render(t, item)).join('; ');
  return render(t, value);
}

/**
 * A notification in the reader's language, or null when it must be shown as the server's
 * English: written before templates existed, or using one this version does not know.
 */
export function translatedNotification(t: Translate, text: NotificationText | null | undefined): string | null {
  return text && known(text) ? render(t, text) : null;
}
