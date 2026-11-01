import { describe, expect, it } from 'vitest';

import { nearestPlace, PLACES, placeNamed, REGIONS, roughDriveMinutes } from './places';

describe('the places a ride can use', () => {
  it('has no name twice, for the name is what the form and the server go by', () => {
    const names = PLACES.map((place) => place.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('has every place in India, and every state with a place', () => {
    for (const place of PLACES) {
      expect(place.lat, place.name).toBeGreaterThan(8);
      expect(place.lat, place.name).toBeLessThan(35);
      expect(place.lon, place.name).toBeGreaterThan(68);
      expect(place.lon, place.name).toBeLessThan(98);
    }
    for (const region of REGIONS) expect(region.places.length, region.state).toBeGreaterThan(0);
  });

  it('keeps the four research towns where the simulator has them', () => {
    expect(placeNamed('Kolhapur')).toMatchObject({ lat: 16.705, lon: 74.2433 });
    expect(placeNamed('Karad')).toMatchObject({ lat: 17.289, lon: 74.1818 });
    expect(placeNamed('Satara')).toMatchObject({ lat: 17.6805, lon: 74.0183 });
    expect(placeNamed('Pune')).toMatchObject({ lat: 18.5204, lon: 73.8567 });
  });

  it('knows nothing of a place not listed', () => {
    expect(placeNamed('Atlantis')).toBeUndefined();
  });
});

describe('nearestPlace', () => {
  it('finds the listed city closest to a point', () => {
    expect(nearestPlace(16.71, 74.24).name).toBe('Kolhapur');
    expect(nearestPlace(13.1, 80.3).name).toBe('Chennai');
  });
});

describe('roughDriveMinutes', () => {
  it('is in whole fives, and grows with the distance', () => {
    const kolhapur = placeNamed('Kolhapur')!;
    const near = roughDriveMinutes(kolhapur, placeNamed('Karad')!);
    const far = roughDriveMinutes(kolhapur, placeNamed('Pune')!);

    expect(near % 5).toBe(0);
    expect(far % 5).toBe(0);
    expect(far).toBeGreaterThan(near);
  });

  it('is the same both ways, and never nothing', () => {
    const mumbai = placeNamed('Mumbai')!;
    const panaji = placeNamed('Panaji')!;

    expect(roughDriveMinutes(mumbai, panaji)).toBe(roughDriveMinutes(panaji, mumbai));
    expect(roughDriveMinutes(mumbai, mumbai)).toBe(5);
  });
});
