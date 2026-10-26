import {
  assertTripTransition,
  canTransitionTrip,
  InvalidTripTransitionError,
} from './trip-transitions.js';

describe('trip transitions', () => {
  it('accepts the required departure, arrival, delivery, and completion flow', () => {
    const flow = [
      'DRAFT',
      'SCHEDULED',
      'READY_TO_DEPART',
      'IN_TRANSIT',
      'ARRIVAL_DETECTED',
      'ARRIVAL_VERIFIED',
      'DELIVERY_IN_PROGRESS',
      'DELIVERED',
      'COMPLETED',
    ] as const;

    for (let index = 0; index < flow.length - 1; index += 1) {
      expect(canTransitionTrip(flow[index], flow[index + 1])).toBe(true);
      expect(() => assertTripTransition(flow[index], flow[index + 1])).not.toThrow();
    }
  });

  it('rejects skipping verification and delivery steps', () => {
    expect(() => assertTripTransition('IN_TRANSIT', 'COMPLETED')).toThrow(
      InvalidTripTransitionError,
    );
    expect(() => assertTripTransition('ARRIVAL_DETECTED', 'DELIVERED')).toThrow(
      InvalidTripTransitionError,
    );
  });

  it('keeps completed and cancelled trips terminal', () => {
    expect(canTransitionTrip('COMPLETED', 'IN_TRANSIT')).toBe(false);
    expect(canTransitionTrip('CANCELLED', 'SCHEDULED')).toBe(false);
  });
});
