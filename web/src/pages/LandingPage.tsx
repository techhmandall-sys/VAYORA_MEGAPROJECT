import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BatteryCharging,
  Bus,
  CalendarClock,
  Check,
  Footprints,
  HeartHandshake,
  Languages,
  MessagesSquare,
  Search,
  ShieldCheck,
  Star,
  Ticket,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { CountUp } from '../components/countup';
import { PlaceField } from '../components/places';
import { useT } from '../lib/i18n';
import { PLACES } from '../lib/places';
import { preload } from '../pageLoaders';
import { wantRoute } from '../lib/recent';
import { formatOneDecimal, formatRupees, formatTime, formatWeekday } from '../lib/format';

// The corridor as drawn on the front page: north up, each town where it lies, so Pune sits
// above and a little west of Kolhapur. Decoration only; the real route comes from OSRM.
const TOWNS = [
  { name: 'Kolhapur', x: 146, y: 228 },
  { name: 'Karad', x: 132, y: 164 },
  { name: 'Satara', x: 92, y: 121 },
  { name: 'Pune', x: 54, y: 29 },
] as const;
const ROAD = 'M146 228 C 152 202, 126 186, 132 164 S 98 140, 92 121 S 48 64, 54 29';
// The towns are not evenly spaced along the curve; this approximates where each one falls
// as a fraction of it, for staggering the markers and pausing the travelling dot.
const TOWN_FRACTIONS = [0, 1 / 3, 2 / 3, 1];
const DRAW_SECONDS = 1.4;

/** A section that rises into place the first time it is scrolled to; shown at once where that cannot be told. */
function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
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
    <div ref={ref} className={`${shown ? 'animate-pop-in' : 'opacity-0'} ${className}`}>
      {children}
    </div>
  );
}

/** The thin line that draws itself along the road once, then settles into a slow, looping
 * dashed flow. One element does both: a transition from a single full-length dash down to
 * zero offset draws it in, then a class swap hands off to the looping keyframe. */
