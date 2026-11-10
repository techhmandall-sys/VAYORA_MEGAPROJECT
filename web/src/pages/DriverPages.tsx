import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Car, CarFront, Check, CirclePlus, IndianRupee, MessagesSquare, Users } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';

import { LeavesIn, LiveStatus, useTimeAhead } from '../components/live';
import { firstName, HomeStat, SetupChecklist } from '../components/setup';
import { useAuth } from '../lib/auth';
import { PaymentReceivedButtons } from '../components/payment';
import { RateForm } from '../components/rating';
import { CheckCode } from '../components/boarding';
import { CallButton } from '../components/call';
import { InsuranceEditor } from '../components/insurance';
import { RideChat } from '../components/RideChat';
import { initialsOf, PhotoEditor } from '../components/photo';
import { RouteMap } from '../components/LazyRouteMap';
import { WeeklyPayoutChart } from '../components/charts';
import { Collapse } from '../components/collapse';
import { CountUp } from '../components/countup';
import { Button, Card, ConfirmButton, Meter, Notice, Page, QueryState, SelectField, Stat, StatusBadge, TextField } from '../components/ui';
import { api } from '../lib/api';
import { PlaceField } from '../components/places';
import { placeNamed, roughDriveMinutes } from '../lib/places';
import { formatDateTime, formatRupees, formatTime } from '../lib/format';
import { msg, useT, useUnits } from '../lib/i18n';
import { methodLabels } from '../lib/payments';
import { LIVE_MS, useNow } from '../lib/live';
import { rideSchema, toPublishRequest, vehicleSchema, type RideForm, type VehicleForm, MAX_DETOUR_MINUTES, MAX_REPEAT_WEEKS, ridesPublished, toVehicleRequest } from '../lib/schemas';
import { comfortLabels, luggageLabels, vehiclePhrases } from '../lib/vehicle';
import type { Booking, Comfort, DriverPaymentDetails, DueReason, Earning, Luggage, MyProfile, Ride, RoutePreview, Vehicle } from '../lib/types';

const useVehicles = () => useQuery({ queryKey: ['vehicles'], queryFn: () => api<Vehicle[]>('/vehicles') });

