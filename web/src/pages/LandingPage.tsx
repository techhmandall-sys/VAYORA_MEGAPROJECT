import {
  ArrowRight,
  ArrowUpDown,
  BatteryCharging,
  Bus,
  CalendarClock,
  Check,
  ChevronDown,
  Clock3,
  Flag,
  Footprints,
  HeartHandshake,
  KeyRound,
  Languages,
  MessagesSquare,
  Search,
  Siren,
  Star,
  Ticket,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import heroNarrow from '../assets/khandala-900.webp';
import heroWide from '../assets/khandala-1600.webp';
import { CountUp } from '../components/countup';
import { PlaceField } from '../components/places';
import { SelectField, TextField } from '../components/ui';
import { todayInIndia } from '../lib/format';
import { useT } from '../lib/i18n';
import { PLACES } from '../lib/places';
import { recentPlaces, wantRoute } from '../lib/recent';
import { preload } from '../pageLoaders';

/** Intercity routes to start a search from. Places on the list, not a claim about demand. */
const ROUTE_IDEAS: [string, string][] = [
  ['Kolhapur', 'Pune'],
  ['Mumbai', 'Pune'],
  ['Pune', 'Nashik'],
  ['Bengaluru', 'Mysuru'],
  ['New Delhi', 'Jaipur'],
  ['Chennai', 'Puducherry'],
  ['Hyderabad', 'Vijayawada'],
  ['Ahmedabad', 'Vadodara'],
];

/** A section that rises into place the first time it is scrolled to; shown at once where that cannot be told. */
function Reveal({ children, className = '', id }: { children: ReactNode; className?: string; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (shown || !ref.current) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [shown]);
  return (
    <div ref={ref} id={id} className={`scroll-mt-24 ${shown ? 'animate-pop-in' : 'opacity-0'} ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ children, lead }: { children: ReactNode; lead?: string }) {
  return (
    <div className="space-y-1.5">
      <h2 className="text-[24px] font-bold tracking-tight text-slate-950 sm:text-[30px]">{children}</h2>
      {lead && <p className="max-w-2xl text-[15px] leading-relaxed text-slate-500">{lead}</p>}
    </div>
  );
}

interface Wanted {
  from: string;
  to: string;
}

/**
 * The search, first thing on the page, as on the search screen itself: where from, where to,
 * when and for how many. It waits on the search page past signing up or signing in.
 */
function HeroSearch({ route, onRoute, formRef }: { route: Wanted; onRoute: (route: Wanted) => void; formRef: RefObject<HTMLFormElement> }) {
  const t = useT();
  const navigate = useNavigate();
  const today = todayInIndia();
  const [date, setDate] = useState(today);
  const [seats, setSeats] = useState(1);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    wantRoute({ ...route, date: date >= today ? date : today, seats });
    navigate('/register?as=passenger');
  };
  return (
    <form
      ref={formRef}
      onSubmit={submit}
      aria-label={t('Find a ride')}
      className="grid scroll-mt-24 gap-3 rounded-[1.75rem] bg-surface p-4 text-slate-900 shadow-float ring-1 ring-black/5 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_10.5rem_6.5rem_auto] lg:items-end"
    >
      <PlaceField label={t('From')} value={route.from} onChange={(from) => onRoute({ ...route, from })} />
      <button
        type="button"
        aria-label={t('Swap start and destination')}
        title={t('Swap start and destination')}
        onClick={() => onRoute({ from: route.to, to: route.from })}
        className="mx-auto -my-1 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700 ring-1 ring-slate-900/[0.06] transition-transform hover:bg-slate-200 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30 lg:my-0 lg:mb-0.5 lg:rotate-90"
      >
        <ArrowUpDown aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
      </button>
      <PlaceField label={t('To')} value={route.to} onChange={(to) => onRoute({ ...route, to })} />
      <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3 lg:contents">
        <TextField label={t('Date')} type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} />
        <SelectField label={t('Seats')} value={seats} onChange={(event) => setSeats(Number(event.target.value))}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </SelectField>
      </div>
      <button
        type="submit"
        disabled={route.from === route.to}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-[16px] font-bold text-white shadow-glow transition-[transform,background-color] hover:bg-accent-strong active:scale-[0.97] focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30 disabled:pointer-events-none disabled:opacity-40"
      >
        <Search aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.5} />
        {t('Find a ride')}
      </button>
    </form>
  );
}

function Hero({ route, onRoute, formRef }: { route: Wanted; onRoute: (route: Wanted) => void; formRef: RefObject<HTMLFormElement> }) {
  const t = useT();
  return (
    <section className="relative isolate z-10 rounded-[2rem] px-5 pb-6 pt-10 text-white shadow-float sm:px-10 sm:pb-9 sm:pt-16">
      {/* Clipped on their own: a place list opening from the search must be free to pass the edge. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[2rem] bg-navy">
        <img
          src={heroWide}
          srcSet={`${heroNarrow} 900w, ${heroWide} 1600w`}
          sizes="(max-width: 640px) 100vw, 1024px"
          alt=""
          decoding="async"
          className="h-full w-full object-cover object-[70%_center]"
        />
        {/* Navy over the photograph, deepest under the words, so white text stays readable on it. */}
        <div className="absolute inset-0 bg-gradient-to-b from-navy/80 via-navy/55 to-navy/90 sm:bg-gradient-to-r sm:from-navy/90 sm:via-navy/60 sm:to-navy/20" />
      </div>
      <div className="max-w-2xl space-y-5">
        <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold tracking-wide ring-1 ring-inset ring-white/25 backdrop-blur">
          {t('Any route in India')}
        </p>
        <h1 className="text-balance text-[38px] font-extrabold leading-[1.05] tracking-tight sm:text-[56px]">{t('Your Journey. Shared Better.')}</h1>
        <p className="max-w-xl text-[17px] leading-relaxed text-white/90">
          {t('Book a seat in a car already making the trip, or fill the empty seats in yours. If your plans change, VAYORA reminds you to give the seat back while someone else can still take it.')}
        </p>
      </div>
      <div className="mt-8">
        <HeroSearch route={route} onRoute={onRoute} formRef={formRef} />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Link
          to="/register?as=driver"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/15 px-5 text-[15px] font-bold text-white ring-1 ring-inset ring-white/40 backdrop-blur transition-[transform,background-color] hover:bg-white/25 active:scale-[0.97] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
        >
          {t('Offer a ride')}
          <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
        </Link>
        <p className="text-sm text-white/85">
          {t('Already have an account?')}{' '}
          <Link to="/login" className="font-semibold text-white underline decoration-white/50 underline-offset-4 hover:decoration-white">
            {t('Sign in')}
          </Link>
        </p>
      </div>
    </section>
  );
}

/** Places this visitor searched before, on this device, and routes to start from: one tap fills the search. */
function StartingPoints({ onRoute, onPlace }: { onRoute: (route: Wanted) => void; onPlace: (place: string) => void }) {
  const t = useT();
  const [recent] = useState(() => recentPlaces().slice(0, 5));
  const chip =
    'inline-flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-[15px] font-medium text-slate-800 shadow-card ring-1 ring-slate-900/[0.06] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-float active:scale-[0.97] focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30';
  return (
    <Reveal className="space-y-6">
      {recent.length > 0 && (
        <section aria-labelledby="recent-heading" className="space-y-3">
          <h2 id="recent-heading" className="flex items-center gap-2 text-[15px] font-semibold text-slate-500">
            <Clock3 aria-hidden="true" className="h-4 w-4" />
            {t('Recently searched')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {recent.map((place) => (
              <button key={place} type="button" className={chip} onClick={() => onPlace(place)}>
                {t(place)}
              </button>
            ))}
          </div>
        </section>
      )}
      <section aria-labelledby="ideas-heading" className="space-y-3">
        <SectionTitle lead={t('Tap one to fill in the search.')}>
          <span id="ideas-heading">{t('Routes to start with')}</span>
        </SectionTitle>
        <div className="flex flex-wrap gap-2">
          {ROUTE_IDEAS.map(([from, to]) => (
            <button key={`${from}-${to}`} type="button" className={chip} aria-label={t('{from} to {to}', { from: t(from), to: t(to) })} onClick={() => onRoute({ from, to })}>
              <span aria-hidden="true">{t(from)}</span>
              <ArrowRight aria-hidden="true" className="h-4 w-4 text-teal-700" strokeWidth={2.4} />
              <span aria-hidden="true">{t(to)}</span>
            </button>
          ))}
        </div>
      </section>
    </Reveal>
  );
}

function Facts() {
  const t = useT();
  const facts = [
    { value: PLACES.length, label: t('cities to choose from') },
    { value: 7, label: t('days ahead you can book') },
    { value: 3, label: t('languages') },
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      {facts.map((fact) => (
        <div key={fact.label} className="flex flex-col rounded-2xl bg-surface px-4 py-5 text-center shadow-card ring-1 ring-slate-900/[0.04]">
          <dt className="text-[13px] font-medium text-slate-500">{fact.label}</dt>
          <dd className="order-first text-[34px] font-extrabold tabular-nums tracking-tight text-slate-950">
            <CountUp value={fact.value} format={(n) => String(Math.round(n))} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A card with an icon in the brand's soft green: how-it-works steps, reasons, safety. */
function IconCard({ icon: Icon, title, body, number }: { icon: LucideIcon; title: string; body: string; number?: number }) {
  return (
    <li className="relative overflow-hidden rounded-2xl bg-surface p-5 shadow-card ring-1 ring-slate-900/[0.04] transition-[transform,box-shadow] duration-300 ease-settle hover:-translate-y-0.5 hover:shadow-float">
      {number !== undefined && (
        <span aria-hidden="true" className="absolute right-4 top-2 text-[64px] font-black leading-none text-slate-950/[0.05]">
          {number}
        </span>
      )}
      <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-800">
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <h3 className="mt-4 text-[17px] font-semibold text-slate-900">{title}</h3>
      <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{body}</p>
    </li>
  );
}

function HowItWorks() {
  const t = useT();
  const steps: { icon: LucideIcon; title: string; body: string }[] = [
    {
      icon: Search,
      title: t('Search your route'),
      body: t('Choose where you start and where you are going, or a point on the map. Rides passing within reach are shown with the walk to where you board.'),
    },
    {
      icon: Ticket,
      title: t('Book a seat'),
      body: t('Your seat is held while you decide. Many drivers confirm at once; the others answer your request. You pay your driver after the ride.'),
    },
    {
      icon: MessagesSquare,
      title: t('Travel together'),
      body: t('Chat with your driver and follow the car on the map. The emergency button puts calling 112 first.'),
    },
  ];
  return (
    <Reveal id="how-it-works" className="space-y-5">
      <SectionTitle>{t('How it works')}</SectionTitle>
      <ol className="grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <IconCard key={step.title} {...step} number={index + 1} />
        ))}
      </ol>
    </Reveal>
  );
}

function Features() {
  const t = useT();
  const features: { icon: LucideIcon; title: string; body: string }[] = [
    { icon: Footprints, title: t('Pickups on the way'), body: t('A driver can take a few minutes out of the way to pick you up where the road passes.') },
    { icon: HeartHandshake, title: t('Women-only rides'), body: t('A driver can offer a ride to women only; only women see it or can book it.') },
    { icon: CalendarClock, title: t('Flexible bookings'), body: t('Choose a window of time. If your driver withdraws, VAYORA looks for another ride in it, at the same price.') },
    { icon: BatteryCharging, title: t('Electric cars'), body: t('A route an electric car cannot cover on one charge is caught before it is published, with chargers along the way.') },
    { icon: Bus, title: t('Buses when no car goes'), body: t('When no ride fits, buses on the same stretch are suggested.') },
    { icon: Languages, title: t('Three languages'), body: t('Every screen in English, Hindi and Marathi, receipts included.') },
  ];
  return (
    <Reveal className="space-y-5">
      <SectionTitle>{t('Made for travelling between cities')}</SectionTitle>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <IconCard key={feature.title} {...feature} />
        ))}
      </ul>
    </Reveal>
  );
}

/** What keeps a trip accountable: each one a feature the app has, worded as it works. */
function TrustAndSafety() {
  const t = useT();
  const points: { icon: LucideIcon; title: string; body: string }[] = [
    {
      icon: Siren,
      title: t('Call 112 first'),
      body: t('The emergency button on every screen puts calling 112 first, then alerts VAYORA staff with where you are, and texts your emergency contacts where texts are set up.'),
    },
    {
      icon: Star,
      title: t('Ratings both ways'),
      body: t('Passengers and drivers rate each other after every trip, and every profile shows the rides each member has completed.'),
    },
    {
      icon: KeyRound,
      title: t('Boarding codes'),
      body: t('Each passenger has a four-digit code the driver checks at pickup, so the right person gets into the right car.'),
    },
    {
      icon: Flag,
      title: t('Report anyone'),
      body: t('Any member can be reported from their profile, and VAYORA staff look at every report.'),
    },
  ];
  return (
    <Reveal id="safety" className="space-y-5">
      <SectionTitle lead={t('What keeps every trip accountable, and what to do if something goes wrong.')}>{t('Trust and safety')}</SectionTitle>
      <ul className="grid gap-3 sm:grid-cols-2">
        {points.map((point) => (
          <IconCard key={point.title} {...point} />
        ))}
      </ul>
    </Reveal>
  );
}

/** The project's one idea, for anyone: a seat given back early is a seat someone else can take. */
function EarlyMatters() {
  const t = useT();
  return (
    <Reveal>
      <section className="grid gap-6 rounded-3xl bg-surface p-6 shadow-card ring-1 ring-slate-900/[0.04] sm:p-8 md:grid-cols-[1.2fr_1fr] md:items-center">
        <div className="space-y-3">
          <SectionTitle>{t('Why giving a seat back early matters')}</SectionTitle>
          <p className="text-[15px] leading-relaxed text-slate-600">
            {t('A seat given back three days before departure can still be booked by someone else. Given back two hours before, it usually travels empty. So VAYORA asks early, asks for less of the fare the earlier you cancel, and never cancels anyone on a guess.')}
          </p>
          <p className="text-[15px] font-medium leading-relaxed text-slate-800">
            {t('The project measures what counts: rides completed for every 100 searches, not bookings made.')}
          </p>
        </div>
        <div aria-hidden="true" className="space-y-2">
          <div className="h-3 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500" />
          <div className="flex justify-between gap-4 text-[13px] font-medium">
            <span className="flex max-w-[45%] items-start gap-1.5 text-emerald-800">
              <Check className="mt-0.5 h-3.5 w-3.5 flex-none" strokeWidth={3} />
              {t('Days before: someone else can book it')}
            </span>
            <span className="max-w-[45%] text-right text-red-700">{t('Hours before: the seat is usually lost')}</span>
          </div>
        </div>
      </section>
    </Reveal>
  );
}

function Side({ title, points, action, to, tone }: { title: string; points: string[]; action: string; to: string; tone: string }) {
  return (
    <section className={`flex flex-col gap-4 rounded-3xl p-6 text-white shadow-float sm:p-7 ${tone}`}>
      <h2 className="text-[22px] font-bold tracking-tight">{title}</h2>
      <ul className="flex-1 space-y-2.5">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-2.5 text-[15px] leading-snug text-white/90">
            <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-white/20">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            {point}
          </li>
        ))}
      </ul>
      <Link
        to={to}
        className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full bg-white px-5 text-[15px] font-bold text-navy shadow-lg shadow-black/10 transition-transform hover:-translate-y-0.5 active:scale-[0.97] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
      >
        {action}
        <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
      </Link>
    </section>
  );
}

function TwoSides() {
  const t = useT();
  return (
    <Reveal className="grid gap-4 md:grid-cols-2">
      <Side
        title={t('For passengers')}
        points={[t('Pay only for the stretch you ride'), t("Each driver's record of rides kept, and their ratings"), t('Pay the driver directly, in cash or by UPI')]}
        action={t('Create a passenger account')}
        to="/register?as=passenger"
        tone="bg-navy"
      />
      <Side
        title={t('For drivers')}
        points={[t('Publish once, or repeat a ride every week'), t('Approve each passenger, or let them book at once'), t('Keep the whole fare: VAYORA charges nothing')]}
        action={t('Create a driver account')}
        to="/register?as=driver"
        tone="bg-accent"
      />
    </Reveal>
  );
}

/** Questions a newcomer has, answered from how the app works, without figures that could drift from the server's. */
function Faq() {
  const t = useT();
  const questions = [
    {
      q: t('Does VAYORA charge a fee?'),
      a: t('No. VAYORA takes no fee and no commission. Passengers pay their driver directly after the ride, in cash or by UPI.'),
    },
    {
      q: t('What if I need to cancel?'),
      a: t('The earlier you cancel, the less you pay: nothing if you cancel early enough, and never anything if your driver cancels. My bookings shows what cancelling would cost at any moment.'),
    },
    {
      q: t('How are prices set?'),
      a: t('Each driver sets the price per seat for every stretch of the ride. VAYORA suggests one from the distance, and you pay only for the stretch you ride.'),
    },
    {
      q: t('Which cities can I travel between?'),
      a: t('Any two of the {n} cities on VAYORA, across India. Road distances and times are worked out between Kolhapur and Pune; elsewhere they are a straight-line estimate, and say so.', { n: PLACES.length }),
    },
  ];
  return (
    <Reveal id="faq" className="space-y-5">
      <SectionTitle>{t('Frequently asked questions')}</SectionTitle>
      <div className="divide-y divide-slate-900/[0.06] overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-slate-900/[0.04]">
        {questions.map(({ q, a }) => (
          <details key={q} className="more group">
            <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 px-5 py-3.5 text-[16px] font-semibold text-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-teal-600/30">
              {q}
              <ChevronDown aria-hidden="true" className="more-chevron h-5 w-5 flex-none text-slate-400" />
            </summary>
            <p className="px-5 pb-5 text-[15px] leading-relaxed text-slate-600">{a}</p>
          </details>
        ))}
      </div>
    </Reveal>
  );
}

function Footer() {
  const t = useT();
  const link = 'inline-flex items-center rounded-full text-[15px] text-white/80 touch:min-h-11 underline-offset-4 hover:text-white hover:underline focus:outline-none focus-visible:ring-4 focus-visible:ring-white/40';
  return (
    <footer className="rounded-3xl bg-navy px-6 py-8 text-white sm:px-10 sm:py-10">
      <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="text-[22px] font-extrabold tracking-tight">VAYORA</p>
          <p className="text-[15px] text-white/80">{t('Your Journey. Shared Better.')}</p>
        </div>
        <nav aria-label={t('Pages')} className="grid grid-cols-2 gap-x-10 gap-y-2 sm:grid-cols-3">
          <a href="#how-it-works" className={link}>
            {t('How it works')}
          </a>
          <a href="#safety" className={link}>
            {t('Trust and safety')}
          </a>
          <a href="#faq" className={link}>
            {t('Frequently asked questions')}
          </a>
          <Link to="/register?as=passenger" className={link}>
            {t('Find a ride')}
          </Link>
          <Link to="/register?as=driver" className={link}>
            {t('Offer a ride')}
          </Link>
          <Link to="/login" className={link}>
            {t('Sign in')}
          </Link>
        </nav>
      </div>
      <div className="mt-8 space-y-1 border-t border-white/15 pt-6 text-[13px] leading-relaxed text-white/70">
        <p>{t('A final-year project at DYPCET, Kolhapur. Text messages and calls are simulated unless real services are connected.')}</p>
        <p>{t('Road distances and times are worked out between Kolhapur and Pune. On other routes they are a straight-line estimate, and say so.')}</p>
        <p>{t('The research behind VAYORA was run on the Kolhapur to Pune route.')}</p>
        <p>{t('Photo: {name} on Unsplash', { name: 'Sonika Agarwal' })}</p>
        <p>© 2026 VAYORA</p>
      </div>
    </footer>
  );
}

/** What a signed-out visitor sees first: what VAYORA is, a search to start with, and the ways in. */
export function LandingPage() {
  // The search, shared by the hero and the routes to start with, which fill it.
  const [route, setRoute] = useState<Wanted>({ from: 'Kolhapur', to: 'Pune' });
  const searchRef = useRef<HTMLFormElement>(null);
  // Signing in is the likely next step: its code is fetched while the reader is reading.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((run: () => void) => window.setTimeout(run, 1500));
    idle(() => preload('/login'));
  }, []);
  const fill = (wanted: Wanted) => {
    setRoute(wanted);
    // In braces: newer browsers return a promise from scrolling.
    searchRef.current?.scrollIntoView?.({ block: 'center' });
    searchRef.current?.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus({ preventScroll: true });
  };
  return (
    <div className="space-y-12 sm:space-y-16">
      <Hero route={route} onRoute={setRoute} formRef={searchRef} />
      {/* A recent place is where to: the start stays, unless it is that place. */}
      <StartingPoints onRoute={fill} onPlace={(place) => fill({ from: route.from === place ? route.to : route.from, to: place })} />
      <Facts />
      <HowItWorks />
      <Features />
      <TrustAndSafety />
      <EarlyMatters />
      <TwoSides />
      <Faq />
      <Footer />
    </div>
  );
}
