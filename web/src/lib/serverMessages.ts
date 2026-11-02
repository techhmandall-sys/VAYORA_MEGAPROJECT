import { msg, type Translate } from './i18n';

// Every fixed message core-api can answer an error with, and the client's own "cannot
// reach the server". Listed so the translation tables must cover them; the error notice
// translates whatever it shows. A core-api test (ServerMessagesTest) fails if the server
// gains a fixed message that is not here.
export const SERVER_MESSAGES = [
  msg('A bus must go somewhere else'),
  msg('A code was sent a moment ago. Wait before asking for another.'),
  msg('A no-show can only be recorded while the ride is in progress'),
  msg('A ride needs exactly one price per leg between stops'),
  msg('A stretch between two stops is longer than your vehicle covers on a full charge, by your own figures. Add a stop where you can charge.'),
  msg('Add a phone number first'),
  msg('Administrators cannot self-register'),
  msg('Battery and consumption are only for an electric vehicle'),
  msg('Booking not found'),
  msg('Choose a photo'),
  msg('Contact not found'),
  msg('Departure time must be in the future'),
  msg('Email is already registered'),
  msg('Enter a phone number of 10 to 15 digits'),
  msg('Give an email address or a phone number'),
  msg('Invalid email, phone number or password'),
  msg('It is too early to start this ride'),
  msg('Member not found'),
  msg('No boarding pass for that booking'),
  msg('No open alert with that id'),
  msg('No photo'),
  msg('No receipt for that booking'),
  msg('No ride open for booking has those stops'),
  msg('No such bus service'),
  msg('No such channel'),
  msg('No such stopover'),
  msg('Not enough seats left on that part of the ride'),
  msg('Not enough seats left on that part of the ride to hold'),
  msg('Not enough seats left on that part of the ride: some are being held for another passenger for a few minutes'),
  msg('Nothing is due on this booking'),
  msg('Notification not found'),
  msg('Only a charger has a power rating'),
  msg('Only a completed trip can be confirmed'),
  msg('Only a completed trip can be rated'),
  msg('Only a driver can declare an identity document'),
  msg('Only a driver whose profile says she is a woman can offer a women-only ride. Set your gender on your account page first.'),
  msg('Only a ride in progress can be completed'),
  msg('Only a scheduled ride can be cancelled'),
  msg('Only a scheduled ride can be started'),
  msg('Phone number is already registered'),
  msg('Push notifications are not set up on this server'),
  msg('Report not found'),
  msg('Request a code first'),
  msg('Ride not found'),
  msg('Seats cannot be held right now. You can still book.'),
  msg('Stops must be in travel order with increasing offsetMinutes'),
  msg('That code has expired. Request a new one.'),
  msg('That code is no longer valid. Request a new one.'),
  msg('That code is not right'),
  msg('That is more detour than a ride may offer'),
  msg('This ride picks up only at its stops'),
  msg('That pickup would take the driver further out of their way than they offered'),
  msg('A call can only be made while the booking is confirmed'),
  msg('It is too early to call: calls open shortly before the trip'),
  msg('Confirm your phone number on your account page before calling'),
  msg('They have no confirmed phone number. Use the chat instead.'),
  msg('That insurance has already ended'),
  msg('That is not a photo VAYORA can read: use a JPEG or PNG'),
  msg('That is not a push service VAYORA sends to'),
  msg('That phone number belongs to another account'),
  msg('That photo has too many pixels'),
  msg('That photo is too large'),
  msg('That referral code does not exist'),
  msg("The browser's keys are not valid"),
  msg('The earliest hour must be before the latest'),
  msg('The email could not be sent. Try again later.'),
  msg('The text message could not be sent. Try again later.'),
  msg('The first stop must have offsetMinutes 0'),
  msg('The lowest price must not be above the highest'),
  msg('The return must leave after the ride out has arrived'),
  msg('This account has no email address'),
  msg('This driver approves each request, and it is too close to departure for an answer. Choose a ride that confirms instantly.'),
  msg('This idempotency key was already used for a different booking'),
  msg('This is already verified'),
  msg('This report is already closed'),
  msg('This request was already submitted'),
  msg('This ride has already left that stop'),
  msg('This ride has already left; the booking can no longer be cancelled'),
  msg('This ride is already on the road, and its driver approves each request'),
  msg('This ride is for women only'),
  msg('This ride is not open for booking'),
  msg('This ride is not part of a series with rides still to run'),
  msg('This ride is on the road and due at that stop too soon to book'),
  msg('Those stops are not on this ride'),
  msg('Too many wrong attempts. Request a new code.'),
  msg('Declare an identity document first'),
  msg("Declare this car's insurance first"),
  msg('Say which car the insurance is for'),
  msg('This is already waiting for VAYORA staff'),
  msg('VAYORA staff have already checked this'),
  msg('No check is waiting with that id'),
  msg('Say why it could not be confirmed'),
  msg('That is as many codes as one day allows. Try again tomorrow.'),
  msg('User not found'),
  msg('Vehicle not found'),
  msg('Vehicle not found among your vehicles'),
  msg('You already have an open report about this member'),
  msg('You can only report someone you have booked or driven with'),
  msg('You cannot report yourself'),
  msg('You still owe a driver for an earlier booking. You can book again once they mark it paid: see My bookings.'),
  msg('You have already answered for this trip'),
  msg('You have already rated this trip'),
  msg('You sign in with your phone number, so it cannot be removed'),
  msg('toSeq must come after fromSeq'),
  msg('This account is suspended'),
  msg('Google sign-in is not set up on this server'),
  msg('That Google sign-in could not be checked'),
  msg('Google has not confirmed this email address'),
  msg('No account uses this Google address yet. Choose passenger or driver to create one.'),
  msg('Invalid request content.'),
  msg('Cannot reach the server. Check your connection and try again.'),
  msg("The call could not be placed. Try again, or use the ride's chat."),
  // A driver's UPI details.
  msg('That does not look like a UPI ID. It looks like name@bank, as your UPI app shows it'),
  msg('No QR code'),
  // intel's fixed refusals of a live what-if run, which the app shows as they come.
  msg('Sign in first'),
  msg('Your session has ended. Sign in again.'),
  msg('Only an administrator can run the simulator'),
  msg('Live runs are not set up on this server'),
  msg('No such sweep can be run live'),
];

