const EARTH_RADIUS_METERS = 6_371_000;

export function distanceMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latA = radians(latitudeA);
  const latB = radians(latitudeB);
  const deltaLat = latB - latA;
  const deltaLon = radians(longitudeB - longitudeA);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLon / 2) ** 2;

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function isWithinRadius(
  latitude: number,
  longitude: number,
  centerLatitude: number,
  centerLongitude: number,
  radiusMeters: number,
): boolean {
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) return false;
  return distanceMeters(latitude, longitude, centerLatitude, centerLongitude) <= radiusMeters;
}
