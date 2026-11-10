import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Armchair, ArrowUpDown, CalendarPlus, Info, Award, BadgeCheck, Car, CarTaxiFront, Check, Clock, Flag, Footprints, Hourglass, Map as MapIcon, MessagesSquare, Route as RouteIcon, Search, Send, ShieldCheck, Shuffle, SlidersHorizontal, Sparkles, Ticket, TriangleAlert, Undo2, UserRound, Users, Wallet, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

import { LeavesIn, LiveDot, LiveStatus, useTimeAhead } from '../components/live';
import { CancellingTerms, HowToPayDriver, usePaymentTerms } from '../components/payment';
import { RateForm, RatingSummary } from '../components/rating';
import { RideChat } from '../components/RideChat';
import { BoardingPassView } from '../components/boarding';
import { BusAlternatives } from '../components/bus';
import { TripConfirmation } from '../components/tripConfirmation';
import { RouteMap } from '../components/LazyRouteMap';
import type { MapPoint } from '../components/RouteMap';
import { CallButton } from '../components/call';
import { initialsOf } from '../components/photo';
import { Collapse } from '../components/collapse';
import { SuccessCard } from '../components/success';
import { ActionTile, Avatar, Button, Card, Chip, ConfirmButton, Detail, Meter, More, Notice, Page, QueryState, Segmented, SelectField, StatusBadge, StepperField, TextField } from '../components/ui';
import { api } from '../lib/api';
import { placeNamed } from '../lib/places';
import { PlaceField } from '../components/places';
import { answerBy, formatDate, formatDateTime, formatDayMonth, formatRupees, formatTime, formatWeekday, todayInIndia } from '../lib/format';
import { clockFace, LIVE_MS, owedNow, useNow } from '../lib/live';
import { forgetWantedRoute, readWantedRoute } from '../lib/recent';
import { useScrollFade } from '../lib/scrollFade';
import { PHONE, useMediaQuery } from '../lib/media';
import { Sheet } from '../components/sheet';
import { msg, useT, useUnits } from '../lib/i18n';
import { matchReasonLabels } from '../lib/match';
import { comfortLabels, luggageLabels, vehiclePhrases } from '../lib/vehicle';
import { searchSchema, type SearchForm } from '../lib/schemas';
import type {
  Booking,
  Availability,
  Candidate,
  Comfort,
  FlexTier,
  Luggage,
  MyProfile,
  RequestTerms,
  RickshawEstimate,
  Ride,
  RideStatus,
  SearchSort,
  SeatHold,
} from '../lib/types';

/** Closer than this, a stop is where the passenger is: said in words, not as "0 m". */
const NEAR_M = 50;

interface LatLon {
  lat: number;
  lon: number;
}

/** Parts of the day a passenger can ask for, as hours of boarding: from, and before. */
const DAY_PARTS = {
  ANY: [null, null],
  MORNING: [null, 12],
  AFTERNOON: [12, 17],
  EVENING: [17, null],
} as const;

interface Filters {
  dayPart: keyof typeof DAY_PARTS;
  /** Per seat, as typed. Empty means no limit. */
  maxPrice: string;
  minPrice: string;
  comfortAtLeast: Comfort | '';
  luggageAtLeast: Luggage | '';
  musicWelcome: boolean;
  quietRide: boolean;
  instantOnly: boolean;
  confirmedDriver: boolean;
  idCheckedDriver: boolean;
  maxTwoInBack: boolean;
  womenOnly: boolean;
  smokeFree: boolean;
  petsWelcome: boolean;
}

const NO_FILTERS: Filters = {
  dayPart: 'ANY',
  maxPrice: '',
  minPrice: '',
  comfortAtLeast: '',
  luggageAtLeast: '',
  musicWelcome: false,
  quietRide: false,
  instantOnly: false,
  confirmedDriver: false,
  idCheckedDriver: false,
  maxTwoInBack: false,
  womenOnly: false,
  smokeFree: false,
  petsWelcome: false,
};

/** Only the filters that are set become query parameters. */
function filterParams(filters: Filters): Record<string, string> {
  const [earliestHour, latestHour] = DAY_PARTS[filters.dayPart];
  const params: Record<string, string> = {};
  if (earliestHour !== null) params.earliestHour = String(earliestHour);
  if (latestHour !== null) params.latestHour = String(latestHour);
  if (filters.maxPrice.trim() !== '' && Number(filters.maxPrice) >= 0) params.maxPrice = String(Number(filters.maxPrice));
  if (filters.minPrice.trim() !== '' && Number(filters.minPrice) >= 0) params.minPrice = String(Number(filters.minPrice));
  if (filters.comfortAtLeast) params.comfortAtLeast = filters.comfortAtLeast;
  if (filters.luggageAtLeast) params.luggageAtLeast = filters.luggageAtLeast;
  for (const flag of ['instantOnly', 'confirmedDriver', 'idCheckedDriver', 'maxTwoInBack', 'womenOnly', 'smokeFree', 'petsWelcome', 'musicWelcome', 'quietRide'] as const) {
    if (filters[flag]) params[flag] = 'true';
  }
  return params;
}

/** What was searched for: the form, plus any exact points, the filters and the ordering. */
interface Criteria {
  form: SearchForm;
  origin: LatLon;
  destination: LatLon;
  sort: SearchSort;
  filters: Filters;
}

const townPoint = (name: string): LatLon => {
  const town = placeNamed(name)!;
  return { lat: town.lat, lon: town.lon };
};

/** The driver's own record: rides completed out of those they went on to drive or withdrew. */
/** An auto-rickshaw to the pickup or from the drop-off, with the meter fare where one is known. */
function rickshawLine(estimate: RickshawEstimate, toPickup: boolean, t: ReturnType<typeof useT>): string {
  const values = {
    minutes: estimate.minutes,
    fare: estimate.fare == null ? '' : formatRupees(estimate.fare),
    town: estimate.fareTown ? t(estimate.fareTown) : '',
  };
  const line =
    estimate.fare == null
      ? toPickup
        ? t('Or about {minutes} min by auto-rickshaw to the pickup; no meter fare is known there', values)
        : t('Or about {minutes} min by auto-rickshaw from the drop-off; no meter fare is known there', values)
      : toPickup
        ? t('Or about {minutes} min by auto-rickshaw to the pickup, about {fare} by the {town} meter fare', values)
        : t('Or about {minutes} min by auto-rickshaw from the drop-off, about {fare} by the {town} meter fare', values);
  return estimate.byRoad ? line : `${line} · ${t('roughly: in a straight line')}`;
}

function driverRecord(candidate: Candidate, t: ReturnType<typeof useT>): string {
  const offered = candidate.driverRidesCompleted + candidate.driverRidesWithdrawn;
  if (offered === 0) return t('No completed rides yet');
  return t('Completed {completed} of the {offered} rides they have finished or withdrawn', {
    completed: candidate.driverRidesCompleted,
    offered,
  });
}

/** The same search apart from its order. */
function sameSearch(a: Criteria | null, b: Criteria | null): boolean {
  return a !== null && b !== null && JSON.stringify({ ...a, sort: null }) === JSON.stringify({ ...b, sort: null });
}

const candidateKey = (candidate: Candidate, seats: number) =>
  `${candidate.rideId}-${candidate.fromSeq}-${candidate.toSeq}-${seats}`;

/**
 * The ride's route with the passenger's own stretch picked out. Fetched when opened.
 *
 * @param pickup where and when the driver picks the passenger up instead of at a stop
 *               (feature 28); the stop before it is then not where they board
 */
