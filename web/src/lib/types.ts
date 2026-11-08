// Shapes of core-api's JSON, as its controllers return them.

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
  /** The driver's own description; null if not said. */
  comfort: Comfort | null;
  luggage: Luggage | null;
  electric: boolean;
  batteryKwh: number | null;
  consumptionKwhPer100Km: number | null;
  /** What the two figures above imply on a full charge. Not a measured range. */
  estimatedRangeKm: number | null;
  /** Insurance as the driver declares it, never checked; both null if not said. */
  insurer: string | null;
  insuredUntil: string | null;
}

export type Comfort = 'BASIC' | 'COMFORT' | 'PREMIUM';

/** The largest bag each passenger may bring. */
export type Luggage = 'NONE' | 'SMALL' | 'MEDIUM' | 'LARGE';

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
  /** Null on a ride with no recorded route. */
  distanceKm: number | null;
  durationMinutes: number | null;
  /** `STRAIGHT_LINE` means the stops were only joined up: not a road distance. */
  routeSource: RouteSource | null;
  /** [lat, lon] pairs. */
  path: [number, number][];
  /** Whatever the driver typed for passengers; null if nothing. */
  notes: string | null;
  /** The driver's promise of at most two passengers on the back seat. */
  maxTwoInBack: boolean;
  /** Rides published together with this one, itself included. */
  seriesSize: number;
  /** Offered only to passengers whose profile says they are a woman. */
  womenOnly: boolean;
  /** Minutes in all the driver will go out of their way for pickups; 0 for none. */
  maxDetourMinutes?: number;
  /** The earliest the driver may start it. */
  startsFrom?: string;
}

/** Whether intel's assistant is on, and how much one question may carry. */
export interface AssistantStatus {
  enabled: boolean;
  max_messages: number;
  max_message_chars: number;
}

export interface AssistantReply {
  /** null when the assistant declined to answer. */
  reply: string | null;
  declined: boolean;
}

export type RouteSource = 'OSRM' | 'STRAIGHT_LINE';

export type SearchSort = 'TIME' | 'PRICE' | 'RATING' | 'PROXIMITY' | 'BEST_MATCH';

/** Why a result scored as it did for both people (feature 76). */
export type MatchReason =
  | 'NEAR'
  | 'CHEAPEST'
  | 'SAME_SMOKING'
  | 'DIFFERENT_SMOKING'
  | 'SAME_PETS'
  | 'DIFFERENT_PETS'
  | 'SAME_MUSIC'
  | 'DIFFERENT_MUSIC'
  | 'SAME_CONVERSATION'
  | 'DIFFERENT_CONVERSATION';

/** A route through some stops before a ride is published, with a suggested price per leg. */
export interface RoutePreview {
  distanceKm: number;
  durationMinutes: number;
  source: RouteSource;
  legs: { distanceKm: number; durationMinutes: number; suggestedPrice: number }[];
  path: [number, number][];
  /** Rest stops and chargers near the route, in the order they are reached. */
  alongRoute: AlongRoute[];
}

/** A day and stretch where passengers searched and were offered no ride. */
export interface SupplyGap {
  date: string;
  fromStop: string;
  toStop: string;
  emptySearches: number;
  driversNudged: number;
}

/** A place to stop, entered by an administrator; nothing checks it is open or working. */
export interface Stopover {
  id: number;
  kind: 'REST' | 'CHARGER';
  name: string;
  lat: number;
  lon: number;
  chargerKw: number | null;
  notes: string | null;
}

export interface AlongRoute {
  stopover: Stopover;
  kmAlong: number;
  kmOffRoute: number;
  /** The rest stop nearest the point a break is due; at most one per route. */
  suggestedBreak: boolean;
}

