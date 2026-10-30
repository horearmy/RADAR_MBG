// Negative cross-tenant tests (detail).
// Requires test DB + seeding fixture (two tenants A/B with users).
// Scenarios:
// 1. Tenant A listTrips cannot return tenant B trips.
// 2. Tenant A getTripById(B trip) -> 404.
// 3. Tenant A createTrip with tenant B driver/vehicle -> 400/404.
// 4. Tenant A cannot read driver/vehicle of tenant B.
// 5. Tenant A cannot upload/download document of tenant B.
// 6. Tenant suspended cannot perform normal ops.
import { describe, it } from 'vitest';

describe('cross-tenant negative (detail)', () => {
  it('placeholder', () => {
    // implement with auth + seeding harness
  });
});
