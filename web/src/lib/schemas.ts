// Form validation. The limits mirror core-api's, so a form that passes here is not then
// bounced by the server for a reason the user could have been told up front.

import { z } from 'zod';

// Zod would otherwise try to compile its checks with `new Function`, which the online setup's content
// security policy refuses (and reports, on every page). It falls back either way; this skips the attempt.
z.config({ jitless: true });

// A coerced number is written z.coerce.number<number>() throughout: the field holds a number
// as far as the form's types go, as it did before zod 4 typed the input as unknown.

import { placeNamed } from './places';
import { msg } from './i18n';

// Digits with an optional + in front; spaces and hyphens are allowed and the server drops them.
const PHONE = /^\+?[0-9][0-9 -]{8,18}[0-9]$/;

export const loginSchema = z.object({
  // An email address, or a phone number: whichever the account was made with.
  login: z
    .string()
    .trim()
    .min(1, msg('Enter your email or phone number'))
    .refine((value) => (value.includes('@') ? z.string().email().safeParse(value).success : PHONE.test(value)), {
      message: msg('Enter a valid email or phone number'),
    }),
  password: z.string().min(1, msg('Enter your password')),
});
export type LoginForm = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  login: z
    .string()
    .trim()
    .min(1, msg('Enter your email or phone number'))
    .refine((value) => (value.includes('@') ? z.string().email().safeParse(value).success : PHONE.test(value)), {
      message: msg('Enter a valid email or phone number'),
    }),
});
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, msg('Enter the 6-digit reset code'))
    .regex(/^[0-9]{6}$/, msg('Enter the 6-digit reset code')),
  newPassword: z.string().min(8, msg('Use at least 8 characters')).max(72, msg('Use at most 72 characters')),
});
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(1, msg('Enter your name')).max(100),
    // What the member will sign in with; only that one is sent.
    method: z.enum(['email', 'phone']),
    email: z.string().trim().max(254).optional(),
    phone: z.string().trim().max(20).optional(),
    password: z.string().min(8, msg('Use at least 8 characters')).max(72, msg('Use at most 72 characters')),
    role: z.enum(['PASSENGER', 'DRIVER'], { message: msg('Choose how you will use VAYORA') }),
    // The code of whoever invited them. Optional; an unknown code is refused by the server.
    referralCode: z.string().trim().max(20).optional(),
  })
  .superRefine((form, ctx) => {
    if (form.method === 'email' && !z.string().email().safeParse(form.email ?? '').success) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: form.email ? msg('Enter a valid email') : msg('Enter your email') });
    }
    if (form.method === 'phone' && !PHONE.test(form.phone ?? '')) {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: msg('Enter 10 to 15 digits, with or without a + in front') });
    }
  });
export type RegisterForm = z.infer<typeof registerSchema>;

export const searchSchema = z
  .object({
    origin: z.string().refine((name) => placeNamed(name) !== undefined, msg('Choose where you start')),
    destination: z.string().refine((name) => placeNamed(name) !== undefined, msg('Choose where you are going')),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, msg('Choose a date')),
    seats: z.coerce.number<number>().int().min(1, msg('At least 1 seat')).max(8, msg('At most 8 seats')),
  })
  .refine((form) => form.destination !== form.origin, {
    path: ['destination'],
    message: msg('Choose a different place from where you start'),
  });
export type SearchForm = z.infer<typeof searchSchema>;

export const vehicleSchema = z.object({
  make: z.string().trim().min(1, msg('Enter the make')).max(50),
  model: z.string().trim().min(1, msg('Enter the model')).max(50),
  year: z.union([z.literal(''), z.coerce.number<number>().int().min(1980, msg('Too old')).max(2100, msg('Check the year'))]),
  colour: z.string().trim().max(30),
  seats: z.coerce.number<number>().int().min(2, msg('At least 2, counting the driver')).max(9, msg('At most 9')),
  // Empty means the driver has not said.
  comfort: z.enum(['', 'BASIC', 'COMFORT', 'PREMIUM']),
  luggage: z.enum(['', 'NONE', 'SMALL', 'MEDIUM', 'LARGE']),
  electric: z.boolean(),
  batteryKwh: z.union([z.literal(''), z.coerce.number<number>().min(1, msg('Between 1 and 300 kWh')).max(300, msg('Between 1 and 300 kWh'))]),
  consumptionKwhPer100Km: z.union([
    z.literal(''),
    z.coerce.number<number>().min(5, msg('Between 5 and 60 kWh per 100 km')).max(60, msg('Between 5 and 60 kWh per 100 km')),
  ]),
});
export type VehicleForm = z.infer<typeof vehicleSchema>;

/** Turns the vehicle form into the body core-api expects. Battery figures go only with an electric vehicle. */
export function toVehicleRequest(form: VehicleForm) {
  const figure = (value: number | '') => (form.electric && value !== '' ? Math.round(value * 10) / 10 : null);
  return {
    make: form.make,
    model: form.model,
    year: form.year === '' ? null : form.year,
    colour: form.colour || null,
    seats: form.seats,
    comfort: form.comfort || null,
    luggage: form.luggage || null,
    electric: form.electric,
    batteryKwh: figure(form.batteryKwh),
    consumptionKwhPer100Km: figure(form.consumptionKwhPer100Km),
  };
}

/** How many further weeks a ride can be repeated for. The server enforces the same limit. */
export const MAX_REPEAT_WEEKS = 8;
/** As vayora.detour.max-minutes on the server, which has the last word. */
export const MAX_DETOUR_MINUTES = 30;

