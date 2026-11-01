import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Car, CarFront, IndianRupee, Users } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';

import { SimulatedPaymentNotice } from '../components/payment';
import { RateForm } from '../components/rating';
import { CheckCode } from '../components/boarding';
import { CallButton } from '../components/call';
import { InsuranceEditor } from '../components/insurance';
import { RideChat } from '../components/RideChat';
import { initialsOf, PhotoEditor } from '../components/photo';
import { RouteMap } from '../components/RouteMap';
import { WeeklyPayoutChart } from '../components/charts';
import { Collapse } from '../components/collapse';
import { CountUp } from '../components/countup';
import { Button, Card, ConfirmButton, Notice, Page, QueryState, SelectField, StatusBadge, TextField } from '../components/ui';
import { api } from '../lib/api';
import { PlaceOptions } from '../components/places';
import { placeNamed, roughDriveMinutes } from '../lib/places';
import { formatDateTime, formatRupees, formatTime } from '../lib/format';
import { msg, useT, useUnits } from '../lib/i18n';
import { rideSchema, toPublishRequest, vehicleSchema, type RideForm, type VehicleForm, MAX_DETOUR_MINUTES, MAX_REPEAT_WEEKS, ridesPublished, toVehicleRequest } from '../lib/schemas';
import { comfortLabels, luggageLabels, vehiclePhrases } from '../lib/vehicle';
import type { Booking, Comfort, Luggage, MyProfile, Ride, RoutePreview, Settlement, Vehicle } from '../lib/types';

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

/**
 * Shows the road route through the chosen stops, lets the driver move a meeting point by
 * clicking the map, and offers prices and timings worked out from the route.
 */
