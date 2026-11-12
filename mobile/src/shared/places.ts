// Copied from web/src/lib by mobile/scripts/sync-shared.mjs. Change it there, then run npm run sync-shared.
// Places a ride can start, stop or end, by state, for the search and publish forms. Each is the
// town centre: a driver moves their own meeting point on the map, and a passenger can choose any
// exact point, so a place not listed is still reachable from the nearest one that is.

const msg = (text: string): string => text;

export interface Place {
  /** The English name: what the server stores and matches. Display it through `t`. */
  name: string;
  lat: number;
  lon: number;
}

export interface Region {
  state: string;
  places: readonly Place[];
}

const at = (name: string, lat: number, lon: number): Place => ({ name, lat, lon });

// Maharashtra first, where the project began; the rest by name.
export const REGIONS: readonly Region[] = [
  {
    state: msg('Maharashtra'),
    places: [
      at(msg('Kolhapur'), 16.705, 74.2433),
      at(msg('Karad'), 17.289, 74.1818),
      at(msg('Satara'), 17.6805, 74.0183),
      at(msg('Pune'), 18.5204, 73.8567),
      at(msg('Ahilyanagar'), 19.0948, 74.748),
      at(msg('Amravati'), 20.9374, 77.7796),
      at(msg('Chhatrapati Sambhajinagar'), 19.8762, 75.3433),
      at(msg('Jalgaon'), 21.0077, 75.5626),
      at(msg('Latur'), 18.4088, 76.5604),
      at(msg('Mumbai'), 19.076, 72.8777),
      at(msg('Nagpur'), 21.1458, 79.0882),
      at(msg('Nanded'), 19.1383, 77.321),
      at(msg('Nashik'), 19.9975, 73.7898),
      at(msg('Navi Mumbai'), 19.033, 73.0297),
      at(msg('Ratnagiri'), 16.9902, 73.312),
      at(msg('Sangli'), 16.8524, 74.5815),
      at(msg('Solapur'), 17.6599, 75.9064),
      at(msg('Thane'), 19.2183, 72.9781),
    ],
  },
  {
    state: msg('Andhra Pradesh'),
    places: [
      at(msg('Guntur'), 16.3067, 80.4365),
      at(msg('Kurnool'), 15.8281, 78.0373),
      at(msg('Nellore'), 14.4426, 79.9865),
      at(msg('Tirupati'), 13.6288, 79.4192),
      at(msg('Vijayawada'), 16.5062, 80.648),
      at(msg('Visakhapatnam'), 17.6868, 83.2185),
    ],
  },
  { state: msg('Arunachal Pradesh'), places: [at(msg('Itanagar'), 27.0844, 93.6053)] },
  {
    state: msg('Assam'),
    places: [at(msg('Dibrugarh'), 27.4728, 94.912), at(msg('Guwahati'), 26.1445, 91.7362), at(msg('Silchar'), 24.8333, 92.7789)],
  },
  {
    state: msg('Bihar'),
    places: [at(msg('Gaya'), 24.7955, 85.0002), at(msg('Muzaffarpur'), 26.1209, 85.3647), at(msg('Patna'), 25.5941, 85.1376)],
  },
  { state: msg('Chandigarh'), places: [at(msg('Chandigarh'), 30.7333, 76.7794)] },
  { state: msg('Chhattisgarh'), places: [at(msg('Bilaspur'), 22.0797, 82.1409), at(msg('Raipur'), 21.2514, 81.6296)] },
  { state: msg('Dadra and Nagar Haveli and Daman and Diu'), places: [at(msg('Silvassa'), 20.2739, 72.9967)] },
  { state: msg('Delhi'), places: [at(msg('New Delhi'), 28.6139, 77.209)] },
  { state: msg('Goa'), places: [at(msg('Margao'), 15.2993, 73.9862), at(msg('Panaji'), 15.4909, 73.8278)] },
  {
    state: msg('Gujarat'),
    places: [
      at(msg('Ahmedabad'), 23.0225, 72.5714),
      at(msg('Bhavnagar'), 21.7645, 72.1519),
      at(msg('Gandhinagar'), 23.2156, 72.6369),
      at(msg('Jamnagar'), 22.4707, 70.0577),
      at(msg('Rajkot'), 22.3039, 70.8022),
      at(msg('Surat'), 21.1702, 72.8311),
      at(msg('Vadodara'), 22.3072, 73.1812),
    ],
  },
  {
    state: msg('Haryana'),
    places: [
      at(msg('Ambala'), 30.3782, 76.7767),
      at(msg('Faridabad'), 28.4089, 77.3178),
      at(msg('Gurugram'), 28.4595, 77.0266),
      at(msg('Hisar'), 29.1492, 75.7217),
    ],
  },
  {
    state: msg('Himachal Pradesh'),
    places: [at(msg('Dharamshala'), 32.219, 76.3234), at(msg('Manali'), 32.2432, 77.1892), at(msg('Shimla'), 31.1048, 77.1734)],
  },
  { state: msg('Jammu and Kashmir'), places: [at(msg('Jammu'), 32.7266, 74.857), at(msg('Srinagar'), 34.0837, 74.7973)] },
  {
    state: msg('Jharkhand'),
    places: [at(msg('Dhanbad'), 23.7957, 86.4304), at(msg('Jamshedpur'), 22.8046, 86.2029), at(msg('Ranchi'), 23.3441, 85.3096)],
  },
  {
    state: msg('Karnataka'),
    places: [
      at(msg('Belagavi'), 15.8497, 74.4977),
      at(msg('Bengaluru'), 12.9716, 77.5946),
      at(msg('Hubballi'), 15.3647, 75.124),
      at(msg('Kalaburagi'), 17.3297, 76.8343),
      at(msg('Mangaluru'), 12.9141, 74.856),
      at(msg('Mysuru'), 12.2958, 76.6394),
    ],
  },
  {
    state: msg('Kerala'),
    places: [
      at(msg('Kochi'), 9.9312, 76.2673),
      at(msg('Kozhikode'), 11.2588, 75.7804),
      at(msg('Thiruvananthapuram'), 8.5241, 76.9366),
      at(msg('Thrissur'), 10.5276, 76.2144),
    ],
  },
  { state: msg('Ladakh'), places: [at(msg('Leh'), 34.1526, 77.5771)] },
  {
    state: msg('Madhya Pradesh'),
    places: [
      at(msg('Bhopal'), 23.2599, 77.4126),
      at(msg('Gwalior'), 26.2183, 78.1828),
      at(msg('Indore'), 22.7196, 75.8577),
      at(msg('Jabalpur'), 23.1815, 79.9864),
      at(msg('Ujjain'), 23.1765, 75.7885),
    ],
  },
  { state: msg('Manipur'), places: [at(msg('Imphal'), 24.817, 93.9368)] },
  { state: msg('Meghalaya'), places: [at(msg('Shillong'), 25.5788, 91.8933)] },
  { state: msg('Mizoram'), places: [at(msg('Aizawl'), 23.7271, 92.7176)] },
  { state: msg('Nagaland'), places: [at(msg('Kohima'), 25.6751, 94.1086)] },
  {
    state: msg('Odisha'),
    places: [
      at(msg('Bhubaneswar'), 20.2961, 85.8245),
      at(msg('Cuttack'), 20.4625, 85.8828),
      at(msg('Puri'), 19.8135, 85.8312),
      at(msg('Rourkela'), 22.2604, 84.8536),
    ],
  },
  { state: msg('Puducherry'), places: [at(msg('Puducherry'), 11.9416, 79.8083)] },
  {
    state: msg('Punjab'),
    places: [
      at(msg('Amritsar'), 31.634, 74.8723),
      at(msg('Jalandhar'), 31.326, 75.5762),
      at(msg('Ludhiana'), 30.901, 75.8573),
      at(msg('Patiala'), 30.3398, 76.3869),
    ],
  },
  {
    state: msg('Rajasthan'),
    places: [
      at(msg('Ajmer'), 26.4499, 74.6399),
      at(msg('Bikaner'), 28.0229, 73.3119),
      at(msg('Jaipur'), 26.9124, 75.7873),
      at(msg('Jodhpur'), 26.2389, 73.0243),
      at(msg('Kota'), 25.2138, 75.8648),
      at(msg('Udaipur'), 24.5854, 73.7125),
    ],
  },
  { state: msg('Sikkim'), places: [at(msg('Gangtok'), 27.3389, 88.6065)] },
  {
    state: msg('Tamil Nadu'),
    places: [
      at(msg('Chennai'), 13.0827, 80.2707),
      at(msg('Coimbatore'), 11.0168, 76.9558),
      at(msg('Kanniyakumari'), 8.0883, 77.5385),
      at(msg('Madurai'), 9.9252, 78.1198),
      at(msg('Salem'), 11.6643, 78.146),
      at(msg('Tiruchirappalli'), 10.7905, 78.7047),
      at(msg('Tirunelveli'), 8.7139, 77.7567),
      at(msg('Vellore'), 12.9165, 79.1325),
    ],
  },
  {
    state: msg('Telangana'),
    places: [at(msg('Hyderabad'), 17.385, 78.4867), at(msg('Nizamabad'), 18.6725, 78.0941), at(msg('Warangal'), 17.9689, 79.5941)],
  },
  { state: msg('Tripura'), places: [at(msg('Agartala'), 23.8315, 91.2868)] },
  {
    state: msg('Uttar Pradesh'),
    places: [
      at(msg('Agra'), 27.1767, 78.0081),
      at(msg('Ayodhya'), 26.7922, 82.1998),
      at(msg('Bareilly'), 28.367, 79.4304),
      at(msg('Ghaziabad'), 28.6692, 77.4538),
      at(msg('Gorakhpur'), 26.7606, 83.3732),
      at(msg('Kanpur'), 26.4499, 80.3319),
      at(msg('Lucknow'), 26.8467, 80.9462),
      at(msg('Mathura'), 27.4924, 77.6737),
      at(msg('Meerut'), 28.9845, 77.7064),
      at(msg('Noida'), 28.5355, 77.391),
      at(msg('Prayagraj'), 25.4358, 81.8463),
      at(msg('Varanasi'), 25.3176, 82.9739),
    ],
  },
  {
    state: msg('Uttarakhand'),
    places: [
      at(msg('Dehradun'), 30.3165, 78.0322),
      at(msg('Haridwar'), 29.9457, 78.1642),
      at(msg('Nainital'), 29.3803, 79.4636),
      at(msg('Rishikesh'), 30.0869, 78.2676),
    ],
  },
  {
    state: msg('West Bengal'),
    places: [
      at(msg('Asansol'), 23.6739, 86.9524),
      at(msg('Darjeeling'), 27.041, 88.2663),
      at(msg('Durgapur'), 23.5204, 87.3119),
      at(msg('Kolkata'), 22.5726, 88.3639),
      at(msg('Siliguri'), 26.7271, 88.3953),
    ],
  },
];

export const PLACES: readonly Place[] = REGIONS.flatMap((region) => region.places);

const byName = new Map(PLACES.map((place) => [place.name, place]));

export const placeNamed = (name: string): Place | undefined => byName.get(name);

/** The straight line between two points, in kilometres. */
function kmBetween(from: { lat: number; lon: number }, to: { lat: number; lon: number }): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(to.lat - from.lat);
  const dLon = radians(to.lon - from.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * A rough driving time between two points, in minutes, to the next five, only to pre-fill the
 * publish form until the driver works out the route or types their own: the straight line, a
 * third longer for how roads wind, at 50 km/h.
 */
export function roughDriveMinutes(from: { lat: number; lon: number }, to: { lat: number; lon: number }): number {
  return Math.max(5, Math.ceil(((kmBetween(from, to) * 1.33) / 50) * 12) * 5);
}

/** The listed city closest to a point. */
export function nearestPlace(lat: number, lon: number): Place {
  return PLACES.reduce((best, place) => (kmBetween({ lat, lon }, place) < kmBetween({ lat, lon }, best) ? place : best));
}
