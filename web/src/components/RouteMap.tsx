import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';

export interface MapPoint {
  lat: number;
  lon: number;
  label: string;
  /** Drawn larger and in a different colour, e.g. where the passenger boards. */
  emphasis?: boolean;
}

// Leaflet sets these as SVG attributes, where a CSS variable still resolves, so the line and the
// pins take the role's tint in either theme.
const TINT = 'rgb(var(--teal-600))';
const HIGHLIGHT = 'rgb(var(--amber-500))';

const GLIDE_MS = 1200;

function FitTo({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join(';');
  useEffect(() => {
    // Without animation: a map removed mid-animation (leaving the page just after the route
    // is drawn) throws "Cannot read properties of undefined (reading '_leaflet_pos')".
    if (points.length === 1) map.setView(points[0], 13, { animate: false });
    else if (points.length > 1) map.fitBounds(points, { padding: [24, 24], animate: false });
    // Refit only when the points themselves change, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function Clicks({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return null;
}

const liveIcon = L.divIcon({ className: 'live-marker', iconSize: [18, 18], html: '<span></span>' });

/** Someone moving: glides from where it was to each new position, and keeps itself in view. */
function MovingMarker({ point }: { point: MapPoint }) {
  const map = useMap();
  const marker = useRef<L.Marker>(null);
  const shown = useRef({ lat: point.lat, lon: point.lon });

  useEffect(() => {
    const from = { ...shown.current };
    const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const started = performance.now();
    let frame = 0;
    const step = (time: number) => {
      const progress = still ? 1 : Math.min(1, (time - started) / GLIDE_MS);
      const eased = progress * (2 - progress);
      shown.current = { lat: from.lat + (point.lat - from.lat) * eased, lon: from.lon + (point.lon - from.lon) * eased };
      marker.current?.setLatLng([shown.current.lat, shown.current.lon]);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    // Without animation, for the same reason as FitTo.
    if (!map.getBounds().pad(-0.15).contains([point.lat, point.lon])) map.setView([point.lat, point.lon], map.getZoom(), { animate: false });
    return () => cancelAnimationFrame(frame);
  }, [map, point.lat, point.lon]);

  return (
    <Marker ref={marker} position={[shown.current.lat, shown.current.lon]} icon={liveIcon}>
      <Tooltip>{point.label}</Tooltip>
    </Marker>
  );
}

/**
 * A map of a route and the places on it. Purely a picture: everything it shows is also
 * given in text next to it, so nobody needs the map to use the page.
 */
export function RouteMap({ path = [], points, moving, onPick, describe }: {
  /** The line to draw, as [lat, lon] pairs. */
  path?: [number, number][];
  points: MapPoint[];
  /** Someone on the move, updated as they go. The map stays put while they stay in view. */
  moving?: MapPoint;
  /** If given, a click on the map reports where. */
  onPick?: (lat: number, lon: number) => void;
  /** What the map shows, for screen readers. */
  describe: string;
}) {
  const firstMoving = useRef(moving);
  const all: [number, number][] = firstMoving.current
    ? [[firstMoving.current.lat, firstMoving.current.lon]]
    : [...path, ...points.map((p): [number, number] => [p.lat, p.lon])];
  return (
    // Isolated: Leaflet's panes have high z-indexes that would otherwise rise over the sticky header.
    <div role="img" aria-label={describe} className="isolate h-72 overflow-hidden rounded-2xl ring-1 ring-slate-900/[0.08]">
      <MapContainer center={[17.6, 74.05]} zoom={8} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {path.length > 1 && <Polyline positions={path} pathOptions={{ color: '#fff', weight: 8, opacity: 0.85 }} />}
        {path.length > 1 && <Polyline positions={path} pathOptions={{ color: TINT, weight: 4.5 }} />}
        {points.map((point) => (
          <CircleMarker
            key={`${point.label}-${point.lat}-${point.lon}`}
            center={[point.lat, point.lon]}
            radius={point.emphasis ? 9 : 6}
            pathOptions={{ color: '#fff', weight: 2.5, fillColor: point.emphasis ? HIGHLIGHT : TINT, fillOpacity: 1 }}
          >
            <Tooltip>{point.label}</Tooltip>
          </CircleMarker>
        ))}
        {moving && <MovingMarker point={moving} />}
        <FitTo points={all} />
        {onPick && <Clicks onPick={onPick} />}
      </MapContainer>
    </div>
  );
}
