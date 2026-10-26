import { hasConfirmedGeofenceArrival } from './geofence-policy.js';

const center = {
  centerLatitude: -6.2,
  centerLongitude: 106.8,
  radiusMeters: 100,
  minGpsAccuracyMeters: 30,
  confirmationFixes: 2,
  confirmationDurationSeconds: 10,
};
const now = new Date('2026-10-26T02:00:20.000Z');

function fix(deviceTimestamp: string, accuracyMeters = 10, latitude = -6.2) {
  return {
    latitude,
    longitude: 106.8,
    accuracyMeters,
    deviceTimestamp: new Date(deviceTimestamp),
    integrityFlags: [] as string[],
  };
}

describe('geofence arrival policy', () => {
  it('requires multiple accurate fixes inside the radius for the configured duration', () => {
    expect(hasConfirmedGeofenceArrival([
      fix('2026-10-26T02:00:20.000Z'),
      fix('2026-10-26T02:00:10.000Z'),
    ], center, now, 90)).toBe(true);
  });

  it('does not confirm from one fix, an inaccurate fix, or a short dwell', () => {
    expect(hasConfirmedGeofenceArrival([fix('2026-10-26T02:00:20.000Z')], center, now, 90)).toBe(false);
    expect(hasConfirmedGeofenceArrival([
      fix('2026-10-26T02:00:20.000Z'),
      fix('2026-10-26T02:00:10.000Z', 60),
    ], center, now, 90)).toBe(false);
    expect(hasConfirmedGeofenceArrival([
      fix('2026-10-26T02:00:20.000Z'),
      fix('2026-10-26T02:00:15.000Z'),
    ], center, now, 90)).toBe(false);
  });

  it('rejects stale fixes, integrity flags, and positions outside the geofence', () => {
    expect(hasConfirmedGeofenceArrival([
      fix('2026-10-26T01:58:00.000Z'),
      fix('2026-10-26T01:57:50.000Z'),
    ], center, now, 30)).toBe(false);

    const flagged = fix('2026-10-26T02:00:20.000Z');
    flagged.integrityFlags = ['IMPLAUSIBLE_JUMP'];
    expect(hasConfirmedGeofenceArrival([
      fix('2026-10-26T02:00:20.000Z'),
      flagged,
    ], center, now, 90)).toBe(false);

    expect(hasConfirmedGeofenceArrival([
      fix('2026-10-26T02:00:20.000Z', 10, -6.197),
      fix('2026-10-26T02:00:10.000Z', 10, -6.197),
    ], center, now, 90)).toBe(false);
  });
});