function RideRoute({ rideId, fromSeq, toSeq, pickup }: { rideId: number; fromSeq: number; toSeq?: number; pickup?: { lat: number; lon: number; time: string } }) {
  const t = useT();
  const ride = useQuery({ queryKey: ['ride', rideId], queryFn: () => api<Ride>(`/rides/${rideId}`) });
  if (!ride.data) {
    return <QueryState isPending={ride.isPending} error={ride.error} isEmpty={false} empty="" onRetry={() => void ride.refetch()} />;
  }
  const boardsAtStop = (seq: number) => !pickup && seq === fromSeq;
  const points: MapPoint[] = [
    ...ride.data.stops.map((stop) => ({
      lat: stop.lat,
      lon: stop.lon,
      label: boardsAtStop(stop.seq)
        ? t('Board here: {stop}', { stop: t(stop.name) })
        : stop.seq === toSeq
          ? t('Get off here: {stop}', { stop: t(stop.name) })
          : t(stop.name),
      emphasis: boardsAtStop(stop.seq) || stop.seq === toSeq,
    })),
    ...(pickup ? [{ lat: pickup.lat, lon: pickup.lon, label: t('You are picked up here'), emphasis: true }] : []),
  ];
  const boarding = pickup ? undefined : ride.data.stops.find((stop) => stop.seq === fromSeq);
  return (
    <div className="mt-3 space-y-2">
      <RouteMap
        path={ride.data.path}
        points={points}
        describe={t('Map of the ride through {stops}', { stops: ride.data.stops.map((stop) => t(stop.name)).join(', ') })}
      />
      <p className="text-sm text-slate-600">
        {pickup && t('You are picked up at your own point, about {time}.', { time: formatDateTime(pickup.time) })}
        {boarding && t('Board at {stop}, leaving {time}.', { stop: t(boarding.name), time: formatDateTime(boarding.departureTime) })}{' '}
        {ride.data.distanceKm !== null &&
          (ride.data.routeSource === 'OSRM'
            ? t('The whole ride is {km} km by road.', { km: ride.data.distanceKm })
            : t('The whole ride is about {km} km in a straight line; the road distance is not available.', { km: ride.data.distanceKm }))}
      </p>
      {ride.data.notes && (
        <p className="text-sm text-slate-700">
          <span className="font-medium">{t('From the driver:')}</span>{' '}
          {/* Rendered as text: notes are whatever the driver typed. */}
          <span className="whitespace-pre-wrap">{ride.data.notes}</span>
        </p>
      )}
    </div>
  );
}

/** The next seven days as a press each, the horizon rides are booked within. */
/**
 * Everything about one result in one place, over the results: the ride's stops with the
 * passenger's own stretch marked, the driver and car, what the seats cost, what cancelling
 * costs, and the same booking button as the card, kept in view under it all.
 */
function RideDetails({ candidate, seats, open, onClose, action }: {
  candidate: Candidate;
  seats: number;
  open: boolean;
  onClose: () => void;
  /** The card's own booking button: one booking rule, wherever it is pressed. */
  action: ReactNode;
}) {
  const t = useT();
  const ride = useQuery({ queryKey: ['ride', candidate.rideId], queryFn: () => api<Ride>(`/rides/${candidate.rideId}`), enabled: open });
  const heading = 'text-[13px] font-semibold uppercase tracking-wide text-slate-500';
  return (
    <Sheet open={open} onClose={onClose} title={t('Ride details')} swipe={false}>
      <div className="max-h-[60vh] space-y-6 overflow-y-auto overscroll-contain pr-1">
        <section aria-labelledby={`stops-${candidate.rideId}`}>
          <h3 id={`stops-${candidate.rideId}`} className={heading}>
            {t('Stops on this ride')}
          </h3>
          {ride.data ? (
            <ol className="mt-3 space-y-3">
              {ride.data.stops.map((stop) => {
                const yours = stop.seq >= candidate.fromSeq && stop.seq <= candidate.toSeq;
                const marker = stop.seq === candidate.fromSeq ? t('You board here') : stop.seq === candidate.toSeq ? t('You get off here') : null;
                return (
                  <li key={stop.seq} className={`relative pl-6 ${yours ? '' : 'text-slate-500'}`}>
                    <span
                      aria-hidden="true"
                      className={`absolute left-0 top-1.5 h-3 w-3 rounded-full ${marker ? 'bg-accent ring-4 ring-teal-600/20' : yours ? 'bg-teal-600' : 'bg-slate-300'}`}
                    />
                    <p className="flex items-baseline justify-between gap-3">
                      <span className={yours ? 'font-semibold text-slate-900' : ''}>{t(stop.name)}</span>
                      <span className="tabular-nums">{formatTime(stop.departureTime)}</span>
                    </p>
                    {marker && <p className="text-[13px] font-semibold text-teal-800">{marker}</p>}
                  </li>
                );
              })}
            </ol>
          ) : (
            <QueryState isPending={ride.isPending} error={ride.error} isEmpty={false} empty="" onRetry={() => void ride.refetch()} />
          )}
        </section>

        <section aria-labelledby={`driver-${candidate.rideId}`} className="space-y-2">
          <h3 id={`driver-${candidate.rideId}`} className={heading}>
            {t('Driver')}
          </h3>
          <div className="flex items-center gap-3">
            <Avatar initials={initialsOf(candidate.driverName)} />
            <p className="min-w-0 text-sm">
              <Link to={`/users/${candidate.driverId}`} className="font-semibold text-slate-900 hover:text-teal-800 hover:underline">
                {candidate.driverName}
              </Link>
              <span className="block text-slate-600">
                <RatingSummary average={candidate.driverRating} count={candidate.driverRatingCount} />
              </span>
            </p>
          </div>
          <Detail icon={Award}>{driverRecord(candidate, t)}</Detail>
          {/* `vehicle` is what the driver typed: shown as text, not translated. */}
          {candidate.vehicle && <Detail icon={Car}>{[candidate.vehicle, ...vehiclePhrases(candidate, t)].join(' · ')}</Detail>}
          {ride.data?.notes && (
            <p className="text-sm text-slate-700">
              <span className="font-medium">{t('From the driver:')}</span>{' '}
              {/* Rendered as text: notes are whatever the driver typed. */}
              <span className="whitespace-pre-wrap">{ride.data.notes}</span>
            </p>
          )}
        </section>

        <section aria-labelledby={`fare-${candidate.rideId}`} className="space-y-2">
          <h3 id={`fare-${candidate.rideId}`} className={heading}>
            {t('Fare')}
          </h3>
          {/* The server's own figures, each as it sent it: nothing here is worked out again. */}
          <dl className="divide-y divide-slate-900/[0.06] rounded-2xl bg-slate-900/[0.03] px-4 text-sm">
            <div className="flex justify-between py-2.5">
              <dt className="text-slate-600">{t('Price a seat')}</dt>
              <dd className="font-medium tabular-nums">{formatRupees(candidate.pricePerSeat)}</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-slate-600">{t('Seats')}</dt>
              <dd className="font-medium tabular-nums">{seats}</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="font-semibold text-slate-900">{t('Total')}</dt>
              <dd className="font-bold tabular-nums">{formatRupees(candidate.fare)}</dd>
            </div>
          </dl>
          <p className="text-[13px] text-slate-500">{t('You pay your driver directly after the ride, in cash or by UPI. VAYORA charges nothing.')}</p>
        </section>

        <section aria-labelledby={`cancel-${candidate.rideId}`} className="space-y-2">
          <h3 id={`cancel-${candidate.rideId}`} className={heading}>
            {t('What cancelling costs')}
          </h3>
          <CancellingTerms />
        </section>
      </div>
      {/* Kept in view under the details, however far they scroll. */}
      <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-900/[0.06] pt-4">
        <p>
          <span className="block text-2xl font-bold tracking-tight text-slate-900">{formatRupees(candidate.fare)}</span>
          <span className="block text-xs text-slate-500">{t('Pay after the ride')}</span>
        </p>
        {action}
      </div>
    </Sheet>
  );
}

