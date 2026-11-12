// What core-api and the gateway send, as the web app reads them (web/src/lib/types.ts), cut to
// what the mobile app uses.

export type Role = 'PASSENGER' | 'DRIVER' | 'ADMIN';

export interface User {
  id: number;
  /** Null for a member who signed up with a phone number. */
  email: string | null;
  fullName: string;
  role: Role;
}

export interface Session {
  accessToken: string;
  expiresInSeconds: number;
  user: User;
}

export interface Vehicle {
  id: number;
  make: string;
  model: string;
  year: number | null;
  colour: string | null;
  /** Total seats including the driver's. */
  seats: number;
  electric: boolean;
}

export interface Stop {
  seq: number;
  name: string;
  lat: number;
  lon: number;
  departureTime: string;
}

/** Segment `seq` runs from stop `seq` to stop `seq + 1`. */
export interface Segment {
  seq: number;
  price: number;
  seatsTotal: number;
  seatsAvailable: number;
}

export type RideStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Ride {
  id: number;
  driverId: number;
  driverName: string;
  vehicleId: number;
  departureTime: string;
  seatsOffered: number;
  instantBooking: boolean;
  status: RideStatus;
  stops: Stop[];
  segments: Segment[];
  distanceKm: number | null;
  durationMinutes: number | null;
  /** [lat, lon] pairs. */
  path: [number, number][];
  notes: string | null;
  startsFrom?: string;
}

/** One ride found by a search, for the stretch the passenger asked about. */
export interface Candidate {
  rideId: number;
  driverName: string;
  instantBooking: boolean;
  fromSeq: number;
  toSeq: number;
  fromStop: string;
  toStop: string;
  boardingTime: string;
  arrivalTime: string;
  pricePerSeat: number;
  seatsAvailable: number;
  /** For the seats searched for. */
  fare: number;
  driverRating: number | null;
  driverRatingCount: number;
  vehicle: string;
  underWay: boolean;
}

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';

export interface Booking {
  id: number;
  rideId: number;
  passengerId: number;
  passengerName: string;
  fromSeq: number;
  toSeq: number;
  fromStop: string;
  toStop: string;
  seats: number;
  price: number;
  status: BookingStatus;
  boardingTime: string;
  createdAt: string;
  passengerRated: boolean;
  driverRated: boolean;
  driverName?: string;
  vehicle?: string | null;
  paymentStatus?: 'DEFERRED' | 'DUE' | 'SETTLED' | 'VOID' | null;
  amountDue?: number | null;
}

export interface BoardingPass {
  bookingId: number;
  reference: string;
  code: string;
}

export interface LegPreview {
  distanceKm: number;
  durationMinutes: number;
  suggestedPrice: number;
}

export interface RoutePreview {
  distanceKm: number;
  durationMinutes: number;
  source: string;
  legs: LegPreview[];
}

export interface NotificationText {
  template: string;
  values: Record<string, TextValue>;
}

export type TextValue = string | NotificationText | NotificationText[];

export interface AppNotification {
  id: string;
  type: string;
  /** The English, which older notifications only have. */
  message: string;
  text: NotificationText | null;
  bookingId: number | null;
  createdAt: string;
  read: boolean;
}

/** A chat message, as the gateway relays it. */
export interface ChatMessage {
  id: string;
  rideId: number;
  senderId: number;
  senderName: string;
  text: string;
  sentAt: string;
}

/** The driver's latest position, as the gateway relays it. */
export interface LivePoint {
  rideId: number;
  lat: number;
  lon: number;
  at: string;
}
