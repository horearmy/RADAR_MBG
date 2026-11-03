export interface UserFeatures {
  drivers: boolean;
  trips: boolean;
  vehicles: boolean;
}

// Fungsi cek fitur - menerima user object dan feature name
export function hasFeature(user: any, feature: "drivers" | "vehicles"): boolean {
  if (!user || !user.features) return true; // Default: fitur aktif
  return user.features[feature] === true;
}