function TravelLine({ reduce }: { reduce: boolean }) {
  const pathRef = useRef<SVGPathElement>(null);
  const [length, setLength] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(false);
  const [introDone, setIntroDone] = useState(false);

  useLayoutEffect(() => {
    if (pathRef.current) setLength(pathRef.current.getTotalLength());
  }, []);

  useEffect(() => {
    if (reduce || length == null) return undefined;
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, [length, reduce]);

  useEffect(() => {
    if (reduce) {
      setIntroDone(true);
      return undefined;
    }
    if (!drawn) return undefined;
    const timer = setTimeout(() => setIntroDone(true), DRAW_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [drawn, reduce]);

  const style = introDone
    ? { strokeDasharray: '7 7', strokeDashoffset: 0 }
    : length == null
      ? { visibility: 'hidden' as const }
      : {
          strokeDasharray: length,
          strokeDashoffset: drawn ? 0 : length,
          transition: `stroke-dashoffset ${DRAW_SECONDS}s cubic-bezier(0.16, 1, 0.3, 1)`,
        };

  return (
    <path
      ref={pathRef}
      d={ROAD}
      fill="none"
      stroke="#fff"
      strokeWidth="2.5"
      strokeLinecap="round"
      className={introDone && !reduce ? 'animate-route-dash' : ''}
      style={style}
    />
  );
}

function CorridorArt() {
  const t = useT();
  const reduce = useReducedMotion() ?? false;
  const [hovered, setHovered] = useState<(typeof TOWNS)[number] | null>(null);

  return (
    <div className="relative mx-auto w-full max-w-[19rem]">
      <svg aria-hidden="true" viewBox="0 0 200 260" className="w-full drop-shadow-[0_10px_30px_rgb(0_0_0_/_0.25)]">
        <path d={ROAD} fill="none" stroke="rgb(255 255 255 / 0.18)" strokeWidth="16" strokeLinecap="round" />
        <TravelLine reduce={reduce} />
        {TOWNS.map((town, index) => {
          const end = index === 0 || index === TOWNS.length - 1;
          // Kolhapur's name goes under it, leaving the corner beside it for a note.
          const label = index === 0 ? { x: town.x, y: town.y + 24, anchor: 'middle' as const }
            : town.x > 100 ? { x: town.x - 14, y: town.y + 4, anchor: 'end' as const }
              : { x: town.x + 14, y: town.y + 4, anchor: 'start' as const };
          return (
            <motion.g
              key={town.name}
              initial={reduce ? false : { opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.3 }}
              onHoverStart={() => setHovered(town)}
              onHoverEnd={() => setHovered((current) => (current?.name === town.name ? null : current))}
              transition={
                reduce
                  ? { duration: 0 }
                  : { delay: TOWN_FRACTIONS[index] * DRAW_SECONDS, type: 'spring', stiffness: 320, damping: 14 }
              }
              style={{ transformOrigin: `${town.x}px ${town.y}px`, cursor: 'pointer' }}
            >
              <circle cx={town.x} cy={town.y} r={14} fill="transparent" />
              <circle cx={town.x} cy={town.y} r={end ? 8 : 5.5} fill="#fff" />
              <circle cx={town.x} cy={town.y} r={end ? 3.5 : 2.5} fill="#0f766e" />
              <text x={label.x} y={label.y} textAnchor={label.anchor} className="fill-white text-[11px] font-semibold">
                {t(town.name)}
              </text>
            </motion.g>
          );
        })}
        <VehicleDot reduce={reduce} />
      </svg>
      <AnimatePresence>
        {hovered && (
          <motion.div
            key={hovered.name}
            initial={{ opacity: 0, scale: 0.9, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 4 }}
            transition={{ duration: 0.15 }}
            style={{ left: `${(hovered.x / 200) * 100}%`, top: `${(hovered.y / 260) * 100}%` }}
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[135%] whitespace-nowrap rounded-xl bg-[#0f172a] px-2.5 py-1.5 text-center text-[11px] font-semibold text-white shadow-float"
          >
            <p>{t(hovered.name)}</p>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Each note in a corner the road and the names leave free, after the line finishes drawing. */}
      <FloatingChip icon={Undo2} className="-right-2 top-[24%] sm:-right-8" delay={`${DRAW_SECONDS}s`}>
        {t('The earlier you cancel, the less you owe')}
      </FloatingChip>
      <FloatingChip icon={Ticket} className="-left-3 top-[47%] sm:-left-10" delay={`${DRAW_SECONDS + 0.15}s`}>
        {t('Your seat is held while you decide')}
      </FloatingChip>
      <FloatingChip icon={ShieldCheck} className="-left-3 bottom-[2%] sm:-left-6" delay={`${DRAW_SECONDS + 0.3}s`}>
        {t('An emergency button on every trip')}
      </FloatingChip>
    </div>
  );
}

/** The vehicle travelling the corridor: a loop with a short dwell at each stop, standing
 * still at Satara (never moving) when motion is reduced, as it did before this. */
function VehicleDot({ reduce }: { reduce: boolean }) {
  if (reduce) return <circle r="6" fill="#fef08a" stroke="#fff" strokeWidth="2" cx={92} cy={121} />;
  // 400ms dwell at each of the four stops; the rest of the 12s is travel, split evenly
  // across the three legs between them (TOWN_FRACTIONS approximates each stop's position).
  const dwell = 0.4 / 12;
  const travel = (1 - dwell * TOWN_FRACTIONS.length) / (TOWN_FRACTIONS.length - 1);
  const keyTimes: number[] = [];
  const keyPoints: number[] = [];
  TOWN_FRACTIONS.forEach((fraction, index) => {
    const arrive = index === 0 ? 0 : keyTimes[keyTimes.length - 1] + travel;
    keyTimes.push(arrive, arrive + dwell);
    keyPoints.push(fraction, fraction);
  });
  return (
    <circle r="6" fill="#fef08a" stroke="#fff" strokeWidth="2" cx={0} cy={0}>
      <animateMotion
        dur="12s"
        repeatCount="indefinite"
        path={ROAD}
        calcMode="linear"
        keyTimes={keyTimes.join(';')}
        keyPoints={keyPoints.join(';')}
      />
    </circle>
  );
}

function FloatingChip({ icon: Icon, className, delay, children }: { icon: LucideIcon; className: string; delay: string; children: ReactNode }) {
  return (
    <span
      style={{ animationDelay: delay }}
      className={`absolute flex max-w-[9.75rem] animate-pop-in items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 text-[12px] font-semibold leading-tight text-[#134e4a] shadow-float backdrop-blur ${className}`}
    >
      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-xl bg-[#ccfbf1] text-[#0f766e]">
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </span>
      {children}
    </span>
  );
}

/** The first thing to do here: say where to. The route waits on the search page, past signing up. */
function RoutePicker() {
  const t = useT();
  const navigate = useNavigate();
  const [from, setFrom] = useState('Kolhapur');
  const [to, setTo] = useState('Pune');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        wantRoute(from, to);
        navigate('/register?as=passenger');
      }}
      className="grid gap-3 rounded-2xl bg-surface p-4 text-slate-900 shadow-float sm:grid-cols-2"
    >
      <PlaceField label={t('From')} value={from} onChange={setFrom} />
      <PlaceField label={t('To')} value={to} onChange={setTo} />
      <button
        type="submit"
        disabled={from === to}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-tint px-5 py-3 text-[15px] font-bold text-white shadow-glow transition-transform hover:-translate-y-0.5 active:scale-[0.97] focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30 disabled:pointer-events-none disabled:opacity-40 sm:col-span-2"
      >
        <Search aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
        {t('Find a ride')}
      </button>
    </form>
  );
}

function Hero() {
  const t = useT();
  return (
    <section className="relative isolate z-10 rounded-[2rem] bg-gradient-to-br from-[#14b8a6] via-[#0f766e] to-[#134e4a] px-6 pb-10 pt-9 text-white shadow-float sm:px-10 sm:pb-12 sm:pt-12">
      {/* Clipped on their own: a place list opening from the hero must be free to pass its edge. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[2rem]">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#5eead4]/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-[#fde68a]/20 blur-3xl" />
      </div>
      <div className="grid items-center gap-10 md:grid-cols-[1.15fr_1fr]">
        <div className="space-y-6">
          <p className="inline-flex flex-wrap items-center gap-x-2 rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold tracking-wide ring-1 ring-inset ring-white/25">
            {t('Any route in India')}
          </p>
          <h1 className="text-balance text-[34px] font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
            {t('Share the road between cities across India')}
          </h1>
          <p className="max-w-xl text-[17px] leading-relaxed text-white/85">
            {t('Book a seat in a car already making the trip, or fill the empty seats in yours. If your plans change, VAYORA reminds you to give the seat back while someone else can still take it.')}
          </p>
          <RoutePicker />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <Link
              to="/register?as=driver"
              className="inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-3 text-[15px] font-bold text-white ring-1 ring-inset ring-white/40 transition-transform hover:-translate-y-0.5 hover:bg-white/20 active:scale-[0.97] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
            >
              {t('Offer a ride')}
              <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
            </Link>
            <p className="text-sm text-white/80">
              {t('Already have an account?')}{' '}
              <Link to="/login" className="font-semibold text-white underline decoration-white/50 underline-offset-4 hover:decoration-white">
                {t('Sign in')}
              </Link>
            </p>
          </div>
        </div>
        <CorridorArt />
      </div>
      <ExampleCard />
    </section>
  );
}

/** What a search result looks like, and says that it is an example: its figures are from no ride. */
function ExampleCard() {
  const t = useT();
  // Friday evening, from a fixed date: illustrative only, not a real booking.
  const departure = '2026-10-30T18:30:00+05:30';
  const driverName = 'Rahul S.';
  return (
    <div
      aria-hidden="true"
      className="relative z-0 mt-6 hidden w-[15rem] rounded-2xl bg-white/95 p-3.5 text-[#0f172a] shadow-float backdrop-blur sm:ml-auto sm:block"
    >
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#64748b]">{t('Example')}</p>
      <div className="flex items-center justify-between gap-1.5 text-[13px] font-semibold">
        <span className="truncate">{driverName}</span>
        <span className="flex flex-none items-center gap-1">
          <Star aria-hidden="true" className="h-3.5 w-3.5 flex-none fill-amber-400 text-amber-400" />
          {formatOneDecimal(4.8)}
        </span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-1.5 text-[12px] text-[#64748b]">
        <span className="truncate">{`${formatWeekday(departure)} ${formatTime(departure)}`}</span>
        <span className="flex-none font-semibold text-[#334155]">{formatRupees(420)}</span>
      </div>
      <p className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] font-semibold">
        <span className="rounded-full bg-[#e0f2fe] px-2 py-0.5 text-[#075985]">{t('{n} seats left', { n: 3 })}</span>
        <span className="rounded-full bg-[#d1fae5] px-2 py-0.5 text-[#065f46]">{t('Confirms instantly')}</span>
      </p>
    </div>
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
        <div key={fact.label} className="flex flex-col rounded-2xl bg-surface px-4 py-4 text-center shadow-card ring-1 ring-slate-900/[0.04]">
          <dt className="text-[13px] font-medium text-slate-500">{fact.label}</dt>
          <dd className="order-first text-3xl font-extrabold tabular-nums tracking-tight text-teal-800">
            <CountUp value={fact.value} format={(n) => String(Math.round(n))} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-[24px] font-bold tracking-tight text-slate-900 sm:text-[28px]">{children}</h2>;
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
    <Reveal className="space-y-4">
      <SectionTitle>{t('How it works')}</SectionTitle>
      <ol className="grid gap-3 md:grid-cols-3">
        {steps.map(({ icon: Icon, title, body }, index) => (
          <li key={title} className="relative overflow-hidden rounded-2xl bg-surface p-5 shadow-card ring-1 ring-slate-900/[0.04]">
            <span aria-hidden="true" className="absolute right-4 top-2 text-[64px] font-black leading-none text-slate-900/[0.05]">
              {index + 1}
            </span>
            <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-600/[0.12] text-teal-800">
              <Icon className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <h3 className="mt-4 text-[17px] font-semibold text-slate-900">{title}</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{body}</p>
          </li>
        ))}
      </ol>
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
          <div className="h-3 rounded-full bg-gradient-to-r from-[#10b981] via-[#f59e0b] to-[#ef4444]" />
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

const featureTones = [
  'bg-teal-600/[0.12] text-teal-800',
  'bg-red-100 text-red-800',
  'bg-amber-100 text-amber-900',
  'bg-emerald-100 text-emerald-900',
  'bg-sky-100 text-sky-900',
  'bg-slate-100 text-slate-800',
];

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
    <Reveal className="space-y-4">
      <SectionTitle>{t('Made for travelling between cities')}</SectionTitle>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, body }, index) => (
          <li
            key={title}
            className="group rounded-2xl bg-surface p-5 shadow-card ring-1 ring-slate-900/[0.04] transition-[transform,box-shadow] duration-300 ease-settle hover:-translate-y-1 hover:shadow-float"
          >
            <span aria-hidden="true" className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-transform duration-300 ease-spring group-hover:scale-110 ${featureTones[index]}`}>
              <Icon className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <h3 className="mt-4 text-[17px] font-semibold text-slate-900">{title}</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{body}</p>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

function Side({ title, points, action, to, gradient }: { title: string; points: string[]; action: string; to: string; gradient: string }) {
  return (
    <section className={`flex flex-col gap-4 rounded-3xl bg-gradient-to-br p-6 text-white shadow-float sm:p-7 ${gradient}`}>
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
        className="inline-flex items-center justify-center gap-2 self-start rounded-full bg-white px-5 py-2.5 text-[15px] font-bold text-[#18181b] shadow-lg shadow-black/10 transition-transform hover:-translate-y-0.5 active:scale-[0.97] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
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
        gradient="from-[#14b8a6] to-[#0f766e]"
      />
      <Side
        title={t('For drivers')}
        points={[t('Publish once, or repeat a ride every week'), t('Approve each passenger, or let them book at once'), t('Keep the whole fare: VAYORA charges nothing')]}
        action={t('Create a driver account')}
        to="/register?as=driver"
        gradient="from-[#6366f1] to-[#4338ca]"
      />
    </Reveal>
  );
}

/** What a signed-out visitor sees first: what VAYORA is, and the ways in. */
export function LandingPage() {
  const t = useT();
  // Signing in is the likely next step: its code is fetched while the reader is reading.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((run: () => void) => window.setTimeout(run, 1500));
    idle(() => preload('/login'));
  }, []);
  return (
    <div className="space-y-10 sm:space-y-14">
      <Hero />
      <Facts />
      <HowItWorks />
      <EarlyMatters />
      <Features />
      <TwoSides />
      <footer className="border-t border-slate-900/[0.07] pt-6 text-center text-[13px] leading-relaxed text-slate-500">
        <p>{t('A final-year project at DYPCET, Kolhapur. Text messages and calls are simulated unless real services are connected.')}</p>
        <p className="mt-1">{t('Road distances and times are worked out between Kolhapur and Pune. On other routes they are a straight-line estimate, and say so.')}</p>
        <p className="mt-1">{t('The research behind VAYORA was run on the Kolhapur to Pune route.')}</p>
      </footer>
    </div>
  );
}
