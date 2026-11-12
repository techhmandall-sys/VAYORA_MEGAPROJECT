import { createElement, useEffect, useMemo, useRef } from 'react';

import { mapHtml, type MapStop } from './mapHtml';
import { colors, radius } from './theme';

// The same map in a browser, where there is no WebView: the page in an iframe. Used only when the
// app runs on the web, which is how it is tested on a computer.

interface Props {
  stops: MapStop[];
  path: [number, number][];
  driver?: { lat: number; lon: number } | null;
  height?: number;
}

type MapWindow = Window & { setDriver?: (lat: number, lon: number) => void };

export function RideMap({ stops, path, driver, height = 220 }: Props) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const html = useMemo(() => mapHtml(stops, path), [stops, path]);

  const place = () => {
    const win = frame.current?.contentWindow as MapWindow | null | undefined;
    if (driver && win?.setDriver) win.setDriver(driver.lat, driver.lon);
  };
  useEffect(place, [driver?.lat, driver?.lon]);

  return createElement('iframe', {
    ref: frame,
    srcDoc: html,
    title: 'Map',
    onLoad: place,
    style: { width: '100%', height, border: 0, borderRadius: radius.card, background: colors.line, display: 'block' },
  });
}
