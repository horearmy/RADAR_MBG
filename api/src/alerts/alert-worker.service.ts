import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  ArrivalVerificationResult,
  DeliveryReviewStatus,
  ExceptionSeverity,
  ExceptionSource,
  Prisma,
  TripStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service.js';
import { ExceptionService } from '../exceptions/exception.service.js';
import {
  alertDedupeKey,
  gpsAlertForAge,
  lateArrivalSeverity,
  quantityVarianceSeverity,
  shouldSuppressAlert,
  type AlertSettings,
} from './alert-policy.js';

type ScanCounts = {
  lateArrival: number;
  gpsStale: number;
  gpsOffline: number;
  qrFailure: number;
  quantityVariance: number;
  podIncomplete: number;
};

const EMPTY_COUNTS: ScanCounts = {
  lateArrival: 0,
  gpsStale: 0,
  gpsOffline: 0,
  qrFailure: 0,
  quantityVariance: 0,
  podIncomplete: 0,
};

@Injectable()
export class AlertWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly exceptions: ExceptionService,
  ) {}

  onModuleInit() {
    if (process.env.ALERT_WORKER_ENABLED !== 'true') {
      this.logger.log('Alert worker disabled (ALERT_WORKER_ENABLED != true).');
      return;
    }
    const settings = readAlertSettings();
    this.timer = setInterval(() => {
      void this.runOnce().catch((error: unknown) => {
        this.logger.error('Alert worker run failed.', error);
      });
    }, settings.intervalSeconds * 1000);
    this.timer.unref();
    void this.runOnce().catch((error: unknown) => {
      this.logger.error('Initial alert worker run failed.', error);
    });
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async runOnce(now = new Date()): Promise<ScanCounts> {
    if (this.running) {
      this.logger.warn('Skipped alert scan because the previous run is still active.');
      return { ...EMPTY_COUNTS };
    }

    this.running = true;
    const settings = readAlertSettings();
    const counts = { ...EMPTY_COUNTS };
    const scans: Array<[keyof ScanCounts, () => Promise<number>]> = [
      ['lateArrival', () => this.scanLateArrivals(now, settings, counts)],
      ['gpsStale', () => this.scanGpsHealth(now, settings, counts)],
      ['qrFailure', () => this.scanQrFailures(now, settings, counts)],
      ['quantityVariance', () => this.scanQuantityVariance(now, settings, counts)],
      ['podIncomplete', () => this.scanPodIncomplete(now, settings, counts)],
    ];

    try {
      for (const [name, scan] of scans) {
        try {
          await scan();
        } catch (error) {
          this.logger.error(`Alert scan "${name}" failed.`, error);
        }
      }
      const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
      if (total > 0) {
        this.logger.log(
          `Alert worker raised ${total} case(s): ${JSON.stringify(counts)}.`,
        );
      }
      return counts;
    } finally {
      this.running = false;
    }
  }

  private async scanLateArrivals(
    now: Date,
    settings: AlertSettings,
    counts: ScanCounts,
  ) {
    const cutoff = new Date(now.getTime() - settings.lateArrivalMinutes * 60_000);
    const trips = await this.prisma.db.trip.findMany({
      where: {
        status: { in: [TripStatus.IN_TRANSIT, TripStatus.ARRIVAL_DETECTED] },
        plannedArrivalAt: { lt: cutoff },
      },
      orderBy: { plannedArrivalAt: 'asc' },
      take: settings.batchLimit,
      select: {
        id: true,
        organizationId: true,
        sppgId: true,
        plannedArrivalAt: true,
        sppg: { select: { name: true, regionId: true } },
        deliveryLocation: { select: { name: true } },
      },
    });

    for (const trip of trips) {
      const minutesLate = Math.floor(
        (now.getTime() - trip.plannedArrivalAt.getTime()) / 60_000,
      );
      if (await this.suppress(trip.organizationId, trip.id, ExceptionSource.LATE_ARRIVAL, now, settings)) {
        continue;
      }
      const created = await this.emit({
        organizationId: trip.organizationId,
        regionId: trip.sppg.regionId,
        sppgId: trip.sppgId,
        tripId: trip.id,
        source: ExceptionSource.LATE_ARRIVAL,
        dedupeKey: alertDedupeKey(
          ExceptionSource.LATE_ARRIVAL,
          trip.id,
          now,
          settings.cooldownMinutes * 60_000,
        ),
        title: `Keterlambatan kedatangan ${minutesLate} menit`,
        details: `Trip dari ${trip.sppg.name} ke ${trip.deliveryLocation.name} belum tiba sesuai jadwal ${trip.plannedArrivalAt.toISOString()}. Keterlambatan ${minutesLate} menit.`,
        severity: lateArrivalSeverity(minutesLate, settings.lateHighMinutes),
        dueAt: dueAt(now, settings.lateHighMinutes <= minutesLate),
        reason: 'Terlambat melewati ambang batas jadwal kedatangan.',
      });
      counts.lateArrival += created;
    }
    return counts.lateArrival;
  }

  private async scanGpsHealth(
    now: Date,
    settings: AlertSettings,
    counts: ScanCounts,
  ) {
    const trips = await this.prisma.db.trip.findMany({
      where: {
        status: {
          in: [
            TripStatus.IN_TRANSIT,
            TripStatus.ARRIVAL_DETECTED,
            TripStatus.ARRIVAL_VERIFIED,
            TripStatus.DELIVERY_IN_PROGRESS,
          ],
        },
      },
      orderBy: { plannedArrivalAt: 'asc' },
      take: settings.batchLimit,
      select: {
        id: true,
        organizationId: true,
        sppgId: true,
        trackingStatus: true,
        sppg: { select: { name: true, regionId: true } },
        positions: {
          orderBy: { serverReceivedAt: 'desc' },
          take: 1,
          select: { serverReceivedAt: true },
        },
      },
    });

    for (const trip of trips) {
      const lastPosition = trip.positions[0]?.serverReceivedAt ?? null;
      const ageMinutes = lastPosition
        ? (now.getTime() - lastPosition.getTime()) / 60_000
        : null;
      const health = gpsAlertForAge(ageMinutes, settings);

      if (trip.trackingStatus !== health.trackingStatus) {
        await this.prisma.db.trip.updateMany({
          where: { id: trip.id, trackingStatus: trip.trackingStatus },
          data: { trackingStatus: health.trackingStatus },
        });
      }
      if (!health.source || !health.severity) continue;

      const source = health.source;
      if (await this.suppress(trip.organizationId, trip.id, source, now, settings)) {
        continue;
      }
      const roundedAge =
        ageMinutes === null ? null : Math.max(0, Math.floor(ageMinutes));
      const isOffline = source === ExceptionSource.OFFLINE;
      const created = await this.emit({
        organizationId: trip.organizationId,
        regionId: trip.sppg.regionId,
        sppgId: trip.sppgId,
        tripId: trip.id,
        source,
        dedupeKey: alertDedupeKey(
          source,
          trip.id,
          now,
          settings.cooldownMinutes * 60_000,
        ),
        title: isOffline
          ? 'GPS kendaraan offline'
          : `GPS kendaraan stale${roundedAge === null ? '' : ` ${roundedAge} menit`}`,
        details: lastPosition
          ? `Posisi terakhir diterima ${roundedAge} menit lalu. Ambang stale ${settings.gpsStaleMinutes} menit dan offline ${settings.gpsOfflineMinutes} menit.`
          : 'Belum ada posisi GPS yang diterima untuk trip aktif ini.',
        severity: health.severity,
        dueAt: dueAt(now, isOffline),
        reason: 'Kualitas/kesegaran data GPS melewati ambang operasional.',
      });
      if (isOffline) counts.gpsOffline += created;
      else counts.gpsStale += created;
    }
    return counts.gpsStale + counts.gpsOffline;
  }

  private async scanQrFailures(
    now: Date,
    settings: AlertSettings,
    counts: ScanCounts,
  ) {
    const cutoff = new Date(now.getTime() - settings.qrLookbackMinutes * 60_000);
    const failures = await this.prisma.db.arrivalVerification.findMany({
      where: {
        result: {
          in: [
            ArrivalVerificationResult.INVALID_QR,
            ArrivalVerificationResult.WRONG_DESTINATION,
          ],
        },
        createdAt: { gte: cutoff },
      },
      orderBy: { createdAt: 'desc' },
      take: settings.batchLimit,
      select: {
        id: true,
        tripId: true,
        result: true,
        reasonCode: true,
        createdAt: true,
        trip: {
          select: {
            organizationId: true,
            sppgId: true,
            sppg: { select: { name: true, regionId: true } },
            deliveryLocation: { select: { name: true } },
          },
        },
      },
    });

    for (const failure of failures) {
      if (
        await this.suppress(
          failure.trip.organizationId,
          failure.tripId,
          ExceptionSource.QR_FAILURE,
          now,
          settings,
        )
      ) {
        continue;
      }
      const created = await this.emit({
        organizationId: failure.trip.organizationId,
        regionId: failure.trip.sppg.regionId,
        sppgId: failure.trip.sppgId,
        tripId: failure.tripId,
        source: ExceptionSource.QR_FAILURE,
        dedupeKey: alertDedupeKey(
          ExceptionSource.QR_FAILURE,
          failure.tripId,
          now,
          settings.cooldownMinutes * 60_000,
        ),
        title: 'Verifikasi QR kedatangan gagal',
        details: `Percobaan ${failure.result} (${failure.reasonCode ?? 'tanpa kode alasan'}) untuk trip ke ${failure.trip.deliveryLocation.name} pada ${failure.createdAt.toISOString()}.`,
        severity: ExceptionSeverity.ATTENTION,
        dueAt: dueAt(now, false),
        reason: 'Kegagalan verifikasi QR perlu ditinjau.',
      });
      counts.qrFailure += created;
    }
    return counts.qrFailure;
  }

  private async scanQuantityVariance(
    now: Date,
    settings: AlertSettings,
    counts: ScanCounts,
  ) {
    const records = await this.prisma.db.deliveryRecord.findMany({
      where: {
        isCurrent: true,
        reviewStatus: DeliveryReviewStatus.PENDING_REVIEW,
        OR: [
          { shortageQuantity: { gt: 0 } },
          { damagedQuantity: { gt: 0 } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: settings.batchLimit,
      select: {
        id: true,
        tripId: true,
        shortageQuantity: true,
        damagedQuantity: true,
        dispatchedQuantity: true,
        plannedQuantity: true,
        createdAt: true,
        trip: {
          select: {
            organizationId: true,
            sppgId: true,
            sppg: { select: { name: true, regionId: true } },
            deliveryLocation: { select: { name: true } },
          },
        },
      },
    });

    for (const record of records) {
      const severity = quantityVarianceSeverity(
        record.shortageQuantity,
        record.damagedQuantity,
        record.dispatchedQuantity,
      );
      const created = await this.emit({
        organizationId: record.trip.organizationId,
        regionId: record.trip.sppg.regionId,
        sppgId: record.trip.sppgId,
        tripId: record.tripId,
        source: ExceptionSource.QUANTITY_VARIANCE,
        dedupeKey: `QUANTITY_VARIANCE:${record.id}`,
        title: 'Selisih jumlah porsi POD',
        details: `POD trip ke ${record.trip.deliveryLocation.name}: rencana ${record.plannedQuantity}, dikirim ${record.dispatchedQuantity}, kurang ${record.shortageQuantity}, rusak ${record.damagedQuantity}. Dibuat ${record.createdAt.toISOString()}.`,
        severity,
        dueAt: dueAt(now, severity === ExceptionSeverity.HIGH),
        reason: 'Selisih kuantitas POD memerlukan rekonsiliasi.',
        skipCooldown: true,
      });
      counts.quantityVariance += created;
    }
    return counts.quantityVariance;
  }

  private async scanPodIncomplete(
    now: Date,
    settings: AlertSettings,
    counts: ScanCounts,
  ) {
    const cutoff = new Date(now.getTime() - settings.podReviewMinutes * 60_000);
    const records = await this.prisma.db.deliveryRecord.findMany({
      where: {
        isCurrent: true,
        reviewStatus: DeliveryReviewStatus.PENDING_REVIEW,
        trip: {
          status: TripStatus.DELIVERED,
          deliveredAt: { lt: cutoff },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: settings.batchLimit,
      select: {
        id: true,
        tripId: true,
        createdAt: true,
        trip: {
          select: {
            organizationId: true,
            sppgId: true,
            sppg: { select: { name: true, regionId: true } },
            deliveryLocation: { select: { name: true } },
          },
        },
      },
    });

    for (const record of records) {
      const created = await this.emit({
        organizationId: record.trip.organizationId,
        regionId: record.trip.sppg.regionId,
        sppgId: record.trip.sppgId,
        tripId: record.tripId,
        source: ExceptionSource.POD_INCOMPLETE,
        dedupeKey: `POD_INCOMPLETE:${record.id}`,
        title: 'POD belum selesai direview',
        details: `POD trip ke ${record.trip.deliveryLocation.name} sudah menunggu review lebih dari ${settings.podReviewMinutes} menit sejak ${record.createdAt.toISOString()}.`,
        severity: ExceptionSeverity.ATTENTION,
        dueAt: dueAt(now, false),
        reason: 'POD melewati ambang waktu penyelesaian review.',
        skipCooldown: true,
      });
      counts.podIncomplete += created;
    }
    return counts.podIncomplete;
  }

  private async suppress(
    organizationId: string,
    tripId: string,
    source: ExceptionSource,
    now: Date,
    settings: AlertSettings,
  ) {
    const latest = await this.prisma.db.exceptionCase.findFirst({
      where: { organizationId, tripId, source },
      orderBy: { openedAt: 'desc' },
      select: { status: true, openedAt: true },
    });
    return shouldSuppressAlert(
      latest,
      now,
      settings.cooldownMinutes * 60_000,
    );
  }

  private async emit(input: {
    organizationId: string;
    regionId: string;
    sppgId: string;
    tripId: string;
    source: ExceptionSource;
    dedupeKey: string;
    title: string;
    details: string;
    severity: ExceptionSeverity;
    dueAt: Date;
    reason: string;
    skipCooldown?: boolean;
  }) {
    if (input.skipCooldown) {
      const existing = await this.prisma.db.exceptionCase.findUnique({
        where: {
          organizationId_dedupeKey: {
            organizationId: input.organizationId,
            dedupeKey: input.dedupeKey,
          },
        },
        select: { id: true },
      });
      if (existing) return 0;
    }

    try {
      await this.exceptions.createSystemAlert(input);
      return 1;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return 0;
      }
      throw error;
    }
  }
}

function readAlertSettings(): AlertSettings {
  return {
    lateArrivalMinutes: envNumber('ALERT_LATE_ARRIVAL_MINUTES', 15, 1, 1440),
    lateHighMinutes: envNumber('ALERT_LATE_HIGH_MINUTES', 60, 1, 2880),
    gpsStaleMinutes: envNumber('ALERT_GPS_STALE_MINUTES', 3, 1, 1440),
    gpsOfflineMinutes: envNumber('ALERT_GPS_OFFLINE_MINUTES', 10, 1, 1440),
    qrLookbackMinutes: envNumber('ALERT_QR_LOOKBACK_MINUTES', 30, 1, 1440),
    podReviewMinutes: envNumber('ALERT_POD_REVIEW_MINUTES', 120, 1, 10080),
    cooldownMinutes: envNumber('ALERT_COOLDOWN_MINUTES', 30, 1, 10080),
    intervalSeconds: envNumber('ALERT_WORKER_INTERVAL_SECONDS', 60, 15, 3600),
    batchLimit: envNumber('ALERT_WORKER_BATCH_LIMIT', 200, 1, 1000),
  };
}

function envNumber(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function dueAt(now: Date, high: boolean) {
  return new Date(now.getTime() + (high ? 30 : 240) * 60_000);
}
