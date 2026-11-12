// A ride's map as a small web page: Leaflet with OpenStreetMap tiles, as the web app draws it, so no
// map key is needed. The page exposes window.setDriver(lat, lon) to move the driver's marker.

export interface MapStop {
  name: string;
  lat: number;
  lon: number;
}

export function mapHtml(stops: MapStop[], path: [number, number][]): string {
  const data = JSON.stringify({ stops, path });
  return `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{height:100%;margin:0;background:#e8eef3}</style>
</head><body><div id="map"></div>
<script>
  var data = ${data};
  var map = L.map('map', { zoomControl: false, attributionControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18, attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  var points = data.path.length > 1 ? data.path : data.stops.map(function (s) { return [s.lat, s.lon]; });
  if (points.length > 1) L.polyline(points, { color: '#0f766e', weight: 5, opacity: 0.85 }).addTo(map);
  data.stops.forEach(function (s, i) {
    L.circleMarker([s.lat, s.lon], {
      radius: 7, color: '#ffffff', weight: 3, fillOpacity: 1,
      fillColor: i === 0 || i === data.stops.length - 1 ? '#0f766e' : '#14b8a6'
    }).addTo(map).bindTooltip(s.name);
  });
  var bounds = L.latLngBounds(points.length ? points : [[16.7, 74.2], [18.5, 73.9]]);
  map.fitBounds(bounds, { padding: [24, 24] });
  // The frame can be laid out after the page starts: measure again once it has its size, and fit.
  setTimeout(function () { map.invalidateSize(); map.fitBounds(bounds, { padding: [24, 24] }); }, 250);
  window.addEventListener('resize', function () { map.invalidateSize(); });
  var driver = null;
  window.setDriver = function (lat, lon) {
    if (!driver) {
      driver = L.circleMarker([lat, lon], { radius: 10, color: '#ffffff', weight: 3, fillColor: '#b42318', fillOpacity: 1 }).addTo(map);
    } else {
      driver.setLatLng([lat, lon]);
    }
    map.panTo([lat, lon]);
  };
</script></body></html>`;
}