// The messages core-api builds from values, as templates: a message that fits one is shown
// translated with its values kept. ServerMessagesTest fails if the server builds one that
// is not here.
export const SERVER_TEMPLATES = [
  msg('You can have at most {n} emergency contacts'),
  msg('This vehicle can offer at most {n} seats'),
  msg('A ride can repeat for at most {n} further weeks'),
  msg('A {status} booking cannot become {next}'),
  msg('Idempotency-Key must be 1 to {n} characters'),
  msg('Too many wrong passwords. Try again in {n} min.'),
];

// A booking status inside such a message, as a word in the sentence.
const STATUS_WORDS = new Map([
  ['PENDING', msg('pending')],
  ['CONFIRMED', msg('confirmed')],
  ['REJECTED', msg('declined')],
  ['CANCELLED', msg('cancelled')],
  ['COMPLETED', msg('completed')],
  ['NO_SHOW', msg('no-show')],
]);

const escape = (text: string) => text.replace(/[.*+?^$()|[\]\\]/g, '\\$&');

const PATTERNS = SERVER_TEMPLATES.map((template) => {
  const names = [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
  const pattern = new RegExp(`^${escape(template).replace(/\{\w+\}/g, '(.+?)')}$`);
  return { template, names, pattern };
});

/**
 * An error as the reader should see it: a fixed message or one built from values,
 * translated when the tables know it, and anything else as it came.
 */
export function translateServerMessage(text: string, t: Translate): string {
  for (const { template, names, pattern } of PATTERNS) {
    const found = pattern.exec(text);
    if (found) {
      const values = Object.fromEntries(
        names.map((name, i) => {
          const word = STATUS_WORDS.get(found[i + 1]);
          return [name, word ? t(word) : found[i + 1]];
        }),
      );
      return t(template, values);
    }
  }
  return t(text);
}
