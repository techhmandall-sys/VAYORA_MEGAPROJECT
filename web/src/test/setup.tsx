import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { forwardRef, useImperativeHandle, type ReactNode } from 'react';
import { afterEach, beforeEach, vi } from 'vitest';

import { MotionGlobalConfig } from 'framer-motion';

import { setToken } from '../lib/api';

// Animations finish at once in tests, so an element leaving the page is gone when asserted.
MotionGlobalConfig.skipAnimations = true;

// jsdom lays nothing out, so it has neither of these. Nothing ever scrolls into view, and a
// drawn line has no length: the front page's route and counting figures then rest as they start.
if (!('IntersectionObserver' in globalThis)) {
  globalThis.IntersectionObserver = class {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}
if (!('getTotalLength' in SVGElement.prototype)) {
  Object.defineProperty(SVGElement.prototype, 'getTotalLength', { value: () => 0 });
}

// Leaflet needs a real browser to draw. This stand-in renders what the map was given as
// plain elements a test can read, and a button that clicks the map at a fixed place.
vi.mock('react-leaflet', () => {
  let onClick: ((event: { latlng: { lat: number; lng: number } }) => void) | undefined;
  return {
    MapContainer: ({ children }: { children: ReactNode }) => (
      <div data-testid="map">
        {children}
        <button type="button" onClick={() => onClick?.({ latlng: { lat: 17.307, lng: 74.19 } })}>
          click the map
        </button>
      </div>
    ),
    TileLayer: () => null,
    Polyline: ({ positions }: { positions: unknown[] }) => <span data-testid="route" data-points={positions.length} />,
    CircleMarker: ({ children }: { children: ReactNode }) => <span data-testid="marker">{children}</span>,
    Marker: forwardRef<unknown, { children: ReactNode; position: [number, number] }>(function Marker({ children, position }, ref) {
      useImperativeHandle(ref, () => ({ setLatLng: () => undefined }));
      return <span data-testid="moving" data-at={position.join(',')}>{children}</span>;
    }),
    Tooltip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    useMap: () => ({
      fitBounds: () => undefined,
      setView: () => undefined,
      getZoom: () => 8,
      getBounds: () => ({ pad: () => ({ contains: () => true }) }),
    }),
    useMapEvents: (handlers: { click?: typeof onClick }) => {
      onClick = handlers.click;
      return null;
    },
  };
});

// No test may reach a real server. One that needs answers stubs fetch itself; any other
// request fails the way an unreachable server would.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('network access is disabled in tests');
    }),
  );
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  setToken(null);
  vi.unstubAllGlobals();
});