export function VehiclesPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const vehicles = useVehicles();
  const { register, handleSubmit, formState, reset, watch: watchVehicle } = useForm<VehicleForm>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: { make: '', model: '', year: '', colour: '', seats: 5, comfort: '', luggage: '', electric: false, batteryKwh: '', consumptionKwhPer100Km: '' },
  });
  const electric = watchVehicle('electric');
  const add = useMutation({
    mutationFn: (form: VehicleForm) =>
      api<Vehicle>('/vehicles', {
        method: 'POST',
        body: toVehicleRequest(form),
      }),
    onSuccess: () => {
      reset();
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });

  return (
    <Page title={t('My vehicles')}>
      <QueryState
        isPending={vehicles.isPending}
        error={vehicles.error}
        isEmpty={vehicles.data?.length === 0}
        empty={t('Add a vehicle before you publish a ride.')}
        icon={CarFront}
        onRetry={() => void vehicles.refetch()}
      />
      {vehicles.data?.map((vehicle) => (
        <Card key={vehicle.id}>
          <div className="mb-3">
            <PhotoEditor
              viewPath={`/vehicles/${vehicle.id}/photo`}
              changePath={`/vehicles/${vehicle.id}/photo`}
              alt={t('Photo of the {vehicle}', { vehicle: `${vehicle.make} ${vehicle.model}` })}
              initials={initialsOf(`${vehicle.make} ${vehicle.model}`)}
            />
          </div>
          <p className="font-medium">
            {vehicle.make} {vehicle.model}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {[vehicle.colour, vehicle.year, t('{n} seats including yours', { n: vehicle.seats })].filter(Boolean).join(' · ')}
          </p>
          {vehiclePhrases(vehicle, t).length > 0 && <p className="mt-1 text-sm text-slate-600">{vehiclePhrases(vehicle, t).join(' · ')}</p>}
          {vehicle.estimatedRangeKm != null && (
            <p className="mt-1 text-sm text-slate-600">
              {t('About {km} km on a full charge, from the figures you gave. Not a measured range.', { km: vehicle.estimatedRangeKm })}
            </p>
          )}
          <InsuranceEditor vehicle={vehicle} />
        </Card>
      ))}

      <Card>
        <h2 className="text-lg font-semibold">{t('Add a vehicle')}</h2>
        <form onSubmit={handleSubmit((form) => add.mutate(form))} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
          {add.error && (
            <div className="sm:col-span-2">
              <Notice tone="error">{add.error.message}</Notice>
            </div>
          )}
          <TextField label={t('Make')} error={formState.errors.make?.message} {...register('make')} />
          <TextField label={t('Model')} error={formState.errors.model?.message} {...register('model')} />
          <TextField label={t('Year (optional)')} type="number" error={formState.errors.year?.message} {...register('year')} />
          <TextField label={t('Colour (optional)')} error={formState.errors.colour?.message} {...register('colour')} />
          <TextField
            label={t('Seats')}
            type="number"
            min={2}
            max={9}
            hint={t("Every seat in the vehicle, counting the driver's.")}
            error={formState.errors.seats?.message}
            {...register('seats')}
          />
          <SelectField label={t('Comfort (optional)')} hint={t('Your own description. Nobody inspects the car.')} {...register('comfort')}>
            <option value="">{t('Not said')}</option>
            {(Object.keys(comfortLabels) as Comfort[]).map((key) => (
              <option key={key} value={key}>
                {t(comfortLabels[key])}
              </option>
            ))}
          </SelectField>
          <SelectField label={t('Luggage per passenger (optional)')} {...register('luggage')}>
            <option value="">{t('Not said')}</option>
            {(Object.keys(luggageLabels) as Luggage[]).map((key) => (
              <option key={key} value={key}>
                {t(luggageLabels[key])}
              </option>
            ))}
          </SelectField>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('electric')} />
            {t('This vehicle is electric')}
          </label>
          {electric && (
            <>
              <TextField
                label={t('Battery (kWh, optional)')}
                type="number"
                step="0.1"
                error={formState.errors.batteryKwh?.message}
                {...register('batteryKwh')}
              />
              <TextField
                label={t('Consumption (kWh per 100 km, optional)')}
                type="number"
                step="0.1"
                error={formState.errors.consumptionKwhPer100Km?.message}
                {...register('consumptionKwhPer100Km')}
              />
            </>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={add.isPending}>
              {add.isPending ? t('Adding…') : t('Add vehicle')}
            </Button>
          </div>
        </form>
      </Card>
    </Page>
  );
}

/** How long the stops must stay as they are before their route is worked out, so moving a pin asks once. */
const AUTO_ROUTE_MS = 400;

/** Where the stops are, as one string: two equal strings mean the same route. */
const pinsOf = (stops: Pick<RideForm['stops'][number], 'lat' | 'lon'>[]) => stops.map((stop) => `${stop.lat},${stop.lon}`).join(' ');

/**
 * Shows the road route through the chosen stops, lets the driver move a meeting point by
 * clicking the map, and offers prices and timings worked out from the route. The route is
 * worked out by itself as soon as two stops have places, and again whenever they change.
 */
function RoutePlanner({ stops, known, rangeKm, onMove, onUse, onRoute }: {
  stops: RideForm['stops'];
  /** The route already worked out for these very stops, if any: shown without asking again. */
  known: RoutePreview | null;
  /** The chosen vehicle's range on a full charge, from the driver's own figures; null if not electric. */
  rangeKm: number | null;
  onMove: (index: number, lat: number, lon: number) => void;
  /** The driver asked for the suggestion: it replaces what they typed. */
  onUse: (included: number[], preview: RoutePreview) => void;
  /** A route was worked out: it fills what the driver has not typed. */
  onRoute: (included: number[], preview: RoutePreview) => void;
}) {
  const t = useT();
  const units = useUnits();
  // A stop just added has no place yet, so nothing to show or route.
  const included = stops.map((stop, index) => ({ ...stop, index })).filter((stop) => stop.name !== '');
  const [moving, setMoving] = useState<number | null>(null);
  const target = included.some((stop) => stop.index === moving) ? moving! : included[0]?.index;
  const town = (index: number) => t(stops[index].name);
  const preview = useMutation({
    mutationFn: (asked: { lat: number; lon: number }[]) => api<RoutePreview>('/rides/route-preview', { method: 'POST', body: { stops: asked } }),
  });
  // Only a failure the driver asked for interrupts them; one that came by itself is said quietly.
  const [byHand, setByHand] = useState(false);
  const pins = pinsOf(included);
  // The stops as they stand now, for an answer that arrives later.
  const latest = useRef({ included, onRoute, known });
  useEffect(() => {
    latest.current = { included, onRoute, known };
  });
  const { reset, mutate } = preview;
  const workOut = useCallback(
    (pressed: boolean) => {
      const asked = latest.current.included;
      setByHand(pressed);
      mutate(
        asked.map((stop) => ({ lat: Number(stop.lat), lon: Number(stop.lon) })),
        {
          // An answer for stops that have changed since is no answer for these.
          onSuccess: (route) => {
            if (pinsOf(latest.current.included) === pinsOf(asked)) latest.current.onRoute(asked.map((stop) => stop.index), route);
          },
        },
      );
    },
    [mutate],
  );
  const timer = useRef<number | undefined>(undefined);
  const ready = included.length >= 2;
  // A route worked out for other stops is no route for these, however they changed.
  useEffect(() => {
    reset();
    // Back on this step with the stops as they were, the route is already known.
    if (!ready || latest.current.known) return;
    timer.current = window.setTimeout(() => workOut(false), AUTO_ROUTE_MS);
    return () => window.clearTimeout(timer.current);
  }, [pins, ready, reset, workOut]);

  if (included.length < 2) return null;
  const shown = preview.data ?? known ?? undefined;
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-slate-700">{t('Route and meeting points')}</legend>
      <div className="max-w-xs">
        <SelectField
          label={t('A click on the map moves the meeting point for')}
          value={target}
          onChange={(event) => setMoving(Number(event.target.value))}
          hint={t('Each starts at the town centre. Put it where passengers should actually find you.')}
        >
          {included.map((stop) => (
            <option key={stop.index} value={stop.index}>
              {town(stop.index)}
            </option>
          ))}
        </SelectField>
      </div>
      <RouteMap
        path={shown?.path}
        points={included.map((stop) => ({
          lat: Number(stop.lat),
          lon: Number(stop.lon),
          label: t('{town} meeting point', { town: town(stop.index) }),
          emphasis: stop.index === target,
        }))}
        onPick={(lat, lon) => {
          if (target !== undefined) onMove(target, lat, lon);
        }}
        describe={t('Map of your stops: {stops}', { stops: included.map((stop) => town(stop.index)).join(', ') })}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          tone="secondary"
          disabled={preview.isPending}
          onClick={() => {
            window.clearTimeout(timer.current);
            workOut(true);
          }}
        >
          {preview.isPending ? t('Working out the route…') : t('Work out the route')}
        </Button>
        {shown && (
          <Button tone="secondary" onClick={() => onUse(included.map((stop) => stop.index), shown)}>
            {t('Use the suggested prices and times')}
          </Button>
        )}
      </div>
      {preview.error &&
        (byHand ? (
          <Notice tone="error">{preview.error.message}</Notice>
        ) : (
          <p className="text-sm text-slate-600">{t('The route could not be worked out by itself. Enter the times and prices, or try again.')}</p>
        ))}
      {shown && (
        <div className="text-sm text-slate-700">
          <p role="status">
            {shown.source === 'OSRM'
              ? t('{km} km by road, about {time} of driving.', {
                  km: shown.distanceKm,
                  time: units.duration(shown.durationMinutes),
                })
              : t(
                  'About {km} km in a straight line. No road route is available for this trip, so this is not a road distance and the times are rough guesses.',
                  { km: shown.distanceKm },
                )}
          </p>
          <ul className="mt-1 list-disc pl-5">
            {shown.legs.map((leg, i) => (
              <li key={included[i + 1].index}>
                {t('{from} to {to}: {km} km, {time}, suggested {price} a seat', {
                  from: town(included[i].index),
                  to: town(included[i + 1].index),
                  km: leg.distanceKm,
                  time: units.duration(leg.durationMinutes),
                  price: formatRupees(leg.suggestedPrice),
                })}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-slate-500">{t('The suggestion is distance times a flat rate. The price is yours to set.')}</p>
          <RangeNotice route={shown} rangeKm={rangeKm} towns={included.map((stop) => town(stop.index))} />
          {shown.alongRoute.length > 0 && (
            <section aria-label={t('Along this route')} className="mt-3">
              <h3 className="font-medium">{t('Along this route')}</h3>
              <ul className="mt-1 space-y-1">
                {shown.alongRoute.map((a) => (
                  <li key={a.stopover.id}>
                    {t('km {km}', { km: Math.round(a.kmAlong) })} · {a.stopover.name} ·{' '}
                    {a.stopover.kind === 'CHARGER'
                      ? a.stopover.chargerKw != null
                        ? t('charger, {kw} kW', { kw: a.stopover.chargerKw })
                        : t('charger')
                      : t('rest stop')}
                    {a.kmOffRoute >= 0.5 && ` · ${t('{km} km off the route', { km: a.kmOffRoute.toFixed(1) })}`}
                    {a.suggestedBreak && <span className="ml-1 font-medium text-teal-800">· {t('a good place for a break')}</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-slate-500">{t('Listed by VAYORA staff. Nothing checks that a stop is open or a charger works.')}</p>
            </section>
          )}
        </div>
      )}
    </fieldset>
  );
}

/** What a vehicle's own range says about a route: a stretch too long to publish, or a charge to plan. */
function RangeNotice({ route, rangeKm, towns }: {
  route: RoutePreview;
  /** The chosen vehicle's range on a full charge, from the driver's own figures; null if not electric. */
  rangeKm: number | null;
  /** The route's stops, in order, as the driver reads them. */
  towns: string[];
}) {
  const t = useT();
  if (rangeKm == null) return null;
  // The first stretch between stops longer than a full charge: the server refuses to publish it.
  const tooLong = route.legs.findIndex((leg) => leg.distanceKm > rangeKm);
  const chargers = route.alongRoute.some((a) => a.stopover.kind === 'CHARGER')
    ? t('Chargers are listed near this route below.')
    : t('No charger is listed near this route.');
  if (tooLong >= 0) {
    return (
      <div className="mt-2">
        <Notice tone="error">
          {t('{from} to {to} is {km} km, longer than the {range} km your vehicle covers on a full charge, by your own figures. A ride with a stretch that long cannot be published: add a stop between them where you can charge.', {
            from: towns[tooLong],
            to: towns[tooLong + 1],
            km: route.legs[tooLong].distanceKm,
            range: rangeKm,
          })}{' '}
          {chargers}
        </Notice>
      </div>
    );
  }
  if (route.distanceKm <= rangeKm) return null;
  return (
    <div className="mt-2">
      <Notice tone="info">
        {t('This route is longer than the {range} km your vehicle covers on a full charge, by your own figures. Plan a charging stop: VAYORA does not plan one for you.', { range: rangeKm })}{' '}
        {chargers}
      </Notice>
    </div>
  );
}

const [ROUTE, WHEN, PRICES, PREFERENCES, REVIEW] = [0, 1, 2, 3, 4];
/** Each step's short name, for the progress line, and its heading. */
const publishSteps = [
  { label: msg('Route'), title: msg('Where you stop') },
  { label: msg('When'), title: msg('When, and in which car') },
  { label: msg('Prices'), title: msg('Times and price per seat') },
  { label: msg('Preferences'), title: msg('Who rides, and how') },
  { label: msg('Review'), title: msg('Check and publish') },
];

/** The step a field of the publish form is filled in on, by its path. */
function stepOfField(path: string): number {
  if (/^stops\.\d+\.(offsetMinutes|priceFromPrevious)$/.test(path)) return PRICES;
  if (path === 'stops' || path.startsWith('stops.')) return ROUTE;
  if (['vehicleId', 'departure', 'seatsOffered', 'instantBooking'].includes(path)) return WHEN;
  return PREFERENCES;
}

/** The paths of every message in a form's errors, such as "stops.2.priceFromPrevious". */
function errorPaths(errors: object, prefix = ''): string[] {
  return Object.entries(errors).flatMap(([key, value]: [string, unknown]) => {
    if (key === 'ref' || !value || typeof value !== 'object') return [];
    // A message about a whole list sits under its root.
    const path = key === 'root' ? prefix.slice(0, -1) : `${prefix}${key}`;
    return typeof (value as { message?: unknown }).message === 'string' ? [path] : errorPaths(value, `${path}.`);
  });
}

/**
 * Where the driver is among the steps of publishing: each step done so far can be gone back to.
 * On a phone the numbers alone, with the step named in words above them.
 */
function PublishProgress({ current, reached, onGo }: { current: number; reached: number; onGo: (step: number) => void }) {
  const t = useT();
  return (
    <nav aria-label={t('Steps')} className="rounded-2xl bg-surface px-4 py-3.5 shadow-card ring-1 ring-slate-900/[0.04] sm:px-5">
      <p className="text-[13px] font-medium text-slate-500 sm:hidden">
        {t('Step {n} of {all}: {step}', { n: current + 1, all: publishSteps.length, step: t(publishSteps[current].label) })}
      </p>
      <ol className="mt-2 flex items-center gap-1.5 sm:mt-0 sm:gap-2">
        {publishSteps.map((step, index) => {
          const done = index < current;
          return (
            <li key={step.label} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                disabled={index > reached}
                aria-current={index === current ? 'step' : undefined}
                aria-label={t('Step {n} of {all}: {step}', { n: index + 1, all: publishSteps.length, step: t(step.label) })}
                onClick={() => onGo(index)}
                className="group flex min-h-11 min-w-0 items-center gap-2 rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30 disabled:cursor-default"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    index === current
                      ? 'bg-accent text-white shadow-sm shadow-accent/30'
                      : done
                        ? 'bg-teal-600/[0.14] text-teal-800 group-hover:bg-teal-600/[0.22]'
                        : 'bg-slate-900/[0.06] text-slate-500'
                  }`}
                >
                  {done ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
                </span>
                <span
                  aria-hidden="true"
                  className={`hidden truncate text-sm sm:block ${index === current ? 'font-semibold text-slate-900' : 'font-medium text-slate-500'}`}
                >
                  {t(step.label)}
                </span>
              </button>
              {index < publishSteps.length - 1 && (
                <span aria-hidden="true" className={`h-0.5 min-w-2 flex-1 rounded-full ${index < reached ? 'bg-teal-600/40' : 'bg-slate-900/[0.08]'}`} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** One part of the review: what was chosen at one step, and the way back to it. */
function ReviewPart({ title, onChange, children }: { title: string; onChange: () => void; children: ReactNode }) {
  const t = useT();
  const id = useId();
  return (
    <section aria-labelledby={id} className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <h3 id={id} className="text-[15px] font-semibold text-slate-900">
          {title}
        </h3>
        <button
          type="button"
          onClick={onChange}
          aria-describedby={id}
          className="-mr-2 inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-teal-800 hover:bg-teal-600/[0.08] focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30"
        >
          {t('Change')}
        </button>
      </div>
      <div className="mt-1 text-sm text-slate-700">{children}</div>
    </section>
  );
}

/**
 * Publishing a ride, a step at a time: the route with its map, when and in which car, the times
 * and prices, what the driver offers passengers, and everything checked together before it goes.
 * One form throughout, checked by the one schema: Next checks the step being left, and publishing
 * checks them all, going back to the first step with something to fix.
 */
export function PublishRidePage() {
  const t = useT();
  const units = useUnits();
  const queryClient = useQueryClient();
  const vehicles = useVehicles();
  // Only a driver whose profile says she is a woman may offer a women-only ride.
  const me = useQuery({ queryKey: ['me', 'profile'], queryFn: () => api<MyProfile>('/me/profile') });
  const defaultValues: Partial<RideForm> = {
    departure: '',
    seatsOffered: 3,
    instantBooking: true,
    maxTwoInBack: false,
    womenOnly: false,
    notes: '',
    returnDeparture: '',
    repeatWeeks: 0,
    maxDetourMinutes: 0,
    // The two ends to begin with; the driver changes them and adds stops in between.
    stops: [
      { ...placeNamed('Kolhapur')!, offsetMinutes: 0, priceFromPrevious: 0 },
      {
        ...placeNamed('Pune')!,
        offsetMinutes: roughDriveMinutes(placeNamed('Kolhapur')!, placeNamed('Pune')!),
        priceFromPrevious: '',
      },
    ],
  };
  const { register, handleSubmit, formState, watch, setValue, getValues, control, clearErrors, setFocus, reset } = useForm<RideForm>({
    resolver: zodResolver(rideSchema),
    defaultValues,
    // A mistake can be on a step not on screen: the page goes to it and focuses it itself.
    shouldFocusError: false,
  });
  const { fields, insert, remove } = useFieldArray({ control, name: 'stops' });
  const [step, setStep] = useState(ROUTE);
  // The furthest step reached, so far: any step up to it can be gone back to.
  const [reached, setReached] = useState(ROUTE);
  // Where the focus goes once a step is on screen: a field to fix, or else the step's heading. A new
  // object each time, so asking twice for the same field still moves the focus.
  const [focusing, setFocusing] = useState<{ field: string | null } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const go = (to: number, field: string | null = null) => {
    setFocusing({ field });
    setStep(to);
    setReached((was) => Math.max(was, to));
  };
  useEffect(() => {
    if (!focusing) return;
    if (focusing.field) setFocus(focusing.field as Parameters<typeof setFocus>[0]);
    // A place picked from a list cannot take the focus by name: the step's heading does.
    if (!(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLSelectElement)) {
      heading.current?.focus();
    }
  }, [focusing, setFocus]);

  /** Rough times from one stop onward, each from the stop before, as far as the stops have places. */
  const retime = (from: number) => {
    const current = getValues('stops');
    let minutes = Number(current[from - 1].offsetMinutes);
    for (let i = from; i < current.length && current[i].name !== '' && current[i - 1].name !== ''; i++) {
      minutes += roughDriveMinutes(current[i - 1], current[i]);
      setValue(`stops.${i}.offsetMinutes`, minutes);
    }
  };

  /** A stop's place chosen: its meeting point starts at the town centre. */
  const choosePlace = (index: number, name: string) => {
    const place = placeNamed(name);
    if (!place) return;
    setValue(`stops.${index}.name`, name, { shouldValidate: formState.isSubmitted });
    setValue(`stops.${index}.lat`, place.lat);
    setValue(`stops.${index}.lon`, place.lon);
    retime(Math.max(index, 1));
  };

  const removeStop = (index: number) => {
    remove(index);
    retime(index);
  };

  // The last route worked out and the stops it was for: the review shows it while they still match.
  const [route, setRoute] = useState<{ pins: string; preview: RoutePreview } | null>(null);
  // Times and prices the driver typed are theirs: a route worked out by itself fills only the rest.
  const typed = useRef(new Set<string>());
  /**
   * Fills the times and prices of the stops a route went through. Each time runs on from the stop
   * before as it now stands, so a time the driver typed carries on to the stops after it.
   * @param all over what the driver typed as well: they asked for the suggestion
   */
  const fillFromRoute = (chosen: number[], preview: RoutePreview, all: boolean) => {
    const current = getValues('stops');
    setRoute({ pins: pinsOf(chosen.map((index) => current[index])), preview });
    let minutes = Number(current[chosen[0]].offsetMinutes);
    preview.legs.forEach((leg, i) => {
      const index = chosen[i + 1];
      const id = fields[index]?.id;
      minutes += leg.durationMinutes;
      if (all || !typed.current.has(`${id}:minutes`)) {
        setValue(`stops.${index}.offsetMinutes`, minutes, { shouldValidate: formState.isSubmitted });
        typed.current.delete(`${id}:minutes`);
      } else {
        minutes = Number(current[index].offsetMinutes);
      }
      if (all || !typed.current.has(`${id}:price`)) {
        setValue(`stops.${index}.priceFromPrevious`, leg.suggestedPrice, { shouldValidate: formState.isSubmitted });
        typed.current.delete(`${id}:price`);
      }
    });
  };
  // What was published, and as how many rides, for the confirmation.
  const [done, setDone] = useState<{ ride: Ride; count: number } | null>(null);
  const publish = useMutation({
    mutationFn: (form: RideForm) => api<Ride>('/rides', { method: 'POST', body: toPublishRequest(form) }),
    onSuccess: (ride, form) => {
      void queryClient.invalidateQueries({ queryKey: ['rides'] });
      setDone({ ride, count: ridesPublished(form) });
    },
  });

  /** Next, or Publish on the last step: the steps up to this one must be right to go on. */
  const next = handleSubmit(
    (form) => {
      if (step === REVIEW) publish.mutate(form);
      else go(step + 1);
    },
    (errors) => {
      const paths = errorPaths(errors);
      const first = Math.min(...paths.map(stepOfField));
      if (first <= step) {
        // Fields that are not typed into (a place, the list itself) have no focus to take.
        go(first, paths.find((path) => stepOfField(path) === first && !/^stops(\.\d+\.name)?$/.test(path)) ?? null);
        return;
      }
      // What is wrong further on is for when the driver gets there.
      clearErrors(paths.filter((path) => stepOfField(path) > step) as Parameters<typeof clearErrors>[0]);
      go(step + 1);
    },
  );

  const startAgain = () => {
    reset(defaultValues);
    typed.current.clear();
    setRoute(null);
    setDone(null);
    publish.reset();
    setReached(ROUTE);
    go(ROUTE);
  };

  const stops = watch('stops');
  const publishing = ridesPublished({ returnDeparture: watch('returnDeparture'), repeatWeeks: watch('repeatWeeks') });

  if (vehicles.data?.length === 0) {
    return (
      <Page title={t('Publish a ride')}>
        <Notice tone="info">
          {t('You need a vehicle first.')}{' '}
          <Link to="/vehicles" className="font-medium underline">
            {t('Add one')}
          </Link>
        </Notice>
      </Page>
    );
  }

  if (done) {
    const { ride, count } = done;
    return (
      <Page title={t('Ride published')}>
        <Card>
          <div className="flex items-start gap-4">
            <span aria-hidden="true" className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
              <Check className="h-6 w-6" strokeWidth={3} />
            </span>
            <div className="min-w-0">
              <p className="text-[19px] font-bold leading-snug tracking-tight text-slate-900">{ride.stops.map((stop) => t(stop.name)).join(' → ')}</p>
              <p className="mt-0.5 text-[15px] text-slate-600">{formatDateTime(ride.departureTime)}</p>
              <p className="mt-3 text-[15px] text-slate-700">{t('Passengers going your way can find it and book now.')}</p>
              {count > 1 && <p className="mt-1 text-[15px] text-slate-700">{t('Published as {n} rides, each of which you can withdraw on its own.', { n: count })}</p>}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/rides"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-[15px] font-semibold text-white shadow-sm shadow-accent/30 transition-transform active:scale-[0.97] focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30"
            >
              {t('See it in My rides')}
              <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
            </Link>
            <Button tone="secondary" onClick={startAgain}>
              {t('Publish another ride')}
            </Button>
          </div>
        </Card>
      </Page>
    );
  }

  const included = stops.filter((stop) => stop.name !== '');
  const wholeWay = stops.reduce((sum, stop, index) => (index > 0 ? sum + (Number(stop.priceFromPrevious) || 0) : sum), 0);
  const departure = watch('departure');
  const leaving = departure && !Number.isNaN(new Date(departure).getTime()) ? formatDateTime(new Date(departure).toISOString()) : null;
  // Until the driver picks one, the select shows (and the form sends) the first vehicle.
  const vehicle = vehicles.data && (vehicles.data.find((one) => String(one.id) === String(watch('vehicleId'))) ?? vehicles.data[0]);
  const rangeKm = vehicle?.estimatedRangeKm ?? null;
  const routeNow = route && route.pins === pinsOf(included) ? route.preview : null;
  const at = (offsetMinutes: number) => formatTime(new Date(Date.parse(departure) + Number(offsetMinutes) * 60_000).toISOString());
  const stopsError = formState.errors.stops as { root?: { message?: string }; message?: string } | undefined;
  const stopsMessage = stopsError?.root?.message ?? stopsError?.message;
  const repeatWeeks = Number(watch('repeatWeeks'));
  const maxDetour = Number(watch('maxDetourMinutes'));
  const notes = watch('notes').trim();

  return (
    <Page title={t('Publish a ride')}>
      <QueryState isPending={vehicles.isPending} error={vehicles.error} isEmpty={false} empty="" onRetry={() => void vehicles.refetch()} />
      {vehicles.data && (
        <div className="space-y-5">
          <PublishProgress current={step} reached={reached} onGo={(to) => go(to)} />
          <form onSubmit={next} noValidate className={`grid items-start gap-5 ${step === REVIEW ? '' : 'lg:grid-cols-[minmax(0,1fr)_17rem]'}`}>
            <section aria-labelledby="publish-step" className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-slate-900/[0.04] sm:p-5">
              <h2 id="publish-step" ref={heading} tabIndex={-1} className="mb-4 text-[19px] font-bold tracking-tight text-slate-900 focus:outline-none">
                {t(publishSteps[step].title)}
              </h2>

              {step === ROUTE && (
                <>
                  {/* The places first: the route follows from them, and the times and prices from the route. */}
                  {stopsMessage && (
                    <p className="mb-2 text-sm text-red-700" role="alert">
                      {t(stopsMessage)}
                    </p>
                  )}
                  <div className="space-y-3">
                    {fields.map((field, index) => {
                      const stop = stops[index];
                      const between = index > 0 && index < fields.length - 1;
                      return (
                        <div key={field.id} className="grid items-end gap-3 rounded-2xl border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                          <PlaceField
                            label={index === 0 ? t('From') : between ? t('Stop on the way {n}', { n: index }) : t('To')}
                            value={stop?.name ?? ''}
                            error={formState.errors.stops?.[index]?.name?.message}
                            onChange={(name) => choosePlace(index, name)}
                          />
                          {between && (
                            <Button tone="secondary" className="justify-self-start" onClick={() => removeStop(index)}>
                              {t('Remove this stop')}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* The server takes ten stops at most. */}
                  {fields.length < 10 && (
                    <Button
                      tone="secondary"
                      className="mt-3"
                      onClick={() => insert(fields.length - 1, { name: '', lat: 0, lon: 0, offsetMinutes: 0, priceFromPrevious: '' }, { shouldFocus: false })}
                    >
                      {t('Add a stop on the way')}
                    </Button>
                  )}
                  <div className="mt-5">
                    <RoutePlanner
                      stops={stops}
                      known={routeNow}
                      rangeKm={rangeKm}
                      onMove={(index, lat, lon) => {
                        setValue(`stops.${index}.lat`, lat);
                        setValue(`stops.${index}.lon`, lon);
                      }}
                      onUse={(chosen, preview) => fillFromRoute(chosen, preview, true)}
                      onRoute={(chosen, preview) => fillFromRoute(chosen, preview, false)}
                    />
                  </div>
                </>
              )}

              {step === WHEN && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField label={t('Vehicle')} error={formState.errors.vehicleId?.message} {...register('vehicleId')}>
                    {vehicles.data.map((one) => (
                      <option key={one.id} value={one.id}>
                        {t('{vehicle} ({n} passenger seats)', { vehicle: `${one.make} ${one.model}`, n: one.seats - 1 })}
                      </option>
                    ))}
                  </SelectField>
                  <TextField
                    label={t('Leaving at')}
                    type="datetime-local"
                    hint={
                      Number.isNaN(Date.parse(departure))
                        ? t("In your device's local time.")
                        : t("{when}, in your device's local time", { when: formatDateTime(new Date(departure).toISOString()) })
                    }
                    error={formState.errors.departure?.message}
                    {...register('departure')}
                  />
                  <TextField
                    label={t('Seats offered')}
                    type="number"
                    min={1}
                    max={8}
                    error={formState.errors.seatsOffered?.message}
                    {...register('seatsOffered')}
                  />
                  <label className="flex min-h-11 items-center gap-2 self-end text-sm text-slate-700">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('instantBooking')} />
                    {t('Confirm bookings instantly, without asking me')}
                  </label>
                  <p className="text-sm text-slate-600 sm:col-span-2">
                    {t('Passengers pay you directly after the ride, in cash or by UPI.')}{' '}
                    <Link to="/account#payment" className="font-medium text-teal-800 underline underline-offset-2">
                      {t('Your UPI ID and QR code')}
                    </Link>
                  </p>
                </div>
              )}

              {step === PRICES && (
                <>
                  <p className="text-sm text-slate-500">
                    {t('Filled in from the route as soon as it is worked out. Change any of them: what you type is kept.')}{' '}
                    {t('Passengers can book between any two of your stops. Each price is for the stretch that ends at that stop.')}
                  </p>
                  <div className="mt-3 space-y-3">
                    {fields.map((field, index) => {
                      const stop = stops[index];
                      // The first stop is where the ride leaves at the time chosen: it has no minutes or price of its own.
                      if (index === 0 || !stop?.name) return null;
                      return (
                        <div key={field.id} className="grid items-end gap-3 rounded-2xl border border-slate-200 p-3 sm:grid-cols-2">
                          <TextField
                            label={t('Minutes from {start} to {town}', { start: t(stops[0].name), town: t(stop.name) })}
                            type="number"
                            min={0}
                            error={formState.errors.stops?.[index]?.offsetMinutes?.message}
                            {...register(`stops.${index}.offsetMinutes`, { onChange: () => typed.current.add(`${field.id}:minutes`) })}
                          />
                          <TextField
                            label={t('Price to {town} (₹)', { town: t(stop.name) })}
                            type="number"
                            min={0}
                            error={formState.errors.stops?.[index]?.priceFromPrevious?.message}
                            {...register(`stops.${index}.priceFromPrevious`, { onChange: () => typed.current.add(`${field.id}:price`) })}
                          />
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {step === PREFERENCES && (
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('maxTwoInBack')} />
                      {t('I promise at most two passengers on the back seat')}
                    </label>
                    <TextField
                      label={t('Minutes you will go out of your way, in all, to pick passengers up at their own point')}
                      hint={t('0 for none: passengers then board only at your stops. Each pickup is worked out before it is offered.')}
                      type="number"
                      min={0}
                      max={MAX_DETOUR_MINUTES}
                      error={formState.errors.maxDetourMinutes?.message}
                      {...register('maxDetourMinutes')}
                    />
                    {me.data?.gender === 'FEMALE' ? (
                      <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                        <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('womenOnly')} />
                        {t('Women passengers only')}
                      </label>
                    ) : (
                      <p className="text-sm text-slate-500 sm:col-span-2">
                        {t('A ride for women passengers only can be offered by a driver whose profile says she is a woman.')}
                      </p>
                    )}
                    <div className="sm:col-span-2">
                      <label htmlFor="ride-notes" className="block text-sm font-medium text-slate-700">
                        {t('Notes for passengers (optional)')}
                      </label>
                      <textarea
                        id="ride-notes"
                        rows={2}
                        maxLength={500}
                        aria-invalid={Boolean(formState.errors.notes)}
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5 text-[15px] shadow-sm focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/15"
                        {...register('notes')}
                      />
                      <p className="mt-1 text-sm text-slate-500">{t('Luggage, where exactly you wait, anything they should know.')}</p>
                    </div>
                  </div>
                  <div className="grid gap-4 border-t border-slate-900/[0.06] pt-5 sm:grid-cols-2">
                    <h3 className="text-[15px] font-semibold text-slate-900 sm:col-span-2">{t('Return and repeat')}</h3>
                    <TextField
                      label={t('Return ride leaving at (optional)')}
                      type="datetime-local"
                      hint={t('The same stops in reverse, with the same prices and the same time between stops.')}
                      error={formState.errors.returnDeparture?.message}
                      {...register('returnDeparture')}
                    />
                    <SelectField label={t('Repeat every week')} hint={t('At the same time of day. Each is a separate ride you can withdraw on its own.')} {...register('repeatWeeks')}>
                      <option value={0}>{t('No, just this once')}</option>
                      {Array.from({ length: MAX_REPEAT_WEEKS }, (_, index) => index + 1).map((weeks) => (
                        <option key={weeks} value={weeks}>
                          {weeks === 1 ? t('For {n} more week', { n: weeks }) : t('For {n} more weeks', { n: weeks })}
                        </option>
                      ))}
                    </SelectField>
                    {publishing > 1 && (
                      <p role="status" className="text-sm font-medium text-slate-700 sm:col-span-2">
                        {t('This will publish {n} rides.', { n: publishing })}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {step === REVIEW && (
                <div className="divide-y divide-slate-900/[0.06]">
                  {publish.error && (
                    <div className="pb-4">
                      <Notice tone="error">{publish.error.message}</Notice>
                    </div>
                  )}
                  <ReviewPart title={t('Where you stop')} onChange={() => go(ROUTE)}>
                    <p className="text-[15px] font-semibold text-slate-900">{included.map((stop) => t(stop.name)).join(' → ')}</p>
                    {routeNow && (
                      <p className="mt-0.5">
                        {routeNow.source === 'OSRM'
                          ? t('{km} km by road, about {time} of driving.', { km: routeNow.distanceKm, time: units.duration(routeNow.durationMinutes) })
                          : t(
                              'About {km} km in a straight line. No road route is available for this trip, so this is not a road distance and the times are rough guesses.',
                              { km: routeNow.distanceKm },
                            )}
                      </p>
                    )}
                    {/* The car may have been chosen after the route was: its range is checked again here. */}
                    {routeNow && <RangeNotice route={routeNow} rangeKm={rangeKm} towns={included.map((stop) => t(stop.name))} />}
                  </ReviewPart>
                  <ReviewPart title={t('When, and in which car')} onChange={() => go(WHEN)}>
                    <dl className="divide-y divide-slate-900/[0.06]">
                      <SummaryRow label={t('Leaving')} value={leaving ?? t('Not chosen yet')} />
                      <SummaryRow label={t('Vehicle')} value={vehicle ? `${vehicle.make} ${vehicle.model}` : ''} />
                      <SummaryRow label={t('Seats')} value={String(watch('seatsOffered'))} />
                      <SummaryRow label={t('Booking')} value={watch('instantBooking') ? t('Confirmed instantly') : t('You approve each request')} />
                    </dl>
                  </ReviewPart>
                  <ReviewPart title={t('Times and price per seat')} onChange={() => go(PRICES)}>
                    <dl className="divide-y divide-slate-900/[0.06]">
                      {stops.map((stop, index) =>
                        index === 0 || !stop.name ? null : (
                          <SummaryRow
                            key={fields[index]?.id ?? index}
                            label={t(stop.name)}
                            value={`${leaving ? `${at(Number(stop.offsetMinutes))} · ` : ''}${formatRupees(Number(stop.priceFromPrevious) || 0)}`}
                          />
                        ),
                      )}
                      <SummaryRow label={t('Whole way, per seat')} value={formatRupees(wholeWay)} />
                    </dl>
                  </ReviewPart>
                  <ReviewPart title={t('Who rides, and how')} onChange={() => go(PREFERENCES)}>
                    <ul className="list-disc space-y-0.5 pl-5">
                      {watch('maxTwoInBack') && <li>{t('I promise at most two passengers on the back seat')}</li>}
                      {watch('womenOnly') && <li>{t('Women passengers only')}</li>}
                      {maxDetour > 0 && <li>{t('Picks passengers up off the stops, up to {n} minutes out of the way in all', { n: maxDetour })}</li>}
                      {!watch('maxTwoInBack') && !watch('womenOnly') && maxDetour === 0 && <li>{t('Nothing chosen')}</li>}
                    </ul>
                    {notes && (
                      <p className="mt-2 whitespace-pre-line rounded-xl bg-slate-900/[0.04] px-3 py-2">
                        <span className="font-medium text-slate-900">{t('Notes for passengers')}:</span> {notes}
                      </p>
                    )}
                    <dl className="mt-2 divide-y divide-slate-900/[0.06]">
                      <SummaryRow
                        label={t('Return ride')}
                        value={watch('returnDeparture') ? formatDateTime(new Date(watch('returnDeparture')).toISOString()) : t('None')}
                      />
                      <SummaryRow
                        label={t('Repeat every week')}
                        value={repeatWeeks === 0 ? t('No, just this once') : repeatWeeks === 1 ? t('For {n} more week', { n: 1 }) : t('For {n} more weeks', { n: repeatWeeks })}
                      />
                      <SummaryRow label={t('Rides to publish')} value={String(publishing)} />
                    </dl>
                  </ReviewPart>
                </div>
              )}

              <div className="mt-6 flex flex-wrap-reverse items-center justify-between gap-3 border-t border-slate-900/[0.06] pt-4">
                {step > ROUTE ? (
                  <Button tone="secondary" onClick={() => go(step - 1)}>
                    {t('Back')}
                  </Button>
                ) : (
                  <span />
                )}
                {step === REVIEW ? (
                  <Button type="submit" busy={publish.isPending} className="min-w-40 py-3">
                    {publish.isPending ? t('Publishing…') : t('Publish ride')}
                  </Button>
                ) : (
                  <Button type="submit" className="min-w-32">
                    {t('Next')}
                    <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
                  </Button>
                )}
              </div>
            </section>

            {/* What will be published, kept in view beside the step on a wide screen. The review is it in full. */}
            {step !== REVIEW && (
              <aside aria-label={t('Your ride')} className="hidden lg:sticky lg:top-28 lg:block">
                <div className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-slate-900/[0.04]">
                  <div className="bg-gradient-to-br from-accent to-accent-strong px-4 py-3 text-white">
                    <p className="text-[13px] font-semibold uppercase tracking-wider text-white/80">{t('Your ride')}</p>
                    <p className="mt-1 text-[17px] font-bold leading-snug">{included.map((stop) => t(stop.name)).join(' → ')}</p>
                  </div>
                  <dl className="divide-y divide-slate-900/[0.06] px-4 text-sm">
                    <SummaryRow label={t('Leaving')} value={leaving ?? t('Not chosen yet')} />
                    <SummaryRow label={t('Seats')} value={String(watch('seatsOffered') ?? '')} />
                    <SummaryRow label={t('Whole way, per seat')} value={wholeWay > 0 ? formatRupees(wholeWay) : t('Not chosen yet')} />
                    <SummaryRow label={t('Rides to publish')} value={String(publishing)} />
                  </dl>
                </div>
              </aside>
            )}
          </form>
        </div>
      )}
    </Page>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}

/** The most seats taken at once on a ride: its fullest stretch. */
const seatsTaken = (ride: Ride) => Math.max(0, ...ride.segments.map((segment) => segment.seatsTotal - segment.seatsAvailable));

/**
 * What a new driver still has to do before passengers can find, trust and pay them, in order,
 * each a tap away. Gone once everything is done; nothing here is required by the server.
 */
function GettingStarted({ rides }: { rides: Ride[] }) {
  const t = useT();
  const vehicles = useVehicles();
  const paying = useQuery({ queryKey: ['me', 'payment-details'], queryFn: () => api<DriverPaymentDetails>('/me/payment-details') });
  const me = useQuery({ queryKey: ['me', 'profile'], queryFn: () => api<MyProfile>('/me/profile') });
  if (!vehicles.data || !paying.data || !me.data) return null;
  return (
    <SetupChecklist
      steps={[
        { done: vehicles.data.length > 0, label: t('Add your car'), to: '/vehicles' },
        { done: Boolean(paying.data.upiId || paying.data.hasQr), label: t('Add your UPI ID or QR code, so passengers can pay you'), to: '/account#payment' },
        { done: me.data.emailVerified || me.data.phoneVerified, label: t('Confirm your email or phone'), to: '/account#contact' },
        { done: rides.length > 0, label: t('Publish your first ride'), to: '/rides/new' },
      ]}
    />
  );
}

export function RidesPage() {
  const t = useT();
  const units = useUnits();
  const queryClient = useQueryClient();
  const rides = useQuery({ queryKey: ['rides'], queryFn: () => api<Ride[]>('/rides/mine'), refetchInterval: LIVE_MS.lists });
  const now = useNow(30_000);
  const ahead = rides.data?.filter((ride) => ride.status === 'SCHEDULED' || ride.status === 'IN_PROGRESS') ?? [];
  const next = ahead.filter((ride) => ride.status === 'SCHEDULED').map((ride) => ride.departureTime).sort()[0];
  const act = useMutation({
    mutationFn: ({ ride, action }: { ride: number; action: 'start' | 'complete' | 'cancel' }) =>
      api<Ride>(`/rides/${ride}/${action}`, { method: 'POST' }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['rides'] }),
  });
  const series = useMutation({
    mutationFn: (ride: number) => api<{ withdrawn: number }>(`/rides/${ride}/cancel-series`, { method: 'POST' }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['rides'] }),
  });

  return (
    <Page title={t('My rides')} aside={rides.data && rides.data.length > 0 ? <LiveStatus query={rides} /> : undefined}>
      {ahead.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat icon={Car} label={t('Rides ahead')}>
            <CountUp value={ahead.length} format={(n) => String(Math.round(n))} />
          </Stat>
          <Stat icon={Users} label={t('Seats booked on them')} tone="bg-emerald-100 text-emerald-900">
            <CountUp value={ahead.reduce((sum, ride) => sum + seatsTaken(ride), 0)} format={(n) => String(Math.round(n))} />
          </Stat>
          {next && (
            <div className="col-span-2 flex flex-col justify-center rounded-2xl bg-tint p-4 text-white shadow-glow sm:col-span-1">
              <p className="text-sm font-medium text-white/85">{t('Your next ride')}</p>
              <p className="mt-1 text-lg font-bold">{formatDateTime(next)}</p>
              <p className="text-sm text-white/85"><NextRideIn time={next} /></p>
            </div>
          )}
        </div>
      )}
      {series.data && (
        <Notice tone="success">
          {t('{n} rides cancelled. Every passenger has been told, and owes nothing.', { n: series.data.withdrawn })}
        </Notice>
      )}
      {series.error && <Notice tone="error">{series.error.message}</Notice>}
      {act.error && <Notice tone="error">{act.error.message}</Notice>}
      <QueryState
        isPending={rides.isPending}
        error={rides.error}
        isEmpty={rides.data?.length === 0}
        empty={t('You have not published a ride yet.')}
        icon={Car}
        onRetry={() => void rides.refetch()}
      />
      {rides.data?.map((ride) => (
        <Card key={ride.id} glow={ride.status === 'IN_PROGRESS'}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <p className="text-lg font-bold tracking-tight text-slate-900">{ride.stops.map((stop) => t(stop.name)).join(' → ')}</p>
                {ride.status === 'SCHEDULED' && <LeavesIn time={ride.departureTime} />}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {t('Leaves {time}', { time: formatDateTime(ride.departureTime) })} ·{' '}
                {ride.instantBooking ? t('Instant booking') : t('You approve requests')}
              </p>
              {ride.distanceKm !== null && ride.durationMinutes !== null && (
                <p className="mt-1 text-sm text-slate-600">
                  {ride.routeSource === 'OSRM'
                    ? t('{km} km by road, about {time}', { km: ride.distanceKm, time: units.duration(ride.durationMinutes) })
                    : t('About {km} km in a straight line', { km: ride.distanceKm })}
                </p>
              )}
              {ride.maxTwoInBack && <p className="mt-1 text-sm text-slate-600">{t('At most two in the back')}</p>}
              {(ride.maxDetourMinutes ?? 0) > 0 && (
                <p className="mt-1 text-sm text-slate-600">
                  {t('You offered up to {n} min in all to pick passengers up at their own point', { n: ride.maxDetourMinutes ?? 0 })}
                </p>
              )}
              {ride.womenOnly && <p className="mt-1 text-sm font-medium text-teal-800">{t('Women only')}</p>}
              {/* Rendered as text: notes are whatever the driver typed. */}
              {ride.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{ride.notes}</p>}
              <p className="mt-2">
                <StatusBadge status={ride.status} />
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ride.status === 'SCHEDULED' && (
                <>
                  {ride.startsFrom && now < Date.parse(ride.startsFrom) ? (
                    <p className="self-center text-sm text-slate-600">{t('You can start it from {time}', { time: formatDateTime(ride.startsFrom) })}</p>
                  ) : (
                  <Button disabled={act.isPending} busy={act.isPending && act.variables?.ride === ride.id && act.variables.action === 'start'} onClick={() => act.mutate({ ride: ride.id, action: 'start' })}>
                    {t('Start ride')}
                  </Button>
                  )}
                  <ConfirmButton
                    label={t('Cancel ride')}
                    confirmLabel={t('Yes, cancel for everyone')}
                    disabled={act.isPending}
                    onConfirm={() => act.mutate({ ride: ride.id, action: 'cancel' })}
                  />
                  {ride.seriesSize > 1 && (
                    <ConfirmButton
                      label={t('Cancel every ride in this series')}
                      confirmLabel={t('Yes, cancel them all')}
                      disabled={series.isPending}
                      onConfirm={() => series.mutate(ride.id)}
                    />
                  )}
                </>
              )}
              {ride.status === 'IN_PROGRESS' && (
                <ConfirmButton
                  label={t('Complete ride')}
                  confirmLabel={t('Yes, we have arrived')}
                  tone="primary"
                  disabled={act.isPending}
                  onConfirm={() => act.mutate({ ride: ride.id, action: 'complete' })}
                />
              )}
            </div>
          </div>
          <ul className="mt-4 grid gap-x-6 gap-y-3 text-sm text-slate-600 sm:grid-cols-2">
            {ride.segments.map((segment) => {
              const stretch = t('{from} → {to}: {free} of {total} seats free, {price}', {
                from: t(ride.stops[segment.seq].name),
                to: t(ride.stops[segment.seq + 1].name),
                free: segment.seatsAvailable,
                total: segment.seatsTotal,
                price: formatRupees(segment.price),
              });
              return (
                <li key={segment.seq}>
                  {stretch}
                  <div className="mt-1.5">
                    <Meter fraction={segment.seatsTotal === 0 ? 0 : (segment.seatsTotal - segment.seatsAvailable) / segment.seatsTotal} label={stretch} />
                  </div>
                </li>
              );
            })}
          </ul>
          <RideBookings ride={ride} />
        </Card>
      ))}
    </Page>
  );
}

/** Open from the start for a ride under way or leaving within a day: who is coming is what the driver checks. */
const SOON_MS = 24 * 3_600_000;

function RideBookings({ ride }: { ride: Ride }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(
    () => ride.status === 'IN_PROGRESS' || (ride.status === 'SCHEDULED' && Date.parse(ride.departureTime) - Date.now() < SOON_MS),
  );
  const [chatOpen, setChatOpen] = useState(false);
  const live = ride.status === 'SCHEDULED' || ride.status === 'IN_PROGRESS';
  const bookings = useQuery({
    queryKey: ['rides', ride.id, 'bookings'],
    queryFn: () => api<Booking[]>(`/rides/${ride.id}/bookings`),
    enabled: open,
    refetchInterval: open && live ? LIVE_MS.lists : false,
  });
  const decide = useMutation({
    mutationFn: ({ booking, action }: { booking: number; action: 'accept' | 'reject' | 'no-show' }) =>
      api<Booking>(`/bookings/${booking}/${action}`, { method: 'POST' }),
    // Covers this ride's bookings and the seat counts on the ride itself; what ends a booking changes earnings.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['rides'] });
      void queryClient.invalidateQueries({ queryKey: ['earnings'] });
    },
  });

  return (
    <div className="mt-4 border-t border-slate-200 pt-3">
      <div className="flex flex-wrap gap-2">
        <Button tone="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
          <Users aria-hidden="true" className="h-4 w-4" />
          {open ? t('Hide passengers') : t('Show passengers')}
        </Button>
        {live && (
          <Button tone="secondary" aria-expanded={chatOpen} onClick={() => setChatOpen(!chatOpen)}>
            <MessagesSquare aria-hidden="true" className="h-4 w-4" />
            {chatOpen ? t('Close chat') : t('Open chat')}
          </Button>
        )}
      </div>
      {live && chatOpen && <RideChat rideId={ride.id} rideStatus={ride.status} />}
      <Collapse open={open}>
        <div className="mt-3 space-y-2">
          {decide.error && <Notice tone="error">{decide.error.message}</Notice>}
          <QueryState
            isPending={bookings.isPending}
            error={bookings.error}
            isEmpty={bookings.data?.length === 0}
            empty={t('Nobody has booked this ride yet.')}
        icon={Users}
            onRetry={() => void bookings.refetch()}
          />
          {bookings.data?.map((booking) => {
            const details = {
              from: t(booking.fromStop),
              to: t(booking.toStop),
              time: formatTime(booking.boardingTime),
              n: booking.seats,
              price: formatRupees(booking.price),
            };
            return (
              <div key={booking.id} className="rounded-xl bg-slate-50 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-medium">
                      <Link to={`/users/${booking.passengerId}`} className="text-teal-800 underline">
                        {booking.passengerName}
                      </Link>
                    </p>
                    <p className="text-slate-600">
                      {booking.seats === 1
                        ? t('{from} → {to} · boards {time} · {n} seat · {price}', details)
                        : t('{from} → {to} · boards {time} · {n} seats · {price}', details)}
                    </p>
                    {booking.pickupLat != null && booking.pickupLon != null && (
                      <p className="text-teal-800">
                        {t('Picks up at their own point after {stop}: {n} min out of your way.', {
                          stop: t(booking.fromStop),
                          n: booking.detourMinutes ?? 0,
                        })}{' '}
                        <a
                          className="underline"
                          target="_blank"
                          rel="noreferrer"
                          href={`https://www.openstreetmap.org/?mlat=${booking.pickupLat}&mlon=${booking.pickupLon}#map=17/${booking.pickupLat}/${booking.pickupLon}`}
                        >
                          {t('See the point on a map')}
                        </a>
                      </p>
                    )}
                    {booking.paymentStatus && (
                      <p className={booking.paymentStatus === 'DUE' ? 'font-medium text-amber-800' : 'text-slate-600'}>
                        {booking.paymentStatus === 'DUE' && booking.amountDue != null
                          ? t('{amount} owed to you', { amount: formatRupees(booking.amountDue) })
                          : booking.paymentStatus === 'SETTLED'
                            ? booking.paymentMethod === 'UPI'
                              ? t('Paid by UPI')
                              : t('Paid in cash')
                            : booking.paymentStatus === 'VOID'
                              ? t('Owes nothing')
                              : t('Pays after the ride')}
                      </p>
                    )}
                    <p className="mt-1">
                      <StatusBadge status={booking.status} />
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {booking.paymentStatus === 'DUE' && booking.amountDue != null && (
                      <PaymentReceivedButtons bookingId={booking.id} amount={booking.amountDue} />
                    )}
                    {booking.status === 'PENDING' && ride.status === 'SCHEDULED' && (
                      <>
                        <Button disabled={decide.isPending} busy={decide.isPending && decide.variables?.booking === booking.id && decide.variables.action === 'accept'} onClick={() => decide.mutate({ booking: booking.id, action: 'accept' })}>
                          {t('Accept')}
                        </Button>
                        <Button
                          tone="secondary"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ booking: booking.id, action: 'reject' })}
                        >
                          {t('Decline')}
                        </Button>
                      </>
                    )}
                    {booking.status === 'CONFIRMED' && (ride.status === 'SCHEDULED' || ride.status === 'IN_PROGRESS') && (
                      <CheckCode bookingId={booking.id} />
                    )}
                    {booking.status === 'CONFIRMED' && ride.status === 'IN_PROGRESS' && (
                      <ConfirmButton
                        label={t('Did not board')}
                        confirmLabel={t('Yes, mark as no-show')}
                        disabled={decide.isPending}
                        onConfirm={() => decide.mutate({ booking: booking.id, action: 'no-show' })}
                      />
                    )}
                  </div>
                </div>
                {booking.status === 'CONFIRMED' && (
                  <div className="mt-2">
                    <CallButton bookingId={booking.id} label={t('Call {name}', { name: booking.passengerName })} />
                  </div>
                )}
                {booking.status === 'COMPLETED' && !booking.driverRated && (
                  <RateForm bookingId={booking.id} legend={t('Rate {name}', { name: booking.passengerName })} />
                )}
              </div>
            );
          })}
        </div>
      </Collapse>
    </div>
  );
}

/** The next ride's countdown, its own component so that only it re-renders with the clock. */
function NextRideIn({ time }: { time: string }) {
  const t = useT();
  const ahead = useTimeAhead();
  const now = useNow(30_000);
  const left = Date.parse(time) - now;
  return <>{left > 0 ? t('Leaves in {time}', { time: ahead(left) }) : t('Time to set off')}</>;
}

const earningReason: Record<DueReason, string> = {
  TRIP_COMPLETED: msg('Trip completed'),
  PASSENGER_NO_SHOW: msg('Passenger did not board'),
  PASSENGER_CANCELLED: msg('Passenger cancelled late'),
};

export function EarningsPage() {
  const t = useT();
  const earnings = useQuery({ queryKey: ['earnings'], queryFn: () => api<Earning[]>('/earnings') });
  const owed = earnings.data?.filter((earning) => earning.status === 'DUE') ?? [];
  const paid = earnings.data?.filter((earning) => earning.status === 'SETTLED') ?? [];
  const total = paid.reduce((sum, earning) => sum + earning.amount, 0);
  const lastWeek = paid.filter((earning) => Date.now() - Date.parse(earning.at) < 7 * 86_400_000);

  return (
    <Page title={t('Earnings')}>
      <Notice tone="info">
        {t('Passengers pay you directly, in cash or by UPI, and VAYORA takes nothing. What shows here is what you marked as paid.')}{' '}
        <Link to="/account#payment" className="font-medium underline underline-offset-2">
          {t('Your UPI ID and QR code')}
        </Link>
      </Notice>
      <QueryState
        isPending={earnings.isPending}
        error={earnings.error}
        isEmpty={earnings.data?.length === 0}
        empty={t('Nothing yet. Once a trip ends, what passengers owe you shows here.')}
        icon={IndianRupee}
        onRetry={() => void earnings.refetch()}
      />
      {owed.length > 0 && (
        <Card>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">{t('Waiting to be paid')}</h2>
          <p className="mt-1 text-sm text-slate-600">{t('A passenger cannot book again until you mark what they owe as paid.')}</p>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {owed.map((earning) => (
              <li key={earning.bookingId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-slate-900">
                    {earning.passengerName} · {formatRupees(earning.amount)}
                  </p>
                  <p className="text-slate-600">
                    {t(earning.fromStop)} → {t(earning.toStop)} · {t(earningReason[earning.reason])}
                  </p>
                </div>
                <PaymentReceivedButtons bookingId={earning.bookingId} amount={earning.amount} />
              </li>
            ))}
          </ul>
        </Card>
      )}
      {paid.length > 0 && (
        <Card>
          <p className="text-sm font-medium text-slate-600">{t('Total paid to you')}</p>
          <p className="mt-1 text-5xl font-bold tracking-tight tabular-nums text-slate-900">
            <CountUp value={total} format={formatRupees} />
          </p>
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <dt className="text-slate-600">{t('In the last 7 days')}</dt>
              <dd className="text-lg font-bold tabular-nums text-slate-900">
                <CountUp value={lastWeek.reduce((sum, earning) => sum + earning.amount, 0)} format={formatRupees} />
              </dd>
            </div>
            <div>
              <dt className="text-slate-600">{t('Payments')}</dt>
              <dd className="text-lg font-bold tabular-nums text-slate-900">{paid.length}</dd>
            </div>
          </dl>
          <div className="mt-6">
            <WeeklyPayoutChart payouts={paid.map((earning) => ({ amount: earning.amount, createdAt: earning.at }))} />
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t('Payments, newest first')}</caption>
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">{t('Paid')}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t('Passenger')}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t('Trip')}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t('Why')}</th>
                  <th scope="col" className="py-2 text-right font-medium">{t('Amount')}</th>
                </tr>
              </thead>
              <tbody>
                {paid.map((earning) => (
                  <tr key={earning.bookingId} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-4">{formatDateTime(earning.at)}</td>
                    <td className="py-2 pr-4">{earning.passengerName}</td>
                    <td className="py-2 pr-4">
                      {t(earning.fromStop)} → {t(earning.toStop)}
                    </td>
                    <td className="py-2 pr-4">
                      {t(earningReason[earning.reason])}
                      {earning.method && ` · ${t(methodLabels[earning.method])}`}
                    </td>
                    <td className="py-2 text-right font-medium">{formatRupees(earning.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Page>
  );
}

/**
 * A driver's home: the next ride with its seats taken and requests waiting, what to do next,
 * what is owed and was paid, and what is left to set up. Every figure is the driver's own rides
 * and earnings; nothing is a forecast.
 */
export function DriverHome() {
  const t = useT();
  const { user } = useAuth();
  const rides = useQuery({ queryKey: ['rides'], queryFn: () => api<Ride[]>('/rides/mine'), refetchInterval: LIVE_MS.lists });
  const earnings = useQuery({ queryKey: ['earnings'], queryFn: () => api<Earning[]>('/earnings') });
  const now = useNow(60_000);
  const ahead = (rides.data ?? [])
    .filter((ride) => ride.status === 'SCHEDULED' || ride.status === 'IN_PROGRESS')
    .sort((a, b) => a.departureTime.localeCompare(b.departureTime));
  const next = ahead[0];
  // The same query the ride's own card makes on My rides, so the two agree.
  const requests = useQuery({
    queryKey: ['rides', next?.id, 'bookings'],
    queryFn: () => api<Booking[]>(`/rides/${next!.id}/bookings`),
    enabled: next !== undefined,
  });
  const waiting = requests.data?.filter((booking) => booking.status === 'PENDING').length;
  const owed = earnings.data?.filter((earning) => earning.status === 'DUE').reduce((sum, earning) => sum + earning.amount, 0);
  const paidThisWeek = earnings.data
    ?.filter((earning) => earning.status === 'SETTLED' && now - Date.parse(earning.at) < 7 * 86_400_000)
    .reduce((sum, earning) => sum + earning.amount, 0);
  const pill =
    'mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-bold text-navy shadow-lg shadow-black/10 transition-transform hover:-translate-y-0.5 active:scale-[0.97] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50';
  const actions = [
    { to: '/rides/new', label: t('Publish a ride'), icon: CirclePlus },
    { to: '/rides', label: t('My rides'), icon: Car },
    { to: '/vehicles', label: t('My vehicles'), icon: CarFront },
    { to: '/earnings', label: t('Earnings'), icon: IndianRupee },
  ];

  return (
    <Page title={t('Hello, {name}', { name: firstName(user?.fullName ?? '') })}>
      <QueryState isPending={rides.isPending} error={rides.error} isEmpty={false} empty="" onRetry={() => void rides.refetch()} />
      {rides.data && (
        <>
          <section aria-label={t('Your next ride')} className="rounded-3xl bg-navy p-6 text-white shadow-float sm:p-7">
            {next ? (
              <>
                <p className="text-sm font-medium text-white/75">{t('Your next ride')}</p>
                <p className="mt-1 text-[26px] font-bold leading-tight tracking-tight">
                  {t(next.stops[0].name)} → {t(next.stops[next.stops.length - 1].name)}
                </p>
                <p className="mt-1.5 text-white/85">
                  {formatDateTime(next.departureTime)} · <NextRideIn time={next.departureTime} />
                </p>
                <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
                  <div>
                    <dt className="text-[13px] text-white/70">{t('Seats booked')}</dt>
                    <dd className="text-xl font-bold tabular-nums">{t('{taken} of {offered}', { taken: seatsTaken(next), offered: next.seatsOffered })}</dd>
                  </div>
                  {waiting !== undefined && (
                    <div>
                      <dt className="text-[13px] text-white/70">{t('Requests waiting')}</dt>
                      <dd className="text-xl font-bold tabular-nums">{waiting}</dd>
                    </div>
                  )}
                </dl>
                <Link to="/rides" className={pill}>
                  {t('My rides')}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
                </Link>
              </>
            ) : (
              <>
                <p className="text-[26px] font-bold leading-tight tracking-tight">{t('No rides ahead')}</p>
                <p className="mt-1.5 text-white/85">{t('Publish one, and passengers going your way can book a seat.')}</p>
                <Link to="/rides/new" className={pill}>
                  {t('Publish a ride')}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
                </Link>
              </>
            )}
          </section>

          <nav aria-label={t('Quick actions')} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {actions.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex min-h-[4.5rem] flex-col items-start justify-center gap-1.5 rounded-2xl bg-surface px-4 py-3 shadow-card ring-1 ring-slate-900/[0.04] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-float focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30"
              >
                <Icon aria-hidden="true" className="h-5 w-5 text-teal-700" strokeWidth={2.2} />
                <span className="text-[15px] font-semibold text-slate-900">{label}</span>
              </Link>
            ))}
          </nav>

          <div className="grid grid-cols-3 gap-3">
            <HomeStat label={t('Rides ahead')} value={String(ahead.length)} to="/rides" />
            {owed !== undefined && <HomeStat label={t('Owed to you')} value={formatRupees(owed)} to="/earnings" />}
            {paidThisWeek !== undefined && <HomeStat label={t('Paid in the last 7 days')} value={formatRupees(paidThisWeek)} to="/earnings" />}
          </div>

          <GettingStarted rides={rides.data} />
        </>
      )}
    </Page>
  );
}
