import { motion } from 'framer-motion';
import {
  Activity,
  Award,
  BadgeCheck,
  Bell,
  Bus,
  Car,
  CarFront,
  CirclePlus,
  Ellipsis,
  FlaskConical,
  Flag,
  Fuel,
  IndianRupee,
  Languages,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  Route,
  ScrollText,
  Search,
  Siren,
  Sun,
  Ticket,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Suspense, useEffect, useState, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../lib/auth';
import { LANGUAGES, msg, useLanguage, useT, type Language } from '../lib/i18n';
import { PHONE, useMediaQuery } from '../lib/media';
import { themeLabels, useTheme, type ThemeChoice } from '../lib/theme';
import { preload } from '../pageLoaders';
import { BarTitle, BarTitleContext, useScrolled } from './pageTitle';
import type { Role } from '../lib/types';
import { NotificationBell } from './bell';
import { ErrorBoundary } from './ErrorBoundary';
import { NotificationWatcher, OfflineBanner, useUnread } from './live';
import { CommandPalette, type Command } from './palette';
import { initialsOf } from './photo';
import { Sheet } from './sheet';
import { SosPanel } from './Sos';
import { Avatar, Button, PageSkeleton } from './ui';

interface Section {
  to: string;
  label: string;
  icon: LucideIcon;
  /** The heading it sits under in the sidebar, where a role has enough pages to need them. */
  group?: string;
}

const OPERATIONS = msg('Operations');
const TRUST = msg('Trust and safety');
const INSIGHT = msg('Insights');

const links: Record<Role, Section[]> = {
  PASSENGER: [
    { to: '/search', label: msg('Find a ride'), icon: Search },
    { to: '/bookings', label: msg('My bookings'), icon: Ticket },
    { to: '/payments', label: msg('Payments'), icon: Wallet },
  ],
  DRIVER: [
    { to: '/rides', label: msg('My rides'), icon: Car },
    { to: '/rides/new', label: msg('Publish a ride'), icon: CirclePlus },
    { to: '/vehicles', label: msg('My vehicles'), icon: CarFront },
    { to: '/earnings', label: msg('Earnings'), icon: IndianRupee },
    { to: '/record', label: msg('My record'), icon: Award },
  ],
  ADMIN: [
    { to: '/admin', label: msg('Overview'), icon: LayoutDashboard, group: OPERATIONS },
    { to: '/admin/reports', label: msg('Reports'), icon: Flag, group: TRUST },
    { to: '/admin/emergencies', label: msg('Emergencies'), icon: Siren, group: TRUST },
    { to: '/admin/document-checks', label: msg('Document checks'), icon: BadgeCheck, group: TRUST },
    { to: '/admin/users', label: msg('Members'), icon: Users, group: TRUST },
    { to: '/admin/rides', label: msg('Rides'), icon: Route, group: OPERATIONS },
    { to: '/admin/bookings', label: msg('Bookings'), icon: Ticket, group: OPERATIONS },
    { to: '/admin/buses', label: msg('Bus services'), icon: Bus, group: OPERATIONS },
    { to: '/admin/stopovers', label: msg('Rest stops and chargers'), icon: Fuel, group: OPERATIONS },
    { to: '/admin/supply-gaps', label: msg('Unmet demand'), icon: TrendingUp, group: INSIGHT },
    { to: '/admin/durability', label: msg('Booking durability'), icon: Activity, group: INSIGHT },
    { to: '/admin/what-if', label: msg('What if'), icon: FlaskConical, group: INSIGHT },
    { to: '/admin/audit', label: msg('Audit log'), icon: ScrollText, group: TRUST },
  ],
};

const account: Section = { to: '/account', label: msg('My account'), icon: UserRound };

export const homeFor = (role: Role): string => links[role][0]?.to ?? '/';

const roleNames: Record<Role, string> = { PASSENGER: msg('Passenger'), DRIVER: msg('Driver'), ADMIN: msg('Administrator') };

// A tab in the phone's bottom bar: icon over a short label, tinted when current.
const tabLink = ({ isActive }: { isActive: boolean }) =>
  `relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-0.5 py-1.5 text-[10px] font-medium ` +
  `focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30 ${isActive ? 'text-teal-700' : 'text-slate-500'}`;

/** The VAYORA mark: a route between two towns. */
function Logo() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="h-8 w-8 flex-none drop-shadow-sm">
      <rect width="32" height="32" rx="9" fill="rgb(var(--accent))" />
      <path d="M9 22c3-9 11-3 14-12" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="9" cy="22" r="2.6" fill="#fff" />
      <circle cx="23" cy="10" r="2.6" fill="#fff" />
    </svg>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 text-[17px] font-bold tracking-tight text-slate-900" translate="no">
      <Logo />
      <span className={compact ? 'hidden lg:inline' : ''}>{'VAYORA'}</span>
    </span>
  );
}

