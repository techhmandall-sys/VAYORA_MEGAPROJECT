import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../lib/auth';
import { RideChat } from './RideChat';

// A stand-in for the gateway connection. `answers` says what the gateway replies to each
// request; `push` delivers something the gateway sends unasked.
const gateway = vi.hoisted(() => {
  const handlers: Record<string, (payload?: unknown) => void> = {};
  const state = {
    answers: {} as Record<string, (payload: Record<string, unknown>) => unknown>,
    requests: [] as [string, Record<string, unknown>][],
    options: undefined as { auth?: { token?: string } } | undefined,
    disconnected: false,
    connects: true,
  };
  const socket = {
    on(event: string, handler: (payload?: unknown) => void) {
      handlers[event] = handler;
      // A real socket connects a moment after it is created.
      if (event === (state.connects ? 'connect' : 'connect_error')) queueMicrotask(() => handler());
      return socket;
    },
    timeout: () => socket,
    emitWithAck: async (event: string, payload: Record<string, unknown>) => {
      state.requests.push([event, payload]);
      return state.answers[event](payload);
    },
    disconnect: () => {
      state.disconnected = true;
    },
  };
  return { state, socket, push: (event: string, payload?: unknown) => handlers[event]?.(payload) };
});

vi.mock('socket.io-client', () => ({
  io: (_url: string, options: { auth?: { token?: string } }) => {
    gateway.state.options = options;
    return gateway.socket;
  },
}));

const message = { id: 'm1', rideId: 12, senderId: 7, senderName: 'Ravi Jadhav', text: 'Leaving in ten minutes.', sentAt: '2026-11-02T01:20:00Z' };

function joinedAs(role: 'DRIVER' | 'PASSENGER', rideStatus = 'SCHEDULED', extra: object = {}) {
  gateway.state.answers['ride:join'] = () => ({ ok: true, role, rideStatus, messages: [message], location: null, ...extra });
}

function openChat(role: 'DRIVER' | 'PASSENGER' = 'PASSENGER', rideStatus?: 'SCHEDULED' | 'IN_PROGRESS') {
  sessionStorage.setItem(
    'vayora.session',
    JSON.stringify({ accessToken: 'session-token', expiresInSeconds: 3600, user: { id: role === 'DRIVER' ? 7 : 1, email: 'a@example.test', fullName: 'Asha Patil', role } }),
  );
  return render(
    <AuthProvider>
      <RideChat rideId={12} rideStatus={rideStatus} />
    </AuthProvider>,
  );
}

beforeEach(() => {
  gateway.state.answers = {};
  gateway.state.requests = [];
  gateway.state.disconnected = false;
  gateway.state.connects = true;
});

