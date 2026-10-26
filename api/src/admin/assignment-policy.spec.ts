import { describe, expect, it } from 'vitest';
import { isValidRange, rangesOverlap } from './assignment-policy.js';

const at = (hour: number) => new Date(`2026-10-26T${String(hour).padStart(2, '0')}:00:00.000Z`);

describe('assignment policy', () => {
  it('accepts an open-ended range', () => {
    expect(isValidRange(at(8), null)).toBe(true);
  });

  it('rejects a range that ends before it starts', () => {
    expect(isValidRange(at(8), at(7))).toBe(false);
    expect(isValidRange(at(8), at(8))).toBe(false);
  });

  it('rejects invalid dates', () => {
    expect(isValidRange(new Date('not-a-date'), null)).toBe(false);
  });

  it('detects overlapping closed ranges', () => {
    expect(rangesOverlap(at(8), at(10), at(9), at(11))).toBe(true);
    expect(rangesOverlap(at(8), at(10), at(10), at(12))).toBe(false);
  });

  it('treats open-ended assignments as overlapping later ranges', () => {
    expect(rangesOverlap(at(8), null, at(20), at(22))).toBe(true);
    expect(rangesOverlap(at(20), at(22), at(8), null)).toBe(true);
  });

  it('allows adjacent ranges', () => {
    expect(rangesOverlap(at(8), at(10), at(10), null)).toBe(false);
  });
});