/** How many rides the form will publish: out and back, for each week. */
export const ridesPublished = (form: Pick<RideForm, 'returnDeparture' | 'repeatWeeks'>): number =>
  (form.returnDeparture === '' ? 1 : 2) * (Number(form.repeatWeeks) + 1);

export const rideSchema = z
  .object({
    vehicleId: z.coerce.number<number>().int().positive(msg('Choose a vehicle')),
    departure: z.string().min(1, msg('Choose when you leave')),
    seatsOffered: z.coerce.number<number>().int().min(1, msg('Offer at least 1 seat')).max(8, msg('At most 8 seats')),
    instantBooking: z.boolean(),
    maxTwoInBack: z.boolean(),
    womenOnly: z.boolean(),
    notes: z.string().max(500, msg('At most 500 characters')),
    // Empty for no return ride.
    returnDeparture: z.string(),
    repeatWeeks: z.coerce.number<number>().int().min(0).max(MAX_REPEAT_WEEKS),
    // Minutes in all the driver will go out of their way for pickups; 0 for none.
    maxDetourMinutes: z.coerce
      .number<number>()
      .int(msg('Enter whole minutes'))
      .min(0, msg('Enter 0 or more'))
      .max(MAX_DETOUR_MINUTES, msg('At most 30 minutes')),
    // The driver's stops, in travel order. The numbers are checked below.
    stops: z.array(
      z.object({
        name: z.string().min(1, msg('Choose a place')),
        // Where passengers meet the driver. Starts at the town centre; the driver can move it.
        lat: z.coerce.number<number>(),
        lon: z.coerce.number<number>(),
        offsetMinutes: z.coerce.number<number>(),
        // Price per seat of the leg that ends at this stop. Starts empty, so 0, a free ride, is
        // something the driver typed rather than something they left.
        priceFromPrevious: z.union([z.literal(''), z.coerce.number<number>()]),
      }),
    ),
  })
  .superRefine((form, context) => {
    if (Number.isNaN(Date.parse(form.departure)) || Date.parse(form.departure) <= Date.now()) {
      context.addIssue({ code: 'custom', path: ['departure'], message: msg('Choose a time in the future') });
    }
    const stops = form.stops.map((stop, index) => ({ ...stop, index }));
    if (form.returnDeparture !== '' && stops.length >= 2) {
      const drive = (stops[stops.length - 1].offsetMinutes - stops[0].offsetMinutes) * 60_000;
      // NaN compares false, so an unreadable time is refused here too.
      if (!(Date.parse(form.returnDeparture) > Date.parse(form.departure) + drive)) {
        context.addIssue({ code: 'custom', path: ['returnDeparture'], message: msg('The return must leave after you have arrived') });
      }
    }
    if (stops.length < 2) {
      context.addIssue({ code: 'custom', path: ['stops'], message: msg('A ride needs at least two stops') });
    }
    for (const stop of stops) {
      if (!Number.isInteger(stop.offsetMinutes) || stop.offsetMinutes < 0 || stop.offsetMinutes > 2880) {
        context.addIssue({
          code: 'custom',
          path: ['stops', stop.index, 'offsetMinutes'],
          message: msg('Enter whole minutes, up to two days'),
        });
      }
      const price = stop.priceFromPrevious;
      if (stop.index > 0 && price === '') {
        context.addIssue({
          code: 'custom',
          path: ['stops', stop.index, 'priceFromPrevious'],
          message: msg('Enter a price, or 0 for a free ride'),
        });
      } else if (price !== '' && !(price >= 0 && price <= 999999)) {
        context.addIssue({
          code: 'custom',
          path: ['stops', stop.index, 'priceFromPrevious'],
          message: msg('Enter a price of 0 or more'),
        });
      }
    }
    for (let i = 1; i < stops.length; i++) {
      if (stops[i].offsetMinutes <= stops[i - 1].offsetMinutes) {
        context.addIssue({
          code: 'custom',
          path: ['stops', i, 'offsetMinutes'],
          message: msg('Must be later than the stop before'),
        });
      }
      if (stops[i].name !== '' && stops[i].name === stops[i - 1].name) {
        context.addIssue({
          code: 'custom',
          path: ['stops', i, 'name'],
          message: msg('Choose a different place from the stop before'),
        });
      }
    }
  });
export type RideForm = z.infer<typeof rideSchema>;

/** Turns the publish form into the body core-api expects. */
export function toPublishRequest(form: RideForm) {
  return {
    vehicleId: form.vehicleId,
    departureTime: new Date(form.departure).toISOString(),
    seatsOffered: form.seatsOffered,
    instantBooking: form.instantBooking,
    stops: form.stops.map((stop) => ({
      name: stop.name,
      lat: stop.lat,
      lon: stop.lon,
      // Minutes after departure: the ride departs from its first stop, at 0.
      offsetMinutes: stop.offsetMinutes,
    })),
    segmentPrices: form.stops.slice(1).map((stop) => (stop.priceFromPrevious === '' ? 0 : stop.priceFromPrevious)),
    notes: form.notes.trim(),
    maxTwoInBack: form.maxTwoInBack,
    womenOnly: form.womenOnly,
    returnDepartureTime: form.returnDeparture === '' ? null : new Date(form.returnDeparture).toISOString(),
    repeatWeeks: form.repeatWeeks,
    maxDetourMinutes: form.maxDetourMinutes,
  };
}