function UnreadBadge({ count, floating = false }: { count: number; floating?: boolean }) {
  const t = useT();
  if (count <= 0) return null;
  return (
    <span
      key={count}
      className={`inline-flex min-w-[1.25rem] animate-badge-pop items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold leading-5 text-white ${
        floating ? 'absolute -top-0.5 left-1/2 ml-1.5 ring-2 ring-surface' : 'absolute right-1 top-1 lg:relative lg:right-auto lg:top-auto lg:ml-auto'
      }`}
    >
      {count}
      <span className="sr-only"> {t('unread')}</span>
    </span>
  );
}

/** One page in the sidebar. A marker slides from the page being left to the one arrived at. */
function SideLink({ section, count = 0 }: { section: Section; count?: number }) {
  const t = useT();
  const { to, label, icon: Icon } = section;
  return (
    <NavLink
      to={to}
      end
      title={t(label)}
      onMouseEnter={() => preload(to)}
      onFocus={() => preload(to)}
      className={({ isActive }) =>
        `relative flex items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-sm lg:justify-start lg:py-2 ` +
        `focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30 ${
          isActive ? 'font-semibold text-teal-800' : 'font-medium text-slate-600 hover:bg-slate-900/[0.04] hover:text-slate-900'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="side-marker"
              aria-hidden="true"
              transition={{ type: 'spring', stiffness: 520, damping: 42 }}
              className="absolute inset-0 rounded-xl bg-teal-600/[0.12]"
            />
          )}
          <Icon aria-hidden="true" className="relative h-[18px] w-[18px] flex-none" />
          <span className="relative sr-only truncate lg:not-sr-only">{t(label)}</span>
          <UnreadBadge count={count} />
        </>
      )}
    </NavLink>
  );
}

/** Every page of a role, down the side: icons alone on a tablet, with their names on a wider screen. */
function Sidebar({ role, name, onSignOut }: { role: Role; name: string; onSignOut: () => void }) {
  const t = useT();
  const count = useUnread() ?? 0;
  const headed = links[role].filter((section) => section.group);
  const headings = [...new Set(headed.map((section) => section.group!))];
  return (
    <aside className="glass fixed inset-y-0 left-0 z-40 flex w-[4.75rem] flex-col border-r border-slate-900/[0.07] lg:w-64 print:hidden">
      <div className="flex h-14 flex-none items-center justify-center px-4 lg:justify-start">
        <Brand compact />
      </div>
      <nav aria-label={t('Main')} className="thin-scroll flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {headings.length === 0 && links[role].map((section) => <SideLink key={section.to} section={section} />)}
        {headings.map((heading) => (
          <div key={heading} className="space-y-1 pb-3">
            <h2 className="hidden px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 lg:block">{t(heading)}</h2>
            {headed.filter((section) => section.group === heading).map((section) => <SideLink key={section.to} section={section} />)}
          </div>
        ))}
        <div className="mt-3 space-y-1 border-t border-slate-900/[0.07] pt-3">
          <SideLink section={{ to: '/notifications', label: msg('Notifications'), icon: Bell }} count={count} />
          <SideLink section={account} />
        </div>
      </nav>
      <div className="flex flex-none flex-col items-center gap-2 border-t border-slate-900/[0.07] p-3 lg:flex-row">
        <Avatar initials={initialsOf(name)} size="sm" />
        <div className="hidden min-w-0 flex-1 lg:block">
          <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
          <p className="truncate text-xs text-slate-500">{t(roleNames[role])}</p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          aria-label={t('Sign out')}
          title={t('Sign out')}
          className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full text-slate-600 hover:bg-slate-900/[0.06] hover:text-slate-900 active:scale-90 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30"
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}

/** Each language is listed in its own script, so it can be found by someone who reads only that one. */
function LanguageSwitcher() {
  const t = useT();
  const { language, setLanguage } = useLanguage();
  return (
    <label className="flex items-center text-sm text-slate-600">
      <span className="sr-only">{t('Language')}</span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        className="select-ios rounded-full border-0 bg-slate-900/[0.05] py-1.5 pl-3 text-sm font-medium text-slate-800 hover:bg-slate-900/[0.09] focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30"
      >
        {LANGUAGES.map((option) => (
          <option key={option.code} value={option.code} lang={option.code}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

const themeOrder: ThemeChoice[] = ['system', 'light', 'dark'];
const themeIcons: Record<ThemeChoice, LucideIcon> = { system: Monitor, light: Sun, dark: Moon };

/** One tap moves through match device, light and dark; the name says which is on. */
function ThemeSwitcher() {
  const t = useT();
  const { choice, setChoice } = useTheme();
  const Icon = themeIcons[choice];
  const nextChoice = themeOrder[(themeOrder.indexOf(choice) + 1) % themeOrder.length];

  // The new theme spreads out from the button, where the browser can draw that and the reader
  // has not asked for less motion. Everywhere else it simply changes.
  const change = (event: MouseEvent) => {
    const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still || typeof document.startViewTransition !== 'function') {
      setChoice(nextChoice);
      return;
    }
    const root = document.documentElement;
    root.style.setProperty('--reveal-x', `${event.clientX}px`);
    root.style.setProperty('--reveal-y', `${event.clientY}px`);
    document.startViewTransition(() => flushSync(() => setChoice(nextChoice)));
  };

  return (
    <button
      type="button"
      onClick={change}
      aria-label={t('Theme: {name}', { name: t(themeLabels[choice]) })}
      title={t('Theme: {name}', { name: t(themeLabels[choice]) })}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/[0.05] text-slate-700 hover:bg-slate-900/[0.09] active:scale-90 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30"
    >
      <Icon key={choice} aria-hidden="true" className="h-4 w-4 animate-badge-pop" />
    </button>
  );
}

/** What the command palette offers a member: every page of their role, then quick settings and actions. */
function useCommands(role: Role, actions: { emergency?: () => void; signOut: () => void }): Command[] {
  const navigate = useNavigate();
  const { setChoice } = useTheme();
  const { setLanguage } = useLanguage();
  const pages = [...links[role], { to: '/notifications', label: msg('Notifications'), icon: Bell }, account];
  return [
    ...pages.map(({ to, label, icon }) => ({
      id: `page:${to}`, group: msg('Pages'), label, icon, run: () => navigate(to), onHighlight: () => preload(to),
    })),
    ...themeOrder.map((choice) => ({
      id: `theme:${choice}`, group: msg('Theme'), label: themeLabels[choice], icon: themeIcons[choice], run: () => setChoice(choice),
    })),
    ...LANGUAGES.map(({ code, name }) => ({
      id: `language:${code}`, group: msg('Language'), label: name, literal: true, icon: Languages, run: () => setLanguage(code),
    })),
    ...(actions.emergency ? [{ id: 'emergency', group: msg('Actions'), label: msg('Emergency'), icon: Siren, run: actions.emergency }] : []),
    { id: 'sign-out', group: msg('Actions'), label: msg('Sign out'), icon: LogOut, run: actions.signOut },
  ];
}

function MemberPalette({ role, emergency, signOut }: { role: Role; emergency?: () => void; signOut: () => void }) {
  return <CommandPalette commands={useCommands(role, { emergency, signOut })} />;
}

/** iOS-style navigation for phones: the main sections along the bottom, the rest in a sheet. */
function PhoneTabBar({ role, onSignOut }: { role: Role; onSignOut: () => void }) {
  const t = useT();
  const count = useUnread() ?? 0;
  const location = useLocation();
  const [more, setMore] = useState(false);
  const main = links[role].slice(0, 3);
  const rest = [...links[role].slice(3), account];
  const inRest = rest.some((section) => location.pathname === section.to);
  return (
    <>
      <nav
        aria-label={t('Main')}
        className="glass fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-1 border-t border-slate-900/[0.07] px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 print:hidden"
      >
        {[...main, { to: '/notifications', label: msg('Notifications'), icon: Bell }].map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end className={tabLink} onTouchStart={() => preload(to)} onFocus={() => preload(to)}>
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="tab-marker"
                    aria-hidden="true"
                    transition={{ type: 'spring', stiffness: 520, damping: 42 }}
                    className="absolute inset-0 rounded-2xl bg-teal-600/[0.1]"
                  />
                )}
                <Icon aria-hidden="true" className="relative h-6 w-6" strokeWidth={isActive ? 2.4 : 2} />
                <span className="relative max-w-full truncate">{t(label)}</span>
                {to === '/notifications' && <UnreadBadge count={count} floating />}
              </>
            )}
          </NavLink>
        ))}
        <button type="button" onClick={() => setMore(true)} aria-expanded={more} className={tabLink({ isActive: inRest })}>
          <Ellipsis aria-hidden="true" className="h-6 w-6" strokeWidth={2} />
          <span>{t('More')}</span>
        </button>
      </nav>
      <Sheet open={more} onClose={() => setMore(false)} title={t('More')}>
        <ul className="divide-y divide-slate-900/[0.06] overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-900/[0.05]">
          {rest.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink to={to} end onClick={() => setMore(false)} className="flex items-center gap-3 px-4 py-3.5 text-[15px] font-medium text-slate-900 active:bg-slate-100">
                <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-600/[0.12] text-teal-800">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                {t(label)}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-900/[0.05]">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
        <Button tone="secondary" className="mt-4 w-full py-3" onClick={onSignOut}>
          <LogOut aria-hidden="true" className="h-4 w-4" />
          {t('Sign out')}
        </Button>
      </Sheet>
    </>
  );
}

export function Layout() {
  const t = useT();
  const { user, logout } = useAuth();
  const [emergency, setEmergency] = useState(false);
  const location = useLocation();
  const phone = useMediaQuery(PHONE);
  const member = user && user.role !== 'ADMIN';
  const side = user && !phone;

  const scrolled = useScrolled();
  // A screen's title once its large title has scrolled under the bar.
  const [barTitle, setBarTitle] = useState<string | null>(null);

  // Each role has its own tint (index.css): the whole app takes it on.
  useEffect(() => {
    const root = document.documentElement;
    if (user) root.dataset.role = user.role;
    else delete root.dataset.role;
  }, [user]);

  return (
    <div className="ambient min-h-screen text-slate-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2 focus:shadow-float"
      >
        {t('Skip to content')}
      </a>
      {user && <NotificationWatcher />}
      {side && <Sidebar role={user.role} name={user.fullName} onSignOut={logout} />}
      <div className={side ? 'pl-[4.75rem] lg:pl-64 print:pl-0' : ''}>
        <OfflineBanner />
        {/* As on iOS: clear at the top of a screen, frosted once something scrolls under it. */}
        <header
          className={`sticky top-0 z-30 border-b transition-[background-color,border-color,backdrop-filter] duration-300 print:hidden ${
            scrolled ? 'glass border-slate-900/[0.07]' : 'border-transparent'
          }`}
        >
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6">
            {!side && <Brand compact={Boolean(barTitle)} />}
            {user && <MemberPalette role={user.role} emergency={member ? () => setEmergency(true) : undefined} signOut={logout} />}
            <BarTitle title={barTitle} />
            <div className="ml-auto flex items-center gap-2 text-sm text-slate-600">
              {/* On a phone a signed-in member finds these in the More sheet: the bar has room for little. */}
              {(!user || !phone) && <LanguageSwitcher />}
              {(!user || !phone) && <ThemeSwitcher />}
              {!user && location.pathname !== '/login' && location.pathname !== '/register' && (
                <NavLink to="/login" className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white shadow-md shadow-accent/25 hover:bg-accent-strong focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30">
                  {t('Sign in')}
                </NavLink>
              )}
              {side && <NotificationBell />}
              {member && (
                <Button tone="danger" aria-expanded={emergency} onClick={() => setEmergency(true)}>
                  <Siren aria-hidden="true" className="h-4 w-4" />
                  {t('Emergency')}
                </Button>
              )}
              {user && phone && <Avatar initials={initialsOf(user.fullName)} size="sm" />}
            </div>
          </div>
        </header>
        {member && emergency && <SosPanel onClose={() => setEmergency(false)} />}
        {/* Keyed by the path, so each screen arrives with the page transition and a failure on one clears on the next. */}
        <main
          id="main"
          key={location.pathname}
          className={`mx-auto max-w-5xl animate-page-in px-4 pt-6 sm:px-6 sm:pt-8 print:p-0 ${user && phone ? 'pb-28' : 'pb-20'}`}
        >
          <ErrorBoundary>
            <BarTitleContext.Provider value={setBarTitle}>
              <Suspense fallback={<PageSkeleton />}>
                <Outlet />
              </Suspense>
            </BarTitleContext.Provider>
          </ErrorBoundary>
        </main>
      </div>
      {user && phone && <PhoneTabBar role={user.role} onSignOut={logout} />}
    </div>
  );
}

/** Lets a route render only for a signed-in user, and with `role` only for that role. */
export function RequireRole({ role }: { role?: Role }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return <Outlet />;
}
