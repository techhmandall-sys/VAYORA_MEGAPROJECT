// The live connection to the gateway for one ride: its chat and the driver's position.
//
// The gateway decides everything that matters (who is on the ride, who may send a
// position, how fast). This only reflects what it says.

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { getToken } from './api';
import type { RideStatus } from './types';

const GATEWAY = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:3000';
const ACK_TIMEOUT_MS = 5000;

export interface ChatMessage {
  id: string;
  rideId: number;
  senderId: number;
  senderName: string;
  text: string;
  sentAt: string;
}

export interface RidePosition {
  rideId: number;
  lat: number;
  lon: number;
  at: string;
}

/** Why the gateway refused something, in its own words. */
export type RealtimeError = 'invalid' | 'not_joined' | 'not_a_member' | 'rate_limited' | 'not_the_driver' | 'ride_not_in_progress' | 'server_error' | 'unreachable';

export type Sent = { ok: true } | { ok: false; error: RealtimeError };

interface Channel {
  /** connecting: not yet answered. joined: live. refused: not on this ride. unavailable: cannot reach the gateway. */
  phase: 'connecting' | 'joined' | 'refused' | 'unavailable';
  /** A joined channel whose connection dropped keeps what it had and comes back by itself. */
  connected: boolean;
  role: 'DRIVER' | 'PASSENGER' | null;
  rideStatus: RideStatus | null;
  messages: ChatMessage[];
  position: RidePosition | null;
}

const START: Channel = { phase: 'connecting', connected: false, role: null, rideStatus: null, messages: [], position: null };

export function useRideChannel(rideId: number): Channel & {
  send: (text: string) => Promise<Sent>;
  sendPosition: (lat: number, lon: number) => Promise<Sent>;
} {
  const [channel, setChannel] = useState<Channel>(START);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    setChannel(START);
    const socket = io(GATEWAY, { auth: { token: getToken() }, transports: ['websocket'] });
    socketRef.current = socket;

    // Runs on every connect, including after a dropped connection: the gateway forgets
    // a socket's rides when it goes, and joining again returns what was missed.
    const join = async () => {
      try {
        const answer = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('ride:join', { rideId });
        if (answer.ok) {
          setChannel({ phase: 'joined', connected: true, role: answer.role, rideStatus: answer.rideStatus, messages: answer.messages, position: answer.location });
        } else {
          setChannel({ ...START, phase: answer.error === 'not_a_member' ? 'refused' : 'unavailable' });
        }
      } catch {
        setChannel((current) => ({ ...current, phase: 'unavailable' }));
      }
    };
    socket.on('connect', join);
    socket.on('disconnect', () => setChannel((current) => ({ ...current, connected: false })));
    socket.on('connect_error', () =>
      setChannel((current) => (current.phase === 'joined' ? { ...current, connected: false } : { ...current, phase: 'unavailable' })),
    );
    socket.on('chat:message', (message: ChatMessage) => {
      if (message.rideId !== rideId) return;
      setChannel((current) =>
        // The join answer and the live stream can both carry the same message.
        current.messages.some((known) => known.id === message.id) ? current : { ...current, messages: [...current.messages, message] },
      );
    });
    socket.on('location', (position: RidePosition) => {
      if (position.rideId === rideId) setChannel((current) => ({ ...current, position }));
    });

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, [rideId]);

  const emit = useCallback(async (event: string, payload: object): Promise<Sent> => {
    const socket = socketRef.current;
    if (!socket) return { ok: false, error: 'unreachable' };
    try {
      return (await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload)) as Sent;
    } catch {
      return { ok: false, error: 'unreachable' };
    }
  }, []);

  const send = useCallback((text: string) => emit('chat:send', { rideId, text }), [emit, rideId]);
  const sendPosition = useCallback((lat: number, lon: number) => emit('location:update', { rideId, lat, lon }), [emit, rideId]);

  return { ...channel, send, sendPosition };
}