function DateChips({ value, onChoose }: { value: string; onChoose: (date: string) => void }) {
  const t = useT();
  const today = todayInIndia();
  const days = Array.from({ length: 7 }, (_, index) => todayInIndia(new Date(Date.parse(`${today}T12:00:00+05:30`) + index * 86_400_000)));
  const row = useScrollFade<HTMLDivElement>();
  return (
    <div ref={row} className="no-scrollbar scroll-fade -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
      {days.map((day, index) => (
        <button
          key={day}
          type="button"
          aria-pressed={day === value}
          onClick={() => onChoose(day)}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold touch:min-h-11 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30 ${
            day === value ? 'bg-tint text-white shadow-sm' : 'bg-slate-900/[0.05] text-slate-700 hover:bg-slate-900/[0.09]'
          }`}
        >
          {index === 0 ? t('Today') : index === 1 ? t('Tomorrow') : `${formatWeekday(`${day}T12:00:00+05:30`)} ${formatDayMonth(`${day}T12:00:00+05:30`)}`}
        </button>
      ))}
    </div>
  );
}

/** Seats held for the passenger, running out before their eyes. Tells the page when it has. */
function HoldClock({ until, from, onEnd }: { until: string; from: number; onEnd: () => void }) {
  const t = useT();
  const now = useNow(1000);
  const left = Date.parse(until) - now;
  useEffect(() => {
    if (left <= 0) onEnd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left <= 0]);
  return (
    <div className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-inset ring-emerald-200">
      <div className="flex items-center justify-between gap-3">
        <p role="status" className="text-sm font-medium text-emerald-900">
          {t('Held for you until {time}. This is not a booking: book before then or the seats go back.', { time: formatTime(until) })}
        </p>
        <span aria-hidden="true" className="flex-none text-xl font-bold tabular-nums text-emerald-900">
          {clockFace(left)}
        </span>
      </div>
      <div className="mt-2">
        <Meter fraction={left / Math.max(1, Date.parse(until) - from)} tone={left < 60_000 ? 'amber' : 'tint'} label={t('Time left on the hold')} />
      </div>
    </div>
  );
}

export function SearchPage() {
  const t = useT();
  const units = useUnits();
  const queryClient = useQueryClient();
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  // Women-only rides are offered only to passengers whose profile says they are a woman.
  const me = useQuery({ queryKey: ['me', 'profile'], queryFn: () => api<MyProfile>('/me/profile') });
  const [booked, setBooked] = useState<Booking | null>(null);
  const [tier, setTier] = useState<FlexTier>('EXACT');
  const [sort, setSort] = useState<SearchSort>('TIME');
  // A new order is not urgent: the results on screen stay, dimmed, until the new order arrives.
  const [sorting, startSorting] = useTransition();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // The result whose details are open, by its key.
  const [details, setDetails] = useState<string | null>(null);
  const phone = useMediaQuery(PHONE);
  const searchForm = useRef<HTMLFormElement>(null);
  // Once searched, the form steps aside for a one-line summary, so the results start at the top.
  const [editing, setEditing] = useState(true);
  const changeSearch = useRef<HTMLButtonElement>(null);
  // A route chosen on the front page before signing in, once: forgotten after the page is on
  // screen, not while it renders, which React may do and throw away.
  const [wanted] = useState(() => readWantedRoute(todayInIndia()));
  useEffect(() => {
    forgetWantedRoute();
  }, []);
  const [turns, setTurns] = useState(0);
  // Exact points chosen on the map. Either replaces its town's centre.
  const [picked, setPicked] = useState<{ origin?: LatLon; destination?: LatLon }>({});
  const [setting, setSetting] = useState<'origin' | 'destination'>('origin');
  const [mapOpen, setMapOpen] = useState(false);
  const [routeShown, setRouteShown] = useState<string | null>(null);
  // One key per thing the passenger is trying to book, kept until it succeeds, so that
  // pressing the button again after a lost response cannot book twice.
  const idempotencyKeys = useRef(new Map<string, string>());
  const { register, handleSubmit, formState, watch, setValue, getValues } = useForm<SearchForm>({
    resolver: zodResolver(searchSchema),
    defaultValues: { origin: wanted?.from ?? 'Kolhapur', destination: wanted?.to ?? 'Pune', date: wanted?.date ?? todayInIndia(), seats: wanted?.seats ?? 1 },
  });
  const towns = { origin: watch('origin'), destination: watch('destination') };
  const filtersSet = Object.keys(filterParams(filters)).length;

  const chooseEnd = (end: 'origin' | 'destination', name: string) => {
    setValue(end, name, { shouldValidate: formState.isSubmitted });
    // An exact point belongs to the town it was chosen around.
    setPicked((current) => ({ ...current, [end]: undefined }));
  };

  const swapEnds = () => {
    setValue('origin', towns.destination, { shouldValidate: formState.isSubmitted });
    setValue('destination', towns.origin, { shouldValidate: formState.isSubmitted });
    setPicked((current) => ({ origin: current.destination, destination: current.origin }));
    setTurns((was) => was + 1);
  };

  const results = useQuery({
    queryKey: ['search', criteria],
    queryFn: () =>
      api<Candidate[]>(
        `/rides/search?${new URLSearchParams({
          originLat: String(criteria!.origin.lat),
          originLon: String(criteria!.origin.lon),
          destLat: String(criteria!.destination.lat),
          destLon: String(criteria!.destination.lon),
          date: criteria!.form.date,
          seats: String(criteria!.form.seats),
          sort: criteria!.sort,
          ...filterParams(criteria!.filters),
        })}`,
      ),
    enabled: criteria !== null,
    // Re-sorting keeps the current results while the new order loads; a new search starts clean.
    placeholderData: (previous, previousQuery) =>
      previousQuery && sameSearch(previousQuery.queryKey[1] as Criteria | null, criteria) ? previous : undefined,
  });
  const stale = sorting || results.isPlaceholderData;

  // The seats left on what is on screen, read again and again. Never by searching again: a search
  // is an event in the log, and this is the same count with none written (lib/live.ts).
  const stretches = (results.data ?? []).slice(0, 30).map((candidate) => `${candidate.rideId}:${candidate.fromSeq}:${candidate.toSeq}`);
  const seatsNow = useQuery({
    queryKey: ['availability', stretches],
    queryFn: () => api<Availability[]>(`/rides/availability?${new URLSearchParams(stretches.map((stretch) => ['stretch', stretch]))}`),
    enabled: stretches.length > 0,
    refetchInterval: LIVE_MS.seats,
  });
  const standing = (candidate: Candidate) =>
    seatsNow.data?.find((now) => now.rideId === candidate.rideId && now.fromSeq === candidate.fromSeq && now.toSeq === candidate.toSeq);

  const book = useMutation({
    mutationFn: async (candidate: Candidate) => {
      const key = candidateKey(candidate, criteria!.form.seats);
      if (!idempotencyKeys.current.has(key)) idempotencyKeys.current.set(key, crypto.randomUUID());
      return api<Booking>('/bookings', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKeys.current.get(key)! },
        body: {
          rideId: candidate.rideId,
          fromSeq: candidate.fromSeq,
          toSeq: candidate.toSeq,
          seats: criteria!.form.seats,
          tier,
          // Picked up where the search started, if that is what the result offered.
          ...(candidate.detourMinutes != null ? { pickupLat: criteria!.origin.lat, pickupLon: criteria!.origin.lon } : {}),
          // The last-mile gap and access option feature 91 showed for this result, for
          // the durability model; nothing is booked by sending it.
          lastMileDistanceM: candidate.pickupDistanceM,
          lastMileModeShown: candidate.pickupRickshaw ? 'rickshaw' : 'walk',
        },
      });
    },
    onSuccess: (booking, candidate) => {
      idempotencyKeys.current.delete(candidateKey(candidate, criteria!.form.seats));
      setBooked(booking);
      setHeld(null);
      // Seat counts in the results and the bookings list are both stale now.
      void queryClient.invalidateQueries({ queryKey: ['search'] });
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  // A UI-only signal that the traveller looked closely at an access option; nothing is
  // booked by it, so its failure is not worth telling anyone about.
  const selectLastMile = useMutation({
    mutationFn: (args: { rideId: number; mode: 'walk' | 'rickshaw' | 'bus' }) =>
      api(`/rides/${args.rideId}/last-mile-selected`, { method: 'POST', body: { mode: args.mode } }),
  });

  // The seats held, and which result they are on. One hold at a time: a new one replaces it.
  const [held, setHeld] = useState<{ key: string; until: string; from: number } | null>(null);
  const hold = useMutation({
    mutationFn: (candidate: Candidate) =>
      api<SeatHold>('/holds', {
        method: 'POST',
        body: { rideId: candidate.rideId, fromSeq: candidate.fromSeq, toSeq: candidate.toSeq, seats: criteria!.form.seats },
      }),
    onSuccess: (placed, candidate) => setHeld({ key: candidateKey(candidate, criteria!.form.seats), until: placed.expiresAt, from: Date.now() }),
  });

  const mapPoints: MapPoint[] = [
    ...[towns.origin, towns.destination].map((name) => ({ ...townPoint(name), label: t(name) })),
    ...(picked.origin ? [{ ...picked.origin, label: t('Your start'), emphasis: true }] : []),
    ...(picked.destination ? [{ ...picked.destination, label: t('Your destination'), emphasis: true }] : []),
  ];

  const endLine = (end: 'origin' | 'destination') => {
    const point = picked[end];
    if (!point) {
      return end === 'origin'
        ? t('Start: the centre of {town}', { town: t(towns.origin) })
        : t('Destination: the centre of {town}', { town: t(towns.destination) });
    }
    const where = { lat: point.lat.toFixed(4), lon: point.lon.toFixed(4) };
    return (
      <>
        {end === 'origin'
          ? t('Start: a point you chose ({lat}, {lon})', where)
          : t('Destination: a point you chose ({lat}, {lon})', where)}{' '}
        <button type="button" className="font-medium text-teal-800 underline" onClick={() => setPicked({ ...picked, [end]: undefined })}>
          {t('Use the centre of {town} instead', { town: t(towns[end]) })}
        </button>
      </>
    );
  };

  /** The same search, a day later: the first thing to try when nothing was found. */
  const tryNextDay = () => {
    if (!criteria) return;
    const next = todayInIndia(new Date(Date.parse(`${criteria.form.date}T12:00:00+05:30`) + 86_400_000));
    setValue('date', next);
    setCriteria({ ...criteria, form: { ...criteria.form, date: next } });
  };

  const filterFields = (
    <fieldset className="grid gap-4 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2">
      <legend className="px-1 text-sm font-medium text-slate-700">{t('Show only rides that')}</legend>
      <SelectField label={t('Leave in the')} value={filters.dayPart} onChange={(event) => setFilters({ ...filters, dayPart: event.target.value as Filters['dayPart'] })}>
        <option value="ANY">{t('Any time of day')}</option>
        <option value="MORNING">{t('Morning, before 12')}</option>
        <option value="AFTERNOON">{t('Afternoon, 12 to 5')}</option>
        <option value="EVENING">{t('Evening, from 5')}</option>
      </SelectField>
      <TextField
        label={t('Cost at most, per seat (₹)')}
        type="number"
        min={0}
        value={filters.maxPrice}
        onChange={(event) => setFilters({ ...filters, maxPrice: event.target.value })}
      />
      <TextField
        label={t('Cost at least, per seat (₹)')}
        type="number"
        min={0}
        value={filters.minPrice}
        onChange={(event) => setFilters({ ...filters, minPrice: event.target.value })}
      />
      <SelectField
        label={t('Comfort at least')}
        value={filters.comfortAtLeast}
        onChange={(event) => setFilters({ ...filters, comfortAtLeast: event.target.value as Comfort | '' })}
      >
        <option value="">{t('Any')}</option>
        {(Object.keys(comfortLabels) as Comfort[]).map((key) => (
          <option key={key} value={key}>
            {t(comfortLabels[key])}
          </option>
        ))}
      </SelectField>
      <SelectField
        label={t('Room for luggage, at least')}
        value={filters.luggageAtLeast}
        onChange={(event) => setFilters({ ...filters, luggageAtLeast: event.target.value as Luggage | '' })}
      >
        <option value="">{t('Any')}</option>
        {(Object.keys(luggageLabels) as Luggage[]).map((key) => (
          <option key={key} value={key}>
            {t(luggageLabels[key])}
          </option>
        ))}
      </SelectField>
      {(
        [
          ['instantOnly', msg('Confirm instantly')],
          ['confirmedDriver', msg('Have a driver with a confirmed email or phone')],
          ['idCheckedDriver', msg('Have a driver whose identity VAYORA staff have checked')],
          ['maxTwoInBack', msg('Promise at most two in the back')],
          ['smokeFree', msg('Have a driver who said no smoking')],
          ['petsWelcome', msg('Have a driver who said pets are welcome')],
          ['musicWelcome', msg('Have a driver who likes music on the way')],
          ['quietRide', msg('Have a driver who prefers a quiet ride')],
        ] as const
      ).map(([flag, label]) => (
        <label key={flag} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={filters[flag]} onChange={(event) => setFilters({ ...filters, [flag]: event.target.checked })} />
          {t(label)}
        </label>
      ))}
      {me.data?.gender === 'FEMALE' && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={filters.womenOnly} onChange={(event) => setFilters({ ...filters, womenOnly: event.target.checked })} />
          {t('Are for women only')}
        </label>
      )}
      <p className="text-sm text-slate-600 sm:col-span-2">
        {t('The last two leave out drivers who have not said either way. Filters apply when you press Search.')}
      </p>
    </fieldset>
  );

  return (
    <Page title={t('Find a ride')}>
      {criteria && !editing && (
        <div className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-card ring-1 ring-slate-900/[0.04]">
          <Search aria-hidden="true" className="h-5 w-5 flex-none text-teal-700" />
          <p className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-slate-900">
              {t(criteria.form.origin)} → {t(criteria.form.destination)}
            </span>
            <span className="block truncate text-[13px] text-slate-600">
              {formatDate(`${criteria.form.date}T12:00:00+05:30`)} ·{' '}
              {Number(criteria.form.seats) === 1 ? t('{n} seat', { n: 1 }) : t('{n} seats', { n: criteria.form.seats })}
              {filtersSet > 0 && ` · ${t('{n} filters on', { n: filtersSet })}`}
            </span>
          </p>
          <Button ref={changeSearch} tone="secondary" aria-expanded={false} onClick={() => setEditing(true)}>
            {t('Change search')}
          </Button>
        </div>
      )}
      <Card hidden={Boolean(criteria) && !editing}>
        <form
          ref={searchForm}
          onSubmit={handleSubmit((form) => {
            setBooked(null);
            book.reset();
            setCriteria({
              form,
              origin: picked.origin ?? townPoint(form.origin),
              destination: picked.destination ?? townPoint(form.destination),
              sort,
              filters,
            });
            setEditing(false);
            // The button pressed is now hidden: keep the reader's place on the summary instead.
            window.requestAnimationFrame(() => changeSearch.current?.focus({ preventScroll: true }));
          })}
          noValidate
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <div className="grid grid-cols-1 items-start gap-2 sm:col-span-2 sm:grid-cols-[1fr_auto_1fr]">
            <PlaceField label={t('From')} value={towns.origin} nearMe error={formState.errors.origin?.message} onChange={(name) => chooseEnd('origin', name)} />
            <button
              type="button"
              aria-label={t('Swap start and destination')}
              title={t('Swap start and destination')}
              onClick={swapEnds}
              className="mx-auto flex h-10 w-10 touch:h-11 touch:w-11 items-center justify-center rounded-full bg-slate-900/[0.05] text-teal-800 hover:bg-slate-900/[0.09] active:scale-90 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30 sm:mt-[1.65rem]"
            >
              <ArrowUpDown aria-hidden="true" className="h-4 w-4 transition-transform duration-500 ease-spring sm:rotate-90" style={{ rotate: `${turns * 180}deg` }} />
            </button>
            <PlaceField label={t('To')} value={towns.destination} error={formState.errors.destination?.message} onChange={(name) => chooseEnd('destination', name)} />
          </div>
          <TextField label={t('Date')} type="date" min={todayInIndia()} error={formState.errors.date?.message} {...register('date')} />
          <StepperField
            label={t('Seats')}
            type="number"
            min={1}
            max={8}
            error={formState.errors.seats?.message}
            decreaseLabel={t('Fewer seats')}
            increaseLabel={t('More seats')}
            onStep={(delta) => setValue('seats', Math.min(8, Math.max(1, Number(getValues('seats')) + delta)), { shouldValidate: true })}
            {...register('seats')}
          />
          <div className="-mt-2 sm:col-span-2">
            <DateChips value={watch('date')} onChoose={(date) => setValue('date', date, { shouldValidate: formState.isSubmitted })} />
          </div>
          <div className="sm:col-span-2 sm:max-w-md">
            <SelectField
              label={t('If the driver withdraws')}
              value={tier}
              onChange={(event) => setTier(event.target.value as FlexTier)}
              hint={t('Flexible and any time book you on another ride automatically. The price is the same.')}
            >
              <option value="EXACT">{t('Only this ride: suggest others')}</option>
              <option value="FLEXIBLE">{t('Flexible: book me within 2 hours')}</option>
              <option value="ANY_TIME">{t('Any time that day')}</option>
            </SelectField>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button type="submit" className="px-6 py-2.5 text-[15px]">
              <Search aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
              {t('Search')}
            </Button>
            <Button tone="secondary" aria-expanded={mapOpen} onClick={() => setMapOpen(!mapOpen)}>
              <MapIcon aria-hidden="true" className="h-4 w-4" />
              {mapOpen ? t('Hide the map') : t('Choose exact points on a map')}
            </Button>
            <Button tone="secondary" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>
              <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
              {filtersOpen && !phone ? t('Hide filters') : t('Filters')}
              {filtersSet > 0 && (
                <span key={filtersSet} aria-hidden="true" className="inline-flex min-w-[1.25rem] animate-badge-pop items-center justify-center rounded-full bg-tint px-1.5 text-[11px] font-bold leading-5 text-white">
                  {filtersSet}
                </span>
              )}
            </Button>
          </div>

          <div className="sm:col-span-2">
            <Collapse open={mapOpen || picked.origin !== undefined || picked.destination !== undefined}>
              <ul className="space-y-0.5 text-[13px] text-slate-600">
                <li>{endLine('origin')}</li>
                <li>{endLine('destination')}</li>
              </ul>
              <p className="mt-1 text-[13px] text-slate-500">
                {t(
                  'Rides are matched to the centre of each town unless you choose an exact point. Only rides with a stop near each end, or whose driver will come to your start, are shown.',
                )}
              </p>
            </Collapse>
            <Collapse open={mapOpen}>
              <div className="mt-3 space-y-2">
                <fieldset className="flex flex-wrap gap-4 text-sm">
                  <legend className="sr-only">{t('Which point a click on the map sets')}</legend>
                  <label className="flex items-center gap-1">
                    <input type="radio" name="setting" checked={setting === 'origin'} onChange={() => setSetting('origin')} />
                    {t('A click sets my start')}
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="radio" name="setting" checked={setting === 'destination'} onChange={() => setSetting('destination')} />
                    {t('A click sets my destination')}
                  </label>
                </fieldset>
                <RouteMap
                  points={mapPoints}
                  onPick={(lat, lon) => setPicked({ ...picked, [setting]: { lat, lon } })}
                  describe={t('Map around your start and destination. Click to choose an exact point.')}
                />
              </div>
            </Collapse>
          </div>

          {/* On a phone the filters open in a sheet (below); here they open in place. */}
          {!phone && (
            <div className="sm:col-span-2">
              <Collapse open={filtersOpen}>{filterFields}</Collapse>
            </div>
          )}
        </form>
        {phone && (
          <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title={t('Filters')} swipe={false}>
            <div className="max-h-[60vh] overflow-y-auto overscroll-contain">{filterFields}</div>
            <Button
              className="mt-4 w-full"
              onClick={() => {
                setFiltersOpen(false);
                searchForm.current?.requestSubmit();
              }}
            >
              <Search aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
              {t('Search')}
            </Button>
          </Sheet>
        )}
      </Card>

      {booked && (
        <SuccessCard key={booked.id}>
          {booked.status === 'CONFIRMED'
            ? t('Booked. {from} to {to}, leaving {time}.', {
                from: t(booked.fromStop),
                to: t(booked.toStop),
                time: formatDateTime(booked.boardingTime),
              })
            : t('Request sent. Your seats are held while the driver decides; see My bookings.')}
          {booked.paymentStatus === 'DEFERRED' &&
            ` ${t('Nothing to pay now: pay your driver {amount} after the ride, in cash or by UPI.', { amount: formatRupees(booked.price) })}`}
        </SuccessCard>
      )}
      {book.error && <Notice tone="error">{book.error.message}</Notice>}

      {criteria && (
        <section aria-label={t('Search results')} className="space-y-3">
          <QueryState
            isPending={results.isPending}
            error={results.error}
            isEmpty={results.data?.length === 0}
            empty={
              Object.keys(filterParams(criteria.filters)).length > 0
                ? t('No rides match on that day with those filters. Try fewer filters, another date or other points.')
                : t('No rides have a stop near both ends on that day with that many seats. Try another date or other points.')
            }
            onRetry={() => void results.refetch()}
          />
          {results.data?.length === 0 && (
            <Button tone="secondary" onClick={tryNextDay}>
              <CalendarPlus aria-hidden="true" className="h-4 w-4" />
              {t('Try the next day')}
            </Button>
          )}
          {results.data?.length === 0 && <BusAlternatives from={criteria.form.origin} to={criteria.form.destination} />}
          {results.data && results.data.length > 0 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <h2 className="text-lg font-bold tracking-tight text-slate-900">
                  {results.data.length === 1 ? t('{n} ride found', { n: results.data.length }) : t('{n} rides found', { n: results.data.length })}
                </h2>
                <LiveStatus query={seatsNow} label={t('Seats are live')} />
              </div>
              <Segmented<SearchSort>
                label={t('Sort by')}
                value={criteria.sort}
                options={[
                  { value: 'TIME', label: t('Earliest departure') },
                  { value: 'PRICE', label: t('Lowest price') },
                  { value: 'RATING', label: t('Best-rated driver') },
                  { value: 'PROXIMITY', label: t('Nearest pickup') },
                  { value: 'BEST_MATCH', label: t('Best match for both of you') },
                ]}
                onChange={(next) => {
                  setSort(next);
                  startSorting(() => setCriteria({ ...criteria, sort: next }));
                }}
              />
              {criteria.sort === 'BEST_MATCH' && (
                <p className="max-w-xl text-sm text-slate-600">
                  {t(
                    "Scored for both of you from what you each said on your profiles, the distance, the price and the driver's record of rides kept. Never from any prediction about either of you. Say what you prefer on your account page to be matched on it.",
                  )}
                </p>
              )}
            </>
          )}
          <div aria-busy={stale} className={`stagger space-y-3 transition-opacity duration-200 ${stale ? 'opacity-50' : ''}`}>
          {results.data?.map((candidate) => {
            const key = candidateKey(candidate, criteria.form.seats);
            const now = standing(candidate);
            const seatsLeft = now?.seatsAvailable ?? candidate.seatsAvailable;
            const gone = now !== undefined && now.status !== 'SCHEDULED' && now.status !== 'IN_PROGRESS';
            const tooFew = seatsLeft < criteria.form.seats;
            return (
              <Card key={key}>
                {/* One sentence for screen readers; the timeline below draws the same thing. */}
                <p className="sr-only">
                  {formatTime(candidate.boardingTime)} {candidate.detourMinutes != null ? t('Your start') : t(candidate.fromStop)} →{' '}
                  {formatTime(candidate.arrivalTime)} {t(candidate.toStop)}
                </p>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div aria-hidden="true" className="flex min-w-0 gap-3">
                    <div className="flex flex-col items-center py-2">
                      <span className="h-3 w-3 rounded-full border-[3px] border-teal-600 bg-surface" />
                      <span className="my-1 w-0.5 flex-1 rounded-full bg-gradient-to-b from-teal-600 to-teal-200" />
                      <span className="h-3 w-3 rounded-full bg-teal-600" />
                    </div>
                    <div className="flex min-w-0 flex-col gap-2">
                      <div>
                        <p className="text-xl font-bold leading-tight tabular-nums text-slate-900">{formatTime(candidate.boardingTime)}</p>
                        <p className="truncate text-sm text-slate-600">{candidate.detourMinutes != null ? t('Your start') : t(candidate.fromStop)}</p>
                      </div>
                      <p className="text-xs font-medium text-slate-500">{units.duration(Math.max(0, Math.round((Date.parse(candidate.arrivalTime) - Date.parse(candidate.boardingTime)) / 60_000)))}</p>
                      <div>
                        <p className="text-xl font-bold leading-tight tabular-nums text-slate-900">{formatTime(candidate.arrivalTime)}</p>
                        <p className="truncate text-sm text-slate-600">{t(candidate.toStop)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-right">
                    <p className="text-right">
                      <span className="block text-2xl font-bold tracking-tight text-slate-900">{formatRupees(candidate.fare)}</span>
                      {Number(criteria.form.seats) > 1 && (
                        <span className="block text-xs text-slate-600">{t('{price} a seat', { price: formatRupees(candidate.pricePerSeat) })}</span>
                      )}
                      <span className="block text-xs text-slate-500">{t('Pay after the ride')}</span>
                    </p>
                    <Button
                      className="mt-1 px-6"
                      disabled={book.isPending || gone || tooFew}
                      busy={book.isPending && book.variables === candidate}
                      onClick={() => book.mutate(candidate)}
                    >
                      {candidate.instantBooking ? t('Book') : t('Request')}
                    </Button>
                  </div>
                </div>

                {(gone || tooFew) && (
                  <div className="mt-3">
                    <Notice tone="info">{gone ? t('This ride is no longer available.') : t('Too few seats are left on this ride now.')}</Notice>
                  </div>
                )}

                <div className="mt-4 flex items-center gap-3 border-t border-slate-900/[0.06] pt-4">
                  <Avatar initials={initialsOf(candidate.driverName)} />
                  <p className="min-w-0 text-sm">
                    <Link to={`/users/${candidate.driverId}`} className="font-semibold text-slate-900 hover:text-teal-800 hover:underline">
                      {candidate.driverName}
                    </Link>
                    <span className="block text-slate-600">
                      <RatingSummary average={candidate.driverRating} count={candidate.driverRatingCount} />
                    </span>
                    {/* What the driver typed, shown as text, not translated. */}
                    {candidate.vehicle && <span className="block truncate text-slate-500">{candidate.vehicle}</span>}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {/* Keyed by the count, so a seat taken or given back while this is on screen shows itself. */}
                  <span key={seatsLeft} className="animate-badge-pop">
                    <Chip icon={Users} tone={seatsLeft <= 1 ? 'amber' : 'sky'}>
                      {seatsLeft === 1 ? t('{n} seat left', { n: seatsLeft }) : t('{n} seats left', { n: seatsLeft })}
                    </Chip>
                  </span>
                  {candidate.instantBooking ? (
                    <Chip icon={Zap} tone="emerald">{t('Confirms instantly')}</Chip>
                  ) : (
                    <Chip icon={Clock} tone="amber">{t('Driver approves each request')}</Chip>
                  )}
                  {candidate.driverConfirmed && <Chip icon={BadgeCheck} tone="teal">{t('Contact confirmed')}</Chip>}
                  {candidate.driverIdChecked && <Chip icon={BadgeCheck} tone="emerald">{t('Identity checked by staff')}</Chip>}
                  {candidate.maxTwoInBack && <Chip icon={Armchair}>{t('At most two in the back')}</Chip>}
                  {candidate.womenOnly && <Chip icon={UserRound} tone="red">{t('Women only')}</Chip>}
                </div>

                <div className="mt-3 space-y-1.5">
                  {candidate.detourMinutes != null && (
                    <Detail icon={RouteIcon} tone="text-teal-800">
                      {t('The driver picks you up at your start, about {time}: {n} min out of their way.', {
                        time: formatTime(candidate.boardingTime),
                        n: candidate.detourMinutes,
                      })}
                    </Detail>
                  )}
                  {candidate.underWay && (
                    <Detail icon={TriangleAlert} tone="text-amber-800">
                      {t('Already on the road: it may reach {stop} before the time shown, so be there early.', { stop: t(candidate.fromStop) })}
                    </Detail>
                  )}
                  <button
                    type="button"
                    className="block w-full text-left touch:min-h-11"
                    onClick={() => selectLastMile.mutate({ rideId: candidate.rideId, mode: 'walk' })}
                  >
                    <Detail icon={Footprints}>
                      {candidate.pickupDistanceM < NEAR_M
                        ? t('Picks you up where you start')
                        : t('Pickup {pickup} from your start', { pickup: units.distance(candidate.pickupDistanceM) })}
                      {' · '}
                      {candidate.dropoffDistanceM < NEAR_M
                        ? t('drops you where you are going')
                        : t('drop-off {dropoff} from your destination', { dropoff: units.distance(candidate.dropoffDistanceM) })}
                      {candidate.pickupWalkMinutes > 0 &&
                        ` · ${
                          candidate.walkOnFootpaths
                            ? t('about {minutes} min walk to the pickup, by footpath', { minutes: candidate.pickupWalkMinutes })
                            : t('about {minutes} min walk to the pickup, in a straight line', { minutes: candidate.pickupWalkMinutes })
                        }`}
                    </Detail>
                  </button>
                  {criteria.sort === 'BEST_MATCH' && (
                    <Detail icon={Sparkles} tone="text-teal-800">
                      {[
                        t('Match {score} of 100', { score: candidate.matchScore }),
                        ...candidate.matchReasons.map((reason) => t(matchReasonLabels[reason])),
                      ].join(' · ')}
                    </Detail>
                  )}
                  {candidate.suggestFlexible && tier === 'EXACT' && (
                    <Detail icon={Shuffle} tone="text-amber-800">
                      {t('This driver has withdrawn some rides. A flexible booking would move you to another ride automatically.')}
                    </Detail>
                  )}
                  <Button tone="secondary" onClick={() => setDetails(key)}>
                    <Info aria-hidden="true" className="h-4 w-4" />
                    {t('Ride details')}
                  </Button>
                  <RideDetails
                    candidate={candidate}
                    seats={Number(criteria.form.seats)}
                    open={details === key}
                    onClose={() => setDetails(null)}
                    action={
                      <Button
                        className="px-6"
                        disabled={book.isPending || gone || tooFew}
                        busy={book.isPending && book.variables === candidate}
                        onClick={() => book.mutate(candidate, { onSuccess: () => setDetails(null) })}
                      >
                        {candidate.instantBooking ? t('Book') : t('Request')}
                      </Button>
                    }
                  />
                  <More label={t('More about this ride')}>
                  <div className="space-y-1.5">
                  {/* `vehicle` is what the driver typed: shown as text, not translated. */}
                  {candidate.vehicle && <Detail icon={Car}>{[candidate.vehicle, ...vehiclePhrases(candidate, t)].join(' · ')}</Detail>}
                  {candidate.insurer && candidate.insuredUntil && (
                    <Detail icon={ShieldCheck}>
                      {candidate.insuranceChecked
                        ? t('Insurance: {insurer}, until {date}. VAYORA staff saw the policy; it was not checked with the insurer.', {
                            insurer: candidate.insurer,
                            date: formatDate(candidate.insuredUntil),
                          })
                        : t('Insurance declared by the driver: {insurer}, until {date}. Not checked.', {
                            insurer: candidate.insurer,
                            date: formatDate(candidate.insuredUntil),
                          })}
                    </Detail>
                  )}
                  <Detail icon={Award}>{driverRecord(candidate, t)}</Detail>
                  {(candidate.pickupRickshaw || candidate.dropoffRickshaw) && (
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 text-left text-sm text-slate-600"
                      onClick={() => selectLastMile.mutate({ rideId: candidate.rideId, mode: 'rickshaw' })}
                    >
                      <CarTaxiFront aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none opacity-70" />
                      <div className="min-w-0 space-y-0.5">
                        {candidate.pickupRickshaw && <p>{rickshawLine(candidate.pickupRickshaw, true, t)}</p>}
                        {candidate.dropoffRickshaw && <p>{rickshawLine(candidate.dropoffRickshaw, false, t)}</p>}
                        {[candidate.pickupRickshaw, candidate.dropoffRickshaw]
                          .filter((e): e is RickshawEstimate => e?.fare != null)
                          .slice(0, 1)
                          .map((e) => (
                            <p key="fare-source" className="text-xs text-slate-500">
                              {/* The source is named as configured: not translated. */}
                              {t('An estimate: the meter, traffic and hour decide. Fare published by {source}, in force from {date}.', {
                                source: e.fareSource ?? '',
                                date: e.fareSince ? formatDate(e.fareSince) : '',
                              })}
                            </p>
                          ))}
                      </div>
                    </button>
                  )}
                  </div>
                  </More>
                </div>
                <div className="mt-4">
                  <Button tone="secondary" aria-expanded={routeShown === key} onClick={() => setRouteShown(routeShown === key ? null : key)}>
                    <MapIcon aria-hidden="true" className="h-4 w-4" />
                    {routeShown === key ? t('Hide route') : t('Show route')}
                  </Button>
                  {held?.key !== key && (
                    <Button tone="secondary" className="ml-2" disabled={hold.isPending || gone || tooFew} busy={hold.isPending && hold.variables === candidate} onClick={() => hold.mutate(candidate)}>
                      {!(hold.isPending && hold.variables === candidate) && <Hourglass aria-hidden="true" className="h-4 w-4" />}
                      {t('Hold while I decide')}
                    </Button>
                  )}
                  {held?.key === key && <HoldClock until={held.until} from={held.from} onEnd={() => setHeld(null)} />}
                  {hold.error && hold.variables && candidateKey(hold.variables, criteria.form.seats) === key && (
                    <p role="alert" className="mt-2 text-sm text-red-700">
                      {hold.error.message}
                    </p>
                  )}
                  <Collapse open={routeShown === key}>
                  <RideRoute
                    rideId={candidate.rideId}
                    fromSeq={candidate.fromSeq}
                    toSeq={candidate.toSeq}
                    pickup={
                      candidate.detourMinutes != null
                        ? { lat: criteria.origin.lat, lon: criteria.origin.lon, time: candidate.boardingTime }
                        : undefined
                    }
                  />
                </Collapse>
                </div>
              </Card>
            );
          })}
          </div>
        </section>
      )}
    </Page>
  );
}

const cancellable = (booking: Booking) => booking.status === 'PENDING' || booking.status === 'CONFIRMED';

const JOURNEY = [
  { label: msg('Requested'), icon: Send },
  { label: msg('Accepted'), icon: Check },
  { label: msg('Under way'), icon: Car },
  { label: msg('Arrived'), icon: Flag },
];

/** How far a booking has got, from the booking and its ride as they stand now. */
function Journey({ booking, rideStatus }: { booking: Booking; rideStatus?: RideStatus }) {
  const t = useT();
  const step = booking.status === 'PENDING' ? 0 : booking.status === 'COMPLETED' ? 3 : rideStatus === 'IN_PROGRESS' ? 2 : 1;
  return (
    <ol aria-label={t('How far this booking has got')} className="mt-4 grid max-w-md grid-cols-4">
      {JOURNEY.map(({ label, icon: Icon }, index) => (
        <li key={label} aria-current={index === step ? 'step' : undefined} className="relative flex flex-col items-center gap-1 text-center">
          {index > 0 && (
            <span aria-hidden="true" className={`absolute right-1/2 top-3.5 z-0 h-0.5 w-full transition-colors duration-700 ${index <= step ? 'bg-accent' : 'bg-slate-200'}`} />
          )}
          <span aria-hidden="true" className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-500 ${index <= step ? 'bg-accent text-white' : 'bg-slate-100 text-slate-500'}`}>
            {index === step && step < 3 && <span className="absolute inset-0 animate-soft-ping rounded-full bg-accent" />}
            <Icon className="relative h-3.5 w-3.5" strokeWidth={2.4} />
          </span>
          <span className={`text-xs font-medium leading-tight ${index === step ? 'font-semibold text-slate-900' : index < step ? 'text-slate-700' : 'text-slate-500'}`}>{t(label)}</span>
        </li>
      ))}
    </ol>
  );
}

