export const tripStatuses = [
  'DRAFT',
  'SCHEDULED',
  'READY_TO_DEPART',
  'IN_TRANSIT',
  'ARRIVAL_DETECTED',
  'ARRIVAL_VERIFIED',
  'DELIVERY_IN_PROGRESS',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'EXCEPTION',
] as const;

export type TripStatus = (typeof tripStatuses)[number];

const allowedTransitions: Record<TripStatus, readonly TripStatus[]> = {
  DRAFT: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['READY_TO_DEPART', 'CANCELLED'],
  READY_TO_DEPART: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['ARRIVAL_DETECTED', 'EXCEPTION'],
  ARRIVAL_DETECTED: ['ARRIVAL_VERIFIED', 'EXCEPTION'],
  ARRIVAL_VERIFIED: ['DELIVERY_IN_PROGRESS', 'EXCEPTION'],
  DELIVERY_IN_PROGRESS: ['DELIVERED', 'EXCEPTION'],
  DELIVERED: ['COMPLETED', 'EXCEPTION'],
  COMPLETED: [],
  CANCELLED: [],
  EXCEPTION: [],
};

export class InvalidTripTransitionError extends Error {
  constructor(
    readonly current: TripStatus,
    readonly next: TripStatus,
  ) {
    super(`Trip cannot transition from ${current} to ${next}`);
    this.name = 'InvalidTripTransitionError';
  }
}

export function canTransitionTrip(
  current: TripStatus,
  next: TripStatus,
): boolean {
  return allowedTransitions[current].includes(next);
}

export function assertTripTransition(
  current: TripStatus,
  next: TripStatus,
): void {
  if (!canTransitionTrip(current, next)) {
    throw new InvalidTripTransitionError(current, next);
  }
}