/** One search result: a ride and the stretch of it the passenger would travel. */
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
  driverId: number;
  /** Null until somebody has rated the driver. */
  driverRating: number | null;
  driverRatingCount: number;
  /** Straight-line metres between the passenger's points and the stops used. */
  pickupDistanceM: number;
  dropoffDistanceM: number;
  /** The driver confirmed an email address or a phone number. Not an identity check. */
  driverConfirmed: boolean;
  maxTwoInBack: boolean;
  /** Make and model, as the driver entered them. */
  vehicle: string;
  comfort: Comfort | null;
  luggage: Luggage | null;
  electric: boolean;
  womenOnly: boolean;
  /** The driver's own past rides: none of it is a prediction. */
  driverRidesCompleted: number;
  driverRidesWithdrawn: number;
  /** In a straight line at a set pace, so the real walk is longer. */
  pickupWalkMinutes: number;
  dropoffWalkMinutes: number;
  /** The driver has withdrawn rides and completed fewer than the set share: from their record only. */
  suggestFlexible: boolean;
  /** Already on the road: offered only from stops it is not yet near, and it may reach them before the time shown. */
  underWay: boolean;
  /** Insurance the driver declares: only while it covers the trip's date. */
  insurer: string | null;
  insuredUntil: string | null;
  /** VAYORA staff saw the policy; never checked with the insurer. */
  insuranceChecked?: boolean;
  /** VAYORA staff saw the identity document the driver declared; never checked with its issuer. */
  driverIdChecked?: boolean;
  /** Out of 100, for both people, from what they said, distance, price and the driver's record; never a prediction. */
  matchScore: number;
  matchReasons: MatchReason[];
  /**
   * Set when the driver picks the passenger up at their start instead of a stop: what it
   * costs the driver, in minutes. The boarding time is then the pickup's.
   */
  detourMinutes: number | null;
  /** The walks were worked out on footpaths; otherwise they are straight-line estimates. */
  walkOnFootpaths: boolean;
  /** An auto-rickshaw where the walk is long; null where none is offered (feature 91). */
  pickupRickshaw?: RickshawEstimate | null;
  dropoffRickshaw?: RickshawEstimate | null;
}

/** An auto-rickshaw to or from a stop: an estimate, never a quote. */
export interface RickshawEstimate {
  minutes: number;
  km: number;
  /** Rupees by the town's published meter fare; null where no published fare is known. */
  fare: number | null;
  fareTown: string | null;
  /** Who published the fare: shown with it. */
  fareSource: string | null;
  fareSince: string | null;
  /** By road; false when the routing service was down and it is a straight line. */
  byRoad: boolean;
}

/** What a passenger agrees to, when booking, should the driver withdraw the ride. */
export type FlexTier = 'EXACT' | 'FLEXIBLE' | 'ANY_TIME';

/** The newest durability estimate of one live booking. Administrators only. */
export interface HazardScore {
  bookingId: number;
  rideId: number;
  passengerName: string;
  fromStop: string;
  toStop: string;
  boardingTime: string;
  survivalProbability: number;
  modelVersion: string;
  scoredAt: string;
  /**
   * Each feature's share of the log relative risk. Positive raises the estimated chance of
   * a cancellation. Empty for scores logged before explanations existed.
   */
  contributions: Record<string, number>;
}

export interface ScoringSummary {
  scored: number;
  alreadyScored: number;
  failed: number;
  skippedRun: boolean;
}

export type ReportOutcome = 'DISMISS' | 'WARN' | 'SUSPEND';

