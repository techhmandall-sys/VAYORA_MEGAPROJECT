import { Send } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { useAuth } from '../lib/auth';
import { formatAgo, formatTime } from '../lib/format';
import { msg, useT } from '../lib/i18n';
import { useNow } from '../lib/live';
import { useRideChannel, type RealtimeError, type RidePosition } from '../lib/realtime';
import type { RideStatus } from '../lib/types';
import { LiveDot } from './live';
import { RouteMap } from './LazyRouteMap';
import { Button, Notice } from './ui';

const MAX_LENGTH = 500;
// A position is sent at most this often, well inside what the gateway accepts.
const POSITION_INTERVAL_MS = 5000;
// GeolocationPositionError.PERMISSION_DENIED. The other two codes (no fix, too slow) pass:
// the watch keeps running, so a moment without signal must not end sharing.
const PERMISSION_DENIED = 1;
// A position older than this is shown as where the driver was, not where they are.
const STALE_MS = 60_000;

const problems: Record<RealtimeError, string> = {
  invalid: msg('That message cannot be sent. Check it is not empty or too long.'),
  not_joined: msg('The connection was lost. Close the chat and open it again.'),
  not_a_member: msg('You are no longer on this ride.'),
  rate_limited: msg('You are sending messages too quickly. Wait a moment.'),
  not_the_driver: msg('Only the driver can share a position.'),
  ride_not_in_progress: msg('A position can only be shared while the ride is under way.'),
  server_error: msg('That could not be sent. Try again.'),
  unreachable: msg('The chat service cannot be reached. Try again.'),
};

