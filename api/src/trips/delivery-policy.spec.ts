import {
  InvalidDeliveryQuantityError,
  reconcileDeliveryQuantities,
} from './delivery-policy.js';

describe('delivery quantity reconciliation', () => {
  it('keeps planned dispatch and receipt quantities distinct when they match', () => {
    expect(reconcileDeliveryQuantities(300, 300, 0)).toEqual({
      receivedQuantity: 300,
      damagedQuantity: 0,
      shortageQuantity: 0,
      hasVariance: false,
    });
  });

  it('computes shortage separately from damaged portions', () => {
    expect(reconcileDeliveryQuantities(300, 270, 10)).toEqual({
      receivedQuantity: 270,
      damagedQuantity: 10,
      shortageQuantity: 20,
      hasVariance: true,
    });
  });

  it('rejects negative quantities and received totals above dispatch', () => {
    expect(() => reconcileDeliveryQuantities(300, 301, 0)).toThrow(InvalidDeliveryQuantityError);
    expect(() => reconcileDeliveryQuantities(300, 270, 31)).toThrow(InvalidDeliveryQuantityError);
    expect(() => reconcileDeliveryQuantities(300, -1, 0)).toThrow(InvalidDeliveryQuantityError);
  });
});