/** One member's report about another, as an administrator sees it. */
export interface MemberReport {
  id: number;
  reporterId: number;
  reporterName: string;
  reportedUserId: number;
  reportedUserName: string;
  reportedUserStatus: 'ACTIVE' | 'SUSPENDED';
  bookingId: number | null;
  reason: 'UNSAFE_DRIVING' | 'HARASSMENT' | 'NO_SHOW' | 'FRAUD' | 'OTHER';
  details: string | null;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  outcome: ReportOutcome | null;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AdminOverview {
  users: Record<string, number>;
  rides: Record<string, number>;
  bookings: Record<string, number>;
  suspendedMembers: number;
  openReports: number;
  disputedTrips: number;
}

export interface Member {
  id: number;
  fullName: string;
  email: string | null;
  role: Role;
  status: 'ACTIVE' | 'SUSPENDED';
  memberSince: string;
}

export interface AuditEntry {
  id: number;
  actorId: number;
  actorName: string;
  action: string;
  targetType: string | null;
  targetId: number | null;
  /** JSON text, shown as it is. */
  detail: string;
  createdAt: string;
}

/** Named so as not to shadow the browser's own Notification. */
/** A notification as an English template and the values that fill it. */
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

export interface Review {
  stars: number;
  comment: string;
  /** First name only. */
  reviewerName: string;
  createdAt: string;
}

/** What any signed-in member may see about another. */
export interface Profile {
  id: number;
  fullName: string;
  role: Role;
  memberSince: string;
  completedTrips: number;
  averageStars: number | null;
  ratingCount: number;
  reviews: Review[];
  /** Proved with a code. Says nothing about who the member is. */
  emailVerified: boolean;
  phoneVerified: boolean;
  bio: string | null;
  /** From a birth year, so a year out either way. */
  age: number | null;
  smoking: boolean | null;
  pets: boolean | null;
  music: boolean | null;
  chattiness: Chattiness | null;
  /** Drivers only: the share of requests they answered themselves. Null with too few. */
  responseRate?: number | null;
  /** Drivers only: median minutes from a request to their answer. */
  responseMinutes?: number | null;
  /** NEWCOMER up to AMBASSADOR; see levelLabels. */
  level?: string;
  /** The identity document a driver says they hold. Declared, unless staff have seen it; counts for no level. */
  declaredId?: IdDocument | null;
  /** When VAYORA staff saw that document: a person saw it, not its issuer. */
  idCheckedAt?: string | null;
}

export type DocumentCheckKind = 'IDENTITY' | 'INSURANCE';

/** A person's check of what a driver declared. No number or copy of anything is kept. */
export interface DocumentCheck {
  id: number;
  kind: DocumentCheckKind;
  vehicleId: number | null;
  status: 'WAITING' | 'CHECKED' | 'REFUSED' | 'WITHDRAWN';
  requestedAt: string;
  decidedAt: string | null;
  note: string | null;
}

/** What an administrator asks to see, and from whom. */
export interface WaitingCheck {
  id: number;
  kind: DocumentCheckKind;
  driverId: number;
  driverName: string;
  requestedAt: string;
  document: IdDocument | null;
  vehicleId: number | null;
  vehicle: string | null;
  insurer: string | null;
  insuredUntil: string | null;
}

/** A driver's own record, for them alone. */
export interface Reliability {
  ridesCompleted: number;
  ridesWithdrawn: number;
  passengersCarried: number;
  passengersCancelled: number;
  noShowsMarked: number;
  averageStars: number | null;
  ratingCount: number;
  responseRate: number | null;
  responseMinutes: number | null;
  level: string;
}

export type Chattiness = 'QUIET' | 'MODERATE' | 'TALKATIVE';

export type Gender = 'FEMALE' | 'MALE' | 'OTHER';

/** Only the kind of document: VAYORA never takes its number or a copy. */
export type IdDocument = 'AADHAAR' | 'PAN' | 'DRIVING_LICENCE' | 'PASSPORT' | 'VOTER_ID';

/** A member's own profile. Null means not said. */
export interface MyProfile {
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  bio: string | null;
  birthYear: number | null;
  gender: Gender | null;
  smoking: boolean | null;
  pets: boolean | null;
  music: boolean | null;
  chattiness: Chattiness | null;
  /** Drivers only: declared, never checked. */
  declaredId?: IdDocument | null;
}

export interface EmergencyContact {
  id: number;
  name: string;
  phone: string;
  relation: string | null;
}

/** The answer to pressing the emergency button. */
export interface SosRaised {
  alertId: number;
  contactsTold: number;
  /** False while messages are simulated: nobody outside the platform was told. */
  reallySent: boolean;
  emergencyNumber: string;
  /** Contacts whose text a real provider could not take; always 0 while simulated. */
  contactsMissed?: number;
}

export interface SosAlert {
  id: number;
  userId: number;
  userName: string;
  userPhone: string | null;
  rideId: number | null;
  lat: number | null;
  lon: number | null;
  contactsTold: number;
  /** `MOCK` means the contacts were not really messaged. */
  sender: string;
  status: 'OPEN' | 'ACKNOWLEDGED';
  createdAt: string;
  /** Contacts whose text could not be sent. */
  contactsMissed?: number;
}

/** A message the mock sender was asked to send and did not. */
export interface MockMessage {
  channel: 'EMAIL' | 'PHONE';
  to: string;
  text: string;
  at: string;
}

/** How long a driver has to answer a request before it is closed. */
export interface RequestTerms {
  answerWithinMinutes: number;
  /** Closed this long before boarding, however recent the request. */
  closesMinutesBeforeBoarding: number;
}

/** How a stretch of a ride stands now: what keeps search results current without searching again. */
export interface Availability {
  rideId: number;
  fromSeq: number;
  toSeq: number;
  status: RideStatus;
  seatsAvailable: number;
}

/** Seats kept from other passengers for a few minutes. Not a booking. */
export interface SeatHold {
  rideId: number;
  fromSeq: number;
  toSeq: number;
  seats: number;
  expiresAt: string;
}

/** How a passenger paid their driver, as the driver says. */
export type PaymentMethod = 'CASH' | 'UPI';

/** Why a booking owes its driver something. */
export type DueReason = 'TRIP_COMPLETED' | 'PASSENGER_NO_SHOW' | 'PASSENGER_CANCELLED';

/**
 * Where a booking's money stands: deferred while the booking is live, then due, or void if it
 * owed nothing, then settled once the driver says they were paid.
 */
export type PaymentStatus = 'DEFERRED' | 'DUE' | 'SETTLED' | 'VOID';

export interface PaymentTerms {
  /** Earliest first. Later than the last tier, the whole fare is owed. */
  cancellationTiers: { atLeastHoursBefore: number; owedShare: number }[];
}

/** A driver's own UPI details. */
export interface DriverPaymentDetails {
  upiId: string | null;
  hasQr: boolean;
}

/** What a passenger with a confirmed or owing booking is shown of how to pay its driver. */
export interface HowToPay {
  driverName: string;
  upiId: string | null;
  hasQr: boolean;
}

/** One of a passenger's bookings, as what it costs and owes. */
export interface PassengerPayment {
  bookingId: number;
  fromStop: string;
  toStop: string;
  fare: number;
  status: PaymentStatus;
  /** What it owed when it ended, paid or not; null until then, and if nothing. */
  amountDue: number | null;
  dueReason: DueReason | null;
  /** Null until the driver says it was paid. */
  method: PaymentMethod | null;
  createdAt: string;
  paidAt: string | null;
}

/** What a booking's receipt says: the same facts as its PDF, names as written. */
export interface BookingReceipt {
  bookingId: number;
  passenger: string;
  driver: string;
  fromStop: string;
  toStop: string;
  seats: number;
  boarding: string;
  status: BookingStatus;
  paidAt: string;
  method: PaymentMethod;
  fare: number;
  /** What the passenger paid the driver: the fare, or part of it after a late cancellation. */
  paid: number;
  reason: DueReason;
}

/** What a passenger owes a driver, or has paid them. */
export interface Earning {
  bookingId: number;
  passengerName: string;
  fromStop: string;
  toStop: string;
  amount: number;
  reason: DueReason;
  status: 'DUE' | 'SETTLED';
  /** Null while it is due. */
  method: PaymentMethod | null;
  /** When the driver said it was paid; while it is due, when the booking was made. */
  at: string;
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
  /** The fare. */
  price: number;
  status: BookingStatus;
  boardingTime: string;
  createdAt: string;
  /** Whether each side has rated the other for this trip. */
  passengerRated: boolean;
  driverRated: boolean;
  /** The passenger's answer to whether a completed trip happened; null until given. */
  passengerConfirmed?: boolean | null;
  flexTier?: FlexTier;
  /** Who drives, and in what: make, model and colour as the driver entered them. */
  driverId?: number;
  driverName?: string;
  vehicle?: string | null;
  /** Picked up here, after the from stop, rather than at it; all null for a stop. */
  pickupLat?: number | null;
  pickupLon?: number | null;
  /** What the pickup costs the driver, in minutes. */
  detourMinutes?: number | null;
  /** Null on a free ride. */
  paymentStatus?: PaymentStatus | null;
  /** What it owed the driver when it ended; null until then, and if nothing. */
  amountDue?: number | null;
  /** How the driver says it was paid; null until then. */
  paymentMethod?: PaymentMethod | null;
}

/** A completed trip its passenger says did not happen. */
export interface DisputedTrip {
  bookingId: number;
  passengerId: number;
  passengerName: string;
  driverId: number;
  driverName: string;
  fromStop: string;
  toStop: string;
  boardingTime: string;
  disputedAt: string;
}

/** A bus service entered by an administrator; not checked against the operator. */
export interface BusService {
  id: number;
  operator: string;
  fromStop: string;
  toStop: string;
  /** Local time of day, HH:mm:ss. */
  departs: string;
  durationMinutes: number;
  fare: number;
  notes: string | null;
}
