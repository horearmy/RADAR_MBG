import { distanceMeters, isWithinRadius } from './trip-geo.js';

describe('trip geospatial helpers', () => {
  it('returns zero distance for the same WGS84 coordinate', () => {
    expect(distanceMeters(-6.2, 106.8, -6.2, 106.8)).toBe(0);
  });

  it('calculates geodesic distance in meters and checks radius boundaries', () => {
    const distance = distanceMeters(0, 0, 0, 0.001);

    expect(distance).toBeGreaterThan(110);
    expect(distance).toBeLessThan(112);
    expect(isWithinRadius(0, 0.001, 0, 0, 112)).toBe(true);
    expect(isWithinRadius(0, 0.001, 0, 0, 100)).toBe(false);
  });

  it('rejects invalid geofence radii', () => {
    expect(isWithinRadius(0, 0, 0, 0, 0)).toBe(false);
    expect(isWithinRadius(0, 0, 0, 0, Number.NaN)).toBe(false);
  });
});
