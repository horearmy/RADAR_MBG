import {
  ExceptionSeverity,
  ExceptionSource,
  ExceptionStatus,
  TrackingStatus,
} from '@prisma/client';

export const CLOSED_EXCEPTION_STATUSES: ExceptionStatus[] = [
  ExceptionStatus.RESOLVED,
  ExceptionStatus.FALSE_POSITIVE,
  ExceptionStatus.DUPLICATE,
  ExceptionStatus.CLOSED_WITH_NOTE,
];

export type AlertSettings = {
  lateArrivalMinutes: number;
  lateHighMinutes: number;
  gpsStaleMinutes: number;
  gpsOfflineMinutes: number;
  qrLookbackMinutes: number;
  podReviewMinutes: number;
  cooldownMinutes: number;
  intervalSeconds: number;
  batchLimit: number;
};

export function gpsAlertForAge(
  ageMinutes: number | null,
  settings: Pick<AlertSettings, 'gpsStaleMinutes' | 'gpsOfflineMinutes'>,
): {
  trackingStatus: TrackingStatus;
  source: ExceptionSource | null;
  severity: ExceptionSeverity | null;
} {
  if (ageMinutes === null || ageMinutes >= settings.gpsOfflineMinutes) {
    return {
      trackingStatus: TrackingStatus.OFFLINE,
      source: ExceptionSource.OFFLINE,
      severity: ExceptionSeverity.HIGH,
    };
  }
  if (ageMinutes >= settings.gpsStaleMinutes) {
    return {
      trackingStatus: TrackingStatus.STALE,
      source: ExceptionSource.GPS_STALE,
      severity: ExceptionSeverity.ATTENTION,
    };
  }
  return {
    trackingStatus: TrackingStatus.LIVE,
    source: null,
    severity: null,
  };
}

export function lateArrivalSeverity(
  minutesLate: number,
  highAfterMinutes: number,
) {
  return minutesLate >= highAfterMinutes
    ? ExceptionSeverity.HIGH
    : ExceptionSeverity.ATTENTION;
}

export function quantityVarianceSeverity(
  shortageQuantity: number,
  damagedQuantity: number,
  dispatchedQuantity: number,
) {
  const variance = Math.max(0, shortageQuantity) + Math.max(0, damagedQuantity);
  const base = Math.max(1, dispatchedQuantity);
  return variance / base >= 0.1
    ? ExceptionSeverity.HIGH
    : ExceptionSeverity.ATTENTION;
}

export function alertDedupeKey(
  source: string,
  tripId: string,
  now: Date,
  cooldownMs: number,
) {
  const bucket = Math.floor(now.getTime() / Math.max(cooldownMs, 1));
  return `${source}:${tripId}:${bucket}`.slice(0, 160);
}

export function shouldSuppressAlert(
  latest: { status: ExceptionStatus; openedAt: Date } | null,
  now: Date,
  cooldownMs: number,
) {
  if (!latest) return false;
  if (!CLOSED_EXCEPTION_STATUSES.includes(latest.status)) return true;
  return now.getTime() - latest.openedAt.getTime() < cooldownMs;
}