function RoutePlanner({ stops, rangeKm, onMove, onUse }: {
  stops: RideForm['stops'];
  /** The chosen vehicle's range on a full charge, from the driver's own figures; null if not electric. */
  rangeKm: number | null;
  onMove: (index: number, lat: number, lon: number) => void;
  onUse: (included: number[], preview: RoutePreview) => void;
}) {
  const t = useT();
  const units = useUnits();
  // A stop just added has no place yet, so nothing to show or route.
  const included = stops.map((stop, index) => ({ ...stop, index })).filter((stop) => stop.name !== '');
  const [moving, setMoving] = useState<number | null>(null);
  const target = included.some((stop) => stop.index === moving) ? moving! : included[0]?.index;
  const town = (index: number) => t(stops[index].name);
  const preview = useMutation({
    mutationFn: () =>
      api<RoutePreview>('/rides/route-preview', {
        method: 'POST',
        body: { stops: included.map((stop) => ({ lat: Number(stop.lat), lon: Number(stop.lon) })) },
      }),
  });

  // A route worked out for other stops is no route for these, however they changed.
  const pins = included.map((stop) => `${stop.lat},${stop.lon}`).join(' ');
  const { reset } = preview;
  useEffect(() => reset(), [pins, reset]);

  if (included.length < 2) return null;
  // The first stretch between stops longer than a full charge: the server refuses to publish it.
  const tooLong =
    rangeKm == null || !preview.data ? -1 : preview.data.legs.findIndex((leg) => leg.distanceKm > rangeKm);
  const chargers = preview.data?.alongRoute.some((a) => a.stopover.kind === 'CHARGER')
    ? t('Chargers are listed near this route below.')
    : t('No charger is listed near this route.');
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
        path={preview.data?.path}
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
        <Button tone="secondary" disabled={preview.isPending} onClick={() => preview.mutate()}>
          {preview.isPending ? t('Working out the route…') : t('Work out the route')}
        </Button>
        {preview.data && (
          <Button tone="secondary" onClick={() => onUse(included.map((stop) => stop.index), preview.data)}>
            {t('Use the suggested prices and times')}
          </Button>
        )}
      </div>
      {preview.error && <Notice tone="error">{preview.error.message}</Notice>}
      {preview.data && (
        <div className="text-sm text-slate-700">
          <p role="status">
            {preview.data.source === 'OSRM'
              ? t('{km} km by road, about {time} of driving.', {
                  km: preview.data.distanceKm,
                  time: units.duration(preview.data.durationMinutes),
                })
              : t(
                  'About {km} km in a straight line. No road route is available for this trip, so this is not a road distance and the times are rough guesses.',
                  { km: preview.data.distanceKm },
                )}
          </p>
          <ul className="mt-1 list-disc pl-5">
            {preview.data.legs.map((leg, i) => (
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
          {tooLong >= 0 ? (
            <div className="mt-2">
              <Notice tone="error">
                {t('{from} to {to} is {km} km, longer than the {range} km your vehicle covers on a full charge, by your own figures. A ride with a stretch that long cannot be published: add a stop between them where you can charge.', {
                  from: town(included[tooLong].index),
                  to: town(included[tooLong + 1].index),
                  km: preview.data.legs[tooLong].distanceKm,
                  range: rangeKm!,
                })}{' '}
                {chargers}
              </Notice>
            </div>
          ) : (
            rangeKm != null &&
            preview.data.distanceKm > rangeKm && (
              <div className="mt-2">
                <Notice tone="info">
                  {t('This route is longer than the {range} km your vehicle covers on a full charge, by your own figures. Plan a charging stop: VAYORA does not plan one for you.', { range: rangeKm })}{' '}
                  {chargers}
                </Notice>
              </div>
            )
          )}
          {preview.data.alongRoute.length > 0 && (
            <section aria-label={t('Along this route')} className="mt-3">
              <h3 className="font-medium">{t('Along this route')}</h3>
              <ul className="mt-1 space-y-1">
                {preview.data.alongRoute.map((a) => (
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

export function PublishRidePage() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const vehicles = useVehicles();
  // Only a driver whose profile says she is a woman may offer a women-only ride.
  const me = useQuery({ queryKey: ['me', 'profile'], queryFn: () => api<MyProfile>('/me/profile') });
  const { register, handleSubmit, formState, watch, setValue, getValues, control } = useForm<RideForm>({
    resolver: zodResolver(rideSchema),
    defaultValues: {
      departure: '',
      seatsOffered: 3,
      instantBooking: true,
      payAfterRide: false,
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
          priceFromPrevious: 0,
        },
      ],
    },
  });
  const { fields, insert, remove } = useFieldArray({ control, name: 'stops' });

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
  const publish = useMutation({
    mutationFn: (form: RideForm) => api<Ride>('/rides', { method: 'POST', body: toPublishRequest(form) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rides'] });
      navigate('/rides');
    },
  });

  const stops = watch('stops');
  const publishing = ridesPublished({ returnDeparture: watch('returnDeparture'), repeatWeeks: watch('repeatWeeks') });
  const stopsError = formState.errors.stops as { root?: { message?: string }; message?: string } | undefined;
  const stopsMessage = stopsError?.root?.message ?? stopsError?.message;

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

  const included = stops.filter((stop) => stop.name !== '');
  const wholeWay = stops.reduce((sum, stop, index) => (index > 0 ? sum + (Number(stop.priceFromPrevious) || 0) : sum), 0);
  const departure = watch('departure');
  const leaving = departure && !Number.isNaN(new Date(departure).getTime()) ? formatDateTime(departure) : null;

  return (
    <Page title={t('Publish a ride')}>
      <QueryState isPending={vehicles.isPending} error={vehicles.error} isEmpty={false} empty="" onRetry={() => void vehicles.refetch()} />
      {vehicles.data && (
        <form
          onSubmit={handleSubmit((form) => publish.mutate(form))}
          noValidate
          className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]"
        >
          <div className="space-y-5">
            {publish.error && <Notice tone="error">{publish.error.message}</Notice>}
            <FormStep n={1} title={t('When, and in which car')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label={t('Vehicle')} error={formState.errors.vehicleId?.message} {...register('vehicleId')}>
                {vehicles.data.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {t('{vehicle} ({n} passenger seats)', { vehicle: `${vehicle.make} ${vehicle.model}`, n: vehicle.seats - 1 })}
                  </option>
                ))}
              </SelectField>
              <TextField
                label={t('Leaving at')}
                type="datetime-local"
                hint={t("In your device's local time.")}
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
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('instantBooking')} />
                {t('Confirm bookings instantly, without asking me')}
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-700 sm:col-span-2">
                <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300" {...register('payAfterRide')} />
                <span>
                  {t('Let passengers pay after the ride, in the app or in cash to me')}
                  <span className="block text-slate-500">
                    {t('Nothing is taken when they book. A late cancellation or a no-show owes what it would have cost paid up front, and they cannot book again until it is paid.')}
                  </span>
                </span>
              </label>
            </div>
            </FormStep>

            <FormStep n={2} title={t('Where you stop')}>
            <fieldset>
              <legend className="text-sm font-medium text-slate-700">{t('Stops and price per seat')}</legend>
              <p className="mt-1 text-sm text-slate-500">
                {t('Passengers can book between any two of your stops. Each price is for the stretch that ends at that stop.')}
              </p>
              {stopsMessage && (
                <p className="mt-2 text-sm text-red-700" role="alert">
                  {t(stopsMessage)}
                </p>
              )}
              <div className="mt-3 space-y-3">
                {fields.map((field, index) => {
                  const stop = stops[index];
                  const between = index > 0 && index < fields.length - 1;
                  return (
                    <div key={field.id} className="grid items-end gap-3 rounded-2xl border border-slate-200 p-3 sm:grid-cols-3">
                      <SelectField
                        label={index === 0 ? t('From') : between ? t('Stop on the way {n}', { n: index }) : t('To')}
                        value={stop?.name ?? ''}
                        error={formState.errors.stops?.[index]?.name?.message}
                        onChange={(event) => choosePlace(index, event.target.value)}
                      >
                        {!stop?.name && <option value="">{t('Choose a place')}</option>}
                        <PlaceOptions />
                      </SelectField>
                      {/* The first stop is where the ride leaves at the time above: it has no minutes or price of its own. */}
                      {index > 0 && stop?.name && (
                        <>
                          <TextField
                            label={t('Minutes from {start} to {town}', { start: t(stops[0].name), town: t(stop.name) })}
                            type="number"
                            min={0}
                            error={formState.errors.stops?.[index]?.offsetMinutes?.message}
                            {...register(`stops.${index}.offsetMinutes`)}
                          />
                          <TextField
                            label={t('Price to {town} (₹)', { town: t(stop.name) })}
                            type="number"
                            min={0}
                            error={formState.errors.stops?.[index]?.priceFromPrevious?.message}
                            {...register(`stops.${index}.priceFromPrevious`)}
                          />
                        </>
                      )}
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
                  onClick={() => insert(fields.length - 1, { name: '', lat: 0, lon: 0, offsetMinutes: 0, priceFromPrevious: 0 }, { shouldFocus: false })}
                >
                  {t('Add a stop on the way')}
                </Button>
              )}
            </fieldset>

            <div className="mt-5">
            <RoutePlanner
              stops={stops}
              // Until the driver picks one, the select shows (and the form sends) the first vehicle.
              rangeKm={
                (vehicles.data.find((vehicle) => String(vehicle.id) === String(watch('vehicleId'))) ?? vehicles.data[0])
                  ?.estimatedRangeKm ?? null
              }
              onMove={(index, lat, lon) => {
                setValue(`stops.${index}.lat`, lat);
                setValue(`stops.${index}.lon`, lon);
              }}
              onUse={(chosen, preview) => {
                // Timings run on from the first stop's own offset; prices are per leg.
                let minutes = Number(stops[chosen[0]].offsetMinutes);
                preview.legs.forEach((leg, i) => {
                  minutes += leg.durationMinutes;
                  setValue(`stops.${chosen[i + 1]}.offsetMinutes`, minutes);
                  setValue(`stops.${chosen[i + 1]}.priceFromPrevious`, leg.suggestedPrice);
                });
              }}
            />
            </div>
            </FormStep>

            <FormStep n={3} title={t('Who rides, and how')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
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
                <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
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
            </FormStep>

            <FormStep n={4} title={t('Return and repeat')}>
            <div className="grid gap-4 sm:grid-cols-2">
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
            </FormStep>
          </div>

          {/* What will be published, kept in view beside the form on a wide screen. */}
          <aside aria-label={t('Your ride')} className="space-y-4 lg:sticky lg:top-28">
            <div className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-slate-900/[0.04]">
              <div className="bg-gradient-to-br from-accent to-accent-strong px-4 py-3 text-white">
                <p className="text-[13px] font-semibold uppercase tracking-wider text-white/80">{t('Your ride')}</p>
                <p className="mt-1 text-[17px] font-bold leading-snug">
                  {included.map((stop) => t(stop.name)).join(' → ')}
                </p>
              </div>
              <dl className="divide-y divide-slate-900/[0.06] px-4 text-sm">
                <SummaryRow label={t('Leaving')} value={leaving ?? t('Not chosen yet')} />
                <SummaryRow label={t('Seats')} value={String(watch('seatsOffered') ?? '')} />
                <SummaryRow label={t('Whole way, per seat')} value={wholeWay > 0 ? formatRupees(wholeWay) : t('Not chosen yet')} />
                <SummaryRow label={t('Rides to publish')} value={String(publishing)} />
              </dl>
            </div>
            <Button type="submit" disabled={publish.isPending} className="w-full py-3">
              {publish.isPending ? t('Publishing…') : t('Publish ride')}
            </Button>
          </aside>
        </form>
      )}
    </Page>
  );
}

/** One numbered part of a long form: the driver sees where they are without anything hidden. */
function FormStep({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-slate-900/[0.04] sm:p-5">
      <h2 id={id} className="mb-4 flex items-center gap-3 text-[17px] font-semibold tracking-tight text-slate-900">
        <span aria-hidden="true" className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent text-sm font-bold text-white shadow-sm shadow-accent/30">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
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

export function RidesPage() {
  const t = useT();
  const units = useUnits();
  const queryClient = useQueryClient();
  const rides = useQuery({ queryKey: ['rides'], queryFn: () => api<Ride[]>('/rides/mine') });
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
    <Page title={t('My rides')}>
      {series.data && (
        <Notice tone="success">
          {t('{n} rides cancelled. Every passenger has been refunded and told.', { n: series.data.withdrawn })}
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
        <Card key={ride.id}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-medium">{ride.stops.map((stop) => t(stop.name)).join(' → ')}</p>
              <p className="mt-1 text-sm text-slate-600">
                {t('Leaves {time}', { time: formatDateTime(ride.departureTime) })} ·{' '}
                {ride.instantBooking ? t('Instant booking') : t('You approve requests')}
                {ride.payAfterRide && ` · ${t('Passengers may pay after the ride')}`}
              </p>
              {ride.distanceKm !== null && ride.durationMinutes !== null && (
                <p className="mt-1 text-sm text-slate-600">
                  {ride.routeSource === 'OSRM'
                    ? t('{km} km by road, about {time}', { km: ride.distanceKm, time: units.duration(ride.durationMinutes) })
                    : t('About {km} km in a straight line (road distance unavailable)', { km: ride.distanceKm })}
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
                  <Button disabled={act.isPending} onClick={() => act.mutate({ ride: ride.id, action: 'start' })}>
                    {t('Start ride')}
                  </Button>
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
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
            {ride.segments.map((segment) => (
              <li key={segment.seq}>
                {t('{from} → {to}: {free} of {total} seats free, {price}', {
                  from: t(ride.stops[segment.seq].name),
                  to: t(ride.stops[segment.seq + 1].name),
                  free: segment.seatsAvailable,
                  total: segment.seatsTotal,
                  price: formatRupees(segment.price),
                })}
              </li>
            ))}
          </ul>
          <RideBookings ride={ride} />
        </Card>
      ))}
    </Page>
  );
}

function RideBookings({ ride }: { ride: Ride }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const live = ride.status === 'SCHEDULED' || ride.status === 'IN_PROGRESS';
  const bookings = useQuery({
    queryKey: ['rides', ride.id, 'bookings'],
    queryFn: () => api<Booking[]>(`/rides/${ride.id}/bookings`),
    enabled: open,
  });
  const decide = useMutation({
    mutationFn: ({ booking, action }: { booking: number; action: 'accept' | 'reject' | 'no-show' | 'cash-received' }) =>
      api<Booking>(`/bookings/${booking}/${action}`, { method: 'POST' }),
    // Covers this ride's bookings and the seat counts on the ride itself; cash changes earnings.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['rides'] });
      void queryClient.invalidateQueries({ queryKey: ['settlements'] });
    },
  });

  return (
    <div className="mt-4 border-t border-slate-200 pt-3">
      <div className="flex flex-wrap gap-2">
        <Button tone="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? t('Hide passengers') : t('Show passengers')}
        </Button>
        {live && (
          <Button tone="secondary" aria-expanded={chatOpen} onClick={() => setChatOpen(!chatOpen)}>
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
                    {booking.payAfterRide && (
                      <p className={booking.paymentStatus === 'DUE' ? 'font-medium text-amber-800' : 'text-slate-600'}>
                        {booking.paymentStatus === 'DUE' && booking.amountDue != null
                          ? t('{amount} due, in the app or in cash to you', { amount: formatRupees(booking.amountDue) })
                          : booking.paymentStatus === 'SETTLED'
                            ? t('Paid after the ride')
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
                      <ConfirmButton
                        label={t('Cash received')}
                        confirmLabel={t('Yes, I was paid {amount} in cash', { amount: formatRupees(booking.amountDue) })}
                        tone="primary"
                        disabled={decide.isPending}
                        onConfirm={() => decide.mutate({ booking: booking.id, action: 'cash-received' })}
                      />
                    )}
                    {booking.status === 'PENDING' && ride.status === 'SCHEDULED' && (
                      <>
                        <Button disabled={decide.isPending} onClick={() => decide.mutate({ booking: booking.id, action: 'accept' })}>
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

const settlementReason: Record<Settlement['reason'], string> = {
  TRIP_COMPLETED: msg('Trip completed'),
  PASSENGER_NO_SHOW: msg('Passenger did not board'),
  LATE_CANCELLATION: msg('Passenger cancelled late'),
};

export function EarningsPage() {
  const t = useT();
  const settlements = useQuery({ queryKey: ['settlements'], queryFn: () => api<Settlement[]>('/settlements') });
  const cashFees = useQuery({ queryKey: ['settlements', 'cash-fees'], queryFn: () => api<{ held: number }>('/settlements/cash-fees') });
  const total = settlements.data?.reduce((sum, settlement) => sum + settlement.amount, 0) ?? 0;

  return (
    <Page title={t('Earnings')}>
      <SimulatedPaymentNotice forDrivers />
      {cashFees.data && cashFees.data.held > 0 && (
        <Notice tone="info">
          {t("{amount} of the cash passengers paid you after their rides is VAYORA's service fee, which you hold for the platform.", {
            amount: formatRupees(cashFees.data.held),
          })}
        </Notice>
      )}
      <QueryState
        isPending={settlements.isPending}
        error={settlements.error}
        isEmpty={settlements.data?.length === 0}
        empty={t('Nothing has been paid out yet. You are paid the fare when a trip completes.')}
        icon={IndianRupee}
        onRetry={() => void settlements.refetch()}
      />
      {settlements.data && settlements.data.length > 0 && (
        <Card>
          <p className="text-sm font-medium text-slate-600">{t('Total paid out')}</p>
          <p className="mt-1 text-5xl font-bold tracking-tight tabular-nums text-slate-900">
            <CountUp value={total} format={formatRupees} />
          </p>
          <div className="mt-6">
            <WeeklyPayoutChart payouts={settlements.data} />
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t('Payouts, newest first')}</caption>
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
                {settlements.data.map((settlement) => (
                  <tr key={settlement.bookingId} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-4">{formatDateTime(settlement.createdAt)}</td>
                    <td className="py-2 pr-4">{settlement.passengerName}</td>
                    <td className="py-2 pr-4">
                      {t(settlement.fromStop)} → {t(settlement.toStop)}
                    </td>
                    <td className="py-2 pr-4">
                      {t(settlementReason[settlement.reason])}
                      {settlement.provider === 'CASH' && ` · ${t('taken in cash')}`}
                    </td>
                    <td className="py-2 text-right font-medium">{formatRupees(settlement.amount)}</td>
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
