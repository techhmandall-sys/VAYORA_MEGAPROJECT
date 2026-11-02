// Where each screen's code comes from. The routes load a screen when it is opened; the
// navigation fetches it a moment earlier, when the reader points at or focuses its link.
export const load = {
  passenger: () => import('./pages/PassengerPages'),
  driver: () => import('./pages/DriverPages'),
  backOffice: () => import('./pages/BackOfficePages'),
  receipts: () => import('./pages/ReceiptPage'),
  payments: () => import('./pages/PaymentsPage'),
  reliability: () => import('./pages/ReliabilityPage'),
  profile: () => import('./pages/ProfilePage'),
  notifications: () => import('./pages/NotificationsPage'),
  account: () => import('./pages/AccountPage'),
  safety: () => import('./pages/SafetyAdminPages'),
  durability: () => import('./pages/AdminPages'),
  whatIf: () => import('./pages/WhatIfPage'),
};

const byPath: Record<string, () => Promise<unknown>> = {
  '/search': load.passenger,
  '/bookings': load.passenger,
  '/payments': load.payments,
  '/rides': load.driver,
  '/rides/new': load.driver,
  '/vehicles': load.driver,
  '/earnings': load.driver,
  '/record': load.reliability,
  '/notifications': load.notifications,
  '/account': load.account,
  '/admin/emergencies': load.safety,
  '/admin/durability': load.durability,
  '/admin/what-if': load.whatIf,
};

/** Fetches a screen's code ahead of a likely visit. A failure here is simply a later load. */
export function preload(path: string): void {
  const loader = byPath[path] ?? (path.startsWith('/admin') ? load.backOffice : undefined);
  void loader?.().catch(() => undefined);
}