/** What cancelling would cost this minute, and when that rises, from the same tiers the server uses. */
function OwedNow({ booking }: { booking: Booking }) {
  const t = useT();
  const terms = usePaymentTerms();
  const ahead = useTimeAhead();
  const now = useNow(60_000);
  const hoursBefore = (Date.parse(booking.boardingTime) - now) / 3_600_000;
  if (booking.status !== 'CONFIRMED' || booking.paymentStatus !== 'DEFERRED' || !terms.data || hoursBefore <= 0) return null;
  const { share, nextShare, hoursUntilNext } = owedNow(terms.data.cancellationTiers, hoursBefore);
  const rises = { time: ahead((hoursUntilNext ?? 0) * 3_600_000), next: formatRupees(booking.price * (nextShare ?? 1)) };
  return (
    <Detail icon={Undo2}>
      {share === 1
        ? t('If you cancel now, you owe your driver the whole fare.')
        : share === 0
          ? t('If you cancel now, you owe nothing. In {time} that rises to {next}.', rises)
          : t('If you cancel now, you owe your driver {amount}. In {time} that rises to {next}.', { amount: formatRupees(booking.price * share), ...rises })}
    </Detail>
  );
}

function BookingCard({ booking, requestTerms, cancelling, onCancel }: {
  booking: Booking;
  requestTerms?: RequestTerms;
  cancelling: boolean;
  onCancel: () => void;
}) {
  const t = useT();
  const [meetingShown, setMeetingShown] = useState(false);
  const [chatShown, setChatShown] = useState(false);
  const active = cancellable(booking);
  // The ride's own state says when the driver has set off. Reading it records nothing.
  const ride = useQuery({ queryKey: ['ride', booking.rideId], queryFn: () => api<Ride>(`/rides/${booking.rideId}`), enabled: active, refetchInterval: LIVE_MS.lists });
  const underWay = active && ride.data?.status === 'IN_PROGRESS';

  return (
    <Card glow={underWay}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900">
              <span aria-hidden="true" className="flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-teal-600/[0.12] text-teal-800">
                <RouteIcon className="h-4 w-4" />
              </span>
              {t(booking.fromStop)} → {t(booking.toStop)}
            </p>
            {active && !underWay && <LeavesIn time={booking.boardingTime} />}
          </div>
          {(active || booking.status === 'COMPLETED') && <Journey booking={booking} rideStatus={ride.data?.status} />}
          {underWay && (
            <p role="status" className="mt-3 flex items-center gap-2 text-sm font-medium text-teal-800">
              <LiveDot />
              {t('Your ride is on the road. Open the chat to see where the driver is.')}
            </p>
          )}
          <div className="mt-3 space-y-1.5">
            <Detail icon={Clock}>
              {booking.seats === 1
                ? t('Leaves {time} · {n} seat', { time: formatDateTime(booking.boardingTime), n: booking.seats })
                : t('Leaves {time} · {n} seats', { time: formatDateTime(booking.boardingTime), n: booking.seats })}
            </Detail>
            {booking.pickupLat != null && (
              <Detail icon={Footprints} tone="text-teal-800">{t('Picked up at your own point after {stop}, not at the stop.', { stop: t(booking.fromStop) })}</Detail>
            )}
            {booking.driverName && (
              <Detail icon={UserRound}>
                {t('Driver')}{' '}
                <Link to={`/users/${booking.driverId}`} className="font-semibold text-teal-800 hover:underline">
                  {booking.driverName}
                </Link>
                {/* What the driver typed: shown as text, not translated. */}
                {booking.vehicle && ` · ${booking.vehicle}`}
              </Detail>
            )}
          </div>
          <p className="mt-1.5 flex items-start gap-2 text-sm text-slate-600">
            <Wallet aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none opacity-70" />
            {t('Fare {amount}', { amount: formatRupees(booking.price) })}
            {booking.paymentStatus &&
              ` · ${
                booking.paymentStatus === 'DUE' && booking.amountDue != null
                  ? t('{amount} owed to your driver', { amount: formatRupees(booking.amountDue) })
                  : booking.paymentStatus === 'SETTLED'
                    ? booking.paymentMethod === 'UPI'
                      ? t('paid by UPI')
                      : t('paid in cash')
                    : booking.paymentStatus === 'VOID'
                      ? t('nothing owed')
                      : t('pay after the ride')
              }`}
          </p>
          <div className="mt-1.5">
            <OwedNow booking={booking} />
          </div>
          <p className="mt-2">
            <StatusBadge status={booking.status} />
          </p>
          {booking.flexTier && booking.flexTier !== 'EXACT' && (
            <p className="mt-2 text-sm text-slate-600">
              {booking.flexTier === 'FLEXIBLE'
                ? t('If the driver withdraws, you are booked on another ride within 2 hours.')
                : t('If the driver withdraws, you are booked on another ride that day.')}
            </p>
          )}
          {booking.status === 'PENDING' && requestTerms && (
            <p className="mt-2 text-sm text-slate-600">
              {t('The driver has until {time} to answer. After that the request closes and you owe nothing.', {
                time: formatDateTime(answerBy(booking.createdAt, booking.boardingTime, requestTerms)),
              })}
            </p>
          )}
          {active && <BoardingPassView bookingId={booking.id} />}
        </div>
      </div>
      {active && (
        <div className={`mt-4 grid gap-2 ${booking.status === 'CONFIRMED' ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <ActionTile
            icon={MapIcon}
            label={meetingShown ? t('Hide meeting point') : t('Show meeting point')}
            active={meetingShown}
            aria-expanded={meetingShown}
            onClick={() => setMeetingShown(!meetingShown)}
          />
          <ActionTile
            icon={MessagesSquare}
            label={chatShown ? t('Close chat') : t('Open chat')}
            // On the road, the chat is how the two sides find each other: it stands out.
            active={chatShown || underWay}
            aria-expanded={chatShown}
            onClick={() => setChatShown(!chatShown)}
          />
          {booking.status === 'CONFIRMED' && <CallButton tile bookingId={booking.id} label={t('Call the driver')} />}
        </div>
      )}
      {booking.paymentStatus === 'DUE' && booking.amountDue != null && (
        <div className="mt-3 space-y-2">
          <Notice tone="info">
            {t('You owe your driver {amount}. You can book again once they mark it paid.', { amount: formatRupees(booking.amountDue) })}
          </Notice>
          <HowToPayDriver bookingId={booking.id} amount={booking.amountDue} />
          <p className="text-sm text-slate-600">
            {t('Paid, and they will not mark it?')}{' '}
            <Link to={`/users/${booking.driverId}`} className="font-medium text-teal-800 underline underline-offset-2">
              {t('Report it on their profile, and staff can clear it.')}
            </Link>
          </p>
        </div>
      )}
      {booking.status === 'CONFIRMED' && booking.paymentStatus === 'DEFERRED' && (
        <div className="mt-3">
          <More label={t('How to pay your driver')}>
            <HowToPayDriver bookingId={booking.id} amount={booking.price} />
          </More>
        </div>
      )}
      {active && (
        <div className="mt-2 flex justify-end">
          <ConfirmButton quiet label={t('Cancel booking')} confirmLabel={t('Yes, cancel it')} disabled={cancelling} onConfirm={onCancel}>
            <OwedNow booking={booking} />
            <CancellingTerms />
          </ConfirmButton>
        </div>
      )}
      <Collapse open={meetingShown}>
        <RideRoute
          rideId={booking.rideId}
          fromSeq={booking.fromSeq}
          toSeq={booking.toSeq}
          pickup={
            booking.pickupLat != null && booking.pickupLon != null
              ? { lat: booking.pickupLat, lon: booking.pickupLon, time: booking.boardingTime }
              : undefined
          }
        />
      </Collapse>
      {chatShown && active && <RideChat rideId={booking.rideId} rideStatus={ride.data?.status} />}
      {booking.status === 'COMPLETED' && booking.passengerConfirmed == null && <TripConfirmation bookingId={booking.id} />}
      {booking.status === 'COMPLETED' && !booking.passengerRated && <RateForm bookingId={booking.id} legend={t('Rate your driver')} />}
    </Card>
  );
}

export function BookingsPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const bookings = useQuery({ queryKey: ['bookings'], queryFn: () => api<Booking[]>('/bookings'), refetchInterval: LIVE_MS.lists });
  // The same for every booking and rarely changed, so asked for once.
  const requestTerms = useQuery({ queryKey: ['booking-terms'], queryFn: () => api<RequestTerms>('/booking-terms'), staleTime: Infinity });
  const cancel = useMutation({
    mutationFn: (id: number) => api<Booking>(`/bookings/${id}/cancel`, { method: 'POST' }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['bookings'] }),
  });
  const upcoming = bookings.data?.filter(cancellable) ?? [];
  const past = bookings.data?.filter((booking) => !cancellable(booking)) ?? [];
  const list = (shown: Booking[]) =>
    shown.map((booking) => (
      <BookingCard key={booking.id} booking={booking} requestTerms={requestTerms.data} cancelling={cancel.isPending} onCancel={() => cancel.mutate(booking.id)} />
    ));

  return (
    <Page title={t('My bookings')} aside={bookings.data && bookings.data.length > 0 ? <LiveStatus query={bookings} /> : undefined}>
      {cancel.error && <Notice tone="error">{cancel.error.message}</Notice>}
      <QueryState
        isPending={bookings.isPending}
        error={bookings.error}
        isEmpty={bookings.data?.length === 0}
        empty={t('You have no bookings yet.')}
        icon={Ticket}
        onRetry={() => void bookings.refetch()}
      />
      {upcoming.length > 0 && (
        <More label={t('What cancelling costs')}>
          <CancellingTerms />
        </More>
      )}
      {upcoming.length > 0 && <h2 className="text-lg font-bold tracking-tight text-slate-900">{t('Coming up')}</h2>}
      {list(upcoming)}
      {past.length > 0 && <h2 className="pt-2 text-lg font-bold tracking-tight text-slate-900">{t('Earlier')}</h2>}
      {list(past)}
    </Page>
  );
}