/** The driver's side of live position: on only while they ask for it. */
function SharePosition({ send }: { send: (lat: number, lon: number) => Promise<{ ok: boolean; error?: RealtimeError }> }) {
  const t = useT();
  const [sharing, setSharing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [lost, setLost] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const lastSent = useRef(0);
  const now = useNow(5000);

  useEffect(() => {
    setLost(false);
    if (!sharing) return;
    if (!('geolocation' in navigator)) {
      setProblem(msg('This device cannot report its position.'));
      setSharing(false);
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        setLost(false);
        if (Date.now() - lastSent.current < POSITION_INTERVAL_MS) return;
        lastSent.current = Date.now();
        void send(position.coords.latitude, position.coords.longitude).then((sent) => {
          if (sent.ok) setSentAt(Date.now());
          if (!sent.ok && sent.error && sent.error !== 'rate_limited') {
            setProblem(problems[sent.error]);
            setSharing(false);
          }
        });
      },
      (error) => {
        if (error.code !== PERMISSION_DENIED) {
          setLost(true);
          return;
        }
        setProblem(msg('Your position is not available. Check that location access is allowed.'));
        setSharing(false);
      },
      { enableHighAccuracy: true },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [sharing, send]);

  return (
    <div className="space-y-2">
      {problem && <Notice tone="error">{t(problem)}</Notice>}
      {sharing && lost && <Notice tone="info">{t('Your position cannot be found just now. Sharing stays on and carries on once it is found.')}</Notice>}
      <Button
        tone="secondary"
        aria-pressed={sharing}
        onClick={() => {
          setProblem(null);
          setSharing(!sharing);
        }}
      >
        {sharing ? t('Stop sharing my position') : t('Share my position with passengers')}
      </Button>
      {sharing && (
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <LiveDot state={lost ? 'waiting' : 'live'} />
          <span>
            {t('Passengers on this ride can see where you are until you stop or the ride ends.')}
            {sentAt !== null && ` ${t('Last sent {time}.', { time: formatAgo(sentAt, now) })}`}
          </span>
        </p>
      )}
    </div>
  );
}

/** Where the driver is, as it comes in: the marker glides there, leaving a line of where they have been. */
function DriverOnTheMap({ position }: { position: RidePosition }) {
  const t = useT();
  const now = useNow(5000);
  const [trail, setTrail] = useState<[number, number][]>([[position.lat, position.lon]]);
  useEffect(() => {
    setTrail((was) => {
      const last = was[was.length - 1];
      return last[0] === position.lat && last[1] === position.lon ? was : [...was, [position.lat, position.lon]];
    });
  }, [position.lat, position.lon]);
  const stale = now - Date.parse(position.at) > STALE_MS;
  return (
    <div className="space-y-2">
      <p className="flex flex-wrap items-center gap-x-2 text-sm text-slate-700" role="status">
        <LiveDot state={stale ? 'waiting' : 'live'} />
        <span>{t("The driver's position at {time}", { time: formatTime(position.at) })}</span>
        <span className="text-slate-500">{formatAgo(position.at, now)}</span>
      </p>
      <RouteMap
        path={trail}
        points={[]}
        moving={{ lat: position.lat, lon: position.lon, label: t('The driver'), emphasis: true }}
        describe={t("Map showing the driver's last known position")}
      />
    </div>
  );
}

/**
 * Chat between everyone on a ride, and the driver's position while it is under way.
 *
 * @param rideStatus the ride's status as the page knows it now. The chat learns the status
 *                   only when it joins, so a driver who opened it before starting the ride
 *                   would otherwise never be offered position sharing.
 */
export function RideChat({ rideId, rideStatus }: { rideId: number; rideStatus?: RideStatus }) {
  const t = useT();
  const { user } = useAuth();
  const inputId = useId();
  const channel = useRideChannel(rideId);
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  const messageCount = channel.messages.length;

  // The newest message in view, as in any chat.
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messageCount, channel.phase]);

  if (channel.phase === 'connecting') return <Notice tone="info">{t('Connecting…')}</Notice>;
  if (channel.phase === 'refused') return <Notice tone="info">{t('The chat is only for the driver and passengers booked on this ride.')}</Notice>;
  if (channel.phase === 'unavailable') return <Notice tone="error">{t('The chat service cannot be reached. Try again.')}</Notice>;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (text.trim() === '') return;
    setSending(true);
    setProblem(null);
    const sent = await channel.send(text);
    setSending(false);
    if (sent.ok) setText('');
    else setProblem(problems[sent.error]);
  };

  return (
    <div className="mt-3 space-y-3 rounded-2xl bg-surface p-3 shadow-card ring-1 ring-slate-900/[0.05]">
      <p className="flex items-center gap-2 text-xs font-semibold text-slate-600">
        <LiveDot state={channel.connected ? 'live' : 'waiting'} />
        {channel.connected ? t('Connected') : t('Connection lost. Reconnecting…')}
      </p>
      {channel.role === 'DRIVER' && (rideStatus ?? channel.rideStatus) === 'IN_PROGRESS' && <SharePosition send={channel.sendPosition} />}

      {channel.position && channel.role === 'PASSENGER' && <DriverOnTheMap position={channel.position} />}

      {/* Rendered as text: a message is whatever someone typed. Screen readers announce new ones. */}
      <ol ref={list} aria-live="polite" aria-label={t('Messages')} className="thin-scroll max-h-72 space-y-3 overflow-y-auto scroll-smooth px-1 py-1">
        {channel.messages.length === 0 && <li className="py-4 text-center text-sm text-slate-500">{t('No messages yet.')}</li>}
        {channel.messages.map((message) => {
          // Bubbles as in iMessage: one's own on the right in the tint, everyone else's on the left.
          const mine = message.senderId === user?.id;
          return (
            <li key={message.id} className={`flex animate-pop-in flex-col text-sm ${mine ? 'items-end' : 'items-start'}`}>
              <span className="px-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{mine ? t('You') : message.senderName}</span>{' '}
                <span>{formatTime(message.sentAt)}</span>
              </span>
              <p
                className={`mt-1 max-w-[85%] whitespace-pre-wrap break-words rounded-[1.25rem] px-3.5 py-2 text-[15px] leading-snug ${
                  mine ? 'rounded-br-md bg-accent text-white' : 'rounded-bl-md bg-slate-100 text-slate-900'
                }`}
              >
                {message.text}
              </p>
            </li>
          );
        })}
      </ol>

      {problem && <Notice tone="error">{t(problem)}</Notice>}
      <form onSubmit={(event) => void submit(event)} className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
            {t('Message everyone on this ride')}
          </label>
          <input
            id={inputId}
            value={text}
            maxLength={MAX_LENGTH}
            onChange={(event) => setText(event.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5 text-[15px] shadow-sm focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/15"
          />
        </div>
        <Button type="submit" disabled={text.trim() === ''} busy={sending}>
          {!sending && <Send aria-hidden="true" className="h-4 w-4" />}
          {sending ? t('Sending…') : t('Send')}
        </Button>
      </form>
    </div>
  );
}
