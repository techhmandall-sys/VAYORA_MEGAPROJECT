import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { mapHtml, type MapStop } from './mapHtml';
import { colors, radius } from './theme';

interface Props {
  stops: MapStop[];
  path: [number, number][];
  driver?: { lat: number; lon: number } | null;
  height?: number;
}

/** A ride's route and stops, and the driver's position when one is known. */
// react-native-webview declares WebView<P = undefined> with props WebViewProps & P, which TypeScript
// reduces to never; an explicit `object` gives back the real props.
type MapView = WebView<object>;

export function RideMap({ stops, path, driver, height = 220 }: Props) {
  const view = useRef<MapView>(null);
  // Drawn once per ride: a new position moves the marker rather than reloading the map.
  const html = useMemo(() => mapHtml(stops, path), [stops, path]);

  const place = () => {
    if (driver) view.current?.injectJavaScript(`window.setDriver && window.setDriver(${driver.lat}, ${driver.lon}); true;`);
  };
  useEffect(place, [driver?.lat, driver?.lon]);

  return (
    <View style={[styles.frame, { height }]}>
      <WebView<object>
        ref={view}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://localhost/' }}
        onLoadEnd={place}
        scrollEnabled={false}
        javaScriptEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.line,
  },
});
