import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppRoutes } from '../App';
import { AuthProvider } from './auth';
import { formatRupees, setFormatLanguage } from './format';
import { Notice } from '../components/ui';
import { LanguageProvider, TABLES, translate, type Language } from './i18n';
import { translatedNotification } from './notificationText';
import { translateServerMessage } from './serverMessages';

const SRC = join(process.cwd(), 'src');

function sourceFiles(directory: string = SRC): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return name === 'locales' || name === 'test' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.includes('.test.') ? [path] : [];
  });
}

/** Every string passed to `t(` or `msg(` as a literal, anywhere in the app's source. */
function markedStrings(): Set<string> {
  const marked = /\b(?:t|msg)\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
  const found = new Set<string>();
  for (const file of sourceFiles()) {
    for (const match of readFileSync(file, 'utf8').matchAll(marked)) {
      found.add((match[1] ?? match[2]).replace(/\\'/g, "'").replace(/\\"/g, '"'));
    }
  }
  return found;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

afterEach(() => {
  setFormatLanguage('en');
  localStorage.clear();
  document.documentElement.lang = '';
});

describe.each(['hi', 'mr'] as const)('the %s table', (language) => {
  // Loaded by the test setup; the app fetches each only when it is chosen.
  const table = TABLES[language]!;
  const marked = markedStrings();

  it('has an entry for every string the app can show', () => {
    expect(marked.size).toBeGreaterThan(250);
    expect([...marked].filter((text) => !(text in table))).toEqual([]);
  });

  it('has no entry the app no longer uses', () => {
    expect(Object.keys(table).filter((text) => !marked.has(text))).toEqual([]);
  });

  it('keeps exactly the placeholders of the English', () => {
    const broken = Object.entries(table).filter(([english, translated]) => placeholders(english).join() !== placeholders(translated).join());
    expect(broken).toEqual([]);
  });

  it('translates everything except what is the same in every language', () => {
    const untranslated = Object.entries(table)
      .filter(([english, translated]) => english === translated)
      .map(([english]) => english);
    expect(untranslated).toEqual(['UPI']);
  });

  it('keeps the emergency number, the currency sign and the product name as they are', () => {
    const emergency = Object.keys(table).find((text) => text.includes('112'))!;
    expect(table[emergency]).toContain('112');
    expect(table['Price to {town} (₹)']).toContain('₹');
    expect(table['Choose how you will use VAYORA']).toContain('VAYORA');
  });
});

describe('the source', () => {
  // Text a reader sees must go through `t`. These find text that does not.
  const strip = (code: string) => code.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

  // Screens and components only: lib/ has providers but nothing a reader sees.
  const screens = () => sourceFiles().filter((file) => file.endsWith('.tsx') && !file.slice(SRC.length + 1).startsWith('lib'));

  it('has no literal text between tags', () => {
    // A `>` that closes a tag, not the one in `=>`, then text, then the next tag.
    const text = /(?<![=-])>\s*([^<>{}=;()|&?:]*[A-Za-z]{2}[^<>{}=;()|&?:]*?)\s*</g;
    // The map's attribution is a credit the licence requires, in the owner's own name.
    const allowed = new Set(['OpenStreetMap']);
    const found = screens()
      .flatMap((file) => [...strip(readFileSync(file, 'utf8')).matchAll(text)].map((match) => [file.slice(SRC.length + 1), match[1].trim()]))
      .filter(([, literal]) => !allowed.has(literal))
      .map(([file, literal]) => `${file}: ${literal}`);
    expect(found).toEqual([]);
  });

  it('has no literal text in the attributes a reader sees or hears', () => {
    const attribute = /\b(label|hint|title|empty|confirmLabel|describe|legend|aria-label|placeholder|alt)="([^"]*[A-Za-z][^"]*)"/g;
    const found = screens().flatMap((file) =>
      [...strip(readFileSync(file, 'utf8')).matchAll(attribute)].map((match) => `${file.slice(SRC.length + 1)}: ${match[0]}`),
    );
    expect(found).toEqual([]);
  });
});

describe('translate', () => {
  it('fills placeholders in whichever order the language puts them', () => {
    expect(translate('en', '{from} to {to} hours before boarding', { from: 24, to: 48 })).toBe('24 to 48 hours before boarding');
    expect(translate('hi', '{from} to {to} hours before boarding', { from: 24, to: 48 })).toBe('सवार होने से 24 से 48 घंटे पहले');
    expect(translate('mr', '{n} seats left', { n: 3 })).toBe('3 जागा शिल्लक');
  });

  it('falls back to the English for a string it has no entry for, and never returns nothing', () => {
    expect(translate('hi', 'A sentence no table has')).toBe('A sentence no table has');
    expect(translate('mr', '')).toBe('');
  });

  it('leaves a placeholder visible when no value was given for it', () => {
    expect(translate('en', 'Rate {name}', {})).toBe('Rate {name}');
  });
});

describe('the app in another language', () => {
  function open(path: string, language: Language) {
    sessionStorage.setItem(
      'vayora.session',
      JSON.stringify({ accessToken: 'token', expiresInSeconds: 3600, user: { id: 1, email: 'a@example.test', fullName: 'Asha Patil', role: 'PASSENGER' } }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const path = new URL(url).pathname;
        const body = path.endsWith('/unread-count') ? { unread: 2 } : path.endsWith('/bookings') ? [] : { detail: 'Service unavailable' };
        return new Response(JSON.stringify(body), { status: path.includes('/rides/search') ? 503 : 200 });
      }),
    );
    render(
      <LanguageProvider initial={language}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <AuthProvider>
            <MemoryRouter initialEntries={[path]}>
              <AppRoutes />
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      </LanguageProvider>,
    );
  }

  it('shows navigation, headings, town names and empty states in Hindi', async () => {
    open('/bookings', 'hi');

    expect(await screen.findByRole('heading', { name: 'मेरी बुकिंग' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'मुख्य' });
    expect(within(nav).getByRole('link', { name: 'सवारी खोजें' })).toBeInTheDocument();
    expect(await within(nav).findByText('अपठित')).toBeInTheDocument(); // the unread count, once it has loaded
    expect(await screen.findByText('आपकी अभी तक कोई बुकिंग नहीं है।')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('hi');
  });

  it('translates validation messages and town names in Marathi', async () => {
    open('/search', 'mr');

    expect(await screen.findByRole('heading', { name: 'प्रवास शोधा' })).toBeInTheDocument();
    expect(screen.getByLabelText('कुठून')).toHaveValue('कोल्हापूर'); // the place reads in Marathi, and the server still gets its English name
    await userEvent.clear(screen.getByLabelText('जागा'));
    await userEvent.type(screen.getByLabelText('जागा'), '0');
    await userEvent.click(screen.getByRole('button', { name: 'शोधा' }));

    expect(await screen.findByText('किमान 1 जागा')).toBeInTheDocument();
  });

  it('translates a message the server is known to send', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: 'Not enough seats left on that part of the ride' }), { status: 409 })));
    render(<Notice tone="error">Not enough seats left on that part of the ride</Notice>, {
      wrapper: ({ children }) => <LanguageProvider initial="hi">{children}</LanguageProvider>,
    });
    expect(screen.getByRole('alert')).toHaveTextContent('सवारी के उस हिस्से पर पर्याप्त सीटें नहीं बचीं');
  });

  it('translates a message the server builds from a number, keeping the number', () => {
    render(<Notice tone="error">You can have at most 3 emergency contacts</Notice>, {
      wrapper: ({ children }) => <LanguageProvider initial="mr">{children}</LanguageProvider>,
    });
    expect(screen.getByRole('alert')).toHaveTextContent('तुम्ही जास्तीत जास्त 3 आपत्कालीन संपर्क ठेवू शकता');
  });

  it("shows a server explanation it does not know as it came, in English", async () => {
    open('/search', 'hi');

    await userEvent.click(await screen.findByRole('button', { name: 'खोजें' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable');
    expect(screen.getByRole('button', { name: 'फिर से कोशिश करें' })).toBeInTheDocument();
  });

  it('switches language from the header, remembers it, and can switch back', async () => {
    open('/bookings', 'en');

    await userEvent.selectOptions(await screen.findByLabelText('Language'), 'मराठी');
    expect(await screen.findByRole('heading', { name: 'माझी बुकिंग' })).toBeInTheDocument();
    expect(localStorage.getItem('vayora.language')).toBe('mr');
    expect(document.documentElement.lang).toBe('mr');

    await userEvent.selectOptions(screen.getByLabelText('भाषा'), 'English');
    expect(await screen.findByRole('heading', { name: 'My bookings' })).toBeInTheDocument();
  });

  it('offers each language under its own name, in its own script', async () => {
    open('/bookings', 'hi');

    const options = within(await screen.findByLabelText('भाषा')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['English', 'हिन्दी', 'मराठी']);
  });
});

describe('money', () => {
  it('uses the same digits in every language, so a fare reads the same to both sides', () => {
    for (const language of ['en', 'hi', 'mr'] as const) {
      setFormatLanguage(language);
      expect(formatRupees(1144)).toMatch(/1,144/);
      expect(formatRupees(1144)).toContain('₹');
    }
  });
});

describe('notifications', () => {
  const hindi = (text: string, values?: Record<string, string | number>) => translate('hi', text, values);

  it('are translated piece by piece: the sentence, the seats, the towns and each other ride', () => {
    const notice = {
      template: 'The driver cancelled the ride you booked for {seats}. You owe nothing. {more}',
      values: {
        seats: { template: '{n} seats, {from} to {to}', values: { n: '2', from: 'Kolhapur', to: 'Pune' } },
        more: {
          template: 'Other rides that could take you: {rides}. Search again to book one.',
          values: { rides: [{ template: '{time} from {stop} with {driver}', values: { time: '07:15', stop: 'Kolhapur', driver: 'Pune Kulkarni' } }] },
        },
      },
    };
    expect(translatedNotification(hindi, notice)).toBe(
      'चालक ने वह सवारी रद्द कर दी जिसमें आपने 2 सीटें, कोल्हापुर से पुणे बुक की थीं। आपको कुछ नहीं देना।'
        + ' अन्य सवारियाँ जो आपको ले जा सकती हैं: 07:15, कोल्हापुर से, Pune Kulkarni के साथ। बुक करने के लिए फिर से खोजें।',
    );
  });

  it("leave a person's name and an administrator's note as written", () => {
    expect(translatedNotification(hindi, { template: 'An administrator reviewed a report about you: {note}', values: { note: 'Pune' } }))
      .toBe('एक व्यवस्थापक ने आपके बारे में एक रिपोर्ट की समीक्षा की: Pune');
  });

  it('are left to the English when any part is unknown', () => {
    expect(translatedNotification(hindi, { template: '{x}', values: { x: 'y' } })).toBeNull();
    expect(translatedNotification(hindi, null)).toBeNull();
  });

  it('give a moment and a day in the reader language, not the server English or ISO', () => {
    setFormatLanguage('mr');
    const marathi = (text: string, values?: Record<string, string | number>) => translate('mr', text, values);
    const reminder = translatedNotification(marathi, {
      template: 'Your seat from {from} to {to} leaves {when}. If your plans have changed, cancelling now lets someone else take it, and you would owe your driver Rs {owed} of your Rs {fare} fare. If you are still travelling, there is nothing to do.',
      values: { from: 'Kolhapur', to: 'Pune', when: '2026-10-23T02:00:00Z', owed: '200.00', fare: '400.00' },
    });
    const nudge = translatedNotification(marathi, {
      template: 'Passengers looked for a ride from {from} to {to} on {date} and found none. If you are driving then, you could offer seats.',
      values: { from: 'Kolhapur', to: 'Pune', date: '2026-10-27' },
    });

    expect(reminder).toContain('23 ऑक्टो');
    expect(reminder).toContain('7:30');
    expect(reminder).not.toMatch(/Fri|2026-10-23T/);
    expect(nudge).toContain('27 ऑक्टो');
    expect(nudge).not.toContain('2026-10-27');
  });
});

describe('server messages built from values', () => {
  const inLanguage = (language: Language) => (text: string, values?: Record<string, string | number>) => translate(language, text, values);

  it('name a booking status as a word, in English too', () => {
    expect(translateServerMessage('A CANCELLED booking cannot become CONFIRMED', inLanguage('en'))).toBe('A cancelled booking cannot become confirmed');
    expect(translateServerMessage('A CANCELLED booking cannot become CONFIRMED', inLanguage('hi'))).toBe('रद्द बुकिंग पक्की नहीं हो सकती');
  });

  it('keep the number as it came', () => {
    expect(translateServerMessage('This vehicle can offer at most 6 seats', inLanguage('hi'))).toBe('यह वाहन अधिकतम 6 सीटें दे सकता है');
  });

  it('leave fixed messages to the table and anything unknown as it came', () => {
    expect(translateServerMessage('Booking not found', inLanguage('hi'))).toBe(translate('hi', 'Booking not found'));
    expect(translateServerMessage('You can have at most 3 emergency contacts and a dog', inLanguage('hi'))).toBe(
      'You can have at most 3 emergency contacts and a dog',
    );
  });
});
