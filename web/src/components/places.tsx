import { LocateFixed, Loader2, MapPin } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { msg, useT } from '../lib/i18n';
import { nearestPlace, REGIONS } from '../lib/places';
import { rememberPlace, recentPlaces } from '../lib/recent';
import { controlBase, FieldFrame, useFieldIds } from './ui';

const RECENT = msg('Recent');

type Option =
  | { kind: 'near' }
  | { kind: 'place'; name: string; state: string; group?: string };

/** The places to offer: by state while nothing is typed, the best matches first once something is. */
function optionsFor(query: string, t: (key: string) => string, nearMe: boolean, recents: string[]): Option[] {
  const typed = query.trim().toLowerCase();
  const all = REGIONS.flatMap((region) => region.places.map((place) => ({ name: place.name, state: region.state })));
  if (typed === '') {
    return [
      ...(nearMe ? [{ kind: 'near' } as const] : []),
      ...recents.flatMap((name) => {
        const known = all.find((place) => place.name === name);
        return known ? [{ kind: 'place' as const, ...known, group: RECENT }] : [];
      }),
      ...all.map((place) => ({ kind: 'place' as const, ...place, group: place.state })),
    ];
  }
  // Found by its name or its state, in English or the reader's language.
  const rank = (place: { name: string; state: string }): number => {
    const names = [place.name, t(place.name)].map((name) => name.toLowerCase());
    if (names.some((name) => name.startsWith(typed))) return 0;
    if (names.some((name) => name.includes(typed))) return 1;
    return [place.state, t(place.state)].some((state) => state.toLowerCase().includes(typed)) ? 2 : -1;
  };
  return all
    .map((place) => ({ place, score: rank(place) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => a.score - b.score)
    .map(({ place }) => ({ kind: 'place' as const, ...place }));
}

/**
 * Choosing a place from 126 by typing a few letters, in any of the three languages. The full
 * list by state is there for browsing. Works as a combobox for a keyboard and a screen reader.
 *
 * @param nearMe offers the nearest listed city to where the device says it is. The position
 *               stays in the browser: only the city it picks is ever searched for.
 */
export function PlaceField({ label, value, onChange, error, hint, nearMe = false }: {
  label: string;
  value: string;
  onChange: (name: string) => void;
  error?: string;
  hint?: string;
  nearMe?: boolean;
}) {
  const t = useT();
  const { id, describedBy } = useFieldIds(error, hint);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // Recent places are read as the list opens, so one chosen in the other field shows up too.
  const options = useMemo(() => (open ? optionsFor(query, t, nearMe, recentPlaces()) : []), [open, query, t, nearMe]);
  const optionId = (index: number) => `${listId}-${index}`;

  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open]);

  const close = () => {
    setOpen(false);
    setQuery('');
    setActive(0);
  };

  const choose = (name: string) => {
    rememberPlace(name);
    onChange(name);
    close();
  };

  const locate = () => {
    close();
    if (!('geolocation' in navigator)) {
      setProblem(t('This device cannot report its position.'));
      return;
    }
    setLocating(true);
    setProblem(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        choose(nearestPlace(position.coords.latitude, position.coords.longitude).name);
      },
      () => {
        setLocating(false);
        setProblem(t('Your position is not available. Check that location access is allowed.'));
      },
      { timeout: 10_000 },
    );
  };

  const pick = (option: Option) => (option.kind === 'near' ? locate() : choose(option.name));

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => (options.length === 0 ? 0 : (current + step + options.length) % options.length));
    } else if (event.key === 'Enter' && open) {
      // A press that chooses a place does not also submit the form.
      event.preventDefault();
      if (options[active]) pick(options[active]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      close();
    }
  };

  return (
    <FieldFrame id={id} label={label} error={error ?? problem ?? undefined} hint={hint}>
      <div className="relative mt-1.5">
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-teal-700">
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        </span>
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options.length > 0 ? optionId(active) : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          autoComplete="off"
          spellCheck={false}
          value={open ? query : value ? t(value) : ''}
          // What is chosen stays in sight as a hint while something new is typed over it.
          placeholder={value ? t(value) : t('Choose a place')}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={close}
          onKeyDown={onKeyDown}
          className={`${controlBase} pl-9 font-medium`}
        />
        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            // Pressing the list must not take focus from the field, or it would close first.
            onMouseDown={(event) => event.preventDefault()}
            className="thin-scroll absolute inset-x-0 top-full z-30 mt-1.5 max-h-72 origin-top animate-menu-in overflow-y-auto overscroll-contain rounded-2xl bg-surface py-1.5 shadow-float ring-1 ring-slate-900/[0.08]"
          >
            {options.length === 0 && <li className="px-4 py-3 text-sm text-slate-600">{t('No place by that name is listed. Choose the nearest, then pick the exact point on the map.')}</li>}
            {options.map((option, index) => {
              const previous = options[index - 1];
              const heading = option.kind === 'place' && option.group && (previous?.kind !== 'place' || previous.group !== option.group) ? option.group : null;
              const lit = index === active;
              const look = `flex cursor-pointer items-center gap-2.5 px-4 py-2 text-[15px] ${lit ? 'bg-teal-600/[0.12] text-teal-900' : 'text-slate-900 hover:bg-slate-900/[0.04]'}`;
              return (
                <li key={option.kind === 'near' ? 'near' : `${option.group ?? ''}-${option.name}`} role="presentation">
                  {heading && (
                    <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t(heading)}</p>
                  )}
                  {/* The field keeps the focus and the keyboard, and points at the option lit. */}
                  {option.kind === 'near' ? (
                    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                    <div id={optionId(index)} role="option" tabIndex={-1} aria-selected={lit} className={`${look} font-medium`} onClick={() => pick(option)} onMouseEnter={() => setActive(index)}>
                      <LocateFixed aria-hidden="true" className="h-4 w-4 flex-none text-teal-700" />
                      {t('Near me')}
                    </div>
                  ) : (
                    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                    <div id={optionId(index)} role="option" tabIndex={-1} aria-selected={lit} className={look} onClick={() => pick(option)} onMouseEnter={() => setActive(index)}>
                      <span className="min-w-0 flex-1 truncate">{t(option.name)}</span>
                      {!heading && !option.group && (
                        <span aria-hidden="true" className="flex-none text-xs text-slate-500">
                          {t(option.state)}
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </FieldFrame>
  );
}
