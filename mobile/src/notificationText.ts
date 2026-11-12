import { formatDateTime, formatDayOf } from './format';
import type { Translate } from './settings';
import type { AppNotification, NotificationText, TextValue } from './types';

// A notification in the reader's language, as web/src/lib/notificationText.ts renders it: the
// template and each value translated, towns by name, moments and days as dates. A template the
// tables do not know is shown in English with its values filled in.

const TOWNS = new Set(['from', 'to', 'stop']);
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function show(t: Translate, name: string, value: TextValue): string {
  if (typeof value === 'string') {
    if (TOWNS.has(name)) return t(value);
    if (INSTANT.test(value)) return formatDateTime(value);
    return DAY.test(value) ? formatDayOf(value) : value;
  }
  if (Array.isArray(value)) return value.map((item) => render(t, item)).join('; ');
  return render(t, value);
}

function render(t: Translate, text: NotificationText): string {
  const values = Object.fromEntries(Object.entries(text.values).map(([name, value]) => [name, show(t, name, value)]));
  return t(text.template, values);
}

export function notificationText(t: Translate, notification: AppNotification): string {
  return notification.text ? render(t, notification.text) : notification.message;
}
