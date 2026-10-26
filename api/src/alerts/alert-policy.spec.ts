import { ExceptionSeverity, ExceptionSource, ExceptionStatus, TrackingStatus } from '@prisma/client';
import {
  alertDedupeKey,
  gpsAlertForAge,
  lateArrivalSeverity,
  quantityVarianceSeverity,
  shouldSuppressAlert,
} from './alert-policy.js';

const gpsThresholds = { gpsStaleMinutes: 3, gpsOfflineMinutes: 10 };

describe('alert policy', () => {
  it('classifies missing and old GPS as offline', () => {
    expect(gpsAlertForAge(null, gpsThresholds)).toEqual({
      trackingStatus: TrackingStatus.OFFLINE,
      source: ExceptionSource.OFFLINE,
      severity: ExceptionSeverity.HIGH,
    });
    expect(gpsAlertForAge(12, gpsThresholds).source).toBe(ExceptionSource.OFFLINE);
  });

  it('classifies intermediate GPS age as stale and fresh data as live', () => {
    expect(gpsAlertForAge(5, gpsThresholds)).toEqual({
      trackingStatus: TrackingStatus.STALE,
      source: ExceptionSource.GPS_STALE,
      severity: ExceptionSeverity.ATTENTION,
    });
    expect(gpsAlertForAge(0.5, gpsThresholds)).toEqual({
      trackingStatus: TrackingStatus.LIVE,
      source: null,
      severity: null,
    });
  });

  it('escalates late arrival severity after the high threshold', () => {
    expect(lateArrivalSeverity(20, 60)).toBe(ExceptionSeverity.ATTENTION);
    expect(lateArrivalSeverity(61, 60)).toBe(ExceptionSeverity.HIGH);
  });

  it('flags quantity variance at ten percent or more', () => {
    expect(quantityVarianceSeverity(5, 0, 300)).toBe(ExceptionSeverity.ATTENTION);
    expect(quantityVarianceSeverity(20, 10, 300)).toBe(ExceptionSeverity.HIGH);
  });

  it('keeps dedupe keys stable within a cooldown bucket and changes after it', () => {
    const now = new Date('2026-10-26T10:00:00.000Z');
    const first = alertDedupeKey(ExceptionSource.LATE_ARRIVAL, 'trip-1', now, 30 * 60_000);
    const sameBucket = alertDedupeKey(
      ExceptionSource.LATE_ARRIVAL,
      'trip-1',
      new Date('2026-10-26T10:20:00.000Z'),
      30 * 60_000,
    );
    const nextBucket = alertDedupeKey(
      ExceptionSource.LATE_ARRIVAL,
      'trip-1',
      new Date('2026-10-26T10:31:00.000Z'),
      30 * 60_000,
    );
    expect(sameBucket).toBe(first);
    expect(nextBucket).not.toBe(first);
  });

  it('suppresses only active cases or closed cases inside cooldown', () => {
    const now = new Date('2026-10-26T10:00:00.000Z');
    const cooldown = 30 * 60_000;
    expect(shouldSuppressAlert(null, now, cooldown)).toBe(false);
    expect(
      shouldSuppressAlert(
        { status: ExceptionStatus.INVESTIGATING, openedAt: new Date('2026-10-26T08:00:00.000Z') },
        now,
        cooldown,
      ),
    ).toBe(true);
    expect(
      shouldSuppressAlert(
        { status: ExceptionStatus.RESOLVED, openedAt: new Date('2026-10-26T09:45:00.000Z') },
        now,
        cooldown,
      ),
    ).toBe(true);
    expect(
      shouldSuppressAlert(
        { status: ExceptionStatus.RESOLVED, openedAt: new Date('2026-10-26T09:00:00.000Z') },
        now,
        cooldown,
      ),
    ).toBe(false);
  });
});
