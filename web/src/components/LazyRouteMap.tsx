import { lazy, Suspense, type ComponentProps } from 'react';

import type { RouteMap as LoadedRouteMap } from './RouteMap';

// Leaflet is the largest library in the app and most screens never draw a map: it is fetched
// the first time one is shown, not with the page.
const Loaded = lazy(() => import('./RouteMap').then((module) => ({ default: module.RouteMap })));

/** The route map, loaded on first use. Holds the map's place meanwhile, so nothing jumps. */
export function RouteMap(props: ComponentProps<typeof LoadedRouteMap>) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="skeleton h-72 rounded-2xl" />}>
      <Loaded {...props} />
    </Suspense>
  );
}
