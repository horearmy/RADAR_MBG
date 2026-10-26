export type DeliveryReconciliation = {
  receivedQuantity: number;
  damagedQuantity: number;
  shortageQuantity: number;
  hasVariance: boolean;
};

export class InvalidDeliveryQuantityError extends Error {
  constructor() {
    super('Received and damaged quantities cannot exceed the dispatched quantity');
    this.name = 'InvalidDeliveryQuantityError';
  }
}

export function reconcileDeliveryQuantities(
  dispatchedQuantity: number,
  receivedQuantity: number,
  damagedQuantity: number,
): DeliveryReconciliation {
  if (
    !Number.isSafeInteger(dispatchedQuantity) ||
    dispatchedQuantity <= 0 ||
    !Number.isSafeInteger(receivedQuantity) ||
    receivedQuantity < 0 ||
    !Number.isSafeInteger(damagedQuantity) ||
    damagedQuantity < 0 ||
    receivedQuantity + damagedQuantity > dispatchedQuantity
  ) {
    throw new InvalidDeliveryQuantityError();
  }

  const shortageQuantity = dispatchedQuantity - receivedQuantity - damagedQuantity;
  return {
    receivedQuantity,
    damagedQuantity,
    shortageQuantity,
    hasVariance: shortageQuantity > 0 || damagedQuantity > 0,
  };
}
