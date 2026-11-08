import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppRoutes } from './App';
import { AuthProvider } from './lib/auth';
import { setFormatLanguage, todayInIndia } from './lib/format';
import { placeNamed } from './lib/places';
import { LanguageProvider, type Language } from './lib/i18n';
import type { Booking, Candidate, Role, Session } from './lib/types';

function signIn(role: Role) {
  const session: Session = {
    accessToken: 'token',
    expiresInSeconds: 3600,
    user: { id: 1, email: 'user@example.test', fullName: 'Asha Patil', role },
  };
  sessionStorage.setItem('vayora.session', JSON.stringify(session));
}

/** Chooses a place in a place field, as someone would: by typing part of it. */
async function pickPlace(label: string, place: string) {
  await userEvent.click(screen.getByLabelText(label));
  await userEvent.keyboard(place);
  await userEvent.click(await screen.findByRole('option', { name: place }));
}

function open(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

/** Answers each request from the first route whose "METHOD /path" prefix matches. */
function serve(routes: Record<string, () => Response>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${new URL(url).pathname.replace('/api/v1', '')}`;
    // A photo is answered only by a route written for it, never by a shorter prefix such as
    // GET /vehicles, which would hand a page a list where it expects an image.
    const photo = key.endsWith('/photo');
    // Likewise a route preview, which the publish page asks for by itself, never by POST /rides.
    const routing = key === 'POST /rides/route-preview';
    const match = Object.keys(routes).find(
      (route) => key.startsWith(route) && (!photo || route.endsWith('/photo')) && (!routing || route === key),
    );
    if (!match && routing) return json({ detail: 'No route in this test' }, 503);
    // Any signed-in page may ask for the payment terms.
    if (!match && key === 'GET /payment-terms') return json(terms);
    // And the bookings page for how long a driver has to answer.
    // And the search and publish pages, for whether women-only rides apply.
    if (!match && key === 'GET /me/profile') return json({ gender: null });
    if (!match && key === 'GET /notifications/preferences') return json({ email: false, sms: false });
    if (!match && key === 'GET /bus-alternatives') return json([]);
    if (!match && key === 'GET /me/push') return json({ publicKey: null, subscribed: false });
    if (!match && key === 'GET /me/document-checks') return json([]);
    if (!match && key === 'GET /auth/google') return json({ clientId: null });
    if (!match && key.startsWith('GET ') && key.endsWith('/photo')) return json({ detail: 'No photo' }, 404);
    if (!match && key === 'GET /me/referral') return json({ code: 'K7QX2M', signedUp: 0, qualified: 0 });
    if (!match && key === 'GET /booking-terms') return json({ answerWithinMinutes: 720, closesMinutesBeforeBoarding: 120 });
    // The navigation asks for this on every signed-in page.
    if (!match && key === 'GET /notifications/unread-count') return json({ unread: 0 });
    // And the search results, for the seats left now.
    if (!match && key === 'GET /rides/availability') return json([]);
    if (!match) throw new Error(`unexpected request: ${key}`);
    return routes[match]();
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const terms = {
  cancellationTiers: [
    { atLeastHoursBefore: 48, owedShare: 0 },
    { atLeastHoursBefore: 24, owedShare: 0.5 },
  ],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const candidate: Candidate = {
  rideId: 12,
  driverName: 'Ravi Jadhav',
  instantBooking: false,
  fromSeq: 0,
  toSeq: 2,
  fromStop: 'Kolhapur',
  toStop: 'Pune',
  boardingTime: '2026-11-02T01:30:00Z',
  arrivalTime: '2026-11-02T06:00:00Z',
  pricePerSeat: 520,
  seatsAvailable: 3,
  fare: 1040,
  driverId: 7,
  driverRating: 4.6667,
  driverRatingCount: 3,
  pickupDistanceM: 1992,
  dropoffDistanceM: 0,
  driverConfirmed: false,
  maxTwoInBack: false,
  womenOnly: false,
  driverRidesCompleted: 18,
  driverRidesWithdrawn: 1,
  pickupWalkMinutes: 4,
  dropoffWalkMinutes: 0,
  suggestFlexible: false,
  underWay: false,
  insurer: null,
  insuredUntil: null,
  matchScore: 72,
  matchReasons: [],
  detourMinutes: null,
  walkOnFootpaths: false,
  vehicle: 'Maruti Ertiga',
  comfort: null,
  luggage: null,
  electric: false,
};

const rideWithRoute = {
  id: 12,
  driverId: 7,
  driverName: 'Ravi Jadhav',
  vehicleId: 3,
  departureTime: '2026-11-02T01:30:00Z',
  seatsOffered: 3,
  instantBooking: false,
  status: 'SCHEDULED',
  stops: [
    { seq: 0, name: 'Kolhapur', lat: 16.705, lon: 74.2433, departureTime: '2026-11-02T01:30:00Z' },
    { seq: 1, name: 'Satara', lat: 17.6805, lon: 74.0183, departureTime: '2026-11-02T03:40:00Z' },
    { seq: 2, name: 'Pune', lat: 18.5204, lon: 73.8567, departureTime: '2026-11-02T06:00:00Z' },
  ],
  segments: [],
  distanceKm: 235.9,
  durationMinutes: 203,
  routeSource: 'OSRM',
  path: [
    [16.705, 74.2433],
    [17.2, 74.2],
    [17.6805, 74.0183],
    [18.5204, 73.8567],
  ],
};

const booking: Booking = {
  id: 90,
  rideId: 12,
  passengerId: 1,
  passengerName: 'Asha Patil',
  fromSeq: 0,
  toSeq: 2,
  fromStop: 'Kolhapur',
  toStop: 'Pune',
  seats: 1,
  price: 520,
  paymentStatus: 'DEFERRED',
  status: 'PENDING',
  boardingTime: '2026-11-02T01:30:00Z',
  createdAt: '2026-10-30T10:00:00Z',
  passengerRated: false,
  driverRated: false,
};

describe('access', () => {
  it('shows a signed-out visitor what VAYORA is, and takes a driver to sign up as one', async () => {
    open('/');

    expect(await screen.findByRole('heading', { level: 1, name: 'Share the road between cities across India' })).toBeInTheDocument();
    expect(screen.getByText(/simulated unless real services are connected/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Offer a ride' }));

    expect(await screen.findByRole('heading', { name: 'Create an account' })).toBeInTheDocument();
    expect(screen.getByLabelText('I want to')).toHaveValue('DRIVER');
  });

  it('takes a signed-in member past the front page to their own', async () => {
    signIn('DRIVER');
    serve({ 'GET /rides/mine': () => json([]) });
    open('/');

    expect(await screen.findByRole('heading', { name: 'My rides' })).toBeInTheDocument();
  });

  it('sends a signed-out visitor to sign in', async () => {
    open('/bookings');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it("keeps a passenger out of the driver's pages and shows only passenger navigation", async () => {
    signIn('PASSENGER');
    open('/rides/new');

    expect(await screen.findByRole('heading', { name: 'Find a ride' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'My bookings' })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Publish a ride' })).not.toBeInTheDocument();
  });

  it("keeps a driver out of the passenger's pages", async () => {
    signIn('DRIVER');
    serve({ 'GET /rides/mine': () => json([]) });
    open('/search');

    expect(await screen.findByRole('heading', { name: 'My rides' })).toBeInTheDocument();
    expect(await screen.findByText('You have not published a ride yet.')).toBeInTheDocument();
  });

  it('signs out and returns to sign in', async () => {
    signIn('PASSENGER');
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(sessionStorage.getItem('vayora.session')).toBeNull();
  });
});

describe('command palette', () => {
  it('opens with Ctrl+K, narrows as you type, and goes where you choose', async () => {
    signIn('PASSENGER');
    serve({ 'GET /bookings': () => json([]) });
    open('/search');
    await screen.findByRole('heading', { name: 'Find a ride' });

    await userEvent.keyboard('{Control>}k{/Control}');
    const dialog = await screen.findByRole('dialog', { name: 'Search pages and actions' });
    const field = within(dialog).getByRole('combobox');
    expect(field).toHaveFocus();
    // A passenger is offered no driver's page.
    expect(within(dialog).queryByRole('option', { name: 'Publish a ride' })).not.toBeInTheDocument();
    await userEvent.type(field, 'bookings');
    expect(within(dialog).getAllByRole('option').map((option) => option.textContent)).toEqual(['My bookings']);
    await userEvent.keyboard('{Enter}');

    expect(await screen.findByRole('heading', { name: 'My bookings' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('switches the theme from the list, and gives focus back on Escape', async () => {
    signIn('DRIVER');
    serve({ 'GET /rides/mine': () => json([]) });
    open('/rides');
    await screen.findByRole('heading', { name: 'My rides' });
    const button = screen.getByRole('button', { name: 'Search pages and actions' });

    await userEvent.click(button);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(button).toHaveFocus();

    await userEvent.click(button);
    await userEvent.type(within(await screen.findByRole('dialog')).getByRole('combobox'), 'dark');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    expect(localStorage.getItem('vayora.theme')).toBe('dark');
  });
});

describe('signing in', () => {
  it('shows field errors without calling the server', async () => {
    const fetchMock = serve({});
    open('/login');

    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter your email or phone number')).toBeInTheDocument();
    expect(screen.getByLabelText('Email or phone number')).toHaveAttribute('aria-invalid', 'true');
    // Only the question of whether Google sign-in is offered; nothing is submitted.
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it("shows the server's reason when the credentials are wrong", async () => {
    serve({ 'POST /auth/login': () => json({ detail: 'Invalid email or password' }, 401) });
    open('/login');

    await userEvent.type(await screen.findByLabelText('Email or phone number'), 'asha@example.test');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });
});

describe('finding and booking a ride', () => {
  it('searches, shows the fare for the party, and requests the booking', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({
      'GET /rides/search': () => json([candidate]),
      'POST /bookings': () => json(booking, 201),
    });
    open('/search');

    await userEvent.clear(await screen.findByLabelText('Seats'));
    await userEvent.type(screen.getByLabelText('Seats'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    const results = await screen.findByRole('region', { name: 'Search results' });
    expect(await within(results).findByRole('link', { name: 'Ravi Jadhav' })).toHaveAttribute('href', '/users/7');
    expect(within(results).getByText(/4\.7 out of 5 · 3 ratings/)).toBeInTheDocument();
    expect(within(results).getByText(/3 seats left/)).toBeInTheDocument();
    expect(within(results).getByText('₹1,040')).toBeInTheDocument();
    // The form has stepped aside for a summary, so the results start near the top.
    expect(screen.getByRole('button', { name: 'Change search' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Search' })).not.toBeInTheDocument();
    // There is nothing to choose: no card, no wallet, no second way to book.
    expect(within(results).queryByLabelText('Pay with')).not.toBeInTheDocument();
    expect(within(results).queryByText(/service fee/)).not.toBeInTheDocument();
    expect(within(results).getByText(/Driver approves each request/)).toBeInTheDocument();

    await userEvent.click(within(results).getByRole('button', { name: 'Request' }));

    expect(await screen.findByText(/Request sent/)).toHaveTextContent('Nothing to pay now: pay your driver ₹520 after the ride, in cash or by UPI.');
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse(post[1]!.body as string)).toEqual({
      rideId: 12,
      fromSeq: 0,
      toSeq: 2,
      seats: 2,
      tier: 'EXACT',
      lastMileDistanceM: candidate.pickupDistanceM,
      lastMileModeShown: 'walk',
    });
    expect((post[1]!.headers as Record<string, string>)['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('says so when nothing matches, and offers a retry when the search fails', async () => {
    signIn('PASSENGER');
    let attempts = 0;
    serve({
      'GET /rides/search': () => (attempts++ === 0 ? json({ detail: 'Service unavailable' }, 503) : json([])),
    });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable');

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/No rides have a stop near both ends/)).toBeInTheDocument();
  });

  it('shows why a booking failed and leaves the results in place', async () => {
    signIn('PASSENGER');
    serve({
      'GET /rides/search': () => json([candidate]),
      'POST /bookings': () => json({ detail: 'Not enough seats left on that part of the ride' }, 409),
    });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Request' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Not enough seats left');
    expect(screen.getByRole('button', { name: 'Request' })).toBeInTheDocument();
  });

  it('reuses one idempotency key when the same booking is tried again after a failure', async () => {
    signIn('PASSENGER');
    let attempts = 0;
    const fetchMock = serve({
      'GET /rides/search': () => json([candidate]),
      'POST /bookings': () =>
        attempts++ === 0 ? json({ detail: 'Not enough seats left on that part of the ride' }, 409) : json(booking, 201),
    });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Request' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not enough seats left on that part of the ride');
    await userEvent.click(screen.getByRole('button', { name: 'Request' }));
    expect(await screen.findByText(/Request sent/)).toBeInTheDocument();

    const keys = fetchMock.mock.calls
      .filter(([, init]) => init?.method === 'POST')
      .map(([, init]) => (init!.headers as Record<string, string>)['Idempotency-Key']);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });
});

describe('booking durability (administrator)', () => {
  const score = {
    bookingId: 3,
    rideId: 2,
    passengerName: 'Meera Kulkarni',
    fromStop: 'Kolhapur',
    toStop: 'Pune',
    boardingTime: '2026-11-02T01:30:00Z',
    survivalProbability: 0.8107,
    modelVersion: 'h3-cox',
    scoredAt: '2026-10-30T10:00:00Z',
    contributions: { lead_hours: 0.41, seats: 0.02, prior_cancel_share: -0.18, departure_hour: 0 },
  };

  it('names the two features that moved an estimate most, and which way', async () => {
    signIn('ADMIN');
    serve({ 'GET /admin/hazard/scores': () => json([score, { ...score, bookingId: 4, passengerName: 'Sunita Pawar', contributions: {} }]) });
    open('/admin/durability');

    const row = (await screen.findByText('Meera Kulkarni')).closest('tr')!;
    expect(within(row).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'How far ahead it was booked makes a cancellation likelier',
      'Share of earlier bookings cancelled makes a cancellation less likely',
    ]);
    // A score logged before explanations existed says so rather than inventing reasons.
    expect(within(screen.getByText('Sunita Pawar').closest('tr')!).getByText('None given')).toBeInTheDocument();
  });

  it('shows each estimate as a percentage with its model and a warning about what it is', async () => {
    signIn('ADMIN');
    serve({ 'GET /admin/hazard/scores': () => json([score]) });
    open('/admin/durability');

    const row = (await screen.findByText('Meera Kulkarni')).closest('tr')!;
    expect(within(row).getByText('81%')).toBeInTheDocument();
    expect(within(row).getByText('h3-cox')).toBeInTheDocument();
    expect(screen.getByText(/trained on\s+simulated data only/)).toBeInTheDocument();
    expect(screen.getByText(/must\s+not be used to decline, penalise or price anyone/)).toBeInTheDocument();
  });

  it('reports what a scoring run did, including bookings the model could not score', async () => {
    signIn('ADMIN');
    serve({
      'GET /admin/hazard/scores': () => json([]),
      'POST /admin/hazard/score': () => json({ scored: 2, alreadyScored: 5, failed: 1, skippedRun: false }),
    });
    open('/admin/durability');

    expect(await screen.findByText('No confirmed booking has been scored yet.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Score bookings now' }));

    expect(await screen.findByText('2 scored, 5 already scored today, 1 could not be scored.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('The model service did not answer');
  });

  it('is closed to drivers and passengers', async () => {
    signIn('DRIVER');
    serve({ 'GET /rides/mine': () => json([]) });
    open('/admin/durability');

    expect(await screen.findByRole('heading', { name: 'My rides' })).toBeInTheDocument();
    expect(screen.queryByText('Booking durability')).not.toBeInTheDocument();
  });
});

describe('reporting and moderation', () => {
  const profile = {
    id: 7,
    fullName: 'Ravi Jadhav',
    role: 'DRIVER',
    memberSince: '2026-03-14T08:00:00Z',
    completedTrips: 12,
    averageStars: null,
    ratingCount: 0,
    reviews: [],
  };
  const report = {
    id: 4,
    reporterId: 1,
    reporterName: 'Asha Patil',
    reportedUserId: 7,
    reportedUserName: 'Ravi Jadhav',
    reportedUserStatus: 'ACTIVE',
    bookingId: 90,
    reason: 'UNSAFE_DRIVING',
    details: 'Overtook on a blind bend.',
    status: 'OPEN',
    outcome: null,
    resolutionNote: null,
    createdAt: '2026-10-30T10:00:00Z',
    resolvedAt: null,
  };

  it('lets a member report another, pointing to the emergency number first', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({
      'GET /users/7/profile': () => json(profile),
      'POST /reports': () => json({ id: 4 }, 201),
    });
    open('/users/7');

    await userEvent.click(await screen.findByRole('button', { name: 'Report Ravi Jadhav' }));
    expect(screen.getByText(/If you are in danger now, call 112/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send report' })).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText('What happened?'), 'Unsafe driving');
    await userEvent.type(screen.getByLabelText(/Details/), 'Overtook on a blind bend.');
    await userEvent.click(screen.getByRole('button', { name: 'Send report' }));

    expect(await screen.findByText(/Your report has been sent/)).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse(post[1]!.body as string)).toEqual({
      reportedUserId: 7,
      reason: 'UNSAFE_DRIVING',
      details: 'Overtook on a blind bend.',
    });
  });

  it("shows the server's reason when the member may not be reported", async () => {
    signIn('PASSENGER');
    serve({
      'GET /users/7/profile': () => json(profile),
      'POST /reports': () => json({ detail: 'You can only report someone you have booked or driven with' }, 403),
    });
    open('/users/7');

    await userEvent.click(await screen.findByRole('button', { name: 'Report Ravi Jadhav' }));
    await userEvent.selectOptions(screen.getByLabelText('What happened?'), 'Fraud');
    await userEvent.click(screen.getByRole('button', { name: 'Send report' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('You can only report someone you have booked or driven with');
  });

  it('offers no report button on your own profile or to an administrator', async () => {
    signIn('PASSENGER'); // signed-in id is 1
    serve({ 'GET /users/1/profile': () => json({ ...profile, id: 1, fullName: 'Asha Patil', role: 'PASSENGER' }) });
    open('/users/1');

    expect(await screen.findByRole('heading', { name: 'Asha Patil' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Report/ })).not.toBeInTheDocument();
  });

  it('lets an administrator warn with a note, and suspends only after confirming', async () => {
    signIn('ADMIN');
    const fetchMock = serve({
      'GET /admin/reports': () => json([report]),
      'POST /admin/reports/4/resolve': () => json({ ...report, status: 'RESOLVED' }),
    });
    open('/admin/reports');

    expect(await screen.findByText('Overtook on a blind bend.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Suspend member' }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));

    await userEvent.type(screen.getByLabelText('Note for report #4'), 'Please keep to the speed limit.');
    await userEvent.click(screen.getByRole('button', { name: 'Warn member' }));

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse(post[1]!.body as string)).toEqual({ outcome: 'WARN', note: 'Please keep to the speed limit.' });
  });

  it('shows the overview with real counts and a pointer to waiting reports', async () => {
    signIn('ADMIN');
    serve({
      'GET /admin/overview': () =>
        json({
          users: { ADMIN: 1, DRIVER: 4, PASSENGER: 9 },
          rides: { SCHEDULED: 3, COMPLETED: 2 },
          bookings: {},
          suspendedMembers: 1,
          openReports: 2,
        }),
    });
    open('/admin');

    expect(await screen.findByText('2 reports are waiting.', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Suspended members: 1')).toBeInTheDocument();
    expect(screen.getByText('None yet.')).toBeInTheDocument(); // no bookings: said, not shown as zeroes
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Audit log' })).toBeInTheDocument();
  });

  it('lists members and can reinstate a suspended one', async () => {
    signIn('ADMIN');
    const member = { id: 7, fullName: 'Ravi Jadhav', email: 'ravi@example.test', role: 'DRIVER', memberSince: '2026-03-14T08:00:00Z' };
    const fetchMock = serve({
      'GET /admin/users': () => json([{ ...member, status: 'SUSPENDED' }, { ...member, id: 8, fullName: 'Meera Kulkarni', status: 'ACTIVE' }]),
      'POST /admin/users/7/reinstate': () => new Response(null, { status: 204 }),
    });
    open('/admin/users');

    await userEvent.click(await screen.findByRole('button', { name: 'Reinstate Ravi Jadhav' }));
    expect(fetchMock.mock.calls.some(([url, init]) => init?.method === 'POST' && String(url).endsWith('/admin/users/7/reinstate'))).toBe(true);
    expect(screen.queryByRole('button', { name: 'Reinstate Meera Kulkarni' })).not.toBeInTheDocument();
  });

  it('shows the audit log', async () => {
    signIn('ADMIN');
    serve({
      'GET /admin/audit': () =>
        json([
          { id: 2, actorId: 1, actorName: 'Administrator', action: 'REPORT_SUSPEND', targetType: 'report', targetId: 4, detail: '{"reason": "FRAUD"}', createdAt: '2026-10-30T10:00:00Z' },
        ]),
    });
    open('/admin/audit');

    const row = (await screen.findByText('report suspend')).closest('tr')!;
    expect(within(row).getByText('report #4')).toBeInTheDocument();
    expect(within(row).getByText('{"reason": "FRAUD"}')).toBeInTheDocument();
  });
});

describe('maps, routes and location search', () => {
  const searchUrls = (fetchMock: ReturnType<typeof serve>) =>
    fetchMock.mock.calls.map(([url]) => new URL(String(url))).filter((url) => url.pathname.endsWith('/rides/search'));

  it('searches from the town centres, and re-searches when the order is changed', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({ 'GET /rides/search': () => json([candidate]) });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
    expect(await screen.findByText(/Pickup 2\.0 km from your start · drops you where you are going/)).toBeInTheDocument();
    const first = searchUrls(fetchMock)[0].searchParams;
    expect([first.get('originLat'), first.get('originLon')]).toEqual(['16.705', '74.2433']);
    expect([first.get('destLat'), first.get('destLon')]).toEqual(['18.5204', '73.8567']);
    expect(first.get('sort')).toBe('TIME');

    await userEvent.click(screen.getByRole('radio', { name: 'Nearest pickup' }));
    await screen.findByText(/Pickup 2\.0 km/);
    const urls = searchUrls(fetchMock);
    expect(urls[urls.length - 1].searchParams.get('sort')).toBe('PROXIMITY');
  });

  it('uses a point chosen on the map in place of the town centre, and can go back', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({ 'GET /rides/search': () => json([]) });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Choose exact points on a map' }));
    // The map's code arrives when it is first shown.
    await userEvent.click(await screen.findByRole('button', { name: 'click the map' }));
    expect(screen.getByText(/a point you chose \(17\.3070, 74\.1900\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    await screen.findByText(/No rides have a stop near both ends/);
    const sent = searchUrls(fetchMock)[0].searchParams;
    expect([sent.get('originLat'), sent.get('originLon')]).toEqual(['17.307', '74.19']);
    expect(sent.get('destLat')).toBe('18.5204'); // the destination is still the town

    // The form steps aside for a one-line summary once searched; it comes back to change the search.
    await userEvent.click(screen.getByRole('button', { name: 'Change search' }));
    await userEvent.click(screen.getByRole('button', { name: 'Use the centre of Kolhapur instead' }));
    expect(screen.getByText('Start: the centre of Kolhapur')).toBeInTheDocument();
  });

  it('shows the route of a result, with where to board, on request', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({
      'GET /rides/search': () => json([candidate]),
      'GET /rides/12': () => json(rideWithRoute),
    });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
    await screen.findByRole('button', { name: 'Show route' });
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/rides/12'))).toBe(false); // not until asked
    await userEvent.click(screen.getByRole('button', { name: 'Show route' }));

    expect(await screen.findByText('Board here: Kolhapur')).toBeInTheDocument();
    expect(screen.getByText('Get off here: Pune')).toBeInTheDocument();
    // The line is drawn twice, a pale edge under the tint.
    expect(screen.getAllByTestId('route')[0]).toHaveAttribute('data-points', '4');
    expect(screen.getByText(/The whole ride is 235\.9 km by road\./)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Map of the ride through Kolhapur, Satara, Pune' })).toBeInTheDocument();
  });

  it('does not call a straight-line estimate a road distance', async () => {
    signIn('PASSENGER');
    serve({
      'GET /bookings': () => json([{ ...booking, status: 'CONFIRMED' }]),
      'GET /rides/12': () => json({ ...rideWithRoute, routeSource: 'STRAIGHT_LINE', distanceKm: 204.1 }),
    });
    open('/bookings');

    await userEvent.click(await screen.findByRole('button', { name: 'Show meeting point' }));

    expect(await screen.findByText(/about 204\.1 km in a straight line; the road distance is not available/)).toBeInTheDocument();
    expect(screen.getByText(/Board at Kolhapur, leaving/)).toBeInTheDocument();
  });

  it('works out the route once the stops have places, fills the times and prices, and keeps what the driver types', async () => {
    signIn('DRIVER');
    const fetchMock = serve({
      'GET /vehicles': () => json([{ id: 3, make: 'Maruti', model: 'Ertiga', year: 2022, colour: 'Silver', seats: 7 }]),
      'POST /rides/route-preview': () =>
        json({
          distanceKm: 230,
          durationMinutes: 191,
          source: 'OSRM',
          legs: [{ distanceKm: 230, durationMinutes: 191, suggestedPrice: 460 }],
          alongRoute: [],
          path: [
            [16.705, 74.2433],
            [18.5204, 73.8567],
          ],
        }),
    });
    open('/rides/new');

    // Nothing to press: both ends have places, so the route follows, and the times and prices from it.
    expect(await screen.findByText('230 km by road, about 3 h 11 min of driving.')).toBeInTheDocument();
    expect(screen.getByText(/Kolhapur to Pune: 230 km, 3 h 11 min, suggested ₹460 a seat/)).toBeInTheDocument();
    const routes = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/rides/route-preview'));
    expect(JSON.parse(routes()[0][1]!.body as string)).toEqual({
      stops: [
        { lat: 16.705, lon: 74.2433 },
        { lat: 18.5204, lon: 73.8567 },
      ],
    });
    expect(screen.getByLabelText('Price to Pune (₹)')).toHaveValue(460);
    expect(screen.getByLabelText('Minutes from Kolhapur to Pune')).toHaveValue(191);
    // The summary follows the form: the whole way has a price, and only the time is left to choose.
    const summary = within(screen.getByRole('complementary', { name: 'Your ride' }));
    expect(summary.getByText('Kolhapur → Pune')).toBeInTheDocument();
    expect(summary.getByText('₹460')).toBeInTheDocument();
    expect(summary.getAllByText('Not chosen yet')).toHaveLength(1);

    // A price the driver types stays theirs through every route worked out after it.
    await userEvent.clear(screen.getByLabelText('Price to Pune (₹)'));
    await userEvent.type(screen.getByLabelText('Price to Pune (₹)'), '500');
    // Moving a pin invalidates the route that was shown, and it is worked out again.
    // The map's code arrives when it is first shown.
    await userEvent.click(await screen.findByRole('button', { name: 'click the map' }));
    expect(screen.queryByText(/230 km by road/)).not.toBeInTheDocument();
    expect(await screen.findByText('230 km by road, about 3 h 11 min of driving.')).toBeInTheDocument();
    expect(routes()).toHaveLength(2);
    expect(screen.getByLabelText('Price to Pune (₹)')).toHaveValue(500);

    // Asked for, the suggestion replaces it.
    await userEvent.click(screen.getByRole('button', { name: 'Use the suggested prices and times' }));
    expect(screen.getByLabelText('Price to Pune (₹)')).toHaveValue(460);
  });

  it('says quietly when the route could not be worked out by itself, and leaves the prices to type', async () => {
    signIn('DRIVER');
    serve({
      'GET /vehicles': () => json([{ id: 3, make: 'Maruti', model: 'Ertiga', year: 2022, colour: 'Silver', seats: 7 }]),
      'POST /rides/route-preview': () => json({ detail: 'Routing is not available' }, 503),
    });
    open('/rides/new');

    expect(await screen.findByText('The route could not be worked out by itself. Enter the times and prices, or try again.')).toBeInTheDocument();
    // Nobody asked, so nothing interrupts a screen reader.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Price to Pune (₹)')).toHaveValue(null);

    // Asked for, a failure is said as one.
    await userEvent.click(screen.getByRole('button', { name: 'Work out the route' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Routing is not available');
  });
});

describe('my bookings', () => {
  it('cancels only after a second, explicit confirmation', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({
      'GET /bookings': () => json([booking]),
      'POST /bookings/90/cancel': () => json({ ...booking, status: 'CANCELLED' }),
    });
    open('/bookings');

    expect(await screen.findByText('Waiting for the driver')).toBeInTheDocument();
    expect(screen.getByText(/Fare ₹520 · pay after the ride/)).toBeInTheDocument();
    // What cancelling costs is stated, from the server's own terms, before anything is cancelled.
    expect(await screen.findByText('48 hours or more before boarding: nothing to pay.')).toBeInTheDocument();
    expect(screen.getByText('24 to 48 hours before boarding: 50% of the fare to your driver.')).toBeInTheDocument();
    expect(screen.getByText('Less than 24 hours before boarding, or if you do not turn up: the whole fare to your driver.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel it' }));
    expect(fetchMock.mock.calls.some(([url, init]) => init?.method === 'POST' && String(url).endsWith('/bookings/90/cancel'))).toBe(true);
  });

  it('offers no cancel button on a booking that is already over', async () => {
    signIn('PASSENGER');
    serve({ 'GET /bookings': () => json([{ ...booking, status: 'COMPLETED' }]) });
    open('/bookings');

    expect(await screen.findByText('Completed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel booking' })).not.toBeInTheDocument();
    expect(screen.queryByText('If you cancel')).not.toBeInTheDocument();
  });

  it('shows what a booking cancelled late still owes the driver', async () => {
    signIn('PASSENGER');
    serve({
      'GET /bookings/90/pay-driver': () => json({ driverName: 'Ravi Jadhav', upiId: null, hasQr: false }),
      'GET /bookings': () => json([{ ...booking, status: 'CANCELLED', paymentStatus: 'DUE', amountDue: 260, driverId: 7 }]),
    });
    open('/bookings');

    expect(await screen.findByText(/₹260 owed to your driver/)).toBeInTheDocument();
  });
});

describe('notifications', () => {
  const unread = {
    id: 'a1',
    type: 'BOOKING_CONFIRMED',
    message: 'The driver accepted your booking for 1 seat, Kolhapur to Pune.',
    bookingId: 90,
    createdAt: '2026-10-30T10:00:00Z',
    read: false,
  };
  const old = { ...unread, id: 'a0', message: 'Your trip from Kolhapur to Pune is complete.', read: true };

  it('shows how many are unread in the navigation', async () => {
    signIn('PASSENGER');
    serve({ 'GET /notifications/unread-count': () => json({ unread: 3 }) });
    open('/search');

    const link = await screen.findByRole('link', { name: /Notifications/ });
    expect(await within(link).findByText('3')).toBeInTheDocument();
    expect(within(link).getByText('unread')).toBeInTheDocument();
  });

  it('lists them, marks unread ones for screen readers, and can mark all as read', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({
      'GET /notifications/unread-count': () => json({ unread: 1 }),
      'GET /notifications': () => json([unread, old]),
      'POST /notifications/read-all': () => new Response(null, { status: 204 }),
    });
    open('/notifications');

    const first = (await screen.findByText(unread.message)).closest('li')!;
    expect(within(first).getByText('Unread:')).toBeInTheDocument();
    expect(within(first).getByRole('button', { name: 'Mark as read' })).toBeInTheDocument();
    const second = screen.getByText(old.message).closest('li')!;
    expect(within(second).queryByRole('button', { name: 'Mark as read' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    expect(fetchMock.mock.calls.some(([url, init]) => init?.method === 'POST' && String(url).endsWith('/notifications/read-all'))).toBe(true);
  });

  it('says so when there are none', async () => {
    signIn('DRIVER');
    serve({ 'GET /notifications': () => json([]) });
    open('/notifications');

    expect(await screen.findByText('You have no notifications.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument();
  });
});

describe('who drives', () => {
  it('names the driver and the car on a booking, with a link to the profile', async () => {
    signIn('PASSENGER');
    serve({ 'GET /bookings': () => json([{ ...booking, driverId: 7, driverName: 'Ravi Jadhav', vehicle: 'Maruti Ertiga, Silver' }]) });
    open('/bookings');

    const link = await screen.findByRole('link', { name: 'Ravi Jadhav' });
    expect(link).toHaveAttribute('href', '/users/7');
    expect(link.parentElement).toHaveTextContent('Driver Ravi Jadhav · Maruti Ertiga, Silver');
  });
});

describe('ratings', () => {
  it('lets a passenger rate a completed trip, stars first', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({
      'GET /bookings': () => json([{ ...booking, status: 'COMPLETED' }]),
      'POST /bookings/90/rating': () => new Response(null, { status: 201 }),
    });
    open('/bookings');

    const send = await screen.findByRole('button', { name: 'Send rating' });
    expect(send).toBeDisabled(); // nothing can be sent without choosing stars
    await userEvent.click(screen.getByRole('radio', { name: '4 stars' }));
    await userEvent.type(screen.getByLabelText(/Comment/), 'On time and careful.');
    await userEvent.click(send);

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(String(post[0])).toMatch(/\/bookings\/90\/rating$/);
    expect(JSON.parse(post[1]!.body as string)).toEqual({ stars: 4, comment: 'On time and careful.' });
    // The server answers 201 with no body: that is success, not an error to show. (A real
    // browser showed "Unexpected end of JSON input" here before the API helper allowed it.)
    await waitFor(() => expect(send).toHaveTextContent('Send rating'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('asks for no rating on a trip already rated or not completed', async () => {
    signIn('PASSENGER');
    serve({
      'GET /bookings': () =>
        json([
          { ...booking, id: 91, status: 'COMPLETED', passengerRated: true },
          { ...booking, id: 92, status: 'CONFIRMED' },
        ]),
    });
    open('/bookings');

    expect(await screen.findByText('Completed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send rating' })).not.toBeInTheDocument();
  });

  it('shows a member profile, with a review rendered as plain text', async () => {
    signIn('PASSENGER');
    serve({
      'GET /users/7/profile': () =>
        json({
          id: 7,
          fullName: 'Ravi Jadhav',
          role: 'DRIVER',
          memberSince: '2026-03-14T08:00:00Z',
          completedTrips: 12,
          averageStars: 4.5,
          ratingCount: 2,
          reviews: [
            { stars: 5, comment: '<img src=x onerror=alert(1)> great', reviewerName: 'Meera', createdAt: '2026-10-01T08:00:00Z' },
          ],
        }),
    });
    open('/users/7');

    expect(await screen.findByRole('heading', { name: 'Ravi Jadhav' })).toBeInTheDocument();
    expect(screen.getByText('March 2026')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText(/4\.5 out of 5 · 2 ratings/)).toBeInTheDocument();
    expect(screen.getByText('<img src=x onerror=alert(1)> great')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('shows a declared identity document as declared and not checked, never as confirmed', async () => {
    signIn('PASSENGER');
    serve({
      'GET /users/7/profile': () =>
        json({ id: 7, fullName: 'Ravi Jadhav', role: 'DRIVER', memberSince: '2026-03-14T08:00:00Z', completedTrips: 0,
          averageStars: null, ratingCount: 0, reviews: [], emailVerified: false, phoneVerified: false, declaredId: 'DRIVING_LICENCE' }),
    });
    open('/users/7');

    const about = within(await screen.findByRole('list', { name: 'About this member' }));
    expect(about.getByText('Declared: Driving licence, not checked')).toBeInTheDocument();
    expect(about.queryByText(/confirmed/)).not.toBeInTheDocument();
    expect(screen.getByText('VAYORA has not checked any identity documents.')).toBeInTheDocument();
  });

  it('says so when a member has no ratings instead of showing a score', async () => {
    signIn('DRIVER');
    serve({
      'GET /users/1/profile': () =>
        json({
          id: 1,
          fullName: 'New Member',
          role: 'PASSENGER',
          memberSince: '2026-10-01T08:00:00Z',
          completedTrips: 0,
          averageStars: null,
          ratingCount: 0,
          reviews: [],
        }),
    });
    open('/users/1');

    expect(await screen.findByText('No ratings yet')).toBeInTheDocument();
    expect(screen.getByText('Nobody has written a review yet.')).toBeInTheDocument();
  });
});

describe('earnings (driver)', () => {
  it('lists what was paid with its reason and a total, and what is still owed, and that VAYORA takes nothing', async () => {
    signIn('DRIVER');
    const earning = {
      bookingId: 1,
      passengerName: 'Meera Kulkarni',
      fromStop: 'Kolhapur',
      toStop: 'Pune',
      status: 'SETTLED',
      method: 'CASH',
      at: '2026-11-02T06:00:00Z',
    };
    serve({
      'GET /earnings': () =>
        json([
          { ...earning, amount: 520, reason: 'TRIP_COMPLETED' },
          { ...earning, bookingId: 2, amount: 260, reason: 'PASSENGER_CANCELLED', method: 'UPI' },
          { ...earning, bookingId: 3, amount: 400, reason: 'PASSENGER_NO_SHOW', status: 'DUE', method: null, passengerName: 'Asha Patil' },
        ]),
    });
    open('/earnings');

    expect((await screen.findAllByText('₹780')).length).toBeGreaterThan(0);
    expect(screen.getByText(/Trip completed · Cash to the driver/)).toBeInTheDocument();
    expect(screen.getByText(/Passenger cancelled late · UPI/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Waiting to be paid' })).toBeInTheDocument();
    expect(screen.getByText(/Asha Patil · ₹400/)).toBeInTheDocument();
    expect(screen.getByText(/Passengers pay you directly, in cash or by UPI, and VAYORA takes nothing/)).toBeInTheDocument();
    expect(screen.queryByText(/paid out|service fee|simulated/i)).not.toBeInTheDocument();
  });
  it('explains when nothing has been paid yet', async () => {
    signIn('DRIVER');
    serve({ 'GET /earnings': () => json([]) });
    open('/earnings');

    expect(await screen.findByText(/Nothing yet\. Once a trip ends/)).toBeInTheDocument();
  });
});

describe('my account', () => {
  const mine = {
    email: 'user@example.test',
    emailVerified: false,
    phone: null,
    phoneVerified: false,
    bio: null,
    birthYear: null,
    gender: null,
    smoking: null,
    pets: null,
    music: null,
    chattiness: null,
  };
  const bodyOf = (fetchMock: ReturnType<typeof serve>, method: string, path: string) => {
    const call = fetchMock.mock.calls.find(([url, init]) => init?.method === method && String(url).endsWith(path));
    return JSON.parse(String(call?.[1]?.body ?? 'null'));
  };

  it('saves the whole profile, sending what was not said as nothing', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({
      'GET /me/profile': () => json(mine),
      'GET /me/emergency-contacts': () => json([]),
      'PUT /me/profile': () => json({ ...mine, phone: '+919800000001', smoking: false, chattiness: 'QUIET' }),
    });
    open('/account');

    await userEvent.type(await screen.findByLabelText('Phone number'), '+919800000001');
    await userEvent.selectOptions(screen.getByLabelText('Smoking in the car'), 'No, please');
    await userEvent.selectOptions(screen.getByLabelText('Conversation'), 'I prefer a quiet ride');
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByText('Your profile is saved.')).toBeInTheDocument();
    expect(bodyOf(fetchMock, 'PUT', '/me/profile')).toEqual({
      phone: '+919800000001',
      bio: '',
      birthYear: null,
      gender: null,
      smoking: false,
      pets: null,
      music: null,
      chattiness: 'QUIET',
    });
    // The saved number can now be confirmed.
    expect(within(screen.getByRole('region', { name: 'Email and phone' })).getByText('+919800000001')).toBeInTheDocument();
  });

  it('lets a driver say which identity document they hold, and nothing more, and take it back', async () => {
    signIn('DRIVER');
    const fetchMock = serve({
      'GET /me/profile': () => json(mine),
      'GET /me/emergency-contacts': () => json([]),
      'PUT /me/id-declaration': () => json({ ...mine, declaredId: 'DRIVING_LICENCE' }),
      'DELETE /me/id-declaration': () => json({ ...mine, declaredId: null }),
    });
    open('/account');

    const section = within(await screen.findByRole('region', { name: 'Identity document' }));
    expect(section.getByText(/never asks for its number or keeps a copy/)).toBeInTheDocument();
    expect(section.queryByRole('textbox')).not.toBeInTheDocument();
    await userEvent.selectOptions(section.getByRole('combobox'), 'Driving licence');
    await userEvent.click(section.getByRole('button', { name: 'Declare' }));

    expect(await section.findByText('You have declared: Driving licence.')).toBeInTheDocument();
    expect(bodyOf(fetchMock, 'PUT', '/me/id-declaration')).toEqual({ document: 'DRIVING_LICENCE' });
    await userEvent.click(section.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(section.queryByText(/You have declared/)).not.toBeInTheDocument());
  });

  it('offers a passenger no identity document to declare', async () => {
    signIn('PASSENGER');
    serve({ 'GET /me/profile': () => json(mine), 'GET /me/emergency-contacts': () => json([]) });
    open('/account');

    await screen.findByRole('region', { name: 'Email and phone' });
    expect(screen.queryByRole('region', { name: 'Identity document' })).not.toBeInTheDocument();
  });

  it('refuses a phone number that is not one without asking the server', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({ 'GET /me/profile': () => json(mine), 'GET /me/emergency-contacts': () => json([]) });
    open('/account');

    await userEvent.type(await screen.findByLabelText('Phone number'), '12345');
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByText('Enter 10 to 15 digits, with or without a + in front')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
  });

  it('confirms an email with a code and says plainly that no real email was sent', async () => {
    signIn('PASSENGER');
    let confirmed = false;
    const fetchMock = serve({
      'GET /me/profile': () => json({ ...mine, emailVerified: confirmed }),
      'GET /me/emergency-contacts': () => json([]),
      'POST /me/verification/email/request': () => new Response(null, { status: 204 }),
      'POST /me/verification/email/confirm': () => {
        confirmed = true;
        return new Response(null, { status: 204 });
      },
    });
    open('/account');

    const section = within(await screen.findByRole('region', { name: 'Email and phone' }));
    expect(section.getByText('Not confirmed')).toBeInTheDocument();
    expect(section.getByText('None given')).toBeInTheDocument(); // no phone: nothing to confirm
    await userEvent.click(section.getByRole('button', { name: 'Send me a code' }));

    expect(await section.findByText(/sends no real email or SMS/)).toBeInTheDocument();
    const confirm = section.getByRole('button', { name: 'Confirm' });
    await userEvent.type(section.getByLabelText('6-digit code'), '12a3');
    expect(confirm).toBeDisabled(); // letters are dropped and three digits are not a code
    await userEvent.type(section.getByLabelText('6-digit code'), '456');
    await userEvent.click(confirm);

    expect(await section.findByText('Confirmed')).toBeInTheDocument();
    expect(bodyOf(fetchMock, 'POST', '/me/verification/email/confirm')).toEqual({ code: '123456' });
  });

  it('confirms a phone number with its own code, leaving the confirmed email alone', async () => {
    signIn('PASSENGER');
    let confirmed = false;
    const fetchMock = serve({
      'GET /me/profile': () => json({ ...mine, emailVerified: true, phone: '+919800000009', phoneVerified: confirmed }),
      'GET /me/emergency-contacts': () => json([]),
      'POST /me/verification/phone/request': () => new Response(null, { status: 204 }),
      'POST /me/verification/phone/confirm': () => {
        confirmed = true;
        return new Response(null, { status: 204 });
      },
    });
    open('/account');

    const section = within(await screen.findByRole('region', { name: 'Email and phone' }));
    expect(await section.findByText('+919800000009')).toBeInTheDocument();
    // Only the phone needs confirming, so there is one button.
    await userEvent.click(section.getByRole('button', { name: 'Send me a code' }));
    expect(await section.findByText(/sends no real email or SMS/)).toBeInTheDocument();
    await userEvent.type(section.getByLabelText('6-digit code'), '654321');
    await userEvent.click(section.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(section.getAllByText('Confirmed')).toHaveLength(2));
    expect(bodyOf(fetchMock, 'POST', '/me/verification/phone/confirm')).toEqual({ code: '654321' });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/verification/email/'))).toBe(false);
  });

  it("shows the server's reason when a code is wrong", async () => {
    signIn('PASSENGER');
    serve({
      'GET /me/profile': () => json(mine),
      'GET /me/emergency-contacts': () => json([]),
      'POST /me/verification/email/request': () => new Response(null, { status: 204 }),
      'POST /me/verification/email/confirm': () => json({ detail: 'That code is not right' }, 400),
    });
    open('/account');

    await userEvent.click(await screen.findByRole('button', { name: 'Send me a code' }));
    await userEvent.type(await screen.findByLabelText('6-digit code'), '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That code is not right');
  });

  it('adds and removes emergency contacts, and stops offering more at three', async () => {
    signIn('DRIVER');
    let contacts: { id: number; name: string; phone: string; relation: string | null }[] = [
      { id: 1, name: 'Meera Patil', phone: '+919800000001', relation: 'Mother' },
      { id: 2, name: 'Sunil Patil', phone: '+919800000002', relation: null },
    ];
    const fetchMock = serve({
      'GET /me/profile': () => json(mine),
      'GET /me/emergency-contacts': () => json(contacts),
      'POST /me/emergency-contacts': () => {
        contacts = [...contacts, { id: 3, name: 'Neha', phone: '9800000003', relation: null }];
        return json(contacts[2], 201);
      },
      'DELETE /me/emergency-contacts/1': () => {
        contacts = contacts.filter((contact) => contact.id !== 1);
        return new Response(null, { status: 204 });
      },
    });
    open('/account');

    const section = within(await screen.findByRole('region', { name: 'Emergency contacts' }));
    expect(section.getByText(/they would NOT be messaged/)).toBeInTheDocument();
    await userEvent.type(await section.findByLabelText('Their name'), 'Neha');
    await userEvent.type(section.getByLabelText('Their phone number'), '98');
    await userEvent.click(section.getByRole('button', { name: 'Add contact' }));
    expect(await section.findByText('Enter 10 to 15 digits, with or without a + in front')).toBeInTheDocument();
    await userEvent.type(section.getByLabelText('Their phone number'), '00000003');
    await userEvent.click(section.getByRole('button', { name: 'Add contact' }));

    expect(await section.findByText('You can have at most 3 emergency contacts.')).toBeInTheDocument();
    expect(section.queryByLabelText('Their name')).not.toBeInTheDocument();
    expect(bodyOf(fetchMock, 'POST', '/me/emergency-contacts')).toEqual({ name: 'Neha', phone: '9800000003', relation: '' });

    await userEvent.click(section.getByRole('button', { name: 'Remove Meera Patil' }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false); // asks first
    // The question is asked in a dialog over the page, titled with what is being done.
    const ask = screen.getByRole('dialog', { name: 'Remove Meera Patil' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Yes, remove' }));
    expect(await section.findByLabelText('Their name')).toBeInTheDocument();
    expect(section.queryByText('Meera Patil')).not.toBeInTheDocument();
  });

  it('offers an administrator no emergency contacts and no emergency button', async () => {
    signIn('ADMIN');
    serve({ 'GET /me/profile': () => json(mine) });
    open('/account');

    expect(await screen.findByRole('region', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Emergency contacts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Emergency' })).not.toBeInTheDocument();
  });
});

describe('the emergency button', () => {
  const raised = { alertId: 5, contactsTold: 2, reallySent: false, emergencyNumber: '112' };

  it('puts calling 112 first and says that the contacts were not messaged', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({ 'GET /bookings': () => json([]), 'POST /sos': () => json(raised, 201) });
    open('/bookings');

    await userEvent.click(await screen.findByRole('button', { name: 'Emergency' }));
    const panel = within(screen.getByRole('region', { name: 'Emergency' }));
    expect(panel.getByText('If you are in danger, call 112 now.')).toBeInTheDocument();
    expect(panel.getByRole('link', { name: 'Call 112' })).toHaveAttribute('href', 'tel:112');
    expect(panel.getByText(/they are not an emergency service/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false); // opening sends nothing

    await userEvent.click(panel.getByRole('button', { name: 'Send an alert' }));

    expect(await panel.findByText(/your emergency contacts were NOT messaged/)).toBeInTheDocument();
    expect(panel.getByText('Your alert is recorded and the administrators can see it.')).toBeInTheDocument();
    expect(panel.getByRole('link', { name: 'Call 112' })).toBeInTheDocument(); // still there afterwards
    expect(panel.queryByRole('button', { name: 'Send an alert' })).not.toBeInTheDocument();
    await userEvent.click(panel.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('region', { name: 'Emergency' })).not.toBeInTheDocument();
  });

  it('sends the position when the device gives one, and still sends when it refuses', async () => {
    signIn('DRIVER');
    const fetchMock = serve({ 'GET /rides/mine': () => json([]), 'POST /sos': () => json(raised, 201) });
    let allow = true;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (ok: (found: unknown) => void, refused: () => void) =>
          allow ? ok({ coords: { latitude: 16.705, longitude: 74.2433 } }) : refused(),
      },
    });
    try {
      open('/rides');
      await userEvent.click(await screen.findByRole('button', { name: 'Emergency' }));
      await userEvent.click(screen.getByRole('button', { name: 'Send an alert' }));
      await screen.findByText(/were NOT messaged/);
      await userEvent.click(screen.getByRole('button', { name: 'Close' }));

      allow = false;
      await userEvent.click(screen.getByRole('button', { name: 'Emergency' }));
      await userEvent.click(screen.getByRole('button', { name: 'Send an alert' }));
      await screen.findByText(/were NOT messaged/);

      const bodies = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').map(([, init]) => JSON.parse(String(init?.body)));
      expect(bodies).toEqual([{ lat: 16.705, lon: 74.2433 }, {}]);
    } finally {
      Reflect.deleteProperty(navigator, 'geolocation');
    }
  });

  it('with real text messages, says how many contacts were told and tells the member to call any it missed', async () => {
    signIn('PASSENGER');
    serve({ 'GET /bookings': () => json([]),
      'POST /sos': () => json({ ...raised, reallySent: true, contactsTold: 2, contactsMissed: 1 }, 201) });
    open('/bookings');

    await userEvent.click(await screen.findByRole('button', { name: 'Emergency' }));
    await userEvent.click(screen.getByRole('button', { name: 'Send an alert' }));

    const panel = within(screen.getByRole('region', { name: 'Emergency' }));
    expect(await panel.findByText('A message was sent to 2 of your emergency contacts.')).toBeInTheDocument();
    expect(panel.getByText('1 of your emergency contacts could not be messaged. Call them yourself, or call 112.'))
      .toBeInTheDocument();
    expect(panel.queryByText(/were NOT messaged/)).not.toBeInTheDocument();
  });

  it("shows the server's reason if the alert could not be recorded, with 112 still on screen", async () => {
    signIn('PASSENGER');
    serve({ 'GET /bookings': () => json([]), 'POST /sos': () => json({ detail: 'Service unavailable' }, 503) });
    open('/bookings');

    await userEvent.click(await screen.findByRole('button', { name: 'Emergency' }));
    await userEvent.click(screen.getByRole('button', { name: 'Send an alert' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable');
    expect(screen.getByRole('link', { name: 'Call 112' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send an alert' })).toBeEnabled();
  });
});

describe('emergencies (administrator)', () => {
  const alert = {
    id: 5,
    userId: 7,
    userName: 'Asha Patil',
    userPhone: '+919800000009',
    rideId: null,
    lat: 16.705,
    lon: 74.2433,
    contactsTold: 2,
    sender: 'MOCK',
    status: 'OPEN',
    createdAt: '2026-11-02T06:00:00Z',
  };

  it('shows who, where and that nobody was messaged, and takes an alert off the queue', async () => {
    signIn('ADMIN');
    let waiting = [alert];
    serve({
      'GET /admin/sos': () => json(waiting),
      'POST /admin/sos/5/acknowledge': () => {
        waiting = [];
        return new Response(null, { status: 204 });
      },
      'GET /admin/mock-outbox': () =>
        json([{ channel: 'EMAIL', to: 'user@example.test', text: 'Your VAYORA verification code is 123456.', at: '2026-11-02T06:00:00Z' }]),
    });
    open('/admin/emergencies');

    expect(await screen.findByRole('link', { name: 'Asha Patil' })).toHaveAttribute('href', '/users/7');
    expect(screen.getByText('Phone: +919800000009')).toBeInTheDocument();
    expect(screen.getByText('Position given: 16.70500, 74.24330')).toBeInTheDocument();
    expect(screen.getByText('2 emergency contacts on file. They were NOT messaged: the sender is simulated.')).toBeInTheDocument();
    const outbox = within(screen.getByRole('region', { name: 'Simulated outbox' }));
    expect(await outbox.findByText('Your VAYORA verification code is 123456.')).toBeInTheDocument();
    expect(outbox.getByText(/None of these was sent to anyone/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Acknowledge' }));

    expect(await screen.findByText('No emergency is waiting.')).toBeInTheDocument();
  });

  it('is closed to members', async () => {
    signIn('PASSENGER');
    serve({});
    open('/admin/emergencies');

    expect(await screen.findByRole('heading', { name: 'Find a ride' })).toBeInTheDocument();
  });
});

describe('what a profile says about a member', () => {
  const profile = {
    id: 7,
    fullName: 'Ravi Jadhav',
    role: 'DRIVER',
    memberSince: '2026-01-05T00:00:00Z',
    completedTrips: 4,
    averageStars: null,
    ratingCount: 0,
    reviews: [],
    emailVerified: true,
    phoneVerified: false,
    bio: 'Drive to Pune every Friday.',
    age: 34,
    smoking: false,
    pets: null,
    music: true,
    chattiness: 'TALKATIVE',
  };

  it('shows only what they said, and never claims an identity check', async () => {
    signIn('PASSENGER');
    serve({ 'GET /users/7/profile': () => json(profile) });
    open('/users/7');

    const about = within(await screen.findByRole('list', { name: 'About this member' }));
    expect(about.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'About 34 years old',
      'Email confirmed',
      'No smoking',
      'Likes music on the way',
      'Likes to talk',
    ]);
    expect(screen.getByText('Drive to Pune every Friday.')).toBeInTheDocument();
    expect(screen.getByText('VAYORA has not checked any identity documents.')).toBeInTheDocument();
  });

  it('treats what the server left out as not said', async () => {
    signIn('PASSENGER');
    serve({
      'GET /users/7/profile': () =>
        json({ id: 7, fullName: 'Ravi Jadhav', role: 'DRIVER', memberSince: '2026-01-05T00:00:00Z', completedTrips: 4, averageStars: null, ratingCount: 0, reviews: [] }),
    });
    open('/users/7');

    await screen.findByText('VAYORA has not checked any identity documents.');
    expect(within(screen.getByRole('list', { name: 'About this member' })).queryAllByRole('listitem')).toEqual([]);
  });
});

describe('search filters', () => {
  const searches = (fetchMock: ReturnType<typeof serve>) =>
    fetchMock.mock.calls
      .map(([url]) => new URL(String(url)))
      .filter((url) => url.pathname.endsWith('/rides/search'))
      .map((url) => Object.fromEntries(url.searchParams));

  it('sends nothing extra until a filter is set, then only the ones that are', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({ 'GET /rides/search': () => json([{ ...candidate, driverConfirmed: true }]) });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
    expect(await screen.findByText(/Contact confirmed/)).toBeInTheDocument();
    expect(Object.keys(searches(fetchMock)[0]).sort()).toEqual(['date', 'destLat', 'destLon', 'originLat', 'originLon', 'seats', 'sort']);

    // The form steps aside for a one-line summary once searched; it comes back to change the search.
    await userEvent.click(screen.getByRole('button', { name: 'Change search' }));
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const filters = within(screen.getByRole('group', { name: 'Show only rides that' }));
    await userEvent.selectOptions(filters.getByLabelText('Leave in the'), 'Afternoon, 12 to 5');
    await userEvent.type(filters.getByLabelText('Cost at most, per seat (₹)'), '600');
    await userEvent.click(filters.getByLabelText('Confirm instantly'));
    await userEvent.click(filters.getByLabelText('Have a driver who said no smoking'));
    // Nothing is searched again until Search is pressed.
    expect(searches(fetchMock)).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(searches(fetchMock)).toHaveLength(2));
    expect(searches(fetchMock)[1]).toMatchObject({ earliestHour: '12', latestHour: '17', maxPrice: '600', instantOnly: 'true', smokeFree: 'true' });
    expect(searches(fetchMock)[1]).not.toHaveProperty('confirmedDriver');
    expect(searches(fetchMock)[1]).not.toHaveProperty('petsWelcome');
  });

  it('sends one bound for morning and evening, and keeps the filters when the order changes', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({ 'GET /rides/search': () => json([candidate]) });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Filters' }));
    await userEvent.selectOptions(screen.getByLabelText('Leave in the'), 'Evening, from 5');
    await userEvent.click(screen.getByLabelText('Have a driver with a confirmed email or phone'));
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await userEvent.click(await screen.findByRole('radio', { name: 'Lowest price' }));

    await waitFor(() => expect(searches(fetchMock)).toHaveLength(2));
    for (const sent of searches(fetchMock)) {
      expect(sent).toMatchObject({ earliestHour: '17', confirmedDriver: 'true' });
      expect(sent).not.toHaveProperty('latestHour');
    }
    expect(searches(fetchMock)[1].sort).toBe('PRICE');
    expect(screen.queryByText(/Contact confirmed/)).not.toBeInTheDocument(); // this driver has confirmed nothing
  });

  it('says the filters may be why nothing was found', async () => {
    signIn('PASSENGER');
    serve({ 'GET /rides/search': () => json([]) });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
    expect(await screen.findByText(/Try another date or other points/)).toBeInTheDocument();

    // The form steps aside for a one-line summary once searched; it comes back to change the search.
    await userEvent.click(screen.getByRole('button', { name: 'Change search' }));
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await userEvent.click(screen.getByLabelText('Have a driver who said pets are welcome'));
    expect(screen.getByText(/leave out drivers who have not said either way/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText(/Try fewer filters/)).toBeInTheDocument();
  });
});

describe('ride notes, return rides and weekly repeats', () => {
  it('says how many rides a return and weekly repeats will publish', async () => {
    signIn('DRIVER');
    serve({ 'GET /vehicles': () => json([{ id: 3, make: 'Maruti', model: 'Ertiga', year: 2022, colour: 'Silver', seats: 7 }]) });
    open('/rides/new');

    const repeat = await screen.findByLabelText('Repeat every week');
    expect(screen.queryByText(/This will publish/)).not.toBeInTheDocument(); // one ride needs no warning
    await userEvent.selectOptions(repeat, 'For 2 more weeks');
    expect(await screen.findByText('This will publish 3 rides.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Return ride leaving at (optional)'), { target: { value: '2030-01-01T18:00' } });
    expect(await screen.findByRole('status')).toHaveTextContent('This will publish 6 rides.');
    expect(screen.getByLabelText('I promise at most two passengers on the back seat')).not.toBeChecked();
    expect(screen.getByLabelText('Notes for passengers (optional)')).toHaveValue('');
  });

  it('shows the back-seat promise on a result and the driver\'s notes with the route, as text', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({
      'GET /rides/search': () => json([{ ...candidate, maxTwoInBack: true }]),
      'GET /rides/12': () => json({ ...rideWithRoute, notes: 'Two bags each. <b>No</b> smoking.', maxTwoInBack: true, seriesSize: 1 }),
    });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Filters' }));
    await userEvent.click(screen.getByLabelText('Promise at most two in the back'));
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText(/At most two in the back/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('maxTwoInBack=true'))).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Show route' }));
    expect(await screen.findByText('From the driver:')).toBeInTheDocument();
    expect(screen.getByText('Two bags each. <b>No</b> smoking.')).toBeInTheDocument(); // the tag is shown, not obeyed
  });
});

describe('my vehicles', () => {
  const plain = {
    id: 3, make: 'Maruti', model: 'Ertiga', year: 2022, colour: 'Silver', seats: 7,
    comfort: null, luggage: null, electric: false, batteryKwh: null, consumptionKwhPer100Km: null, estimatedRangeKm: null,
  };
  const ev = {
    id: 4, make: 'Tata', model: 'Nexon EV', year: null, colour: null, seats: 5,
    comfort: 'PREMIUM', luggage: 'MEDIUM', electric: true, batteryKwh: 40.5, consumptionKwhPer100Km: 15, estimatedRangeKm: 270,
  };

  it('adds an electric vehicle with what the driver says about it', async () => {
    signIn('DRIVER');
    let owned: unknown[] = [plain];
    const fetchMock = serve({
      'GET /vehicles': () => json(owned),
      'POST /vehicles': () => {
        owned = [plain, ev];
        return json(ev, 201);
      },
    });
    open('/vehicles');

    expect(await screen.findByText('Maruti Ertiga')).toBeInTheDocument();
    expect(screen.queryByText(/on a full charge/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Battery (kWh, optional)')).not.toBeInTheDocument(); // only for an electric vehicle

    await userEvent.type(screen.getByLabelText('Make'), 'Tata');
    await userEvent.type(screen.getByLabelText('Model'), 'Nexon EV');
    await userEvent.selectOptions(screen.getByLabelText('Comfort (optional)'), 'Premium');
    await userEvent.selectOptions(screen.getByLabelText('Luggage per passenger (optional)'), 'A medium bag each');
    await userEvent.click(screen.getByLabelText('This vehicle is electric'));
    await userEvent.type(screen.getByLabelText('Battery (kWh, optional)'), '40.5');
    await userEvent.type(screen.getByLabelText('Consumption (kWh per 100 km, optional)'), '15');
    await userEvent.click(screen.getByRole('button', { name: 'Add vehicle' }));

    expect(await screen.findByText('Premium · A medium bag each · Electric')).toBeInTheDocument();
    expect(screen.getByText('About 270 km on a full charge, from the figures you gave. Not a measured range.')).toBeInTheDocument();
    const sent = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(sent?.[1]?.body))).toEqual({
      make: 'Tata', model: 'Nexon EV', year: null, colour: null, seats: 5,
      comfort: 'PREMIUM', luggage: 'MEDIUM', electric: true, batteryKwh: 40.5, consumptionKwhPer100Km: 15,
    });
  });

  it('refuses an impossible battery without asking the server', async () => {
    signIn('DRIVER');
    const fetchMock = serve({ 'GET /vehicles': () => json([]) });
    open('/vehicles');

    await userEvent.type(await screen.findByLabelText('Make'), 'Tata');
    await userEvent.type(screen.getByLabelText('Model'), 'Nexon EV');
    await userEvent.click(screen.getByLabelText('This vehicle is electric'));
    await userEvent.type(screen.getByLabelText('Battery (kWh, optional)'), '900');
    await userEvent.click(screen.getByRole('button', { name: 'Add vehicle' }));

    expect(await screen.findByText('Between 1 and 300 kWh')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('tells a passenger what car a result is', async () => {
    signIn('PASSENGER');
    serve({ 'GET /rides/search': () => json([{ ...candidate, vehicle: 'Tata Nexon EV', comfort: 'COMFORT', luggage: 'SMALL', electric: true }]) });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Tata Nexon EV · Comfortable · A small bag each · Electric')).toBeInTheDocument();
  });
});

describe('holding seats', () => {
  const placed = { rideId: 12, fromSeq: 0, toSeq: 2, seats: 2, expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() };

  it('holds the seats searched for, says it is not a booking, and forgets the hold once booked', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({
      'GET /rides/search': () => json([candidate]),
      'POST /holds': () => json(placed, 201),
      'POST /bookings': () => json(booking, 201),
    });
    open('/search');

    await userEvent.clear(await screen.findByLabelText('Seats'));
    await userEvent.type(screen.getByLabelText('Seats'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Hold while I decide' }));

    expect(await screen.findByText(/Held for you until .*This is not a booking/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hold while I decide' })).not.toBeInTheDocument();
    const sent = fetchMock.mock.calls.find(([url, init]) => init?.method === 'POST' && String(url).endsWith('/holds'));
    expect(JSON.parse(String(sent?.[1]?.body))).toEqual({ rideId: 12, fromSeq: 0, toSeq: 2, seats: 2 });

    await userEvent.click(screen.getByRole('button', { name: 'Request' }));
    await waitFor(() => expect(screen.queryByText(/Held for you until/)).not.toBeInTheDocument());
  });

  it("shows the server's reason on the result when the seats cannot be held, and can still book", async () => {
    signIn('PASSENGER');
    serve({
      'GET /rides/search': () => json([candidate]),
      'POST /holds': () => json({ detail: 'Seats cannot be held right now. You can still book.' }, 503),
    });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Hold while I decide' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Seats cannot be held right now. You can still book.');
    expect(screen.getByRole('button', { name: 'Request' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Hold while I decide' })).toBeEnabled();
  });
});

describe('a request waiting for the driver', () => {
  it('says when it will be closed, and says nothing of the kind once it is answered', async () => {
    signIn('PASSENGER');
    serve({ 'GET /bookings': () => json([booking, { ...booking, id: 91, status: 'CONFIRMED' }]) });
    open('/bookings');

    const deadlines = await screen.findAllByText(/The driver has until .* to answer\. After that the request closes and you owe nothing\./);
    expect(deadlines).toHaveLength(1); // the pending one only
  });
});

describe('publishing a ride through the page', () => {
  const vehicle = { id: 3, make: 'Maruti', model: 'Ertiga', year: 2022, colour: 'Silver', seats: 7 };
  const published = { ...rideWithRoute, notes: null, maxTwoInBack: false, seriesSize: 1 };

  async function fillIn() {
    fireEvent.change(await screen.findByLabelText('Leaving at'), { target: { value: '2030-01-01T07:00' } });
    await userEvent.clear(screen.getByLabelText('Seats offered'));
    await userEvent.type(screen.getByLabelText('Seats offered'), '2');
    await userEvent.click(screen.getByLabelText('Confirm bookings instantly, without asking me'));
    await userEvent.click(screen.getByRole('button', { name: 'Add a stop on the way' }));
    await pickPlace('Stop on the way 1', 'Satara');
    await userEvent.clear(screen.getByLabelText('Price to Satara (₹)'));
    await userEvent.type(screen.getByLabelText('Price to Satara (₹)'), '270');
    await userEvent.clear(screen.getByLabelText('Price to Pune (₹)'));
    await userEvent.type(screen.getByLabelText('Price to Pune (₹)'), '250');
  }

  it('sends the stops, prices, seats and approval choice the driver entered, then shows their rides', async () => {
    signIn('DRIVER');
    const fetchMock = serve({
      'GET /vehicles': () => json([vehicle]),
      'POST /rides': () => json(published, 201),
      'GET /rides/mine': () => json([published]),
    });
    open('/rides/new');

    await fillIn();
    await userEvent.click(screen.getByRole('button', { name: 'Publish ride' }));

    expect(await screen.findByRole('heading', { name: 'My rides' })).toBeInTheDocument();
    const sent = fetchMock.mock.calls.find(([url, init]) => init?.method === 'POST' && new URL(String(url)).pathname.endsWith('/rides'));
    const body = JSON.parse(String(sent?.[1]?.body));
    expect(body).toMatchObject({
      vehicleId: 3,
      departureTime: new Date('2030-01-01T07:00').toISOString(),
      seatsOffered: 2,
      instantBooking: false,
      segmentPrices: [270, 250],
      returnDepartureTime: null,
      repeatWeeks: 0,
    });
    expect(body.stops.map((stop: { name: string }) => stop.name)).toEqual(['Kolhapur', 'Satara', 'Pune']);
    expect(body.stops[0].offsetMinutes).toBe(0);
  });

  it('sends the minutes the driver will go out of their way, and none unless they say', async () => {
    signIn('DRIVER');
    const fetchMock = serve({
      'GET /vehicles': () => json([vehicle]),
      'POST /rides': () => json(published, 201),
      'GET /rides/mine': () => json([published]),
    });
    open('/rides/new');

    await fillIn();
    const field = screen.getByLabelText('Minutes you will go out of your way, in all, to pick passengers up at their own point');
    expect(field).toHaveValue(0);
    await userEvent.clear(field);
    await userEvent.type(field, '10');
    await userEvent.click(screen.getByRole('button', { name: 'Publish ride' }));

    await screen.findByRole('heading', { name: 'My rides' });
    const sent = fetchMock.mock.calls.find(([url, init]) => init?.method === 'POST' && new URL(String(url)).pathname.endsWith('/rides'));
    expect(JSON.parse(String(sent?.[1]?.body))).toMatchObject({ maxDetourMinutes: 10 });
  });

  it('publishes a ride between any two places, with a stop added and another taken away', async () => {
    signIn('DRIVER');
    const fetchMock = serve({
      'GET /vehicles': () => json([vehicle]),
      'POST /rides': () => json(published, 201),
      'GET /rides/mine': () => json([published]),
    });
    open('/rides/new');

    fireEvent.change(await screen.findByLabelText('Leaving at'), { target: { value: '2030-01-01T07:00' } });
    await pickPlace('From', 'Mumbai');
    await pickPlace('To', 'Panaji');
    await userEvent.click(screen.getByRole('button', { name: 'Add a stop on the way' }));
    await pickPlace('Stop on the way 1', 'Pune');
    await userEvent.click(screen.getByRole('button', { name: 'Add a stop on the way' }));
    await pickPlace('Stop on the way 2', 'Ratnagiri');
    await userEvent.click(screen.getAllByRole('button', { name: 'Remove this stop' })[0]);
    expect(screen.queryByLabelText('Stop on the way 2')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Price to Ratnagiri (₹)'), '500');
    await userEvent.type(screen.getByLabelText('Price to Panaji (₹)'), '400');
    await userEvent.click(screen.getByRole('button', { name: 'Publish ride' }));

    await screen.findByRole('heading', { name: 'My rides' });
    const sent = fetchMock.mock.calls.find(([url, init]) => init?.method === 'POST' && new URL(String(url)).pathname.endsWith('/rides'));
    const body = JSON.parse(String(sent?.[1]?.body));
    expect(body.stops.map((stop: { name: string }) => stop.name)).toEqual(['Mumbai', 'Ratnagiri', 'Panaji']);
    expect(body.stops[0]).toMatchObject({ lat: 19.076, lon: 72.8777, offsetMinutes: 0 });
    // Each later than the one before, or the server refuses the ride.
    expect(body.stops[1].offsetMinutes).toBeGreaterThan(0);
    expect(body.stops[2].offsetMinutes).toBeGreaterThan(body.stops[1].offsetMinutes);
    expect(body.segmentPrices).toEqual([500, 400]);
  });

  it('will not publish until a stop that was added has a place', async () => {
    signIn('DRIVER');
    const fetchMock = serve({ 'GET /vehicles': () => json([vehicle]) });
    open('/rides/new');

    fireEvent.change(await screen.findByLabelText('Leaving at'), { target: { value: '2030-01-01T07:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Add a stop on the way' }));
    await userEvent.click(screen.getByRole('button', { name: 'Publish ride' }));

    expect(await screen.findByText('Choose a place', { selector: 'p, span, [role="alert"]' })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('forgets a worked-out route when a stop changes', async () => {
    signIn('DRIVER');
    serve({
      'GET /vehicles': () => json([vehicle]),
      'POST /rides/route-preview': () =>
        json({ distanceKm: 230, durationMinutes: 191, source: 'OSRM', alongRoute: [],
          legs: [{ distanceKm: 230, durationMinutes: 191, suggestedPrice: 460 }], path: [[16.705, 74.2433], [18.5204, 73.8567]] }),
    });
    open('/rides/new');

    await userEvent.click(await screen.findByRole('button', { name: 'Work out the route' }));
    expect(await screen.findByText('230 km by road, about 3 h 11 min of driving.')).toBeInTheDocument();

    await pickPlace('To', 'Chennai');
    expect(screen.queryByText(/230 km by road/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use the suggested prices and times' })).not.toBeInTheDocument();
  });

  it("keeps the form and shows the server's reason when publishing is refused", async () => {
    signIn('DRIVER');
    serve({
      'GET /vehicles': () => json([vehicle]),
      'POST /rides': () => json({ detail: 'This vehicle can offer at most 6 seats' }, 400),
    });
    open('/rides/new');

    await fillIn();
    await userEvent.click(screen.getByRole('button', { name: 'Publish ride' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This vehicle can offer at most 6 seats');
    expect(screen.getByRole('heading', { name: 'Publish a ride' })).toBeInTheDocument();
    expect(screen.getByLabelText('Price to Satara (₹)')).toHaveValue(270);
  });
});

describe('running a ride from my rides', () => {
  const posted = (fetchMock: ReturnType<typeof serve>) =>
    fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').map(([url]) => new URL(String(url)).pathname.replace('/api/v1', ''));

  it('accepts one request and declines another', async () => {
    signIn('DRIVER');
    let requests = [booking, { ...booking, id: 91, passengerName: 'Meera Kulkarni', passengerId: 5 }];
    const decide = (id: number, status: string) => () => {
      requests = requests.map((b) => (b.id === id ? { ...b, status: status as Booking['status'] } : b));
      return json(requests.find((b) => b.id === id));
    };
    const fetchMock = serve({
      'GET /rides/mine': () => json([{ ...rideWithRoute, notes: null, maxTwoInBack: false, seriesSize: 1 }]),
      'GET /rides/12/bookings': () => json(requests),
      'POST /bookings/90/accept': decide(90, 'CONFIRMED'),
      'POST /bookings/91/reject': decide(91, 'REJECTED'),
    });
    open('/rides');

    // Leaving within a day: who is coming shows from the start.
    expect(await screen.findByRole('button', { name: 'Hide passengers' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Asha Patil' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Accept' })).toHaveLength(2);

    await userEvent.click(screen.getAllByRole('button', { name: 'Accept' })[0]);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Accept' })).toHaveLength(1));
    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Decline' })).not.toBeInTheDocument());

    expect(posted(fetchMock)).toEqual(['/bookings/90/accept', '/bookings/91/reject']);
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Declined by the driver')).toBeInTheDocument();
  });

  it('starts the ride, marks a no-show and completes only after confirming each irreversible step', async () => {
    signIn('DRIVER');
    let ride = { ...rideWithRoute, instantBooking: true, notes: null, maxTwoInBack: false, seriesSize: 1 };
    let aboard = [{ ...booking, status: 'CONFIRMED' as Booking['status'] }];
    const fetchMock = serve({
      'GET /rides/mine': () => json([ride]),
      'GET /rides/12/bookings': () => json(aboard),
      'POST /rides/12/start': () => {
        ride = { ...ride, status: 'IN_PROGRESS' };
        return json(ride);
      },
      'POST /bookings/90/no-show': () => {
        aboard = [{ ...aboard[0], status: 'NO_SHOW' }];
        return json(aboard[0]);
      },
      'POST /rides/12/complete': () => {
        ride = { ...ride, status: 'COMPLETED' };
        return json(ride);
      },
    });
    open('/rides');

    await userEvent.click(await screen.findByRole('button', { name: 'Start ride' }));
    // Leaving within a day: who is coming shows from the start.
    expect(await screen.findByRole('button', { name: 'Hide passengers' })).toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: 'Did not board' }));
    expect(posted(fetchMock)).toEqual(['/rides/12/start']); // asks first
    await userEvent.click(screen.getByRole('button', { name: 'Yes, mark as no-show' }));
    expect(await screen.findByText('Did not board')).toBeInTheDocument(); // now the status, not a button

    await userEvent.click(screen.getByRole('button', { name: 'Complete ride' }));
    expect(posted(fetchMock)).toEqual(['/rides/12/start', '/bookings/90/no-show']);
    await userEvent.click(screen.getByRole('button', { name: 'Yes, we have arrived' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Complete ride' })).not.toBeInTheDocument());

    expect(posted(fetchMock)).toEqual(['/rides/12/start', '/bookings/90/no-show', '/rides/12/complete']);
  });
});

describe('payments (passenger)', () => {
  const payment = {
    bookingId: 90, fromStop: 'Kolhapur', toStop: 'Pune', fare: 520, status: 'SETTLED', amountDue: 520, dueReason: 'TRIP_COMPLETED',
    method: 'UPI', createdAt: '2026-10-30T10:00:00Z', paidAt: '2026-10-31T10:00:00Z',
  };
  const open_ = { amountDue: null, dueReason: null, method: null, paidAt: null };

  it('lists where each booking stands and what was paid to drivers', async () => {
    signIn('PASSENGER');
    serve({
      'GET /payments': () =>
        json([
          { ...payment, ...open_, bookingId: 93, status: 'DEFERRED' },
          { ...payment, ...open_, bookingId: 92, status: 'VOID' },
          { ...payment, ...open_, bookingId: 91, status: 'DUE', amountDue: 260, dueReason: 'PASSENGER_CANCELLED' },
          payment,
        ]),
    });
    open('/payments');

    expect(await screen.findByText('Paid to your drivers')).toBeInTheDocument();
    expect(screen.getByText('₹520 paid · UPI')).toBeInTheDocument();
    expect(screen.getByText('₹260 owed to your driver')).toBeInTheDocument();
    expect(screen.getByText('Nothing owed')).toBeInTheDocument();
    expect(screen.getByText('Pay after the ride')).toBeInTheDocument();
    expect(screen.getByText(/You owe ₹260\. You can book again once your driver marks it paid\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See My bookings' })).toHaveAttribute('href', '/bookings');
    // Only what is paid has a receipt.
    expect(screen.getAllByRole('link', { name: 'View or print receipt' })).toHaveLength(1);
    expect(screen.queryByText(/service fee|simulated/i)).not.toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Payments' })).toHaveAttribute('href', '/payments');
    expect(within(screen.getByRole('navigation', { name: 'Main' })).queryByRole('link', { name: 'Passes' })).not.toBeInTheDocument();
  });

  it('says so when nothing has been booked', async () => {
    signIn('PASSENGER');
    serve({ 'GET /payments': () => json([]) });
    open('/payments');
    expect(await screen.findByText('You have not booked anything yet.')).toBeInTheDocument();
  });
});
describe('women-only rides', () => {
  const vehicle = { id: 3, make: 'Maruti', model: 'Ertiga', year: 2022, colour: 'Silver', seats: 7 };

  it('lets a driver whose profile says she is a woman offer one, and sends the choice', async () => {
    signIn('DRIVER');
    const fetchMock = serve({
      'GET /me/profile': () => json({ gender: 'FEMALE' }),
      'GET /vehicles': () => json([vehicle]),
      'POST /rides': () => json({ ...rideWithRoute, notes: null, maxTwoInBack: false, seriesSize: 1, womenOnly: true }, 201),
      'GET /rides/mine': () => json([{ ...rideWithRoute, notes: null, maxTwoInBack: false, seriesSize: 1, womenOnly: true }]),
    });
    open('/rides/new');

    fireEvent.change(await screen.findByLabelText('Leaving at'), { target: { value: '2030-01-01T07:00' } });
    await userEvent.click(await screen.findByLabelText('Women passengers only'));
    // A price starts empty: a free ride is something the driver types, never what they leave.
    await userEvent.type(screen.getByLabelText('Price to Pune (₹)'), '450');
    await userEvent.click(screen.getByRole('button', { name: 'Publish ride' }));

    expect(await screen.findByText('Women only')).toBeInTheDocument();
    const sent = fetchMock.mock.calls.find(([url, init]) => init?.method === 'POST' && new URL(String(url)).pathname.endsWith('/rides'));
    expect(JSON.parse(String(sent?.[1]?.body)).womenOnly).toBe(true);
  });

  it('explains instead of offering it to any other driver', async () => {
    signIn('DRIVER');
    serve({ 'GET /vehicles': () => json([vehicle]) });
    open('/rides/new');

    expect(await screen.findByText(/can be offered by a driver whose profile says she is a woman/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Women passengers only')).not.toBeInTheDocument();
  });

  it('offers a woman passenger the filter and marks women-only results', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({
      'GET /me/profile': () => json({ gender: 'FEMALE' }),
      'GET /rides/search': () => json([{ ...candidate, womenOnly: true }]),
    });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Filters' }));
    await userEvent.click(await screen.findByLabelText('Are for women only'));
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText(/Women only/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('womenOnly=true'))).toBe(true);
  });

  it('does not offer the filter to anyone else', async () => {
    signIn('PASSENGER');
    serve({});
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Filters' }));
    expect(screen.queryByLabelText('Are for women only')).not.toBeInTheDocument();
  });
});

describe('receipts', () => {
  const paidFor = {
    bookingId: 90, fromStop: 'Kolhapur', toStop: 'Pune', fare: 900, status: 'SETTLED', amountDue: 450, dueReason: 'PASSENGER_CANCELLED',
    method: 'UPI', createdAt: '2026-10-25T10:00:00Z', paidAt: '2026-10-27T10:00:00Z',
  };

  it('downloads a receipt with the session token and saves it under its name', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({
      'GET /payments': () => json([paidFor]),
      'GET /bookings/90/receipt': () => new Response(new Blob(['%PDF-1.4']), { status: 200, headers: { 'Content-Type': 'application/pdf' } }),
    });
    // jsdom has neither, so they are put in for this test and taken out after it.
    const revoked = vi.fn();
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:receipt'), revokeObjectURL: revoked });
    const clicked: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.download);
    });
    try {
      open('/payments');
      await userEvent.click(await screen.findByRole('button', { name: 'Download receipt (PDF, in English)' }));

      await waitFor(() => expect(clicked).toEqual(['vayora-booking-90.pdf']));
      const asked = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/bookings/90/receipt'));
      expect((asked?.[1]?.headers as Record<string, string>).Authorization).toBe('Bearer token');
      expect(revoked).toHaveBeenCalledWith('blob:receipt');
    } finally {
      click.mockRestore();
      Reflect.deleteProperty(URL, 'createObjectURL');
      Reflect.deleteProperty(URL, 'revokeObjectURL');
    }
  });

  it('says so when the receipt cannot be downloaded', async () => {
    signIn('PASSENGER');
    serve({
      'GET /bookings/90/receipt': () => json({ detail: 'No receipt for that booking' }, 404),
      'GET /payments': () => json([paidFor]),
    });
    open('/payments');

    await userEvent.click(await screen.findByRole('button', { name: 'Download receipt (PDF, in English)' }));
    expect(await screen.findByText('The receipt could not be downloaded. Try again.')).toBeInTheDocument();
  });
  /** As `open`, in a language other than English. */
  function openIn(path: string, language: Language) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <LanguageProvider initial={language}>
        <QueryClientProvider client={client}>
          <AuthProvider>
            <MemoryRouter initialEntries={[path]}>
              <AppRoutes />
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      </LanguageProvider>,
    );
  }

  const receipt = {
    bookingId: 90, passenger: 'आशा पाटील', driver: 'Ravi Jadhav', fromStop: 'Kolhapur', toStop: 'Pune', seats: 2,
    boarding: '2026-10-30T04:30:00Z', status: 'CANCELLED', paidAt: '2026-10-27T10:00:00Z', method: 'UPI',
    fare: 900, paid: 450, reason: 'PASSENGER_CANCELLED',
  };

  it('opens a receipt from the payments page, saying the driver was paid directly and it is no tax invoice', async () => {
    signIn('PASSENGER');
    serve({
      'GET /payments': () => json([paidFor]),
      'GET /bookings/90/receipt-data': () => json(receipt),
    });
    open('/payments');

    await userEvent.click(await screen.findByRole('link', { name: 'View or print receipt' }));

    expect(await screen.findByRole('heading', { name: 'Receipt for booking 90' })).toBeInTheDocument();
    expect(await screen.findByText('Kolhapur to Pune, 2 seats')).toBeInTheDocument();
    expect(screen.getByText('27 Oct 2026, 3:30 pm, by UPI')).toBeInTheDocument();
    expect(screen.getByText('Cancelling late')).toBeInTheDocument();
    expect(screen.getByText('₹900.00')).toBeInTheDocument();
    expect(screen.getByText('₹450.00')).toBeInTheDocument();
    expect(screen.getByText('Paid directly to the driver, as the driver recorded it. VAYORA took no part of it and charged nothing.')).toBeInTheDocument();
    expect(screen.getByText('This is not a tax invoice.')).toBeInTheDocument();
  });
  it('shows a receipt in the reader language with names as written, and prints it from the browser', async () => {
    signIn('PASSENGER');
    serve({ 'GET /bookings/90/receipt-data': () => json(receipt) });
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    try {
      openIn('/receipts/booking/90', 'mr');

      expect(await screen.findByRole('heading', { name: 'बुकिंग 90 ची पावती' })).toBeInTheDocument();
      // The PDF's fonts would print this name as "??? ?????".
      expect(await screen.findByText('आशा पाटील')).toBeInTheDocument();
      expect(screen.getByText('कोल्हापूर ते पुणे, 2 जागा')).toBeInTheDocument();
      expect(screen.getByText('रद्द')).toBeInTheDocument();
      expect(screen.getByText('उशिरा रद्द करणे')).toBeInTheDocument();
      expect(screen.getByText(/^थेट चालकाला दिले/)).toBeInTheDocument();
      expect(screen.getByText('हे कर बीजक (टॅक्स इनव्हॉइस) नाही.')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'छापा किंवा PDF म्हणून जतन करा' }));
      expect(print).toHaveBeenCalledOnce();
    } finally {
      print.mockRestore();
      setFormatLanguage('en');
      document.documentElement.lang = '';
    }
  });

  it('says why a receipt cannot be shown', async () => {
    signIn('PASSENGER');
    serve({ 'GET /bookings/91/receipt-data': () => json({ detail: 'No receipt for that booking' }, 404) });
    open('/receipts/booking/91');

    expect(await screen.findByText('No receipt for that booking')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Print or save as PDF' })).not.toBeInTheDocument();
  });
});

describe("a driver's response rate", () => {
  const driverProfile = {
    id: 7, fullName: 'Ravi Jadhav', role: 'DRIVER', memberSince: '2026-01-05T00:00:00Z', completedTrips: 4,
    averageStars: null, ratingCount: 0, reviews: [], emailVerified: false, phoneVerified: false, bio: null,
    age: null, smoking: null, pets: null, music: null, chattiness: null,
  };

  it('shows the share answered and the typical time', async () => {
    signIn('PASSENGER');
    serve({ 'GET /users/7/profile': () => json({ ...driverProfile, responseRate: 0.6667, responseMinutes: 45 }) });
    open('/users/7');
    expect(await screen.findByText('67%, usually within 45 min')).toBeInTheDocument();
  });

  it('says when there are too few requests to tell, and shows nothing of the kind for a passenger', async () => {
    signIn('PASSENGER');
    serve({
      'GET /users/7/profile': () => json({ ...driverProfile, responseRate: null, responseMinutes: null }),
    });
    open('/users/7');
    expect(await screen.findByText('Not enough requests yet')).toBeInTheDocument();
  });
});

describe('boarding codes', () => {
  it('shows a passenger their reference and code when asked', async () => {
    signIn('PASSENGER');
    serve({
      'GET /bookings/90/boarding-pass': () => json({ bookingId: 90, reference: 'JX-000090', code: '4821' }),
      'GET /bookings': () => json([{ ...booking, status: 'CONFIRMED' }]),
    });
    open('/bookings');

    await userEvent.click(await screen.findByRole('button', { name: 'Show my boarding code' }));
    expect(await screen.findByText('4821')).toBeInTheDocument();
    expect(screen.getByText(/Reference JX-000090/)).toBeInTheDocument();
  });

  it('lets a driver check a code without ever being sent it', async () => {
    signIn('DRIVER');
    const fetchMock = serve({
      'GET /rides/mine': () => json([{ ...rideWithRoute, notes: null, maxTwoInBack: false, seriesSize: 1, womenOnly: false }]),
      'GET /rides/12/bookings': () => json([{ ...booking, status: 'CONFIRMED' }]),
      'POST /bookings/90/check-code': () => json({ matches: false }),
    });
    open('/rides');

    // Leaving within a day: who is coming shows from the start.
    expect(await screen.findByRole('button', { name: 'Hide passengers' })).toBeInTheDocument();
    const input = await screen.findByLabelText('Boarding code shown by the passenger');
    await userEvent.type(input, '48a21');
    expect(input).toHaveValue('4821'); // digits only, four at most
    await userEvent.click(screen.getByRole('button', { name: 'Check code' }));

    expect(await screen.findByText('Does not match this booking')).toBeInTheDocument();
    const sent = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/check-code'));
    expect(JSON.parse(String(sent?.[1]?.body))).toEqual({ code: '4821' });
  });
});

describe('after a trip', () => {
  it('asks the passenger whether a completed trip happened, once, and sends the answer', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({
      'POST /bookings/90/trip-confirmation': () => new Response(null, { status: 204 }),
      'GET /bookings': () => json([{ ...booking, status: 'COMPLETED', passengerRated: true, passengerConfirmed: null }]),
    });
    open('/bookings');

    await userEvent.click(await screen.findByRole('button', { name: 'No, it did not happen' }));

    expect(await screen.findByText(/An administrator will look into it/)).toBeInTheDocument();
    const sent = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/trip-confirmation'));
    expect(JSON.parse(String(sent?.[1]?.body))).toEqual({ travelled: false });
  });

  it('does not ask again once answered', async () => {
    signIn('PASSENGER');
    serve({ 'GET /bookings': () => json([{ ...booking, status: 'COMPLETED', passengerRated: true, passengerConfirmed: true }]) });
    open('/bookings');

    expect(await screen.findByText('Completed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Yes, I travelled' })).not.toBeInTheDocument();
  });

  it('lists disputed trips for administrators', async () => {
    signIn('ADMIN');
    serve({
      'GET /admin/disputed-trips': () =>
        json([{ bookingId: 90, passengerId: 1, passengerName: 'Meera Kulkarni', driverId: 7, driverName: 'Ravi Jadhav',
          fromStop: 'Kolhapur', toStop: 'Pune', boardingTime: '2026-11-02T01:30:00Z', disputedAt: '2026-11-03T08:00:00Z' }]),
    });
    open('/admin/disputes');

    expect(await screen.findByRole('link', { name: 'Ravi Jadhav' })).toHaveAttribute('href', '/users/7');
    expect(screen.getByText(/Nothing has been reversed/)).toBeInTheDocument();
  });
});

describe('more search filters', () => {
  it('sends a price floor, preferences and car minimums only when set', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({ 'GET /rides/search': () => json([candidate]) });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Filters' }));
    await userEvent.type(screen.getByLabelText('Cost at least, per seat (₹)'), '300');
    await userEvent.selectOptions(screen.getByLabelText('Comfort at least'), 'Comfortable');
    await userEvent.selectOptions(screen.getByLabelText('Room for luggage, at least'), 'A medium bag each');
    await userEvent.click(screen.getByLabelText('Have a driver who prefers a quiet ride'));
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/rides/search'))).toBe(true));
    const sent = new URL(String(fetchMock.mock.calls.find(([url]) => String(url).includes('/rides/search'))![0]));
    expect(Object.fromEntries(sent.searchParams)).toMatchObject({
      minPrice: '300', comfortAtLeast: 'COMFORT', luggageAtLeast: 'MEDIUM', quietRide: 'true',
    });
    expect(sent.searchParams.has('musicWelcome')).toBe(false);
  });
});

describe('levels and the driver record', () => {
  it("shows a member's level on their profile", async () => {
    signIn('PASSENGER');
    serve({
      'GET /users/7/profile': () =>
        json({ id: 7, fullName: 'Ravi Jadhav', role: 'DRIVER', memberSince: '2026-01-05T00:00:00Z', completedTrips: 12,
          averageStars: 4.3, ratingCount: 5, reviews: [], emailVerified: true, phoneVerified: false, bio: null, age: null,
          smoking: null, pets: null, music: null, chattiness: null, level: 'EXPERIENCED' }),
    });
    open('/users/7');
    expect(await screen.findByText('Experienced')).toBeInTheDocument();
  });

  it('shows a driver their own record', async () => {
    signIn('DRIVER');
    serve({
      'GET /me/reliability': () =>
        json({ ridesCompleted: 4, ridesWithdrawn: 1, passengersCarried: 9, passengersCancelled: 2, noShowsMarked: 1,
          averageStars: null, ratingCount: 0, responseRate: null, responseMinutes: null, level: 'NEWCOMER' }),
    });
    open('/record');

    expect(await screen.findByText('Rides you withdrew')).toBeInTheDocument();
    expect(screen.getByText('Newcomer')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText(/Only you see this page/)).toBeInTheDocument();
  });
});

describe('notification preferences', () => {
  const mine = {
    email: 'user@example.test', emailVerified: true, phone: null, phoneVerified: false, bio: null, birthYear: null,
    gender: null, smoking: null, pets: null, music: null, chattiness: null,
  };

  it('saves a choice, says copies are simulated, and warns about an unconfirmed phone', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({
      'GET /me/profile': () => json(mine),
      'GET /me/emergency-contacts': () => json([]),
      'PUT /notifications/preferences': () => json({ email: false, sms: true }),
    });
    open('/account');

    const section = within(await screen.findByRole('region', { name: 'Notifications' }));
    expect(await section.findByText(/no email or SMS is really sent/)).toBeInTheDocument();
    await userEvent.click(section.getByLabelText('Text me a copy'));

    expect(await section.findByText('Confirm your phone number above, or no copy can be sent.')).toBeInTheDocument();
    const sent = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT' && true);
    expect(JSON.parse(String(sent?.[1]?.body))).toEqual({ email: false, sms: true });
  });
});

describe('series and the back-office browser', () => {
  it('cancels a whole series only after confirming, and says what happened', async () => {
    signIn('DRIVER');
    const fetchMock = serve({
      'GET /rides/mine': () => json([{ ...rideWithRoute, notes: null, maxTwoInBack: false, seriesSize: 4, womenOnly: false }]),
      'POST /rides/12/cancel-series': () => json({ withdrawn: 4 }),
    });
    open('/rides');

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel every ride in this series' }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel them all' }));

    expect(await screen.findByText('4 rides cancelled. Every passenger has been told, and owes nothing.')).toBeInTheDocument();
  });

  it('offers no series button on a ride published alone', async () => {
    signIn('DRIVER');
    serve({ 'GET /rides/mine': () => json([{ ...rideWithRoute, notes: null, maxTwoInBack: false, seriesSize: 1, womenOnly: false }]) });
    open('/rides');
    await screen.findByRole('button', { name: 'Cancel ride' });
    expect(screen.queryByRole('button', { name: 'Cancel every ride in this series' })).not.toBeInTheDocument();
  });

  it('lets an administrator browse rides and bookings by status', async () => {
    signIn('ADMIN');
    const fetchMock = serve({
      'GET /admin/rides': () =>
        json([{ id: 12, driverName: 'Ravi Jadhav', driverId: 7, departureTime: '2026-11-02T01:30:00Z', status: 'SCHEDULED',
          seatsOffered: 3, bookings: 1, fromStop: 'Kolhapur', toStop: 'Pune' }]),
    });
    open('/admin/rides');

    expect(await screen.findByText('3 seats offered, 1 bookings', { exact: false })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Scheduled');
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/admin/rides?status=SCHEDULED'))).toBe(true));
  });
});

describe('invitations', () => {
  it('shows the code and who used it', async () => {
    signIn('PASSENGER');
    serve({
      'GET /me/profile': () => json({ email: 'user@example.test', emailVerified: false, phone: null, phoneVerified: false,
        bio: null, birthYear: null, gender: null, smoking: null, pets: null, music: null, chattiness: null }),
      'GET /me/emergency-contacts': () => json([]),
      'GET /me/referral': () => json({ code: 'K7QX2M', signedUp: 3, qualified: 1 }),
    });
    open('/account');

    const section = within(await screen.findByRole('region', { name: 'Invite friends' }));
    expect(await section.findByText('K7QX2M')).toBeInTheDocument();
    expect(section.getByText('3 signed up with it; 1 of them have completed a trip.')).toBeInTheDocument();
    expect(section.queryByText(/reward|free|pass/i)).not.toBeInTheDocument();
  });
});

describe('bus services', () => {
  const bus = { id: 4, operator: 'Test Operator', fromStop: 'Kolhapur', toStop: 'Pune', departs: '15:30:00',
    durationMinutes: 300, fare: 350, notes: null };

  it('offers listed buses when no ride matches, and says they are not checked', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({ 'GET /rides/search': () => json([]), 'GET /bus-alternatives': () => json([bus]) });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
    const section = within(await screen.findByRole('region', { name: 'Buses instead' }));
    expect(section.getByText('15:30')).toBeInTheDocument();
    expect(section.getByText(/Check times and fares with the operator/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/bus-alternatives?from=Kolhapur&to=Pune'))).toBe(true);
  });

  it('shows nothing about buses when none are listed', async () => {
    signIn('PASSENGER');
    serve({ 'GET /rides/search': () => json([]) });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
    await screen.findByText(/No rides have a stop near both ends/);
    expect(screen.queryByRole('region', { name: 'Buses instead' })).not.toBeInTheDocument();
  });

  it('lets an administrator add a bus service and remove one after confirming', async () => {
    signIn('ADMIN');
    const fetchMock = serve({
      'GET /admin/bus-services': () => json([bus]),
      'POST /admin/bus-services': () => json(bus, 201),
      'DELETE /admin/bus-services/4': () => new Response(null, { status: 204 }),
    });
    open('/admin/buses');

    await userEvent.type(await screen.findByLabelText('Operator'), 'Test Operator');
    await userEvent.type(screen.getByLabelText('Leaves at'), '15:30');
    await userEvent.type(screen.getByLabelText('From'), 'Kolhapur');
    await userEvent.type(screen.getByLabelText('To'), 'Pune');
    await userEvent.type(screen.getByLabelText('Journey time in minutes'), '300');
    await userEvent.type(screen.getByLabelText('Fare in rupees'), '350');
    await userEvent.click(screen.getByRole('button', { name: 'Add bus service' }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
      expect(JSON.parse(String(post?.[1]?.body))).toEqual({ operator: 'Test Operator', fromStop: 'Kolhapur', toStop: 'Pune',
        departs: '15:30', durationMinutes: 300, fare: 350, notes: null });
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Yes, remove it' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true));
  });
});

describe('electric range', () => {
  const preview = () =>
    json({ distanceKm: 230, durationMinutes: 191, source: 'OSRM', alongRoute: [], legs: [{ distanceKm: 230, durationMinutes: 191, suggestedPrice: 460 }],
      path: [[16.705, 74.2433], [18.5204, 73.8567]] });
  const ev = (rangeKm: number) => ({ id: 3, make: 'Tata', model: 'Nexon EV', year: 2023, colour: 'Blue', seats: 5,
    electric: true, batteryKwh: 30, consumptionKwhPer100Km: 15, estimatedRangeKm: rangeKm });

  it('tells a driver a stretch longer than their stated range cannot be published, and which', async () => {
    signIn('DRIVER');
    serve({ 'GET /vehicles': () => json([ev(200)]), 'POST /rides/route-preview': preview });
    open('/rides/new');

    await userEvent.click(await screen.findByRole('button', { name: 'Work out the route' }));
    expect(await screen.findByText(/Kolhapur to Pune is 230 km, longer than the 200 km your vehicle covers on a full charge/))
      .toHaveTextContent('cannot be published: add a stop between them where you can charge');
  });

  it('only warns when the route is longer than the range but every stretch fits', async () => {
    signIn('DRIVER');
    serve({
      'GET /vehicles': () => json([ev(200)]),
      'POST /rides/route-preview': () =>
        json({ distanceKm: 230, durationMinutes: 191, source: 'OSRM', alongRoute: [],
          legs: [{ distanceKm: 120, durationMinutes: 100, suggestedPrice: 240 }, { distanceKm: 110, durationMinutes: 91, suggestedPrice: 220 }],
          path: [[16.705, 74.2433], [17.6805, 74.0183], [18.5204, 73.8567]] }),
    });
    open('/rides/new');

    await userEvent.click(await screen.findByRole('button', { name: 'Add a stop on the way' }));
    await pickPlace('Stop on the way 1', 'Satara');
    await userEvent.click(screen.getByRole('button', { name: 'Work out the route' }));
    expect(await screen.findByText(/This route is longer than the 200 km your vehicle covers on a full charge/)).toBeInTheDocument();
    expect(screen.queryByText(/cannot be published/)).not.toBeInTheDocument();
  });

  it('says nothing when the route is within range', async () => {
    signIn('DRIVER');
    serve({ 'GET /vehicles': () => json([ev(300)]), 'POST /rides/route-preview': preview });
    open('/rides/new');

    await userEvent.click(await screen.findByRole('button', { name: 'Work out the route' }));
    await screen.findByText('230 km by road, about 3 h 11 min of driving.');
    expect(screen.queryByText(/on a full charge/)).not.toBeInTheDocument();
  });
});

describe('phone sign-up', () => {
  const bodyOf = (fetchMock: ReturnType<typeof serve>, method: string, path: string) => {
    const call = fetchMock.mock.calls.find(([url, init]) => init?.method === method && String(url).endsWith(path));
    return JSON.parse(String(call?.[1]?.body ?? 'null'));
  };
  const session = { accessToken: 'token', expiresInSeconds: 43200, user: { id: 9, email: null, fullName: 'Meera Kulkarni', role: 'PASSENGER' } };

  it('signs in with a phone number, sending it as a phone', async () => {
    const fetchMock = serve({ 'POST /auth/login': () => json(session), 'GET /rides/search': () => json([]) });
    open('/login');

    await userEvent.type(await screen.findByLabelText('Email or phone number'), '98000 00009');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse-battery');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Find a ride' })).toBeInTheDocument();
    expect(bodyOf(fetchMock, 'POST', '/auth/login')).toEqual({ phone: '98000 00009', password: 'correct-horse-battery' });
  });

  it('refuses something that is neither an email nor a phone number', async () => {
    const fetchMock = serve({});
    open('/login');

    await userEvent.type(await screen.findByLabelText('Email or phone number'), 'asha');
    await userEvent.type(screen.getByLabelText('Password'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter a valid email or phone number')).toBeInTheDocument();
    // Only the question of whether Google sign-in is offered; nothing is submitted.
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('creates an account with a phone number and sends no email', async () => {
    const fetchMock = serve({ 'POST /auth/register': () => json(session, 201), 'GET /rides/search': () => json([]) });
    open('/register');

    await userEvent.type(await screen.findByLabelText('Full name'), 'Meera Kulkarni');
    await userEvent.click(screen.getByRole('radio', { name: 'Phone number' }));
    expect(screen.queryByRole('textbox', { name: 'Email' })).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'Phone number' }), '9800000009');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse-battery');
    await userEvent.selectOptions(screen.getByLabelText('I want to'), 'PASSENGER');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { name: 'Find a ride' })).toBeInTheDocument();
    const body = bodyOf(fetchMock, 'POST', '/auth/register') as Record<string, unknown>;
    expect(body).toMatchObject({ phone: '9800000009', fullName: 'Meera Kulkarni', role: 'PASSENGER' });
    expect(body).not.toHaveProperty('email');
    expect(body).not.toHaveProperty('method');
  });
});

describe('what if', () => {
  const offered = () => json([{ name: 'departure-tolerance', parameter: 'demand.departure_tolerance_hours', min: 0, max: 12, whole: false }]);

  it('shows a saved run for the chosen setting, and says only swept settings are saved runs', async () => {
    signIn('ADMIN');
    serve({ 'GET /v1/whatif/sweeps': offered });
    open('/admin/what-if');

    expect(await screen.findByText(/only the settings a sweep was run at can be chosen there/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Question'), 'How far from their chosen time passengers will travel');
    await userEvent.selectOptions(screen.getByLabelText('Hours either side of the chosen time'), '8');

    const row = screen.getByRole('row', { name: /Completed rides per 100 searches/ });
    // The committed sweep (world h3, web/src/data/whatif.json): B4 against B3 at 8 hours.
    expect(row).toHaveTextContent('32.51');
    expect(row).toHaveTextContent('32.58');
    expect(row).toHaveTextContent('−0.06 (−0.12 to −0.01)');
    expect(within(row).queryByText('no clear difference')).not.toBeInTheDocument();
    expect(screen.getByText('B4 compared with B3, 30 seeds each, paired by seed.', { exact: false })).toBeInTheDocument();
  });

  it('simulates a value no sweep covered, and says the result is only an exploration', async () => {
    signIn('ADMIN');
    const fetchMock = serve({
      'GET /v1/whatif/sweeps': offered,
      'POST /v1/whatif/run': () =>
        json({ variant: 'B4', baseline: 'B3', value: 3, seeds: 5, measures: {
          per_100: { baseline_mean: 32.1, mean: 32.25, difference: 0.15, seeds: 5, seeds_up: 4, seeds_down: 1 },
          late_share: { baseline_mean: 0.38, mean: 0.33, difference: -0.05, seeds: 5, seeds_up: 0, seeds_down: 5 } } }),
    });
    open('/admin/what-if');

    await userEvent.selectOptions(screen.getByLabelText('Question'), 'How far from their chosen time passengers will travel');
    await userEvent.type(await screen.findByLabelText('Value to simulate'), '3');
    await userEvent.selectOptions(screen.getByLabelText('Seeds'), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Simulate' }));

    const result = within(await screen.findByRole('region', { name: 'Live result' }));
    expect(result.getByRole('row', { name: /Completed rides per 100 searches/ })).toHaveTextContent('32.2532.10+0.154 / 1');
    expect(result.getByText(/simulated just now\. Exploratory: no interval, and not a report figure/)).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([url, init]) => init?.method === 'POST' && String(url).endsWith('/v1/whatif/run'))!;
    expect(String(post[0])).toBe('http://localhost:8000/v1/whatif/run');
    expect(JSON.parse(String(post[1]!.body))).toEqual({ sweep: 'departure-tolerance', value: 3, seeds: 5 });
  });

  it("shows intel's reason for refusing a run, and a refusal there signs nobody out", async () => {
    signIn('ADMIN');
    serve({
      'GET /v1/whatif/sweeps': offered,
      'POST /v1/whatif/run': () => json({ detail: 'Your session has ended. Sign in again.' }, 401),
    });
    open('/admin/what-if');

    await userEvent.selectOptions(screen.getByLabelText('Question'), 'How far from their chosen time passengers will travel');
    await userEvent.type(await screen.findByLabelText('Value to simulate'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Simulate' }));

    expect(await screen.findByText('Your session has ended. Sign in again.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What if' })).toBeInTheDocument();
  });
});

describe('rest stops and chargers', () => {
  const stop = (id: number, kind: 'REST' | 'CHARGER', name: string, kmAlong: number, suggestedBreak = false, chargerKw: number | null = null) => ({
    stopover: { id, kind, name, lat: 17.6, lon: 74.05, chargerKw, notes: null },
    kmAlong,
    kmOffRoute: 0.2,
    suggestedBreak,
  });

  it('lists what is along the route, marks the suggested break, and names chargers in the range warning', async () => {
    signIn('DRIVER');
    serve({
      'GET /vehicles': () => json([{ id: 3, make: 'Tata', model: 'Nexon EV', year: 2023, colour: 'Blue', seats: 5,
        electric: true, batteryKwh: 30, consumptionKwhPer100Km: 15, estimatedRangeKm: 200 }]),
      'POST /rides/route-preview': () =>
        json({ distanceKm: 230, durationMinutes: 191, source: 'OSRM', legs: [{ distanceKm: 230, durationMinutes: 191, suggestedPrice: 460 }],
          path: [[16.705, 74.2433], [18.5204, 73.8567]],
          alongRoute: [stop(1, 'CHARGER', 'Karad charger', 62, false, 60), stop(2, 'REST', 'Satara dhaba', 121, true)] }),
    });
    open('/rides/new');

    await userEvent.click(await screen.findByRole('button', { name: 'Work out the route' }));
    const along = within(await screen.findByRole('region', { name: 'Along this route' }));
    expect(along.getByText(/km 62 · Karad charger · charger, 60 kW/)).toBeInTheDocument();
    expect(along.getByText(/km 121 · Satara dhaba · rest stop/)).toHaveTextContent('a good place for a break');
    expect(along.getByText(/Nothing checks that a stop is open/)).toBeInTheDocument();
    expect(screen.getByText(/Chargers are listed near this route below/)).toBeInTheDocument();
  });

  it('lets an administrator add a charger with its power', async () => {
    signIn('ADMIN');
    const fetchMock = serve({
      'GET /admin/stopovers': () => json([]),
      'POST /admin/stopovers': () => json({ id: 5, kind: 'CHARGER', name: 'Karad charger', lat: 17.28, lon: 74.18, chargerKw: 60, notes: null }, 201),
    });
    open('/admin/stopovers');

    expect(await screen.findByText('No rest stops or chargers are listed.')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Kind'), 'Charger');
    await userEvent.type(screen.getByLabelText('Name'), 'Karad charger');
    await userEvent.type(screen.getByLabelText('Latitude'), '17.28');
    await userEvent.type(screen.getByLabelText('Longitude'), '74.18');
    await userEvent.type(screen.getByLabelText('Power in kW (optional)'), '60');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
      expect(JSON.parse(String(post?.[1]?.body))).toEqual({ kind: 'CHARGER', name: 'Karad charger', lat: 17.28, lon: 74.18,
        chargerKw: 60, notes: null });
    });
  });
});

describe('notifications in the reader language', () => {
  const seats = { template: '{n} seats, {from} to {to}', values: { n: '2', from: 'Kolhapur', to: 'Pune' } };
  const cancelled = {
    id: 'a1', type: 'RIDE_CANCELLED', bookingId: 7, createdAt: '2026-11-02T01:30:00Z', read: false,
    message: 'The driver cancelled the ride you booked for 2 seats, Kolhapur to Pune. You owe nothing. No other ride with seats leaves near that time.',
    text: {
      template: 'The driver cancelled the ride you booked for {seats}. You owe nothing. {more}',
      values: { seats, more: { template: 'No other ride with seats leaves near that time.', values: {} } },
    },
  };
  const older = { id: 'a2', type: 'ACCOUNT_NOTICE', bookingId: null, createdAt: '2026-11-01T01:30:00Z', read: true,
    message: 'Written before templates existed.', text: null };

  it('shows a notification from its template, and an older one as its English', async () => {
    signIn('PASSENGER');
    serve({ 'GET /notifications': () => json([cancelled, older]) });
    open('/notifications');

    expect(await screen.findByText(/The driver cancelled the ride you booked for 2 seats, Kolhapur to Pune/)).not.toHaveAttribute('lang');
    expect(screen.getByText('Written before templates existed.')).toHaveAttribute('lang', 'en');
  });

  it('falls back to the English when a template is not one this version knows', async () => {
    signIn('PASSENGER');
    serve({ 'GET /notifications': () => json([{ ...cancelled, text: { template: 'A sentence from a newer server: {x}', values: { x: 'y' } } }]) });
    open('/notifications');

    expect(await screen.findByText(/The driver cancelled the ride you booked for 2 seats/)).toHaveAttribute('lang', 'en');
  });
});

describe('photos', () => {
  const profile = { email: 'user@example.test', emailVerified: false, phone: null, phoneVerified: false,
    bio: null, birthYear: null, gender: null, smoking: null, pets: null, music: null, chattiness: null };

  it('uploads a chosen photo as the file itself, then shows it', async () => {
    // A subclass, so the real URL is left as it was for every other test.
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn(() => 'blob:photo');
      static revokeObjectURL = vi.fn();
    });
    signIn('PASSENGER');
    let stored = false;
    const fetchMock = serve({
      'GET /me/profile': () => json(profile),
      'GET /me/emergency-contacts': () => json([]),
      'PUT /me/photo': () => {
        stored = true;
        return new Response(null, { status: 204 });
      },
      'GET /users/1/photo': () => (stored ? new Response(new Blob(['jpeg'], { type: 'image/jpeg' })) : json({ detail: 'No photo' }, 404)),
    });
    open('/account');

    expect(await screen.findByRole('button', { name: 'Add a photo' })).toBeInTheDocument();
    const file = new File(['png bytes'], 'me.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('Choose a photo'), file);

    expect(await screen.findByRole('img', { name: 'Your photo' })).toHaveAttribute('src', 'blob:photo');
    expect(screen.getByRole('button', { name: 'Replace photo' })).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!;
    expect(put[1]!.body).toBe(file);
    expect((put[1]!.headers as Record<string, string>)['Content-Type']).toBe('image/png');
  });

  it('shows initials when a member has no photo', async () => {
    signIn('PASSENGER');
    serve({ 'GET /me/profile': () => json(profile), 'GET /me/emergency-contacts': () => json([]) });
    open('/account');

    expect(await screen.findByRole('button', { name: 'Add a photo' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Your photo' })).not.toBeInTheDocument();
  });
});

describe('push notifications', () => {
  const profile = { email: 'user@example.test', emailVerified: false, phone: null, phoneVerified: false,
    bio: null, birthYear: null, gender: null, smoking: null, pets: null, music: null, chattiness: null };

  it('says so when the browser cannot receive them', async () => {
    signIn('PASSENGER');
    serve({ 'GET /me/profile': () => json(profile), 'GET /me/emergency-contacts': () => json([]) });
    open('/account');

    expect(await screen.findByText('This browser cannot receive push notifications.')).toBeInTheDocument();
  });

  it('subscribes this browser with the server key and sends the subscription', async () => {
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'BCVx', auth: 'BTBZ' } }),
    };
    let current: typeof subscription | null = null;
    const subscribe = vi.fn(async () => (current = subscription));
    const registration = { pushManager: { subscribe, getSubscription: async () => current } };
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator, { onLine: { value: true } }), {
      serviceWorker: { register: vi.fn(async () => registration), getRegistration: async () => registration },
    }));
    vi.stubGlobal('PushManager', function PushManager() {});
    vi.stubGlobal('Notification', { requestPermission: vi.fn(async () => 'granted') });
    signIn('PASSENGER');
    const fetchMock = serve({
      'GET /me/profile': () => json(profile),
      'GET /me/emergency-contacts': () => json([]),
      'GET /me/push': () => json({ publicKey: 'BP4z9KsN', subscribed: false }),
      'POST /me/push-subscriptions': () => new Response(null, { status: 204 }),
    });
    open('/account');

    await userEvent.click(await screen.findByRole('button', { name: 'Turn on in this browser' }));

    expect(await screen.findByText('Push notifications are on in this browser.')).toBeInTheDocument();
    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    const post = fetchMock.mock.calls.find(([url, init]) => init?.method === 'POST' && String(url).endsWith('/me/push-subscriptions'))!;
    expect(JSON.parse(String(post[1]!.body))).toEqual({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'BCVx', auth: 'BTBZ' } });
  });
});

describe('driver record and walk in search results', () => {
  it("shows the driver's own record and a rough walk to the pickup", async () => {
    signIn('PASSENGER');
    serve({ 'GET /rides/search': () => json([candidate, { ...candidate, rideId: 99, driverRidesCompleted: 0, driverRidesWithdrawn: 0, pickupWalkMinutes: 0 }]) });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
    expect(await screen.findByText('Completed 18 of the 19 rides they have finished or withdrawn')).toBeInTheDocument();
    expect(screen.getByText('No completed rides yet')).toBeInTheDocument();
    expect(screen.getAllByText(/about 4 min walk to the pickup, in a straight line/)).toHaveLength(1);
  });

  it('says a walk was worked out on footpaths only when it was', async () => {
    signIn('PASSENGER');
    serve({ 'GET /rides/search': () => json([{ ...candidate, pickupWalkMinutes: 9, walkOnFootpaths: true }]) });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
    expect(await screen.findByText(/about 9 min walk to the pickup, by footpath/)).toBeInTheDocument();
    expect(screen.queryByText(/in a straight line/)).not.toBeInTheDocument();
  });

  it('offers an auto-rickshaw where the walk is long, with a fare only where one is published, and says whose', async () => {
    signIn('PASSENGER');
    serve({
      'GET /rides/search': () =>
        json([{ ...candidate,
          pickupRickshaw: { minutes: 3, km: 2.0, fare: null, fareTown: null, fareSource: null, fareSince: null, byRoad: false },
          dropoffRickshaw: { minutes: 9, km: 3.1, fare: 62, fareTown: 'Pune', fareSource: 'Pune Regional Transport Authority',
            fareSince: '2026-09-01', byRoad: true } }]),
    });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
    expect(await screen.findByText(
      'Or about 3 min by auto-rickshaw to the pickup; no meter fare is known there · roughly: in a straight line')).toBeInTheDocument();
    expect(screen.getByText(/Or about 9 min by auto-rickshaw from the drop-off, about ₹62(\.00)? by the Pune meter fare$/)).toBeInTheDocument();
    expect(screen.getByText(/An estimate: the meter, traffic and hour decide\. Fare published by Pune Regional Transport Authority, in force from/))
      .toBeInTheDocument();
  });

  it('offers no auto-rickshaw where none was estimated', async () => {
    signIn('PASSENGER');
    serve({ 'GET /rides/search': () => json([candidate]) });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
    await screen.findByText(/about 4 min walk to the pickup/);
    expect(screen.queryByText(/auto-rickshaw/)).not.toBeInTheDocument();
  });
});

describe('flexibility tiers', () => {
  it('books with the chosen tier, and suggests flexible only on a driver with withdrawals', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({
      'GET /rides/search': () => json([{ ...candidate, suggestFlexible: true }]),
      'POST /bookings': () => json({ ...booking, flexTier: 'FLEXIBLE' }, 201),
    });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
    expect(await screen.findByText(/This driver has withdrawn some rides/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('If the driver withdraws'), 'Flexible: book me within 2 hours');
    expect(screen.queryByText(/This driver has withdrawn some rides/)).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: /^(Book|Request)/ })[0]);

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([url, init]) => init?.method === 'POST' && String(url).endsWith('/bookings'));
      expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ tier: 'FLEXIBLE' });
    });
  });
});

describe('a ride already on the road', () => {
  it('says so, and that it may reach the stop early, only on such a ride', async () => {
    signIn('PASSENGER');
    serve({
      'GET /rides/search': () =>
        json([
          { ...candidate, rideId: 1, fromStop: 'Karad', underWay: true },
          { ...candidate, rideId: 2 },
        ]),
    });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Already on the road: it may reach Karad before the time shown, so be there early.')).toBeInTheDocument();
    expect(screen.getAllByText(/Already on the road/)).toHaveLength(1);
  });
});

describe('unmet demand', () => {
  it('lists the coming gaps and how many drivers were told', async () => {
    signIn('ADMIN');
    serve({ 'GET /admin/supply-gaps': () => json([{ date: '2026-11-04', fromStop: 'Kolhapur', toStop: 'Pune', emptySearches: 7, driversNudged: 2 }]) });
    open('/admin/supply-gaps');

    const row = await screen.findByRole('row', { name: /Kolhapur → Pune/ });
    expect(row).toHaveTextContent('7');
    expect(row).toHaveTextContent('2');
    expect(screen.getByText(/not reported as a result/)).toBeInTheDocument();
  });
});

describe('Google sign-in', () => {
  it('is not offered when the server has no Google client', async () => {
    serve({});
    open('/login');
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText('or')).not.toBeInTheDocument();
  });

  it('asks a new person whether they travel or drive, then creates the account with the same token', async () => {
    let callback: ((response: { credential: string }) => void) | undefined;
    vi.stubGlobal('google', {
      accounts: { id: { initialize: (options: { callback: typeof callback }) => (callback = options.callback), renderButton: vi.fn() } },
    });
    const session = { accessToken: 'token', expiresInSeconds: 43200, user: { id: 9, email: 'meera@gmail.test', fullName: 'Meera Kulkarni', role: 'DRIVER' } };
    const fetchMock = serve({
      'GET /auth/google': () => json({ clientId: 'client.apps.googleusercontent.com' }),
      'POST /auth/google': () => {
        const sent = JSON.parse(String(fetchMock.mock.calls.at(-1)![1]!.body));
        return sent.role ? json(session) : json({ detail: 'No account uses this Google address yet. Choose passenger or driver to create one.' }, 409);
      },
      'GET /rides/mine': () => json([]),
    });
    open('/login');

    await waitFor(() => expect(callback).toBeDefined());
    callback!({ credential: 'google-id-token' });
    await userEvent.click(await screen.findByRole('button', { name: 'Offer rides as a driver' }));

    expect(await screen.findByRole('heading', { name: 'My rides' })).toBeInTheDocument();
    const posts = fetchMock.mock.calls.filter(([url, init]) => init?.method === 'POST' && String(url).endsWith('/auth/google'));
    expect(posts.map(([, init]) => JSON.parse(String(init!.body)))).toEqual([
      { idToken: 'google-id-token' },
      { idToken: 'google-id-token', role: 'DRIVER' },
    ]);
  });
});

describe('declared insurance: the driver’s word, never checked', () => {
  const car = { id: 3, make: 'Maruti', model: 'Ertiga', year: 2022, colour: 'Silver', seats: 7, insurer: null, insuredUntil: null };
  const insured = { ...car, insurer: 'New India Assurance', insuredUntil: '2027-03-12' };

  it('sends what the driver declares, and asks for no policy number', async () => {
    signIn('DRIVER');
    const fetchMock = serve({
      'GET /vehicles': () => json([car]),
      'PUT /vehicles/3/insurance': () => json(insured),
    });
    open('/vehicles');

    await userEvent.type(await screen.findByLabelText('Insurer'), 'New India Assurance');
    fireEvent.change(screen.getByLabelText('Insured until'), { target: { value: '2027-03-12' } });
    expect(screen.queryByLabelText(/policy/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Declare insurance' }));

    await waitFor(() => {
      const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
      expect(JSON.parse(String(put?.[1]?.body))).toEqual({ insurer: 'New India Assurance', insuredUntil: '2027-03-12' });
    });
  });

  it('shows a declared insurance as not checked, and removes it', async () => {
    signIn('DRIVER');
    const fetchMock = serve({
      'GET /vehicles': () => json([insured]),
      'DELETE /vehicles/3/insurance': () => json(car),
    });
    open('/vehicles');

    expect(await screen.findByText(/Insurance: New India Assurance, until .*2027\. As you declared it: VAYORA has not checked it/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove the insurance' }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url, init]) => init?.method === 'DELETE' && String(url).endsWith('/vehicles/3/insurance'))).toBe(true),
    );
  });

  it('tells a passenger the insurance is declared and not checked', async () => {
    signIn('PASSENGER');
    serve({ 'GET /rides/search': () => json([{ ...candidate, insurer: 'New India Assurance', insuredUntil: '2027-03-12' }]) });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));

    expect(await screen.findByText(/Insurance declared by the driver: New India Assurance, until .*2027\. Not checked\./)).toBeInTheDocument();
  });
});

describe('staff checks of what a driver declared', () => {
  const declared = { email: 'ravi@example.test', emailVerified: false, phone: null, phoneVerified: false, bio: null, birthYear: null, gender: null, smoking: null, pets: null, music: null, chattiness: null, declaredId: 'PASSPORT' };
  const check = { id: 5, kind: 'IDENTITY', vehicleId: null, status: 'WAITING', requestedAt: '2026-11-01T04:00:00Z', decidedAt: null, note: null };
  const bodyOf = (fetchMock: ReturnType<typeof serve>, method: string, path: string) => {
    const call = fetchMock.mock.calls.find(([url, init]) => init?.method === method && String(url).endsWith(path));
    return JSON.parse(String(call?.[1]?.body ?? 'null'));
  };

  it('lets a driver ask staff to see the document, and says no number or copy is kept', async () => {
    signIn('DRIVER');
    let asked = false;
    const fetchMock = serve({
      'GET /me/profile': () => json(declared),
      'GET /me/emergency-contacts': () => json([]),
      'GET /me/document-checks': () => json(asked ? [check] : []),
      'POST /me/document-checks': () => {
        asked = true;
        return json(check, 201);
      },
    });
    open('/account');

    const section = within(await screen.findByRole('region', { name: 'Identity document' }));
    expect(await section.findByText(/They record only the result: no number and no copy is kept/)).toBeInTheDocument();
    await userEvent.click(section.getByRole('button', { name: 'Ask VAYORA staff to check it' }));

    expect(await section.findByText(/Waiting for VAYORA staff/)).toBeInTheDocument();
    expect(bodyOf(fetchMock, 'POST', '/me/document-checks')).toEqual({ kind: 'IDENTITY', vehicleId: null });
    expect(section.queryByRole('button', { name: 'Ask VAYORA staff to check it' })).not.toBeInTheDocument();
  });

  it('says a person saw it once checked, and why not when refused, with a way to ask again', async () => {
    signIn('DRIVER');
    let answer: unknown = { ...check, status: 'CHECKED', decidedAt: '2026-11-02T04:00:00Z' };
    serve({
      'GET /me/profile': () => json(declared),
      'GET /me/emergency-contacts': () => json([]),
      'GET /me/document-checks': () => json([answer]),
    });
    open('/account');

    expect(await screen.findByText(/Checked by VAYORA staff on .*2026\. A person saw it; it was not checked with its issuer\./)).toBeInTheDocument();
    cleanup();

    answer = { ...check, status: 'REFUSED', decidedAt: '2026-11-02T04:00:00Z', note: 'The photo was too dark.' };
    open('/account');
    expect(await screen.findByText('VAYORA staff could not confirm it: The photo was too dark.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask VAYORA staff to check it' })).toBeInTheDocument();
  });

  it('asks for the insurance of the right car', async () => {
    signIn('DRIVER');
    const fetchMock = serve({
      'GET /vehicles': () => json([{ id: 3, make: 'Maruti', model: 'Ertiga', year: 2022, colour: 'Silver', seats: 7, insurer: 'New India Assurance', insuredUntil: '2027-03-12' }]),
      'GET /me/document-checks': () => json([]),
      'POST /me/document-checks': () => json({ ...check, kind: 'INSURANCE', vehicleId: 3 }, 201),
    });
    open('/vehicles');

    await userEvent.click(await screen.findByRole('button', { name: 'Ask VAYORA staff to check it' }));

    await waitFor(() => expect(bodyOf(fetchMock, 'POST', '/me/document-checks')).toEqual({ kind: 'INSURANCE', vehicleId: 3 }));
  });

  it('shows on a profile that staff saw the document, not that its issuer stands behind it', async () => {
    signIn('PASSENGER');
    serve({
      'GET /users/7/profile': () =>
        json({ id: 7, fullName: 'Ravi Jadhav', role: 'DRIVER', memberSince: '2026-03-14T08:00:00Z', completedTrips: 0, averageStars: null, ratingCount: 0, reviews: [],
          emailVerified: false, phoneVerified: false, declaredId: 'DRIVING_LICENCE', idCheckedAt: '2026-11-02T04:00:00Z' }),
    });
    open('/users/7');

    const about = within(await screen.findByRole('list', { name: 'About this member' }));
    expect(about.getByText('Driving licence, checked by VAYORA staff')).toBeInTheDocument();
    expect(about.queryByText(/not checked/)).not.toBeInTheDocument();
    expect(screen.getByText('A person at VAYORA saw this document. It was not checked with its issuer.')).toBeInTheDocument();
    expect(screen.queryByText('VAYORA has not checked any identity documents.')).not.toBeInTheDocument();
  });

  it('shows a result as checked by staff, and lets a passenger ask only for such drivers', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({
      'GET /rides/search': () => json([{ ...candidate, driverIdChecked: true, insuranceChecked: true, insurer: 'New India Assurance', insuredUntil: '2027-03-12' }]),
    });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Identity checked by staff')).toBeInTheDocument();
    expect(screen.getByText(/Insurance: New India Assurance, until .*2027\. VAYORA staff saw the policy; it was not checked with the insurer\./)).toBeInTheDocument();

    // The form steps aside for a one-line summary once searched; it comes back to change the search.
    await userEvent.click(screen.getByRole('button', { name: 'Change search' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Filters' }));
    await userEvent.click(screen.getByLabelText('Have a driver whose identity VAYORA staff have checked'));
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      const last = fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('/rides/search')).at(-1)!;
      expect(new URL(last).searchParams.get('idCheckedDriver')).toBe('true');
    });
  });

  it('lets an administrator record what they saw: a refusal needs a note, a check is confirmed first', async () => {
    signIn('ADMIN');
    const fetchMock = serve({
      'GET /admin/document-checks': () =>
        json([
          { id: 5, kind: 'IDENTITY', driverId: 7, driverName: 'Ravi Jadhav', requestedAt: '2026-11-01T04:00:00Z', document: 'PASSPORT', vehicleId: null, vehicle: null, insurer: null, insuredUntil: null },
          { id: 6, kind: 'INSURANCE', driverId: 8, driverName: 'Sneha Kulkarni', requestedAt: '2026-11-01T05:00:00Z', document: null, vehicleId: 3, vehicle: 'Maruti Ertiga', insurer: 'New India Assurance', insuredUntil: '2027-03-12' },
        ]),
      'POST /admin/document-checks/5/decide': () => json({}),
      'POST /admin/document-checks/6/decide': () => json({}),
    });
    open('/admin/document-checks');

    expect(await screen.findByRole('heading', { name: 'Document checks' })).toBeInTheDocument();
    expect(await screen.findByText('Identity document: Passport')).toBeInTheDocument();
    expect(screen.getByText(/Insurance for Maruti Ertiga: New India Assurance, until .*2027/)).toBeInTheDocument();
    expect(screen.getByText(/Do not write down its number or keep a copy/)).toBeInTheDocument();

    const refuse = screen.getAllByRole('button', { name: 'Could not confirm' });
    expect(refuse[0]).toBeDisabled();
    await userEvent.type(screen.getAllByLabelText('Note for the driver (needed to refuse)')[0], 'Too dark to read');
    await userEvent.click(screen.getAllByRole('button', { name: 'Could not confirm' })[0]);
    await waitFor(() => expect(bodyOf(fetchMock, 'POST', '/admin/document-checks/5/decide')).toEqual({ outcome: 'REFUSED', note: 'Too dark to read' }));

    await userEvent.click(screen.getAllByRole('button', { name: 'Mark as checked' })[1]);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/document-checks/6/decide'))).toBe(false);
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Yes, I saw the original' }));
    await waitFor(() => expect(bodyOf(fetchMock, 'POST', '/admin/document-checks/6/decide')).toEqual({ outcome: 'CHECKED', note: '' }));
  });

  it('keeps the queue from drivers', async () => {
    signIn('DRIVER');
    serve({ 'GET /rides/mine': () => json([]) });
    open('/admin/document-checks');

    expect(await screen.findByRole('heading', { name: 'My rides' })).toBeInTheDocument();
  });
});

describe('calling the other side: simulated', () => {
  it('says plainly that no call was placed, and that the other side was told', async () => {
    signIn('PASSENGER');
    serve({
      'GET /bookings': () => json([{ ...booking, status: 'CONFIRMED' }]),
      'POST /bookings/90/call': () => json({ provider: 'mock', calleeName: 'Ravi Jadhav' }),
    });
    open('/bookings');

    await userEvent.click(await screen.findByRole('button', { name: 'Call the driver' }));

    const said = await screen.findByText(/^Calling is simulated\./);
    expect(said).toHaveTextContent('connected to Ravi Jadhav through a masked number');
    expect(said).toHaveTextContent('No call was placed, and Ravi Jadhav has been told you tried.');
    expect(said).not.toHaveTextContent(/\d{5}/);
  });

  it('with a real phone service, says the phone will ring from the platform number, and shows none', async () => {
    signIn('PASSENGER');
    serve({
      'GET /bookings': () => json([{ ...booking, status: 'CONFIRMED' }]),
      'POST /bookings/90/call': () => json({ provider: 'twilio', calleeName: 'Ravi Jadhav' }),
    });
    open('/bookings');

    await userEvent.click(await screen.findByRole('button', { name: 'Call the driver' }));

    const said = await screen.findByText(/^Your phone will ring now from VAYORA's number\./);
    expect(said).toHaveTextContent("connected to Ravi Jadhav: neither of you sees the other's number.");
    expect(screen.queryByText(/Calling is simulated/)).not.toBeInTheDocument();
    expect(said).not.toHaveTextContent(/\d{5}/);
  });

  it('shows why a call cannot be made', async () => {
    signIn('PASSENGER');
    serve({
      'GET /bookings': () => json([{ ...booking, status: 'CONFIRMED' }]),
      'POST /bookings/90/call': () => json({ detail: 'They have no confirmed phone number. Use the chat instead.' }, 409),
    });
    open('/bookings');

    await userEvent.click(await screen.findByRole('button', { name: 'Call the driver' }));

    expect(await screen.findByText('They have no confirmed phone number. Use the chat instead.')).toBeInTheDocument();
  });

  it('offers no call on a booking that is not confirmed', async () => {
    signIn('PASSENGER');
    serve({ 'GET /bookings': () => json([booking]) });
    open('/bookings');

    expect(await screen.findByText('Kolhapur → Pune')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Call the driver' })).not.toBeInTheDocument();
  });
});

describe('best match for both people', () => {
  it('asks for that order, and shows each score with its reasons only then', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({
      'GET /rides/search': () =>
        json([{ ...candidate, matchScore: 88, matchReasons: ['NEAR', 'SAME_CONVERSATION', 'DIFFERENT_MUSIC'] }]),
    });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
    await screen.findAllByRole('button', { name: /^(Book|Request)/ });
    expect(screen.queryByText(/Match 88 of 100/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Best match for both of you' }));

    expect(
      await screen.findByText(
        'Match 88 of 100 · Pickup and drop-off close to you · You like the same amount of conversation · You differ about music',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Never from any prediction about either of you/)).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => new URL(String(url)).searchParams.get('sort') === 'BEST_MATCH')).toBe(true),
    );
  });
});
describe('a pickup away from the stops', () => {
  it('says the driver comes to the passenger, at what cost to them, and books with that point', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({
      'GET /rides/search': () => json([{ ...candidate, detourMinutes: 6, boardingTime: '2026-11-02T03:50:00Z' }]),
      'POST /bookings': () => json({ ...booking, status: 'CONFIRMED' }, 201),
    });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
    expect(await screen.findByText(/^The driver picks you up at your start, about .*: 6 min out of their way\.$/)).toBeInTheDocument();
    // Found in a browser: the heading named the stop before the pickup, at the pickup's time.
    expect(screen.getByText(/ Your start → .* Pune$/)).toBeInTheDocument();
    expect(screen.queryByText(/ Kolhapur → /)).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: /^(Book|Request)/ })[0]);

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([url, init]) => init?.method === 'POST' && String(url).endsWith('/bookings'));
      const body = JSON.parse(String(post?.[1]?.body));
      expect(typeof body.pickupLat).toBe('number');
      expect(typeof body.pickupLon).toBe('number');
    });
  });

  it('sends no pickup point for a ride boarded at a stop', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({
      'GET /rides/search': () => json([candidate]),
      'POST /bookings': () => json({ ...booking, status: 'CONFIRMED' }, 201),
    });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
    await userEvent.click((await screen.findAllByRole('button', { name: /^(Book|Request)/ }))[0]);

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([url, init]) => init?.method === 'POST' && String(url).endsWith('/bookings'));
      expect(JSON.parse(String(post?.[1]?.body))).not.toHaveProperty('pickupLat');
    });
    expect(screen.queryByText(/picks you up at your start/)).not.toBeInTheDocument();
  });

  it('tells the passenger they are picked up at their own point', async () => {
    signIn('PASSENGER');
    serve({ 'GET /bookings': () => json([{ ...booking, status: 'CONFIRMED', pickupLat: 17.289, pickupLon: 74.13, detourMinutes: 6 }]) });
    open('/bookings');

    expect(await screen.findByText('Picked up at your own point after Kolhapur, not at the stop.')).toBeInTheDocument();
  });
});
describe('the meeting point of a pickup away from the stops', () => {
  it('marks the pickup point, not the stop before it, as where the passenger boards', async () => {
    signIn('PASSENGER');
    serve({
      'GET /bookings': () =>
        json([{ ...booking, status: 'CONFIRMED', pickupLat: 17.289, pickupLon: 74.13, detourMinutes: 6, boardingTime: '2026-11-02T02:50:00Z' }]),
      'GET /rides/12': () => json(rideWithRoute),
    });
    open('/bookings');

    await userEvent.click(await screen.findByRole('button', { name: 'Show meeting point' }));

    expect(await screen.findByText(/^You are picked up at your own point, about /)).toBeInTheDocument();
    expect(screen.getByText('You are picked up here')).toBeInTheDocument();
    // Found reviewing the detour work: the stop before the pickup was still called the boarding point.
    expect(screen.queryByText(/Board at Kolhapur/)).not.toBeInTheDocument();
    expect(screen.queryByText('Board here: Kolhapur')).not.toBeInTheDocument();
  });
});
describe('paying the driver', () => {
  const bodyOf = (fetchMock: ReturnType<typeof serve>, path: string) => {
    const call = fetchMock.mock.calls.find(([url, init]) => init?.method === 'POST' && new URL(String(url)).pathname.endsWith(path));
    return call ? JSON.parse(String(call[1]?.body ?? 'null')) : undefined;
  };
  const owing = { ...booking, status: 'COMPLETED' as Booking['status'], passengerRated: true, passengerConfirmed: true, driverId: 7,
    paymentStatus: 'DUE' as Booking['paymentStatus'], amountDue: 520 };

  it('books with one button and says nothing is taken now', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({
      'GET /rides/search': () => json([{ ...candidate, instantBooking: true }]),
      'POST /bookings': () => json({ ...booking, status: 'CONFIRMED', paymentStatus: 'DEFERRED' }, 201),
    });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
    const results = await screen.findByRole('region', { name: 'Search results' });
    expect(within(results).queryByRole('button', { name: /pay after the ride/i })).not.toBeInTheDocument();
    await userEvent.click(within(results).getByRole('button', { name: 'Book' }));

    expect(await screen.findByText(/Nothing to pay now: pay your driver ₹520 after the ride/)).toBeInTheDocument();
    const body = bodyOf(fetchMock, '/bookings');
    expect(body).toMatchObject({ rideId: 12 });
    expect(body).not.toHaveProperty('paymentMethod');
    expect(body).not.toHaveProperty('payAfterRide');
  });

  it('shows what is owed and where to pay it, with no way to pay in the app', async () => {
    signIn('PASSENGER');
    const user = userEvent.setup();
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:qr'), revokeObjectURL: vi.fn() });
    serve({
      'GET /bookings/90/pay-driver/qr': () => new Response(new Blob(['png']), { status: 200, headers: { 'Content-Type': 'image/png' } }),
      'GET /bookings/90/pay-driver': () => json({ driverName: 'Ravi Jadhav', upiId: 'ravi@okaxis', hasQr: true }),
      'GET /bookings': () => json([owing]),
    });
    try {
      open('/bookings');

      expect(await screen.findByText(/You owe your driver ₹520\. You can book again once they mark it paid\./)).toBeInTheDocument();
      expect(await screen.findByText('ravi@okaxis')).toBeInTheDocument();
      expect(await screen.findByRole('img', { name: 'UPI QR code of Ravi Jadhav' })).toHaveAttribute('src', 'blob:qr');
      expect(screen.getByText(/Check the name your UPI app shows before you pay/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Pay/ })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Pay with')).not.toBeInTheDocument();
      // A driver who was paid and will not say so can be reported.
      expect(screen.getByRole('link', { name: 'Report it on their profile, and staff can clear it.' })).toHaveAttribute('href', '/users/7');

      await user.click(screen.getByRole('button', { name: 'Copy' }));
      expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
      expect(await navigator.clipboard.readText()).toBe('ravi@okaxis');
    } finally {
      Reflect.deleteProperty(URL, 'createObjectURL');
      Reflect.deleteProperty(URL, 'revokeObjectURL');
    }
  });

  it('offers the UPI app only on a phone, with the amount filled in', async () => {
    signIn('PASSENGER');
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(pointer: coarse)', addEventListener: () => {}, removeEventListener: () => {} }));
    serve({
      'GET /bookings/90/pay-driver': () => json({ driverName: 'Ravi Jadhav', upiId: 'ravi@okaxis', hasQr: false }),
      'GET /bookings': () => json([owing]),
    });
    open('/bookings');

    expect(await screen.findByRole('link', { name: 'Open in my UPI app' })).toHaveAttribute(
      'href',
      'upi://pay?pa=ravi%40okaxis&pn=Ravi%20Jadhav&am=520.00&cu=INR',
    );
  });

  it('says to pay in cash when the driver gave no UPI details', async () => {
    signIn('PASSENGER');
    serve({
      'GET /bookings/90/pay-driver': () => json({ driverName: 'Ravi Jadhav', upiId: null, hasQr: false }),
      'GET /bookings': () => json([owing]),
    });
    open('/bookings');

    expect(await screen.findByText('Pay Ravi Jadhav ₹520 in cash: they have not given a UPI ID or QR code.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument();
  });

  it('keeps how to pay behind a click on a confirmed booking, and shows it to nobody before that', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({
      'GET /bookings/91/pay-driver': () => json({ driverName: 'Ravi Jadhav', upiId: 'ravi@okaxis', hasQr: false }),
      'GET /bookings': () => json([{ ...booking, id: 91, status: 'CONFIRMED', driverId: 7 }, booking]),
      'GET /rides/12': () => json(rideWithRoute),
    });
    open('/bookings');

    expect(await screen.findByText('How to pay your driver')).toBeInTheDocument();
    // Only the confirmed one: a request still waiting for the driver does not ask.
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/bookings/91/pay-driver'))).toBe(true));
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/bookings/90/pay-driver'))).toBe(false);
  });

  it('lets the driver say how they were paid, but only after confirming', async () => {
    signIn('DRIVER');
    let aboard = [{ ...owing, driverRated: true }];
    const fetchMock = serve({
      'GET /rides/mine': () => json([{ ...rideWithRoute, status: 'COMPLETED', notes: null, maxTwoInBack: false, seriesSize: 1 }]),
      'GET /rides/12/bookings': () => json(aboard),
      'POST /bookings/90/payment-received': () => {
        aboard = [{ ...aboard[0], paymentStatus: 'SETTLED', paymentMethod: 'UPI' }];
        return json(aboard[0]);
      },
    });
    open('/rides');

    await userEvent.click(await screen.findByRole('button', { name: 'Show passengers' }));
    expect(await screen.findByText('₹520 owed to you')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Paid by UPI' }));
    expect(bodyOf(fetchMock, '/payment-received')).toBeUndefined(); // asks first
    await userEvent.click(screen.getByRole('button', { name: 'Yes, I was paid ₹520 by UPI' }));

    await waitFor(() => expect(bodyOf(fetchMock, '/payment-received')).toEqual({ method: 'UPI' }));
    expect(await screen.findByText('Paid by UPI')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Paid by UPI' })).not.toBeInTheDocument();
  });

  const profile = { email: 'user@example.test', emailVerified: false, phone: null, phoneVerified: false,
    bio: null, birthYear: null, gender: null, smoking: null, pets: null, music: null, chattiness: null };

  it('lets a driver save a UPI ID on their account, and shows why one is refused', async () => {
    signIn('DRIVER');
    let attempts = 0;
    const fetchMock = serve({
      'GET /me/profile': () => json(profile),
      'GET /me/emergency-contacts': () => json([]),
      'GET /me/payment-details/qr': () => json({ detail: 'No QR code' }, 404),
      'GET /me/payment-details': () => json({ upiId: null, hasQr: false }),
      'PUT /me/payment-details': () =>
        attempts++ === 0
          ? json({ detail: 'That does not look like a UPI ID. It looks like name@bank, as your UPI app shows it' }, 400)
          : json({ upiId: 'ravi@okaxis', hasQr: false }),
    });
    open('/account');

    const section = within(await screen.findByRole('region', { name: 'How passengers pay you' }));
    await userEvent.type(await section.findByLabelText(/Your UPI ID/), 'ravi@gmail.com');
    await userEvent.click(section.getByRole('button', { name: 'Save UPI ID' }));
    expect(await section.findByRole('alert')).toHaveTextContent('That does not look like a UPI ID');

    await userEvent.clear(section.getByLabelText(/Your UPI ID/));
    await userEvent.type(section.getByLabelText(/Your UPI ID/), 'ravi@okaxis');
    await userEvent.click(section.getByRole('button', { name: 'Save UPI ID' }));
    expect(await section.findByText('Your UPI ID is saved.')).toBeInTheDocument();
    const put = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT').at(-1);
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ upiId: 'ravi@okaxis' });
  });

  it('lets a driver upload a QR code, and sends the picture itself', async () => {
    signIn('DRIVER');
    const fetchMock = serve({
      'GET /me/profile': () => json(profile),
      'GET /me/emergency-contacts': () => json([]),
      'GET /me/payment-details/qr': () => json({ detail: 'No QR code' }, 404),
      'PUT /me/payment-details/qr': () => new Response(null, { status: 204 }),
      'GET /me/payment-details': () => json({ upiId: null, hasQr: false }),
    });
    open('/account');

    const section = within(await screen.findByRole('region', { name: 'How passengers pay you' }));
    expect(await section.findByRole('button', { name: 'Add a QR code' })).toBeInTheDocument();
    const picture = new File(['png'], 'qr.png', { type: 'image/png' });
    await userEvent.upload(section.getByLabelText('Choose your UPI QR code'), picture);

    await waitFor(() => {
      const put = fetchMock.mock.calls.find(([url, init]) => init?.method === 'PUT' && String(url).endsWith('/me/payment-details/qr'));
      expect(put?.[1]?.body).toBe(picture);
    });
  });

  it('is not asked of a passenger on their account', async () => {
    signIn('PASSENGER');
    serve({
      'GET /me/profile': () => json(profile),
      'GET /me/emergency-contacts': () => json([]),
    });
    open('/account');

    expect(await screen.findByRole('region', { name: 'Invite friends' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'How passengers pay you' })).not.toBeInTheDocument();
  });

  it('lets staff clear what is owed, only with a reason', async () => {
    signIn('ADMIN');
    let rows = [{ id: 90, rideId: 12, passengerName: 'Asha Patil', passengerId: 5, driverName: 'Ravi Jadhav', fromStop: 'Kolhapur', toStop: 'Pune',
      seats: 1, status: 'COMPLETED', createdAt: '2026-10-30T10:00:00Z', paymentStatus: 'DUE', amountDue: 520 }];
    const fetchMock = serve({
      'POST /admin/bookings/90/clear-due': () => {
        rows = [{ ...rows[0], paymentStatus: 'VOID', amountDue: null as unknown as number }];
        return json({});
      },
      'GET /admin/bookings': () => json(rows),
    });
    open('/admin/bookings');

    expect(await screen.findByText('Owes the driver ₹520')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear what is owed' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Why clear it/), 'Saw the UPI payment');
    await userEvent.click(screen.getByRole('button', { name: 'Clear what is owed' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, clear it' }));

    await waitFor(() => expect(bodyOf(fetchMock, '/clear-due')).toEqual({ reason: 'Saw the UPI payment' }));
    await waitFor(() => expect(screen.queryByText('Owes the driver ₹520')).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('checkbox', { name: 'Only those still owing a driver' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/admin/bookings?owing=true'))).toBe(true));
  });
});
describe('a screen that keeps itself current', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const reads = (fetchMock: ReturnType<typeof serve>, path: string) =>
    fetchMock.mock.calls.filter(([url]) => new URL(String(url)).pathname.endsWith(path)).length;
  const wait = (milliseconds: number) => act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });

  it('reads the seats left again and again but never searches again: a search is an event in the log', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    signIn('PASSENGER');
    const fetchMock = serve({ 'GET /rides/search': () => json([candidate]) });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
    await screen.findByText('Ravi Jadhav');
    await wait(65_000);

    expect(reads(fetchMock, '/rides/search')).toBe(1);
    expect(reads(fetchMock, '/rides/availability')).toBeGreaterThanOrEqual(3);
    const asked = fetchMock.mock.calls.map(([url]) => String(url)).find((url) => url.includes('/rides/availability'))!;
    expect(new URL(asked).searchParams.getAll('stretch')).toEqual(['12:0:2']);
  });

  it('shows a seat taken while the results are on screen, and will not book what no longer fits', async () => {
    signIn('PASSENGER');
    serve({
      'GET /rides/search': () => json([{ ...candidate, seatsAvailable: 3, instantBooking: true }]),
      'GET /rides/availability': () => json([{ rideId: 12, fromSeq: 0, toSeq: 2, status: 'SCHEDULED', seatsAvailable: 0 }]),
    });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));

    expect(await screen.findByText('0 seats left')).toBeInTheDocument();
    expect(screen.getByText('Too few seats are left on this ride now.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Book' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hold while I decide' })).toBeDisabled();
  });

  it('says so when a ride on screen is withdrawn', async () => {
    signIn('PASSENGER');
    serve({
      'GET /rides/search': () => json([{ ...candidate, instantBooking: true }]),
      'GET /rides/availability': () => json([{ rideId: 12, fromSeq: 0, toSeq: 2, status: 'CANCELLED', seatsAvailable: 3 }]),
    });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));

    expect(await screen.findByText('This ride is no longer available.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Book' })).toBeDisabled();
  });

  it('counts a hold down and offers it again when it runs out', async () => {
    signIn('PASSENGER');
    serve({
      'GET /rides/search': () => json([candidate]),
      'POST /holds': () => json({ rideId: 12, fromSeq: 0, toSeq: 2, seats: 1, expiresAt: new Date(Date.now() + 1500).toISOString() }, 201),
    });
    open('/search');

    await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Hold while I decide' }));

    expect(await screen.findByRole('meter', { name: 'Time left on the hold' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Hold while I decide' }, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByRole('meter', { name: 'Time left on the hold' })).not.toBeInTheDocument();
  });

  it('brings news in without a reload: the message floats in and the lists are read again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    signIn('PASSENGER');
    let unread = 0;
    const fetchMock = serve({
      'GET /notifications/unread-count': () => json({ unread }),
      'GET /notifications': () => json([{ id: 'n1', type: 'BOOKING', message: 'The driver accepted your booking.', text: null, bookingId: 90, createdAt: new Date().toISOString(), read: false }]),
      'GET /bookings': () => json([]),
    });
    open('/bookings');
    await screen.findByRole('heading', { name: 'My bookings' });
    await screen.findByText('You have no bookings yet.');
    const before = reads(fetchMock, '/bookings');

    unread = 1;
    await wait(16_000);

    const message = await screen.findByRole('button', { name: 'The driver accepted your booking.' });
    expect(reads(fetchMock, '/bookings')).toBeGreaterThan(before);
    expect(document.title).toBe('(1) VAYORA');

    await userEvent.click(message);
    expect(await screen.findByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('raises nothing for the unread count it first finds: that is not news', async () => {
    signIn('PASSENGER');
    serve({ 'GET /notifications/unread-count': () => json({ unread: 4 }), 'GET /bookings': () => json([]) });
    open('/bookings');

    await screen.findByText('You have no bookings yet.');
    await waitFor(() => expect(document.title).toBe('(4) VAYORA'));
    expect(screen.queryByRole('button', { name: /accepted/ })).not.toBeInTheDocument();
  });

  it('says when there is no connection, and when it comes back', async () => {
    signIn('PASSENGER');
    serve({ 'GET /bookings': () => json([]) });
    open('/bookings');
    await screen.findByRole('heading', { name: 'My bookings' });
    const online = vi.spyOn(navigator, 'onLine', 'get');

    online.mockReturnValue(false);
    act(() => void window.dispatchEvent(new Event('offline')));
    expect(await screen.findByText('You are offline. What you see may be out of date.')).toBeInTheDocument();

    online.mockReturnValue(true);
    act(() => void window.dispatchEvent(new Event('online')));
    expect(await screen.findByText('Back online')).toBeInTheDocument();
    expect(screen.queryByText('You are offline. What you see may be out of date.')).not.toBeInTheDocument();
    online.mockRestore();
  });

  it('opens the newest notifications from the bell and marks them read in place', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({
      'GET /notifications/unread-count': () => json({ unread: 1 }),
      'GET /notifications': () => json([{ id: 'n1', type: 'BOOKING', message: 'Your trip is complete.', text: null, bookingId: 90, createdAt: new Date().toISOString(), read: false }]),
      'POST /notifications/read-all': () => new Response(null, { status: 204 }),
      'GET /bookings': () => json([]),
    });
    open('/bookings');

    await userEvent.click(await screen.findByRole('button', { name: 'Recent notifications' }));

    expect(await screen.findByText('Your trip is complete.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => init?.method === 'POST' && String(url).endsWith('/notifications/read-all'))).toBe(true));
    expect(screen.getByRole('link', { name: 'See all notifications' })).toHaveAttribute('href', '/notifications');
  });
});

describe('a booking as it goes', () => {
  const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
  const stage = (name: string) => within(screen.getByRole('list', { name: 'How far this booking has got' })).getByText(name).closest('li');

  it('shows how far it has got, how long until it leaves, and what cancelling costs right now', async () => {
    signIn('PASSENGER');
    serve({
      'GET /bookings': () => json([{ ...booking, status: 'CONFIRMED', boardingTime: inHours(30) }]),
      'GET /rides/12': () => json(rideWithRoute),
    });
    open('/bookings');

    expect(await screen.findByText(/Leaves in 1 day|Leaves in 30 h/)).toBeInTheDocument();
    expect(stage('Accepted')).toHaveAttribute('aria-current', 'step');
    // Thirty hours out is the 50% tier; six hours from now the whole fare is owed.
    expect(await screen.findByText('If you cancel now, you owe your driver ₹260. In 6 h that rises to ₹520.')).toBeInTheDocument();
  });

  it('says when the whole fare would be owed', async () => {
    signIn('PASSENGER');
    serve({
      'GET /bookings': () => json([{ ...booking, status: 'CONFIRMED', boardingTime: inHours(3) }]),
      'GET /rides/12': () => json(rideWithRoute),
    });
    open('/bookings');

    expect(await screen.findByText('If you cancel now, you owe your driver the whole fare.')).toBeInTheDocument();
  });

  it('says when cancelling would cost nothing yet', async () => {
    signIn('PASSENGER');
    serve({
      'GET /bookings': () => json([{ ...booking, status: 'CONFIRMED', boardingTime: inHours(72) }]),
      'GET /rides/12': () => json(rideWithRoute),
    });
    open('/bookings');

    expect(await screen.findByText(/If you cancel now, you owe nothing\. In .* that rises to ₹260\./)).toBeInTheDocument();
  });
  it('moves on when the driver sets off, and points to where they are', async () => {
    signIn('PASSENGER');
    serve({
      'GET /bookings': () => json([{ ...booking, status: 'CONFIRMED', boardingTime: inHours(1) }]),
      'GET /rides/12': () => json({ ...rideWithRoute, status: 'IN_PROGRESS' }),
    });
    open('/bookings');

    expect(await screen.findByText('Your ride is on the road. Open the chat to see where the driver is.')).toBeInTheDocument();
    expect(stage('Under way')).toHaveAttribute('aria-current', 'step');
  });

  it('keeps bookings coming up apart from earlier ones', async () => {
    signIn('PASSENGER');
    serve({
      'GET /bookings': () => json([
        { ...booking, id: 91, status: 'COMPLETED', passengerRated: true, passengerConfirmed: true },
        { ...booking, id: 92, status: 'CONFIRMED', boardingTime: inHours(30) },
      ]),
      'GET /rides/12': () => json(rideWithRoute),
    });
    open('/bookings');

    expect(await screen.findByRole('heading', { name: 'Coming up' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Earlier' })).toBeInTheDocument();
  });
});

describe('choosing a place', () => {
  it('finds it from a few letters, takes the arrow keys, and searches from where it is', async () => {
    signIn('PASSENGER');
    const fetchMock = serve({ 'GET /rides/search': () => json([]) });
    open('/search');
    const from = await screen.findByLabelText('From');

    await userEvent.click(from);
    await userEvent.keyboard('che');
    expect(screen.getByRole('option', { name: 'Chennai' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Pune' })).not.toBeInTheDocument();
    await userEvent.keyboard('{ArrowDown}{ArrowUp}{Enter}');

    expect(from).toHaveValue('Chennai');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/rides/search'))).toBe(true));
    const asked = new URL(String(fetchMock.mock.calls.find(([url]) => String(url).includes('/rides/search'))![0]));
    expect(asked.searchParams.get('originLat')).toBe(String(placeNamed('Chennai')!.lat));
  });

  it('finds the places of a state, and says when there is no such place', async () => {
    signIn('PASSENGER');
    serve({});
    open('/search');

    await userEvent.click(await screen.findByLabelText('To'));
    await userEvent.keyboard('Goa');
    expect(screen.getByRole('option', { name: 'Panaji' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Margao' })).toBeInTheDocument();

    await userEvent.keyboard('{Backspace}{Backspace}{Backspace}atlantis');
    expect(screen.getByText(/No place by that name is listed/)).toBeInTheDocument();
  });

  it('leaves what was chosen alone when nothing new is picked', async () => {
    signIn('PASSENGER');
    serve({});
    open('/search');
    const to = await screen.findByLabelText('To');

    await userEvent.click(to);
    await userEvent.keyboard('Chen{Escape}');

    expect(to).toHaveValue('Pune');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('offers the nearest listed city to where the device is', async () => {
    signIn('PASSENGER');
    serve({});
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (found: (position: { coords: { latitude: number; longitude: number } }) => void) => found({ coords: { latitude: 19.1, longitude: 72.9 } }) },
    });
    open('/search');
    const from = await screen.findByLabelText('From');

    await userEvent.click(from);
    await userEvent.click(screen.getByRole('option', { name: 'Near me' }));

    await waitFor(() => expect(from).toHaveValue('Mumbai'));
    delete (navigator as { geolocation?: unknown }).geolocation;
  });

  it('swaps the two ends, and takes a date from the next seven days in a press', async () => {
    signIn('PASSENGER');
    serve({});
    open('/search');
    const from = await screen.findByLabelText('From');

    await userEvent.click(screen.getByRole('button', { name: 'Swap start and destination' }));
    expect(from).toHaveValue('Pune');
    expect(screen.getByLabelText('To')).toHaveValue('Kolhapur');

    await userEvent.click(screen.getByRole('button', { name: 'Tomorrow' }));
    const today = todayInIndia();
    expect(screen.getByLabelText('Date')).toHaveValue(todayInIndia(new Date(Date.parse(`${today}T12:00:00+05:30`) + 86_400_000)));
    expect(screen.getByRole('button', { name: 'Tomorrow' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('carries a route chosen on the front page past signing up to the search', async () => {
    open('/');
    await pickPlace('To', 'Mumbai');
    await userEvent.click(screen.getByRole('button', { name: 'Find a ride' }));
    expect(await screen.findByRole('heading', { name: 'Create an account' })).toBeInTheDocument();
    expect(screen.getByLabelText('I want to')).toHaveValue('PASSENGER');
    cleanup();

    signIn('PASSENGER');
    serve({});
    open('/search');

    expect(await screen.findByLabelText('To')).toHaveValue('Mumbai');
  });
});

describe('a driver\'s rides at a glance', () => {
  const ride = {
    ...rideWithRoute,
    seriesSize: 1,
    maxTwoInBack: false,
    womenOnly: false,
    notes: null,
    departureTime: new Date(Date.now() + 3 * 3_600_000).toISOString(),
    segments: [
      { seq: 0, price: 270, seatsTotal: 3, seatsAvailable: 1 },
      { seq: 1, price: 250, seatsTotal: 3, seatsAvailable: 2 },
    ],
  };

  it('counts what is ahead from the fullest stretch of each ride, and shows each stretch filling', async () => {
    signIn('DRIVER');
    serve({ 'GET /rides/mine': () => json([ride]) });
    open('/rides');

    expect(await screen.findByText('Rides ahead')).toBeInTheDocument();
    expect(screen.getByText('Seats booked on them')).toBeInTheDocument();
    expect(screen.getByText('Your next ride')).toBeInTheDocument();
    expect(screen.getAllByText(/Leaves in 3 h/).length).toBeGreaterThan(0);
    expect(screen.getByRole('meter', { name: /Kolhapur → Satara/ })).toHaveAttribute('aria-valuenow', '67');
    expect(screen.getByRole('meter', { name: /Satara → Pune/ })).toHaveAttribute('aria-valuenow', '33');
  });

  it('leaves the figures out when nothing is ahead', async () => {
    signIn('DRIVER');
    serve({ 'GET /rides/mine': () => json([{ ...ride, status: 'COMPLETED' }]) });
    open('/rides');

    await screen.findByRole('meter', { name: /Kolhapur → Satara/ });
    expect(screen.queryByText('Rides ahead')).not.toBeInTheDocument();
  });
});

describe('getting set up as a driver', () => {
  const profile = { email: 'driver@example.test', emailVerified: false, phone: null, phoneVerified: false,
    bio: null, birthYear: null, gender: null, smoking: null, pets: null, music: null, chattiness: null };
  const ride = { ...rideWithRoute, status: 'SCHEDULED', notes: null, maxTwoInBack: false, seriesSize: 1 };

  it('lists what is left in order, each step a link to where it is done', async () => {
    signIn('DRIVER');
    serve({
      'GET /rides/mine': () => json([]),
      'GET /vehicles': () => json([]),
      'GET /me/payment-details': () => json({ upiId: null, hasQr: false }),
      'GET /me/profile': () => json(profile),
    });
    open('/rides');

    expect(await screen.findByRole('heading', { name: 'Get set up' })).toBeInTheDocument();
    expect(screen.getByText('0 of 4 done')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add your car' })).toHaveAttribute('href', '/vehicles');
    expect(screen.getByRole('link', { name: 'Add your UPI ID or QR code, so passengers can pay you' })).toHaveAttribute('href', '/account#payment');
    expect(screen.getByRole('link', { name: 'Confirm your email or phone' })).toHaveAttribute('href', '/account#contact');
    expect(screen.getByRole('link', { name: 'Publish your first ride' })).toHaveAttribute('href', '/rides/new');
  });

  it('marks what is done and counts it', async () => {
    signIn('DRIVER');
    serve({
      'GET /rides/mine': () => json([]),
      'GET /vehicles': () => json([{ id: 4 }]),
      'GET /me/payment-details': () => json({ upiId: null, hasQr: true }),
      'GET /me/profile': () => json(profile),
    });
    open('/rides');

    expect(await screen.findByText('2 of 4 done')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add your car: done' })).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Get set up' })).toHaveAttribute('aria-valuenow', '50');
  });

  it('is gone once everything is done', async () => {
    signIn('DRIVER');
    const fetchMock = serve({
      'GET /rides/mine': () => json([ride]),
      'GET /vehicles': () => json([{ id: 4 }]),
      'GET /me/payment-details': () => json({ upiId: 'ravi@okaxis', hasQr: false }),
      'GET /me/profile': () => json({ ...profile, phoneVerified: true }),
    });
    open('/rides');

    expect(await screen.findByText('Rides ahead')).toBeInTheDocument();
    // Every answer it depends on has come back, so its absence is a decision, not a wait.
    const asked = (path: string) => fetchMock.mock.calls.some(([url]) => new URL(String(url)).pathname.endsWith(path));
    await waitFor(() => expect(['/vehicles', '/me/payment-details', '/me/profile'].every(asked)).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('heading', { name: 'Get set up' })).not.toBeInTheDocument();
  });
});

describe('easier on a phone', () => {
  const vehicle = { id: 3, make: 'Maruti', model: 'Ertiga', year: 2022, colour: 'Silver', seats: 7 };

  it('folds the search into one line once searched, and opens it again to change it', async () => {
    signIn('PASSENGER');
    serve({ 'GET /rides/search': () => json([candidate]) });
    open('/search');

    await userEvent.clear(await screen.findByLabelText('Seats'));
    await userEvent.type(screen.getByLabelText('Seats'), '2');
    // Whether to be rebooked is part of the search, chosen before any result is in view.
    expect(screen.getByRole('combobox', { name: 'If the driver withdraws' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    await screen.findByRole('region', { name: 'Search results' });
    const summary = screen.getByText('Kolhapur → Pune').closest('div')!;
    expect(within(summary).getByText(/2 seats/)).toBeInTheDocument();
    const change = within(summary).getByRole('button', { name: 'Change search' });
    // The button pressed has gone, so the reader's place moves to the one that brings it back.
    await waitFor(() => expect(change).toHaveFocus());
    expect(screen.queryByRole('spinbutton', { name: 'Seats' })).not.toBeInTheDocument();

    await userEvent.click(change);
    expect(screen.getByRole('spinbutton', { name: 'Seats' })).toHaveValue(2);
    expect(screen.queryByRole('button', { name: 'Change search' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Search results' })).toBeInTheDocument();
  });

  it("lays a booking's actions out in one row, and keeps cancelling quiet with its cost in the sheet", async () => {
    signIn('PASSENGER');
    const fetchMock = serve({ 'GET /bookings': () => json([{ ...booking, status: 'CONFIRMED' }]) });
    open('/bookings');

    expect(await screen.findByRole('button', { name: 'Show meeting point' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open chat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Call the driver' })).toBeInTheDocument();
    // The rules sit behind a line on the page rather than in a box on every visit.
    expect(screen.getByText('What cancelling costs').closest('details')).not.toHaveAttribute('open');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    const sheet = screen.getByRole('dialog', { name: 'Cancel booking' });
    expect(await within(sheet).findByText('48 hours or more before boarding: nothing to pay.')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Yes, cancel it' })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it("offers to start a ride only once it may be started, and keeps a later ride's passengers folded", async () => {
    signIn('DRIVER');
    const leaves = Date.now() + 3 * 86_400_000;
    const ride = {
      ...rideWithRoute,
      departureTime: new Date(leaves).toISOString(),
      startsFrom: new Date(leaves - 3_600_000).toISOString(),
      notes: null,
      maxTwoInBack: false,
      seriesSize: 1,
    };
    serve({ 'GET /rides/mine': () => json([ride]), 'GET /rides/12/bookings': () => json([booking]) });
    open('/rides');

    expect(await screen.findByText(/^You can start it from /)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start ride' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show passengers' })).toBeInTheDocument();
  });

  it('keeps the optional parts of publishing folded, opens one holding a mistake, and asks for every price', async () => {
    signIn('DRIVER');
    const fetchMock = serve({ 'GET /vehicles': () => json([vehicle]) });
    open('/rides/new');

    fireEvent.change(await screen.findByLabelText('Leaving at'), { target: { value: '2030-01-01T07:00' } });
    // The time chosen is said back in words, where a date box alone can be misread.
    expect(screen.getByText(/, in your device's local time$/)).toBeInTheDocument();
    const optional = screen.getByText('Who rides, and how').closest('details')!;
    expect(optional).not.toHaveAttribute('open');
    expect(screen.getByText('Return and repeat').closest('details')).not.toHaveAttribute('open');
    // A price starts empty: a free ride is something the driver types, never what they leave.
    expect(screen.getByLabelText('Price to Pune (₹)')).toHaveValue(null);

    const detour = screen.getByLabelText('Minutes you will go out of your way, in all, to pick passengers up at their own point');
    await userEvent.clear(detour);
    await userEvent.type(detour, '45');
    await userEvent.click(screen.getByRole('button', { name: 'Publish ride' }));

    expect(await screen.findByText('Enter a price, or 0 for a free ride')).toBeInTheDocument();
    expect(screen.getByText('At most 30 minutes')).toBeInTheDocument();
    await waitFor(() => expect(optional).toHaveAttribute('open'));
    expect(fetchMock.mock.calls.some(([url, init]) => init?.method === 'POST' && new URL(String(url)).pathname.endsWith('/rides'))).toBe(false);
  });

  it('lists the account as rows that say where each stands, and opens the one a link points at', async () => {
    signIn('DRIVER');
    serve({
      'GET /me/profile': () => json({ email: 'user@example.test', emailVerified: true, phone: null, phoneVerified: false }),
      'GET /me/emergency-contacts': () => json([]),
      // Before the details: the first route whose prefix matches answers.
      'GET /me/payment-details/qr': () => json({ detail: 'No QR code' }, 404),
      'GET /me/payment-details': () => json({ upiId: 'ravi@okaxis', hasQr: false }),
    });
    open('/account#payment');

    // A row is its summary line; a title may also appear inside the row it opens.
    const row = (title: string) => screen.getAllByText(title).map((element) => element.closest('summary')).find(Boolean)!;
    await screen.findByText('How passengers pay you');
    await waitFor(() => expect(row('How passengers pay you').parentElement).toHaveAttribute('open'));
    expect(await within(row('How passengers pay you')).findByText('ravi@okaxis')).toBeInTheDocument();
    expect(row('Profile').parentElement).not.toHaveAttribute('open');
    expect(within(row('Email and phone')).getByText('Confirmed')).toBeInTheDocument();
    expect(await within(row('Emergency contacts')).findByText('None yet')).toBeInTheDocument();
    expect(within(row('Identity document')).getByText('Not declared')).toBeInTheDocument();
  });
});

describe('the assistant', () => {
  const on = { enabled: true, max_messages: 20, max_message_chars: 2000 };
  // As newer browsers do, scrolling answers with a promise: an effect returning it would crash the page.
  beforeEach(() => Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: () => Promise.resolve() }));
  afterEach(() => Reflect.deleteProperty(Element.prototype, 'scrollIntoView'));
  const replies = (fetchMock: ReturnType<typeof serve>) =>
    fetchMock.mock.calls
      .filter(([url]) => String(url).endsWith('/v1/assistant/reply'))
      .map(([, init]) => JSON.parse(String(init?.body)));

  it('says when it is switched off, and offers nothing to type into', async () => {
    signIn('PASSENGER');
    serve({ 'GET /v1/assistant': () => json({ ...on, enabled: false }) });
    open('/assistant');

    expect(await screen.findByText('The assistant is switched off on this server.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Your question')).not.toBeInTheDocument();
  });

  it("sends the whole conversation in the reader's language, and shows each answer as text", async () => {
    signIn('PASSENGER');
    const answers = ['Nothing to pay, <b>48 hours</b> or more before boarding.', 'Half the fare.'];
    const fetchMock = serve({
      'GET /v1/assistant': () => json(on),
      'POST /v1/assistant/reply': () => json({ reply: answers.shift(), declined: false }),
    });
    open('/assistant');

    // A question to start from takes one tap.
    await userEvent.click(await screen.findByRole('button', { name: 'What does cancelling cost?' }));
    // Markup in an answer is shown as the characters it is, never made into markup.
    expect(await screen.findByText('Nothing to pay, <b>48 hours</b> or more before boarding.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Conversation' }).querySelector('b')).toBeNull();

    await userEvent.type(screen.getByLabelText('Your question'), 'And a day before?{Enter}');
    expect(await screen.findByText('Half the fare.')).toBeInTheDocument();
    // intel keeps nothing, so each question carries the conversation before it.
    expect(replies(fetchMock)[1]).toEqual({
      language: 'en',
      messages: [
        { role: 'user', content: 'What does cancelling cost?' },
        { role: 'assistant', content: 'Nothing to pay, <b>48 hours</b> or more before boarding.' },
        { role: 'user', content: 'And a day before?' },
      ],
    });

    await userEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(screen.queryByText('Half the fare.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'What does cancelling cost?' })).toBeInTheDocument();
  });

  it('says when it will not answer, and leaves that question out of the next', async () => {
    signIn('PASSENGER');
    const answers = [{ reply: null, declined: true }, { reply: 'Cash or UPI, to your driver.', declined: false }];
    const fetchMock = serve({
      'GET /v1/assistant': () => json(on),
      'POST /v1/assistant/reply': () => json(answers.shift()),
    });
    open('/assistant');

    await userEvent.type(await screen.findByLabelText('Your question'), 'Write me a poem{Enter}');
    expect(await screen.findByText('The assistant cannot help with that. Ask about how VAYORA works.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Your question'), 'How do I pay?{Enter}');
    expect(await screen.findByText('Cash or UPI, to your driver.')).toBeInTheDocument();

    expect(replies(fetchMock)[1].messages).toEqual([{ role: 'user', content: 'How do I pay?' }]);
  });

  it('gives the question back, with the reason, when no answer could be had', async () => {
    signIn('PASSENGER');
    serve({
      'GET /v1/assistant': () => json(on),
      'POST /v1/assistant/reply': () => json({ detail: 'The assistant is busy. Try again in a minute.' }, 503),
    });
    open('/assistant');

    await userEvent.type(await screen.findByLabelText('Your question'), 'How do I pay?{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('The assistant is busy. Try again in a minute.');
    expect(screen.getByLabelText('Your question')).toHaveValue('How do I pay?');
  });

  it("starts a driver from a driver's questions, and is in the driver's pages", async () => {
    signIn('DRIVER');
    serve({ 'GET /v1/assistant': () => json(on) });
    open('/assistant');

    expect(await screen.findByRole('button', { name: 'How do I publish a ride?' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'How do I pay my driver?' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Assistant' }).length).toBeGreaterThan(0);
  });
});
