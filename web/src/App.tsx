import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { lazy, useState, type ComponentType } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { homeFor, Layout, RequireRole } from './components/Layout';
import { ToastProvider } from './components/toast';
import { Notice, Page } from './components/ui';
import { AuthProvider, useAuth } from './lib/auth';
import { LanguageProvider, useT } from './lib/i18n';
import { ThemeProvider } from './lib/theme';
import { load } from './pageLoaders';
import { LandingPage } from './pages/LandingPage';

// Each screen is its own chunk, fetched when first opened, so the first page arrives sooner.
// The front page is the first thing anyone sees, so it stays in the main bundle. Signing in
// brings the form libraries, which the front page fetches once it is idle (LandingPage).
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(() => load().then((module) => ({ default: module[name] })));
}
const { passenger, driver, backOffice, receipts } = load;
const LoginPage = page(load.auth, 'LoginPage');
const RegisterPage = page(load.auth, 'RegisterPage');
const ForgotPasswordPage = page(load.auth, 'ForgotPasswordPage');
const SearchPage = page(passenger, 'SearchPage');
const BookingsPage = page(passenger, 'BookingsPage');
const PaymentsPage = page(load.payments, 'PaymentsPage');
const BookingReceiptPage = page(receipts, 'BookingReceiptPage');
const RidesPage = page(driver, 'RidesPage');
const PublishRidePage = page(driver, 'PublishRidePage');
const VehiclesPage = page(driver, 'VehiclesPage');
const EarningsPage = page(driver, 'EarningsPage');
const ReliabilityPage = page(load.reliability, 'ReliabilityPage');
const ProfilePage = page(load.profile, 'ProfilePage');
const NotificationsPage = page(load.notifications, 'NotificationsPage');
const AccountPage = page(load.account, 'AccountPage');
const OverviewPage = page(backOffice, 'OverviewPage');
const ReportsPage = page(backOffice, 'ReportsPage');
const MembersPage = page(backOffice, 'MembersPage');
const AuditPage = page(backOffice, 'AuditPage');
const DisputesPage = page(backOffice, 'DisputesPage');
const AdminRidesPage = page(backOffice, 'AdminRidesPage');
const AdminBookingsPage = page(backOffice, 'AdminBookingsPage');
const BusServicesPage = page(backOffice, 'BusServicesPage');
const StopoversPage = page(backOffice, 'StopoversPage');
const SupplyGapsPage = page(backOffice, 'SupplyGapsPage');
const DocumentChecksPage = page(backOffice, 'DocumentChecksPage');
const EmergenciesPage = page(load.safety, 'EmergenciesPage');
const DurabilityPage = page(load.durability, 'DurabilityPage');
const WhatIfPage = page(load.whatIf, 'WhatIfPage');
const AssistantPage = page(load.assistant, 'AssistantPage');
const PassengerHome = page(passenger, 'PassengerHome');
const DriverHome = page(driver, 'DriverHome');

/** Each member's own home; staff have the back office. */
function RoleHome() {
  const { user } = useAuth();
  if (user?.role === 'DRIVER') return <DriverHome />;
  if (user?.role === 'PASSENGER') return <PassengerHome />;
  return <Navigate to="/admin" replace />;
}

function Home() {
  const { user } = useAuth();
  return user ? <Navigate to={homeFor(user.role)} replace /> : <LandingPage />;
}

function NotFound() {
  const t = useT();
  return (
    <Page title={t('Page not found')}>
      <Notice tone="info">{t('There is nothing at this address.')}</Notice>
    </Page>
  );
}

export function AppRoutes() {
  return (
    <ThemeProvider>
      <ToastProvider>
        {/* Motion follows the reader's device: none of it for those who ask for less. */}
        <MotionConfig reducedMotion="user">
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route element={<RequireRole role="PASSENGER" />}>
          <Route path="search" element={<SearchPage />} />
          <Route path="bookings" element={<BookingsPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="receipts/booking/:id" element={<BookingReceiptPage />} />
        </Route>
        <Route element={<RequireRole role="DRIVER" />}>
          <Route path="rides" element={<RidesPage />} />
          <Route path="rides/new" element={<PublishRidePage />} />
          <Route path="vehicles" element={<VehiclesPage />} />
          <Route path="earnings" element={<EarningsPage />} />
          <Route path="record" element={<ReliabilityPage />} />
        </Route>
        <Route element={<RequireRole />}>
          <Route path="users/:id" element={<ProfilePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="assistant" element={<AssistantPage />} />
          <Route path="home" element={<RoleHome />} />
        </Route>
        <Route element={<RequireRole role="ADMIN" />}>
          <Route path="admin" element={<OverviewPage />} />
          <Route path="admin/reports" element={<ReportsPage />} />
          <Route path="admin/emergencies" element={<EmergenciesPage />} />
          <Route path="admin/users" element={<MembersPage />} />
          <Route path="admin/durability" element={<DurabilityPage />} />
          <Route path="admin/what-if" element={<WhatIfPage />} />
          <Route path="admin/audit" element={<AuditPage />} />
          <Route path="admin/disputes" element={<DisputesPage />} />
          <Route path="admin/rides" element={<AdminRidesPage />} />
          <Route path="admin/bookings" element={<AdminBookingsPage />} />
          <Route path="admin/buses" element={<BusServicesPage />} />
          <Route path="admin/stopovers" element={<StopoversPage />} />
          <Route path="admin/supply-gaps" element={<SupplyGapsPage />} />
          <Route path="admin/document-checks" element={<DocumentChecksPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
        </MotionConfig>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default function App() {
  // A failed request is shown with a retry button; silent automatic retries would
  // hide a 4xx the user needs to read.
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }));
  return (
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </LanguageProvider>
  );
}