describe('ride chat', () => {
  it('connects with the session token, joins the ride and shows what was said before', async () => {
    joinedAs('PASSENGER');
    openChat();

    const messages = await screen.findByRole('list', { name: 'Messages' });
    expect(within(messages).getByText('Leaving in ten minutes.')).toBeInTheDocument();
    expect(within(messages).getByText('Ravi Jadhav')).toBeInTheDocument();
    expect(gateway.state.options?.auth?.token).toBe('session-token');
    expect(gateway.state.requests[0]).toEqual(['ride:join', { rideId: 12 }]);
  });

  it('sends a message, clears the box, and shows it when the gateway relays it back', async () => {
    joinedAs('PASSENGER');
    gateway.state.answers['chat:send'] = () => ({ ok: true, id: 'm2' });
    openChat();

    const box = await screen.findByLabelText('Message everyone on this ride');
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled(); // nothing typed yet
    await userEvent.type(box, 'I am at the bus stand gate.');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(gateway.state.requests.at(-1)).toEqual(['chat:send', { rideId: 12, text: 'I am at the bus stand gate.' }]);
    expect(box).toHaveValue('');
    // Not shown until the gateway says so: what is on screen is what everyone got.
    expect(screen.queryByText('I am at the bus stand gate.')).not.toBeInTheDocument();

    act(() => gateway.push('chat:message', { ...message, id: 'm2', senderId: 1, senderName: 'Asha Patil', text: 'I am at the bus stand gate.' }));
    const mine = (await screen.findByText('I am at the bus stand gate.')).closest('li')!;
    expect(within(mine).getByText('You')).toBeInTheDocument();
  });

  it('shows a message only once when the gateway delivers it twice', async () => {
    joinedAs('PASSENGER');
    openChat();
    await screen.findByText('Leaving in ten minutes.');

    act(() => gateway.push('chat:message', message));

    expect(screen.getAllByText('Leaving in ten minutes.')).toHaveLength(1);
  });

  it('ignores a message for another ride', async () => {
    joinedAs('PASSENGER');
    openChat();
    await screen.findByText('Leaving in ten minutes.');

    act(() => gateway.push('chat:message', { ...message, id: 'x', rideId: 99, text: 'not for this ride' }));

    expect(screen.queryByText('not for this ride')).not.toBeInTheDocument();
  });

  it('says why a message was not sent and keeps what was typed', async () => {
    joinedAs('PASSENGER');
    gateway.state.answers['chat:send'] = () => ({ ok: false, error: 'rate_limited' });
    openChat();

    const box = await screen.findByLabelText('Message everyone on this ride');
    await userEvent.type(box, 'hello');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('You are sending messages too quickly. Wait a moment.');
    expect(box).toHaveValue('hello');
  });

  it('renders a message as text, whatever it contains', async () => {
    gateway.state.answers['ride:join'] = () => ({
      ok: true, role: 'PASSENGER', rideStatus: 'SCHEDULED', location: null,
      messages: [{ ...message, text: '<img src=x onerror=alert(1)>' }],
    });
    openChat();

    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('explains when the person is not on the ride', async () => {
    gateway.state.answers['ride:join'] = () => ({ ok: false, error: 'not_a_member' });
    openChat();

    expect(await screen.findByText('The chat is only for the driver and passengers booked on this ride.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Message everyone on this ride')).not.toBeInTheDocument();
  });

  it('says so when the gateway cannot be reached', async () => {
    gateway.state.connects = false;
    openChat();

    expect(await screen.findByRole('alert')).toHaveTextContent('The chat service cannot be reached. Try again.');
  });

  it('joins again after the connection drops and comes back, picking up what was missed', async () => {
    joinedAs('PASSENGER');
    openChat();
    await screen.findByText('Leaving in ten minutes.');

    gateway.state.answers['ride:join'] = () => ({
      ok: true, role: 'PASSENGER', rideStatus: 'IN_PROGRESS', location: null,
      messages: [message, { ...message, id: 'm3', text: 'We have set off.' }],
    });
    await act(async () => gateway.push('connect'));

    expect(await screen.findByText('We have set off.')).toBeInTheDocument();
    expect(gateway.state.requests.filter(([event]) => event === 'ride:join')).toHaveLength(2);
  });

  it('closes the connection when the chat is closed', async () => {
    joinedAs('PASSENGER');
    const { unmount } = openChat();
    await screen.findByText('Leaving in ten minutes.');

    unmount();

    expect(gateway.state.disconnected).toBe(true);
  });
});

describe('live position', () => {
  it("shows a passenger the driver's position and when it was reported", async () => {
    joinedAs('PASSENGER', 'IN_PROGRESS');
    openChat();
    await screen.findByText('Leaving in ten minutes.');
    expect(screen.queryByRole('img')).not.toBeInTheDocument(); // nothing reported yet

    act(() => gateway.push('location', { rideId: 12, lat: 17.289, lon: 74.1818, at: '2026-11-02T02:45:00Z' }));

    expect(await screen.findByRole('status')).toHaveTextContent("The driver's position at 8:15 am");
    expect(screen.getByRole('img', { name: "Map showing the driver's last known position" })).toBeInTheDocument();
  });

  it('moves the driver on the map as positions come in, drawing where they have been', async () => {
    joinedAs('PASSENGER', 'IN_PROGRESS');
    openChat();
    await screen.findByText('Leaving in ten minutes.');

    act(() => gateway.push('location', { rideId: 12, lat: 17.289, lon: 74.1818, at: new Date().toISOString() }));
    expect(await screen.findByTestId('moving')).toBeInTheDocument();
    act(() => gateway.push('location', { rideId: 12, lat: 17.31, lon: 74.19, at: new Date().toISOString() }));

    await waitFor(() => expect(screen.getAllByTestId('route')[0]).toHaveAttribute('data-points', '2'));
    expect(screen.getAllByTestId('moving')).toHaveLength(1);
  });

  it('keeps what was said on screen when the connection drops, and says it is coming back', async () => {
    joinedAs('PASSENGER');
    openChat();
    await screen.findByText('Leaving in ten minutes.');
    expect(screen.getByText('Connected')).toBeInTheDocument();

    act(() => gateway.push('disconnect'));

    expect(await screen.findByText('Connection lost. Reconnecting…')).toBeInTheDocument();
    expect(screen.getByText('Leaving in ten minutes.')).toBeInTheDocument();

    await act(async () => {
      gateway.push('connect');
    });
    expect(await screen.findByText('Connected')).toBeInTheDocument();
  });

  it('offers position sharing to the driver only while the ride is under way', async () => {
    joinedAs('DRIVER', 'SCHEDULED');
    const { unmount } = openChat('DRIVER');
    await screen.findByText('Leaving in ten minutes.');
    expect(screen.queryByRole('button', { name: 'Share my position with passengers' })).not.toBeInTheDocument();
    unmount();

    joinedAs('DRIVER', 'IN_PROGRESS');
    openChat('DRIVER');
    expect(await screen.findByRole('button', { name: 'Share my position with passengers' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('offers position sharing once the ride starts, though the chat was opened before', async () => {
    // Found in a real browser: the chat joined while the ride was scheduled and kept that.
    joinedAs('DRIVER', 'SCHEDULED');
    const { rerender } = openChat('DRIVER', 'SCHEDULED');
    await screen.findByText('Leaving in ten minutes.');
    expect(screen.queryByRole('button', { name: 'Share my position with passengers' })).not.toBeInTheDocument();

    rerender(
      <AuthProvider>
        <RideChat rideId={12} rideStatus="IN_PROGRESS" />
      </AuthProvider>,
    );
    expect(await screen.findByRole('button', { name: 'Share my position with passengers' })).toBeInTheDocument();
  });

  it('never offers position sharing to a passenger', async () => {
    joinedAs('PASSENGER', 'IN_PROGRESS');
    openChat();
    await screen.findByText('Leaving in ten minutes.');

    expect(screen.queryByRole('button', { name: /position/ })).not.toBeInTheDocument();
  });

  it('sends the device position once sharing is on, and stops watching when it is turned off', async () => {
    joinedAs('DRIVER', 'IN_PROGRESS');
    gateway.state.answers['location:update'] = () => ({ ok: true });
    const clearWatch = vi.fn();
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: {
        watchPosition: (onPosition: (position: { coords: { latitude: number; longitude: number } }) => void) => {
          onPosition({ coords: { latitude: 17.289, longitude: 74.1818 } });
          return 42;
        },
        clearWatch,
      },
    });
    openChat('DRIVER');

    await userEvent.click(await screen.findByRole('button', { name: 'Share my position with passengers' }));

    expect(gateway.state.requests.at(-1)).toEqual(['location:update', { rideId: 12, lat: 17.289, lon: 74.1818 }]);
    expect(screen.getByText(/can see where you are until you stop or the ride ends/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Stop sharing my position' }));
    expect(clearWatch).toHaveBeenCalledWith(42);
  });

  it('turns sharing off and says why when location access is refused', async () => {
    joinedAs('DRIVER', 'IN_PROGRESS');
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: {
        watchPosition: (_ok: unknown, onError: (error: { code: number }) => void) => (onError({ code: 1 }), 1),
        clearWatch: vi.fn(),
      },
    });
    openChat('DRIVER');

    await userEvent.click(await screen.findByRole('button', { name: 'Share my position with passengers' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Your position is not available. Check that location access is allowed.');
    expect(screen.getByRole('button', { name: 'Share my position with passengers' })).toHaveAttribute('aria-pressed', 'false');
  });

  // Found driving the app in a browser: one moment without a fix ended sharing for good.
  it('keeps sharing through a moment without a position, and says so until one arrives', async () => {
    joinedAs('DRIVER', 'IN_PROGRESS');
    gateway.state.answers['location:update'] = () => ({ ok: true });
    let report: { ok: (position: { coords: { latitude: number; longitude: number } }) => void; fail: (error: { code: number }) => void } | undefined;
    const clearWatch = vi.fn();
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: {
        watchPosition: (ok: NonNullable<typeof report>['ok'], fail: NonNullable<typeof report>['fail']) => {
          report = { ok, fail };
          return 7;
        },
        clearWatch,
      },
    });
    openChat('DRIVER');
    await userEvent.click(await screen.findByRole('button', { name: 'Share my position with passengers' }));

    act(() => report?.fail({ code: 2 }));

    expect(await screen.findByText(/cannot be found just now/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop sharing my position' })).toHaveAttribute('aria-pressed', 'true');
    expect(clearWatch).not.toHaveBeenCalled();

    act(() => report?.ok({ coords: { latitude: 16.95, longitude: 74.25 } }));

    await waitFor(() => expect(screen.queryByText(/cannot be found just now/)).not.toBeInTheDocument());
    expect(gateway.state.requests.at(-1)).toEqual(['location:update', { rideId: 12, lat: 16.95, lon: 74.25 }]);
  });
});
