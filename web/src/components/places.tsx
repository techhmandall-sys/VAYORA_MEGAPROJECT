import { useT } from '../lib/i18n';
import { REGIONS } from '../lib/places';

/** Every place, grouped by state, to go inside a select. A native select can be typed into. */
export function PlaceOptions() {
  const t = useT();
  return (
    <>
      {REGIONS.map((region) => (
        <optgroup key={region.state} label={t(region.state)}>
          {region.places.map((place) => (
            <option key={place.name} value={place.name}>
              {t(place.name)}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
