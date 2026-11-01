import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { Armchair, Award, BadgeCheck, Car, CarTaxiFront, Clock, Footprints, Hourglass, Map as MapIcon, Route as RouteIcon, ShieldCheck, Shuffle, Sparkles, Ticket, TriangleAlert, UserRound, Users, Wallet, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

import { laterLine, paidLine, PayDue, RefundTerms, SimulatedPaymentNotice, usePaymentTerms } from '../components/payment';
import { RateForm, RatingSummary } from '../components/rating';
import { RideChat } from '../components/RideChat';
import { BoardingPassView } from '../components/boarding';
import { BusAlternatives } from '../components/bus';
import { TripConfirmation } from '../components/tripConfirmation';
import { RouteMap, type MapPoint } from '../components/RouteMap';
import { CallButton } from '../components/call';
import { initialsOf } from '../components/photo';
import { Collapse } from '../components/collapse';
import { SuccessCard } from '../components/success';
import { Button, Card, Chip, ConfirmButton, Detail, Notice, Page, QueryState, SelectField, StatusBadge, StepperField, TextField } from '../components/ui';
import { api } from '../lib/api';
import { placeNamed } from '../lib/places';
import { PlaceOptions } from '../components/places';
import { answerBy, formatDate, formatDateTime, formatRupees, formatTime, todayInCorridor } from '../lib/format';
import { msg, useT, useUnits } from '../lib/i18n';
import { matchReasonLabels } from '../lib/match';
import { payAtCheckout } from '../lib/razorpay';
import { comfortLabels, luggageLabels, vehiclePhrases } from '../lib/vehicle';
import { searchSchema, type SearchForm } from '../lib/schemas';
import type {
  Booking,
  Candidate,
  Comfort,
  FlexTier,
  Luggage,
  MyProfile,
  PaymentMethod,
  RequestTerms,
  RickshawEstimate,
  Ride,
  SearchSort,
  SeatHold,
} from '../lib/types';

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

export function SearchPage() {
  const t = useT();
  const units = useUnits();
  const queryClient = useQueryClient();
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  // Women-only rides are offered only to passengers whose profile says they are a woman.
  const me = useQuery({ queryKey: ['me', 'profile'], queryFn: () => api<MyProfile>('/me/profile') });
  const [booked, setBooked] = useState<Booking | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('UPI');
  const [tier, setTier] = useState<FlexTier>('EXACT');
  // With Razorpay the passenger pays in its checkout, and a booking is for this ride only.
  const terms = usePaymentTerms();
  const checkout = terms.data?.checkout === true;
  const [sort, setSort] = useState<SearchSort>('TIME');
  // A new order is not urgent: the results on screen stay, dimmed, until the new order arrives.
  const [sorting, startSorting] = useTransition();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Exact points chosen on the map. Either replaces its town's centre.
  const [picked, setPicked] = useState<{ origin?: LatLon; destination?: LatLon }>({});
  const [setting, setSetting] = useState<'origin' | 'destination'>('origin');
  const [mapOpen, setMapOpen] = useState(false);
  const [routeShown, setRouteShown] = useState<string | null>(null);
  // One key per thing the passenger is trying to book, kept until it succeeds, so that
  // pressing the button again after a lost response cannot book and charge twice.
  const idempotencyKeys = useRef(new Map<string, string>());
  const { register, handleSubmit, formState, watch, setValue, getValues } = useForm<SearchForm>({
    resolver: zodResolver(searchSchema),
    defaultValues: { origin: 'Kolhapur', destination: 'Pune', date: todayInCorridor(), seats: 1 },
  });
  const towns = { origin: watch('origin'), destination: watch('destination') };

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

  const book = useMutation({
    // `later`: book now and pay once the booking ends, on a ride whose driver accepts that.
    mutationFn: async ({ candidate, later }: { candidate: Candidate; later: boolean }) => {
      const key = candidateKey(candidate, criteria!.form.seats);
      if (!idempotencyKeys.current.has(key)) idempotencyKeys.current.set(key, crypto.randomUUID());
      const stretch = { rideId: candidate.rideId, fromSeq: candidate.fromSeq, toSeq: candidate.toSeq, seats: criteria!.form.seats };
      // Paid first, at the checkout, for what core-api says is due; then booked with the proof.
      const razorpay = checkout && !later
        ? await payAtCheckout('/bookings/checkout', stretch, `${t(candidate.fromStop)} – ${t(candidate.toStop)}`)
        : undefined;
      return api<Booking>('/bookings', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKeys.current.get(key)! },
        body: {
          ...stretch,
          ...(later ? { payAfterRide: true } : razorpay ? { razorpay } : { paymentMethod: method }),
          tier: checkout ? 'EXACT' : tier,
          // Picked up where the search started, if that is what the result offered.
          ...(candidate.detourMinutes != null ? { pickupLat: criteria!.origin.lat, pickupLon: criteria!.origin.lon } : {}),
          // The last-mile gap and access option feature 91 showed for this result, for
          // the durability model; nothing is booked by sending it.
          lastMileDistanceM: candidate.pickupDistanceM,
          lastMileModeShown: candidate.pickupRickshaw ? 'rickshaw' : 'walk',
        },
      });
    },
    onSuccess: (booking, { candidate }) => {
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
  const [held, setHeld] = useState<{ key: string; until: string } | null>(null);
  const hold = useMutation({
    mutationFn: (candidate: Candidate) =>
      api<SeatHold>('/holds', {
        method: 'POST',
        body: { rideId: candidate.rideId, fromSeq: candidate.fromSeq, toSeq: candidate.toSeq, seats: criteria!.form.seats },
      }),
    onSuccess: (placed, candidate) => setHeld({ key: candidateKey(candidate, criteria!.form.seats), until: placed.expiresAt }),
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

  return (
    <Page title={t('Find a ride')}>
      <Card>
        <form
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
          })}
          noValidate
          className="grid gap-4 sm:grid-cols-2"
        >
          <SelectField label={t('From')} error={formState.errors.origin?.message} {...register('origin')}>
            <PlaceOptions />
          </SelectField>
          <SelectField label={t('To')} error={formState.errors.destination?.message} {...register('destination')}>
            <PlaceOptions />
          </SelectField>
          <TextField label={t('Date')} type="date" min={todayInCorridor()} error={formState.errors.date?.message} {...register('date')} />
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

          <div className="space-y-3 sm:col-span-2">
            <p className="text-sm text-slate-600">
              {t(
                'Rides are matched to the centre of each town unless you choose an exact point. Only rides with a stop near each end, or whose driver will come to your start, are shown.',
              )}
            </p>
            <ul className="space-y-1 text-sm text-slate-700">
              <li>{endLine('origin')}</li>
              <li>{endLine('destination')}</li>
            </ul>
            <Button tone="secondary" aria-expanded={mapOpen} onClick={() => setMapOpen(!mapOpen)}>
              {mapOpen ? t('Hide the map') : t('Choose exact points on a map')}
            </Button>
            <Collapse open={mapOpen}>
              <div className="space-y-2">
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

          <div className="space-y-3 sm:col-span-2">
            <Button tone="secondary" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>
              {filtersOpen ? t('Hide filters') : t('Filters')}
            </Button>
            <Collapse open={filtersOpen}>
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
            </Collapse>
          </div>

          <div className="sm:col-span-2">
            <Button type="submit">{t('Search')}</Button>
          </div>
        </form>
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
          {booked.total !== null &&
            ` ${booked.payAfterRide ? laterLine(formatRupees(booked.total), t) : paidLine(terms.data?.provider, formatRupees(booked.total), t)}`}
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
          {results.data?.length === 0 && <BusAlternatives from={criteria.form.origin} to={criteria.form.destination} />}
          {results.data && results.data.length > 0 && (
            <>
              <SimulatedPaymentNotice />
              <div className="grid max-w-xl gap-4 sm:grid-cols-2">
                <SelectField
                  label={t('Sort by')}
                  value={criteria.sort}
                  onChange={(event) => {
                    const next = event.target.value as SearchSort;
                    setSort(next);
                    startSorting(() => setCriteria({ ...criteria, sort: next }));
                  }}
                >
                  <option value="TIME">{t('Earliest departure')}</option>
                  <option value="PRICE">{t('Lowest price')}</option>
                  <option value="RATING">{t('Best-rated driver')}</option>
                  <option value="PROXIMITY">{t('Nearest pickup')}</option>
                  <option value="BEST_MATCH">{t('Best match for both of you')}</option>
                </SelectField>
                {checkout ? (
                  <p className="text-sm text-slate-600">
                    {t("You pay by card, UPI or a wallet in Razorpay's checkout when you book. A booking paid there is for this ride only: if the driver withdraws, everything comes back and other rides are suggested.")}
                  </p>
                ) : (
                  <>
                    <SelectField
                      label={t('Pay with')}
                      value={method}
                      onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                      hint={t('The amount is held when you book and settled when the trip ends.')}
                    >
                      <option value="UPI">{t('UPI')}</option>
                      <option value="CARD">{t('Card')}</option>
                      <option value="WALLET">{t('Wallet')}</option>
                    </SelectField>
                    <SelectField
                      label={t('If the driver withdraws')}
                      value={tier}
                      onChange={(event) => setTier(event.target.value as FlexTier)}
                      hint={t('Flexible and any time book you on another ride automatically, with a new payment hold. The price is the same.')}
                    >
                      <option value="EXACT">{t('Only this ride: suggest others')}</option>
                      <option value="FLEXIBLE">{t('Flexible: book me within 2 hours')}</option>
                      <option value="ANY_TIME">{t('Any time that day')}</option>
                    </SelectField>
                  </>
                )}
              </div>
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
                    <div className="flex min-w-0 flex-col gap-3">
                      <div>
                        <p className="text-xl font-bold leading-tight tabular-nums text-slate-900">{formatTime(candidate.boardingTime)}</p>
                        <p className="truncate text-sm text-slate-600">{candidate.detourMinutes != null ? t('Your start') : t(candidate.fromStop)}</p>
                      </div>
                      <div>
                        <p className="text-xl font-bold leading-tight tabular-nums text-slate-900">{formatTime(candidate.arrivalTime)}</p>
                        <p className="truncate text-sm text-slate-600">{t(candidate.toStop)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-right">
                    <p className="text-right">
                      <span className="block text-2xl font-bold tracking-tight text-slate-900">{formatRupees(candidate.total)}</span>
                      <span className="block text-xs text-slate-500">
                        {t('{fare} fare + {fee} service fee', {
                          fare: formatRupees(candidate.fare),
                          fee: formatRupees(candidate.serviceFee),
                        })}
                      </span>
                      {candidate.keptRides && Number(candidate.serviceFee) > 0 && (
                        <span className="block text-xs font-medium text-emerald-800">{t('A lower fee: this driver keeps their rides')}</span>
                      )}
                    </p>
                    <Button className="mt-1 px-6" disabled={book.isPending} onClick={() => book.mutate({ candidate, later: false })}>
                      {candidate.instantBooking ? t('Book') : t('Request')}
                    </Button>
                    {candidate.payAfterRide && (
                      <Button tone="secondary" disabled={book.isPending} onClick={() => book.mutate({ candidate, later: true })}>
                        {candidate.instantBooking ? t('Book, pay after the ride') : t('Request, pay after the ride')}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3 border-t border-slate-900/[0.06] pt-4">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full bg-gradient-to-br from-[#14b8a6] to-[#0f766e] text-sm font-bold text-white shadow-sm"
                  >
                    {initialsOf(candidate.driverName)}
                  </span>
                  <p className="min-w-0 text-sm">
                    <Link to={`/users/${candidate.driverId}`} className="font-semibold text-slate-900 hover:text-teal-800 hover:underline">
                      {candidate.driverName}
                    </Link>
                    <span className="block text-slate-600">
                      <RatingSummary average={candidate.driverRating} count={candidate.driverRatingCount} />
                    </span>
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Chip icon={Users} tone="sky">
                    {candidate.seatsAvailable === 1
                      ? t('{n} seat left', { n: candidate.seatsAvailable })
                      : t('{n} seats left', { n: candidate.seatsAvailable })}
                  </Chip>
                  {candidate.instantBooking ? (
                    <Chip icon={Zap} tone="emerald">{t('Confirms instantly')}</Chip>
                  ) : (
                    <Chip icon={Clock} tone="amber">{t('Driver approves each request')}</Chip>
                  )}
                  {candidate.payAfterRide && <Chip icon={Wallet} tone="teal">{t('Pay after the ride')}</Chip>}
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
                  <button
                    type="button"
                    className="block w-full text-left"
                    onClick={() => selectLastMile.mutate({ rideId: candidate.rideId, mode: 'walk' })}
                  >
                    <Detail icon={Footprints}>
                      {t('Pickup {pickup} from your start · drop-off {dropoff} from your destination', {
                        pickup: units.distance(candidate.pickupDistanceM),
                        dropoff: units.distance(candidate.dropoffDistanceM),
                      })}
                      {candidate.pickupWalkMinutes > 0 &&
                        ` · ${
                          candidate.walkOnFootpaths
                            ? t('about {minutes} min walk to the pickup, by footpath', { minutes: candidate.pickupWalkMinutes })
                            : t('about {minutes} min walk to the pickup, in a straight line', { minutes: candidate.pickupWalkMinutes })
                        }`}
                    </Detail>
                  </button>
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
                  <Detail icon={Award}>{driverRecord(candidate, t)}</Detail>
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
                </div>
                <div className="mt-4">
                  <Button tone="secondary" aria-expanded={routeShown === key} onClick={() => setRouteShown(routeShown === key ? null : key)}>
                    <MapIcon aria-hidden="true" className="h-4 w-4" />
                    {routeShown === key ? t('Hide route') : t('Show route')}
                  </Button>
                  {held?.key !== key && (
                    <Button tone="secondary" className="ml-2" disabled={hold.isPending} onClick={() => hold.mutate(candidate)}>
                      <Hourglass aria-hidden="true" className="h-4 w-4" />
                      {t('Hold while I decide')}
                    </Button>
                  )}
                  {held?.key === key && (
                    <p role="status" className="mt-2 text-sm font-medium text-emerald-800">
                      {t('Held for you until {time}. This is not a booking: book before then or the seats go back.', {
                        time: formatTime(held.until),
                      })}
                    </p>
                  )}
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

export function BookingsPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const bookings = useQuery({ queryKey: ['bookings'], queryFn: () => api<Booking[]>('/bookings') });
  // The same for every booking and rarely changed, so asked for once.
  const requestTerms = useQuery({ queryKey: ['booking-terms'], queryFn: () => api<RequestTerms>('/booking-terms'), staleTime: Infinity });
  const [meetingShown, setMeetingShown] = useState<number | null>(null);
  const [chatShown, setChatShown] = useState<number | null>(null);
  const cancel = useMutation({
    mutationFn: (id: number) => api<Booking>(`/bookings/${id}/cancel`, { method: 'POST' }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['bookings'] }),
  });
  const cancellable = (booking: Booking) => booking.status === 'PENDING' || booking.status === 'CONFIRMED';

  return (
    <Page title={t('My bookings')}>
      {cancel.error && <Notice tone="error">{cancel.error.message}</Notice>}
      <QueryState
        isPending={bookings.isPending}
        error={bookings.error}
        isEmpty={bookings.data?.length === 0}
        empty={t('You have no bookings yet.')}
        icon={Ticket}
        onRetry={() => void bookings.refetch()}
      />
      {bookings.data && bookings.data.length > 0 && <SimulatedPaymentNotice />}
      {bookings.data?.some(cancellable) && <RefundTerms />}
      {bookings.data?.map((booking) => (
        <Card key={booking.id}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900">
                <span aria-hidden="true" className="flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-teal-600/[0.12] text-teal-800">
                  <RouteIcon className="h-4 w-4" />
                </span>
                {t(booking.fromStop)} → {t(booking.toStop)}
              </p>
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
                {booking.total === null
                  ? t('Fare {amount}', { amount: formatRupees(booking.price) })
                  : t('{total} ({fare} fare + {fee} service fee)', {
                      total: formatRupees(booking.total),
                      fare: formatRupees(booking.price),
                      fee: formatRupees(booking.serviceFee ?? 0),
                    })}
                {booking.refunded !== null && ` · ${t('{amount} returned', { amount: formatRupees(booking.refunded) })}`}
                {booking.payAfterRide &&
                  ` · ${
                    booking.paymentStatus === 'DUE' && booking.amountDue != null
                      ? t('{amount} due', { amount: formatRupees(booking.amountDue) })
                      : booking.paymentStatus === 'SETTLED'
                        ? t('paid after the ride')
                        : booking.paymentStatus === 'VOID'
                          ? t('nothing owed')
                          : t('pay after the ride')
                  }`}
              </p>
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
              {booking.status === 'PENDING' && requestTerms.data && (
                <p className="mt-2 text-sm text-slate-600">
                  {t('The driver has until {time} to answer. After that the request closes and everything you paid is returned.', {
                    time: formatDateTime(answerBy(booking.createdAt, booking.boardingTime, requestTerms.data)),
                  })}
                </p>
              )}
              {cancellable(booking) && <BoardingPassView bookingId={booking.id} />}
            </div>
            <div className="flex flex-wrap gap-2">
              {cancellable(booking) && (
                <>
                  <Button
                    tone="secondary"
                    aria-expanded={meetingShown === booking.id}
                    onClick={() => setMeetingShown(meetingShown === booking.id ? null : booking.id)}
                  >
                    {meetingShown === booking.id ? t('Hide meeting point') : t('Show meeting point')}
                  </Button>
                  <Button
                    tone="secondary"
                    aria-expanded={chatShown === booking.id}
                    onClick={() => setChatShown(chatShown === booking.id ? null : booking.id)}
                  >
                    {chatShown === booking.id ? t('Close chat') : t('Open chat')}
                  </Button>
                  <ConfirmButton
                    label={t('Cancel booking')}
                    confirmLabel={t('Yes, cancel it')}
                    disabled={cancel.isPending}
                    onConfirm={() => cancel.mutate(booking.id)}
                  />
                </>
              )}
            </div>
          </div>
          {booking.status === 'CONFIRMED' && (
            <div className="mt-3">
              <CallButton bookingId={booking.id} label={t('Call the driver')} />
            </div>
          )}
          {booking.paymentStatus === 'DUE' && booking.amountDue != null && (
            <PayDue bookingId={booking.id} amount={booking.amountDue} description={`${t(booking.fromStop)} – ${t(booking.toStop)}`} />
          )}
          <Collapse open={meetingShown === booking.id}>
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
          {chatShown === booking.id && cancellable(booking) && <RideChat rideId={booking.rideId} />}
          {booking.status === 'COMPLETED' && booking.passengerConfirmed == null && <TripConfirmation bookingId={booking.id} />}
          {booking.status === 'COMPLETED' && !booking.passengerRated && <RateForm bookingId={booking.id} legend={t('Rate your driver')} />}
        </Card>
      ))}
    </Page>
  );
}
