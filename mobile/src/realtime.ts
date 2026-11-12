import { io, type Socket } from 'socket.io-client';

// The gateway: a ride's chat and its driver's position (docs/API_DOCUMENTATION.md, "gateway").
// It checks the same token core-api issued, and asks core-api who is on a ride.

export function connectGateway(url: string, token: string): Socket {
  return io(url, { auth: { token }, transports: ['websocket'], reconnection: true, timeout: 10_000 });
}

/** The gateway's answers carry `ok`, and `error` when it refused. */
export interface Answer {
  ok: boolean;
  error?: string;
}

/** Emits an event and waits for the gateway's answer, or fails after a while. */
export function ask<T extends Answer>(socket: Socket, event: string, payload: unknown, ms = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    socket.timeout(ms).emit(event, payload, (error: Error | null, answer: T) => {
      if (error) reject(error);
      else resolve(answer);
    });
  });
}
