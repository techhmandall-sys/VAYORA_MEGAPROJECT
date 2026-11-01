import { describe, expect, it } from 'vitest';

import { answerBy } from './format';
import { registerSchema, rideSchema, ridesPublished, searchSchema, toPublishRequest, toVehicleRequest, vehicleSchema, type RideForm } from './schemas';

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

const tomorrow = () => new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16);

function ride(overrides: Partial<RideForm> = {}): RideForm {
  return {
    vehicleId: 4,
    departure: tomorrow(),
    seatsOffered: 3,
    instantBooking: true,
    payAfterRide: false,
    maxTwoInBack: false,
    womenOnly: false,
    notes: '',
    returnDeparture: '',
    repeatWeeks: 0,
    maxDetourMinutes: 0,
    stops: [
      { name: 'Kolhapur', lat: 16.705, lon: 74.2433, offsetMinutes: 0, priceFromPrevious: 0 },
      { name: 'Satara', lat: 17.6805, lon: 74.0183, offsetMinutes: 130, priceFromPrevious: 270 },
      { name: 'Pune', lat: 18.5204, lon: 73.8567, offsetMinutes: 270, priceFromPrevious: 250 },
    ],
    ...overrides,
  };
}

describe('registerSchema', () => {
  const valid = { fullName: 'Asha Patil', method: 'email', email: 'asha@example.test', password: 'long-enough', role: 'DRIVER' };

  it('accepts a complete form', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('refuses a short password, a bad email and the admin role', () => {
    expect(messages(registerSchema.safeParse({ ...valid, password: 'short' }))).toContain('Use at least 8 characters');
    expect(messages(registerSchema.safeParse({ ...valid, email: 'not-an-email' }))).toContain('Enter a valid email');
    expect(registerSchema.safeParse({ ...valid, role: 'ADMIN' }).success).toBe(false);
  });

  it('asks only for the way the member chose to sign in', () => {
    const byPhone = { ...valid, method: 'phone', email: undefined };
    expect(messages(registerSchema.safeParse(byPhone))).toContain('Enter 10 to 15 digits, with or without a + in front');
    expect(registerSchema.safeParse({ ...byPhone, phone: '+91 98000-00009' }).success).toBe(true);
  });
});

describe('searchSchema', () => {
  const valid = { origin: 'Karad', destination: 'Pune', date: '2026-11-02', seats: '2' };

  it('turns the seats text into a number', () => {
    expect(searchSchema.parse(valid).seats).toBe(2);
  });

  it('accepts any two listed places in India, in either direction', () => {
    expect(searchSchema.safeParse({ ...valid, origin: 'Chennai', destination: 'Bengaluru' }).success).toBe(true);
    expect(searchSchema.safeParse({ ...valid, origin: 'Mumbai', destination: 'Panaji' }).success).toBe(true);
    expect(searchSchema.safeParse({ ...valid, origin: 'Pune', destination: 'Kolhapur' }).success).toBe(true);
  });

  it('refuses the same place twice', () => {
    expect(messages(searchSchema.safeParse({ ...valid, origin: 'Pune', destination: 'Pune' }))).toEqual(['Choose a different place from where you start']);
  });

  it('refuses a place not on the list and a seat count out of range', () => {
    expect(messages(searchSchema.safeParse({ ...valid, destination: 'Atlantis' }))).toEqual(['Choose where you are going']);
    expect(searchSchema.safeParse({ ...valid, seats: '0' }).success).toBe(false);
    expect(searchSchema.safeParse({ ...valid, seats: '9' }).success).toBe(false);
  });
});

describe('vehicleSchema', () => {
  it('lets the year be left blank but not nonsensical', () => {
    const base = { make: 'Maruti', model: 'Ertiga', colour: '', seats: '7', comfort: '', luggage: '', electric: false, batteryKwh: '', consumptionKwhPer100Km: '' };
    expect(vehicleSchema.parse({ ...base, year: '' }).year).toBe('');
    expect(vehicleSchema.parse({ ...base, year: '2022' }).year).toBe(2022);
    expect(vehicleSchema.safeParse({ ...base, year: '1492' }).success).toBe(false);
    expect(vehicleSchema.safeParse({ ...base, year: '', seats: '1' }).success).toBe(false);
  });
});

describe('rideSchema', () => {
  it('accepts a ride with two or more stops in order', () => {
    expect(rideSchema.safeParse(ride()).success).toBe(true);
  });

  it('refuses a departure in the past', () => {
    expect(messages(rideSchema.safeParse(ride({ departure: '2020-01-01T08:00' })))).toContain('Choose a time in the future');
  });

  it('refuses fewer than two stops', () => {
    expect(messages(rideSchema.safeParse(ride({ stops: ride().stops.slice(0, 1) })))).toContain('A ride needs at least two stops');
  });

  it('refuses a stop that is not later than the one before', () => {
    const stops = ride().stops;
    stops[1] = { ...stops[1], offsetMinutes: 0 };
    expect(messages(rideSchema.safeParse(ride({ stops })))).toContain('Must be later than the stop before');
  });

  it('refuses a stop with no place, and the same place twice running', () => {
    const unnamed = ride().stops;
    unnamed[1] = { ...unnamed[1], name: '' };
    expect(messages(rideSchema.safeParse(ride({ stops: unnamed })))).toEqual(['Choose a place']);

    const repeated = ride().stops;
    repeated[1] = { ...repeated[1], name: 'Kolhapur' };
    expect(messages(rideSchema.safeParse(ride({ stops: repeated })))).toEqual(['Choose a different place from the stop before']);
  });

  it('accepts a ride between any places, and back to where it began', () => {
    const stops = [
      { name: 'Mumbai', lat: 19.076, lon: 72.8777, offsetMinutes: 0, priceFromPrevious: 0 },
      { name: 'Panaji', lat: 15.4909, lon: 73.8278, offsetMinutes: 600, priceFromPrevious: 900 },
      { name: 'Mumbai', lat: 19.076, lon: 72.8777, offsetMinutes: 1200, priceFromPrevious: 900 },
    ];
    expect(rideSchema.safeParse(ride({ stops })).success).toBe(true);
  });

  it('refuses a negative price or an absurd offset', () => {
    const negative = ride().stops;
    negative[1] = { ...negative[1], priceFromPrevious: -5 };
    expect(messages(rideSchema.safeParse(ride({ stops: negative })))).toContain('Enter a price of 0 or more');

    const absurd = ride().stops;
    absurd[2] = { ...absurd[2], offsetMinutes: 99999 };
    expect(messages(rideSchema.safeParse(ride({ stops: absurd })))).toContain('Enter whole minutes, up to two days');
  });
});

describe('toPublishRequest', () => {
  it('sends the stops in order, with one price per leg', () => {
    const body = toPublishRequest(ride());

    expect(body.stops.map((stop) => stop.name)).toEqual(['Kolhapur', 'Satara', 'Pune']);
    expect(body.stops.map((stop) => stop.offsetMinutes)).toEqual([0, 130, 270]);
    expect(body.segmentPrices).toEqual([270, 250]);
    expect(body.stops[1]).toMatchObject({ lat: 17.6805, lon: 74.0183 });
  });

  it('sends a meeting point the driver moved, under the town it belongs to', () => {
    const stops = ride().stops;
    stops[1] = { ...stops[1], lat: 17.6912, lon: 74.0001 };

    const body = toPublishRequest(ride({ stops }));

    expect(body.stops[1]).toMatchObject({ name: 'Satara', lat: 17.6912, lon: 74.0001 });
  });

  it('sends the departure as an absolute instant', () => {
    expect(toPublishRequest(ride()).departureTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

describe('return and repeated rides', () => {
  // A datetime-local value so many hours after the ride leaves. Such a value has no zone
  // and is read as local time, so it has to be written as local time too.
  const after = (hours: number) => {
    const at = new Date(Date.parse(tomorrow()) + hours * 3600 * 1000);
    return new Date(at.getTime() - at.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  };

  it('sends no return and no repeat unless asked, and trims the notes', () => {
    const body = toPublishRequest(ride({ notes: '  Two bags each.  ', maxTwoInBack: true }));

    expect(body).toMatchObject({ notes: 'Two bags each.', maxTwoInBack: true, returnDepartureTime: null, repeatWeeks: 0 });
  });

  it('sends whether passengers may pay after the ride, which is off unless chosen', () => {
    expect(toPublishRequest(ride()).payAfterRide).toBe(false);
    expect(toPublishRequest(ride({ payAfterRide: true })).payAfterRide).toBe(true);
  });

  it('sends the return as an instant and the number of further weeks', () => {
    const returnDeparture = after(8);

    const body = toPublishRequest(ride({ returnDeparture, repeatWeeks: 3 }));

    expect(body.returnDepartureTime).toBe(new Date(returnDeparture).toISOString());
    expect(body.repeatWeeks).toBe(3);
  });

  it('refuses a return that leaves before the ride out has arrived', () => {
    // The ride out takes 270 minutes.
    expect(messages(rideSchema.safeParse(ride({ returnDeparture: after(4) })))).toEqual(['The return must leave after you have arrived']);
    expect(messages(rideSchema.safeParse(ride({ returnDeparture: after(4.5) })))).toEqual(['The return must leave after you have arrived']);
    expect(rideSchema.safeParse(ride({ returnDeparture: after(5) })).success).toBe(true);
    expect(messages(rideSchema.safeParse(ride({ returnDeparture: 'soon' })))).toEqual(['The return must leave after you have arrived']);
  });

  it('refuses more weeks than the server allows and notes that are too long', () => {
    expect(rideSchema.safeParse(ride({ repeatWeeks: 8 })).success).toBe(true);
    expect(rideSchema.safeParse(ride({ repeatWeeks: 9 })).success).toBe(false);
    expect(messages(rideSchema.safeParse(ride({ notes: 'x'.repeat(501) })))).toEqual(['At most 500 characters']);
  });

  it('counts the rides a form will publish', () => {
    expect(ridesPublished({ returnDeparture: '', repeatWeeks: 0 })).toBe(1);
    expect(ridesPublished({ returnDeparture: after(8), repeatWeeks: 0 })).toBe(2);
    expect(ridesPublished({ returnDeparture: '', repeatWeeks: 2 })).toBe(3);
    expect(ridesPublished({ returnDeparture: after(8), repeatWeeks: 2 })).toBe(6);
  });
});

describe('vehicle details', () => {
  const base = { make: 'Tata', model: 'Nexon EV', year: '', colour: '', seats: '5', comfort: '', luggage: '', electric: false, batteryKwh: '', consumptionKwhPer100Km: '' };

  it('sends what was not said as nothing', () => {
    expect(toVehicleRequest(vehicleSchema.parse(base))).toEqual({
      make: 'Tata', model: 'Nexon EV', year: null, colour: null, seats: 5,
      comfort: null, luggage: null, electric: false, batteryKwh: null, consumptionKwhPer100Km: null,
    });
  });

  it('sends the battery figures of an electric vehicle, to one decimal', () => {
    const form = vehicleSchema.parse({ ...base, comfort: 'PREMIUM', luggage: 'MEDIUM', electric: true, batteryKwh: '40.52', consumptionKwhPer100Km: '15' });

    expect(toVehicleRequest(form)).toMatchObject({ comfort: 'PREMIUM', luggage: 'MEDIUM', electric: true, batteryKwh: 40.5, consumptionKwhPer100Km: 15 });
  });

  it('drops battery figures left behind when the vehicle is no longer marked electric', () => {
    const form = vehicleSchema.parse({ ...base, electric: false, batteryKwh: '40.5', consumptionKwhPer100Km: '15' });

    expect(toVehicleRequest(form)).toMatchObject({ electric: false, batteryKwh: null, consumptionKwhPer100Km: null });
  });

  it('refuses figures no car has and a class that does not exist', () => {
    expect(messages(vehicleSchema.safeParse({ ...base, electric: true, batteryKwh: '0' }))).toEqual(['Between 1 and 300 kWh']);
    expect(messages(vehicleSchema.safeParse({ ...base, electric: true, consumptionKwhPer100Km: '99' }))).toEqual(['Between 5 and 60 kWh per 100 km']);
    expect(vehicleSchema.safeParse({ ...base, comfort: 'LUXURY' }).success).toBe(false);
  });
});

describe('answerBy', () => {
  const terms = { answerWithinMinutes: 720, closesMinutesBeforeBoarding: 120 };

  it('is twelve hours after the request when boarding is far off', () => {
    expect(answerBy('2026-10-30T10:00:00Z', '2026-11-02T01:30:00Z', terms)).toBe('2026-10-30T22:00:00.000Z');
  });

  it('is two hours before boarding when that comes first', () => {
    expect(answerBy('2026-11-01T20:00:00Z', '2026-11-02T01:30:00Z', terms)).toBe('2026-11-01T23:30:00.000Z');
  });
});
