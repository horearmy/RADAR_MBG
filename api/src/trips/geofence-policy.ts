import { distanceMeters } from './trip-geo.js';

export type GeofenceFix = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  deviceTimestamp: Date;
  integrityFlags: unknown;
};

export type CircleGeofencePolicy = {
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
  minGpsAccuracyMeters: number;
  confirmationFixes: number;
  confirmationDurationSeconds: number;
};

export function hasConfirmedGeofenceArrival(
  newestFirstFixes: GeofenceFix[],
  geofence: CircleGeofencePolicy,
  now: Date,
  maxFixAgeSeconds: number,
): boolean {
  if (
    newestFirstFixes.length < geofence.confirmationFixes ||
    !Number.isFinite(maxFixAgeSeconds) ||
    maxFixAgeSeconds <= 0
  ) {
    return false;
  }

  const requiredFixes = newestFirstFixes.slice(0, geofence.confirmationFixes);
  const allFixesValid = requiredFixes.every((fix) => {
    const hasIntegrityFlags = Array.isArray(fix.integrityFlags) && fix.integrityFlags.length > 0;
    const ageMilliseconds = now.getTime() - fix.deviceTimestamp.getTime();
    return (
      !hasIntegrityFlags &&
      fix.accuracyMeters !== null &&
      fix.accuracyMeters <= geofence.minGpsAccuracyMeters &&
      ageMilliseconds >= 0 &&
      ageMilliseconds <= maxFixAgeSeconds * 1000 &&
      distanceMeters(
        fix.latitude,
        fix.longitude,
        geofence.centerLatitude,
        geofence.centerLongitude,
      ) <= geofence.radiusMeters
    );
  });
  if (!allFixesValid) return false;

  const oldestFix = requiredFixes[requiredFixes.length - 1];
  const newestFix = requiredFixes[0];
  const durationSeconds =
    (newestFix.deviceTimestamp.getTime() - oldestFix.deviceTimestamp.getTime()) / 1000;

  return durationSeconds >= geofence.confirmationDurationSeconds;
}
