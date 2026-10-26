export const OPEN_ENDED = new Date('9999-12-31T00:00:00.000Z');

export function isValidRange(effectiveFrom: Date, effectiveTo: Date | null): boolean {
  if (Number.isNaN(effectiveFrom.getTime())) return false;
  if (effectiveTo !== null && Number.isNaN(effectiveTo.getTime())) return false;
  return effectiveTo === null || effectiveTo > effectiveFrom;
}

export function rangesOverlap(
  leftFrom: Date,
  leftTo: Date | null,
  rightFrom: Date,
  rightTo: Date | null,
): boolean {
  const leftEnd = leftTo ?? OPEN_ENDED;
  const rightEnd = rightTo ?? OPEN_ENDED;
  return leftFrom < rightEnd && rightFrom < leftEnd;
}
