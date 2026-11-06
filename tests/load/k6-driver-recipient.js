// k6 stress test for RADAR MBG Driver & Recipient flows
// Usage:
//   k6 run tests/load/k6-driver-recipient.js
//   k6 run -e BASE_URL=http://localhost:4000/api/v1 -e DRIVER_USER=driver.testfull@example.com -e DRIVER_PASS=Password12345! tests/load/k6-driver-recipient.js
//
// Notes:
// - Do NOT run against production without permission.
// - Rate limits may throttle login/location endpoints; adjust or use test accounts.
// - Admin login requires MFA; pass ADMIN_OTP env var.

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api/v1';
const ORIGIN = __ENV.ORIGIN || 'http://localhost:3000';

// Optional file for POD upload stress (1x1 PNG)
let podFile = null;
try { podFile = open('./pixel.png', 'b'); } catch { podFile = null; }

const DRIVER_USER = __ENV.DRIVER_USER || 'driver.testfull@example.com';
const DRIVER_PASS = __ENV.DRIVER_PASS || 'Password12345!';
const RECIPIENT_USER = __ENV.RECIPIENT_USER || 'penerima.testfull@example.com';
const RECIPIENT_PASS = __ENV.RECIPIENT_PASS || 'Password12345!';
const ADMIN_USER = __ENV.ADMIN_USER || 'admin';
const ADMIN_PASS = __ENV.ADMIN_PASS || 'LzmtZSmeuBBEtZEhqoEYVPYK';
const TENANT_USER = __ENV.TENANT_USER || '';
const TENANT_PASS = __ENV.TENANT_PASS || '';
const APPROVAL_ID = __ENV.APPROVAL_ID || '';

export const options = {
  scenarios: {
    driver_flow: {
      executor: 'ramping-vus',
      exec: 'driverFlow',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 20 },
        { duration: '3m', target: 20 },
        { duration: '30s', target: 60 },
        { duration: '1m', target: 60 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
    recipient_flow: {
      executor: 'ramping-vus',
      exec: 'recipientFlow',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 15 },
        { duration: '3m', target: 15 },
        { duration: '30s', target: 50 },
        { duration: '1m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
    platform_read: {
      executor: 'constant-vus',
      exec: 'platformFlow',
      vus: 5,
      duration: '3m',
    },
    platform_all_read: {
      executor: 'constant-vus',
      exec: 'platformAllReadFlow',
      vus: 3,
      duration: '2m',
      startTime: '1m',
    },
    trips_load: {
      executor: 'constant-vus',
      exec: 'tripsLoadFlow',
      vus: 5,
      duration: '2m',
      startTime: '2m',
    },
    tenant_read: {
      executor: 'constant-vus',
      exec: 'tenantReadFlow',
      vus: 2,
      duration: '2m',
      startTime: '2m',
    },
    approval_decision: {
      executor: 'constant-vus',
      exec: 'approvalDecisionFlow',
      vus: 1,
      duration: '30s',
      startTime: '6m',
    },
    geofence_create: {
      executor: 'constant-vus',
      exec: 'geofenceCreateFlow',
      vus: 1,
      duration: '30s',
      startTime: '7m',
    },
    mfa_begin: {
      executor: 'per-vu-iterations',
      exec: 'mfaBeginFlow',
      vus: 1,
      iterations: 1,
      startTime: '8m',
    },
    registration_create: {
      executor: 'per-vu-iterations',
      exec: 'registrationCreateFlow',
      vus: 1,
      iterations: 1,
      startTime: '8m',
    },
    registration_status: {
      executor: 'constant-vus',
      exec: 'registrationStatusFlow',
      vus: 2,
      duration: '1m',
      startTime: '7m',
    },
    tenant_feature_toggle: {
      executor: 'constant-vus',
      exec: 'tenantFeatureToggleFlow',
      vus: 1,
      duration: '30s',
      startTime: '8m',
    },
    registration_upload_document: {
      executor: 'per-vu-iterations',
      exec: 'registrationUploadDocumentFlow',
      vus: 1,
      iterations: 1,
      startTime: '8m',
    },
    recipient_write: {
      executor: 'constant-vus',
      exec: 'recipientWriteFlow',
      vus: 2,
      duration: '1m',
      startTime: '5m',
    },
    driver_pod: {
      executor: 'constant-vus',
      exec: 'driverPodFlow',
      vus: 1,
      duration: '1m',
      startTime: '5m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.02'],
    'http_req_duration{scenario:driver_flow}': ['p(95)<800'],
    'http_req_duration{scenario:recipient_flow}': ['p(95)<800'],
  },
};

const loginErrors = new Rate('login_errors');

function login(username, password, otpCode) {
  const csrfRes = http.get(`${BASE_URL}/auth/csrf`, { tags: { name: 'csrf' } });
  if (csrfRes.status !== 200) {
    loginErrors.add(1);
    return null;
  }
  const csrfToken = csrfRes.json('csrfToken');
  const body = { username, password };
  if (otpCode) body.otpCode = otpCode;

  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
      Origin: ORIGIN,
    },
    tags: { name: 'login' },
  });

  const ok = res.status === 200;
  loginErrors.add(ok ? 0 : 1);
  check(res, { 'login 200': (r) => r.status === 200 });
  return ok ? res : null;
}

export function driverFlow() {
  group('driver', () => {
    const session = login(DRIVER_USER, DRIVER_PASS);
    if (!session) {
      sleep(2);
      return;
    }

    // Trips list
    const tripsRes = http.get(`${BASE_URL}/trips?page=1&pageSize=25`, { tags: { name: 'driver_trips' } });
    check(tripsRes, { 'driver trips 200': (r) => r.status === 200 });

    // If trips exist, fetch detail and track of first
    if (tripsRes.status === 200) {
      const data = tripsRes.json('data');
      if (Array.isArray(data) && data.length > 0) {
        const tripId = data[0].id;
        const detailRes = http.get(`${BASE_URL}/trips/${tripId}`, { tags: { name: 'driver_trip_detail' } });
        check(detailRes, { 'driver trip detail 200': (r) => r.status === 200 });

        const trackRes = http.get(`${BASE_URL}/trips/${tripId}/track`, { tags: { name: 'driver_trip_track' } });
        check(trackRes, { 'driver trip track 200/404': (r) => r.status === 200 || r.status === 404 });
      }
    }

    // Notifications are not driver-specific; skip
    sleep(1);
  });
}

export function recipientFlow() {
  group('recipient', () => {
    const session = login(RECIPIENT_USER, RECIPIENT_PASS);
    if (!session) {
      sleep(2);
      return;
    }

    const meRes = http.get(`${BASE_URL}/recipient/me`, { tags: { name: 'recipient_me' } });
    check(meRes, { 'recipient me 200': (r) => r.status === 200 });

    const deliveriesRes = http.get(`${BASE_URL}/recipient/deliveries`, { tags: { name: 'recipient_deliveries' } });
    check(deliveriesRes, { 'recipient deliveries 200': (r) => r.status === 200 });

    const notifRes = http.get(`${BASE_URL}/recipient/notifications`, { tags: { name: 'recipient_notifications' } });
    check(notifRes, { 'recipient notifications 200': (r) => r.status === 200 });

    if (notifRes.status === 200) {
      const notifs = notifRes.json();
      if (Array.isArray(notifs) && notifs.length > 0 && notifs[0].id) {
        const readRes = http.post(`${BASE_URL}/recipient/notifications/${encodeURIComponent(notifs[0].id)}/read`, null, {
          tags: { name: 'recipient_notification_read' },
        });
        check(readRes, { 'recipient notification read 200/201': (r) => r.status === 200 || r.status === 201 });
      }
    }

    const reviewsRes = http.get(`${BASE_URL}/recipient/reviews`, { tags: { name: 'recipient_reviews' } });
    check(reviewsRes, { 'recipient reviews 200': (r) => r.status === 200 });

    sleep(1);
  });
}

export function platformAllReadFlow() {
  if (!ADMIN_OTP) {
    sleep(5);
    return;
  }
  group('platform_all_read', () => {
    const session = login(ADMIN_USER, ADMIN_PASS, ADMIN_OTP);
    if (!session) {
      sleep(2);
      return;
    }

    const endpoints = [
      '/platform/summary',
      '/platform/dashboard-summary',
      '/platform/tenants',
      '/platform/geofences?page=1&pageSize=25',
      '/platform/geofences/platform',
      '/platform/recipient-reviews/summary',
      '/platform/recipient-reviews/recent',
      '/admin/sppg?page=1&pageSize=25',
      '/admin/drivers?page=1&pageSize=25',
      '/admin/vehicles?page=1&pageSize=25',
      '/admin/organizations',
      '/admin/regions',
      '/admin/delivery-locations?page=1&pageSize=25',
      '/admin/assignments?page=1&pageSize=25',
      '/admin/users?page=1&pageSize=25',
      '/admin/roles',
      '/admin/audit-logs?page=1&pageSize=25',
      '/admin/approval-requests/inbox?page=1&pageSize=25',
      '/admin/approval-requests/mine?page=1&pageSize=25',
      '/admin/sppg-registrations?page=1&pageSize=25',
      '/admin/recipient-registrations/sites',
      '/admin/recipient-registrations?page=1&pageSize=25',
      '/exceptions?page=1&pageSize=25',
      '/trips?page=1&pageSize=25',
    ];

    for (const ep of endpoints) {
      const res = http.get(`${BASE_URL}${ep}`, { tags: { name: 'platform_read_all' } });
      check(res, { [`GET ${ep} ok`]: (r) => r.status === 200 });
    }

    sleep(2);
  });
}

export function platformFlow() {
  if (!ADMIN_OTP) {
    // Skip platform scenario if no OTP provided
    sleep(5);
    return;
  }
  group('platform', () => {
    const session = login(ADMIN_USER, ADMIN_PASS, ADMIN_OTP);
    if (!session) {
      sleep(2);
      return;
    }

    const summaryRes = http.get(`${BASE_URL}/platform/dashboard-summary`, { tags: { name: 'platform_dashboard_summary' } });
    check(summaryRes, { 'platform dashboard summary 200': (r) => r.status === 200 });

    const reviewSummaryRes = http.get(`${BASE_URL}/platform/recipient-reviews/summary`, { tags: { name: 'platform_review_summary' } });
    check(reviewSummaryRes, { 'platform review summary 200': (r) => r.status === 200 });

    const reviewRecentRes = http.get(`${BASE_URL}/platform/recipient-reviews/recent`, { tags: { name: 'platform_review_recent' } });
    check(reviewRecentRes, { 'platform review recent 200': (r) => r.status === 200 });

    const tenantsRes = http.get(`${BASE_URL}/platform/tenants`, { tags: { name: 'platform_tenants' } });
    check(tenantsRes, { 'platform tenants 200': (r) => r.status === 200 });

    const auditRes = http.get(`${BASE_URL}/audit?page=1&pageSize=25`, { tags: { name: 'platform_audit' } });
    check(auditRes, { 'platform audit 200': (r) => r.status === 200 });

    const geofencesRes = http.get(`${BASE_URL}/platform/geofences?page=1&pageSize=25`, { tags: { name: 'platform_geofences' } });
    check(geofencesRes, { 'platform geofences 200': (r) => r.status === 200 || r.status === 404 });

    sleep(2);
  });
}


const RECIPIENT_STOP_ID = __ENV.RECIPIENT_STOP_ID || '';
const DRIVER_TRIP_ID = __ENV.DRIVER_TRIP_ID || '';

export function recipientWriteFlow() {
  if (!RECIPIENT_STOP_ID) {
    sleep(5);
    return;
  }
  group('recipient_write', () => {
    const session = login(RECIPIENT_USER, RECIPIENT_PASS);
    if (!session) {
      sleep(2);
      return;
    }

    // Create review
    const reviewRes = http.post(`${BASE_URL}/recipient/stops/${encodeURIComponent(RECIPIENT_STOP_ID)}/review`, JSON.stringify({
      rating: 5,
      emoji: '😊',
      comment: 'Stress test review',
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'recipient_create_review' },
    });
    check(reviewRes, { 'create review 200/201': (r) => r.status === 200 || r.status === 201 });

    // Report issue
    const issueRes = http.post(`${BASE_URL}/recipient/stops/${encodeURIComponent(RECIPIENT_STOP_ID)}/report-issue`, JSON.stringify({
      category: 'OTHER',
      description: 'Stress test issue report (min 5 chars).',
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'recipient_report_issue' },
    });
    check(issueRes, { 'report issue 200/201': (r) => r.status === 200 || r.status === 201 });

    // Confirm receipt (may fail if already confirmed)
    const confirmRes = http.post(`${BASE_URL}/recipient/stops/${encodeURIComponent(RECIPIENT_STOP_ID)}/confirm`, null, {
      headers: { 'Idempotency-Key': `stress-${__VU}-${__ITER}` },
      tags: { name: 'recipient_confirm' },
    });
    check(confirmRes, { 'confirm 200/201/409': (r) => r.status === 200 || r.status === 201 || r.status === 409 });

    sleep(1);
  });
}

export function driverPodFlow() {
  if (!DRIVER_TRIP_ID || !podFile) {
    sleep(5);
    return;
  }
  group('driver_pod', () => {
    const session = login(DRIVER_USER, DRIVER_PASS);
    if (!session) {
      sleep(2);
      return;
    }

    // Submit POD (without photo first)
    const submitRes = http.post(`${BASE_URL}/trips/${encodeURIComponent(DRIVER_TRIP_ID)}/delivery`, JSON.stringify({
      receivedQuantity: 1,
      damagedQuantity: 0,
      confirmationNote: 'Stress test POD',
      deviceTimestamp: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'driver_submit_pod' },
    });
    check(submitRes, { 'submit pod 200/201': (r) => r.status === 200 || r.status === 201 });

    // Upload proof (multipart)
    if (submitRes.status === 200 || submitRes.status === 201) {
      const formData = {
        file: http.file(podFile, 'pixel.png', 'image/png'),
      };
      const uploadRes = http.post(`${BASE_URL}/trips/${encodeURIComponent(DRIVER_TRIP_ID)}/delivery/proofs`, formData, {
        tags: { name: 'driver_upload_proof' },
      });
      check(uploadRes, { 'upload proof 200/201': (r) => r.status === 200 || r.status === 201 });
    }

    sleep(2);
  });
}


export function tenantReadFlow() {
  const user = TENANT_USER || `admin-lt${String((__VU % 900) + 1).padStart(5, '0')}`;
  const pass = TENANT_PASS || 'LoadTest123!';
  if (!user || !pass) {
    sleep(5);
    return;
  }
  group('tenant_read', () => {
    const session = login(user, pass);
    if (!session) {
      sleep(2);
      return;
    }

    const meRes = http.get(`${BASE_URL}/auth/me`, { tags: { name: 'tenant_me_auth' } });
    if (meRes.status !== 200) {
      sleep(2);
      return;
    }
    const memberships = meRes.json('user.tenantMemberships');
    const tenantId = Array.isArray(memberships) && memberships.length > 0 ? memberships[0].tenantId : null;
    if (!tenantId) {
      sleep(2);
      return;
    }
    const headers = { 'X-Tenant-Id': tenantId, Accept: 'application/json' };

    const endpoints = [
      '/tenant/summary',
      '/tenant/me',
      '/tenant/trips?page=1&pageSize=25',
      '/tenant/drivers?page=1&pageSize=25',
      '/tenant/vehicles?page=1&pageSize=25',
      '/tenant/delivery-locations?page=1&pageSize=25',
      '/tenant/users?page=1&pageSize=25',
      '/tenant/audit?page=1&pageSize=25',
      '/tenant/recipient-registrations/sites',
      '/tenant/recipient-registrations?page=1&pageSize=25',
    ];

    for (const ep of endpoints) {
      const res = http.get(`${BASE_URL}${ep}`, { headers, tags: { name: 'tenant_read_all' } });
      check(res, { [`GET ${ep} ok`]: (r) => r.status === 200 });
    }

    sleep(2);
  });
}

const APPROVAL_ID = __ENV.APPROVAL_ID || '';
const APPROVAL_DECISION = __ENV.APPROVAL_DECISION || 'APPROVE';
const GEOFENCE_LOCATION_TYPE = __ENV.GEOFENCE_LOCATION_TYPE || '';
const GEOFENCE_LOCATION_ID = __ENV.GEOFENCE_LOCATION_ID || '';
const REGISTRATION_ID = __ENV.REGISTRATION_ID || '';
const MFA_TEST_USER = __ENV.MFA_TEST_USER || '';
const MFA_TEST_PASS = __ENV.MFA_TEST_PASS || '';
const RUN_REGISTRATION_CREATE = __ENV.RUN_REGISTRATION_CREATE === 'true';
const GEOFENCE_LOCATION_TYPE = __ENV.GEOFENCE_LOCATION_TYPE || '';
const GEOFENCE_LOCATION_ID = __ENV.GEOFENCE_LOCATION_ID || '';

export function approvalDecisionFlow() {
  if (!ADMIN_OTP || !APPROVAL_ID) {
    sleep(5);
    return;
  }
  group('approval_decision', () => {
    const session = login(ADMIN_USER, ADMIN_PASS, ADMIN_OTP);
    if (!session) {
      sleep(2);
      return;
    }

    const res = http.post(`${BASE_URL}/admin/approval-requests/${encodeURIComponent(APPROVAL_ID)}/decision`, JSON.stringify({
      decision: APPROVAL_DECISION,
      reason: 'Stress test decision',
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'approval_decision' },
    });
    check(res, { 'approval decision 200/201': (r) => r.status === 200 || r.status === 201 });

    sleep(2);
  });
}


export function geofenceCreateFlow() {
  if (!ADMIN_OTP || !GEOFENCE_LOCATION_TYPE || !GEOFENCE_LOCATION_ID) {
    sleep(5);
    return;
  }
  group('geofence_create', () => {
    const session = login(ADMIN_USER, ADMIN_PASS, ADMIN_OTP);
    if (!session) {
      sleep(2);
      return;
    }

    const res = http.post(`${BASE_URL}/geofences`, JSON.stringify({
      locationType: GEOFENCE_LOCATION_TYPE,
      locationId: GEOFENCE_LOCATION_ID,
      shapeType: 'CIRCLE',
      name: `Stress geofence ${__VU}-${__ITER}`,
      centerLatitude: -6.2,
      centerLongitude: 106.8,
      radiusMeters: 100,
    }), {
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `stress-gf-${__VU}-${__ITER}` },
      tags: { name: 'geofence_create' },
    });
    check(res, { 'geofence create 200/201': (r) => r.status === 200 || r.status === 201 });

    sleep(2);
  });
}

export function registrationStatusFlow() {
  if (!REGISTRATION_NUMBER) {
    sleep(5);
    return;
  }
  group('registration_status', () => {
    const res = http.get(`${BASE_URL}/public/sppg-registrations/status/${encodeURIComponent(REGISTRATION_NUMBER)}`, {
      tags: { name: 'registration_status' },
    });
    check(res, { 'registration status 200': (r) => r.status === 200 });

    sleep(1);
  });
}


export function mfaBeginFlow() {
  if (!MFA_TEST_USER || !MFA_TEST_PASS) {
    sleep(5);
    return;
  }
  group('mfa_begin', () => {
    const session = login(MFA_TEST_USER, MFA_TEST_PASS);
    if (!session) {
      sleep(2);
      return;
    }

    // Begin enrollment (may fail if already enabled)
    const res = http.post(`${BASE_URL}/auth/mfa/enrollment`, null, {
      tags: { name: 'mfa_begin_enrollment' },
    });
    check(res, { 'mfa begin 200/403': (r) => r.status === 200 || r.status === 403 || r.status === 409 });

    sleep(2);
  });
}

export function registrationCreateFlow() {
  if (!RUN_REGISTRATION_CREATE) {
    sleep(5);
    return;
  }
  group('registration_create', () => {
    const res = http.post(`${BASE_URL}/public/sppg-registrations`, JSON.stringify({
      sppgName: `Stress SPPG ${__VU}-${__ITER}`,
      provinceCode: '00',
      regencyCode: '00',
      districtCode: '00',
      villageCode: '00',
      fullAddress: 'Stress test address',
      contactName: 'Stress Test',
      contactEmail: `stress${__VU}${__ITER}@example.com`,
      contactPhone: '08123456789',
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'registration_create' },
    });
    check(res, { 'registration create 200/201': (r) => r.status === 200 || r.status === 201 });

    sleep(2);
  });
}


export function tenantFeatureToggleFlow() {
  const user = TENANT_USER || `admin-lt${String((__VU % 900) + 1).padStart(5, '0')}`;
  const pass = TENANT_PASS || 'LoadTest123!';
  if (!user || !pass) {
    sleep(5);
    return;
  }
  group('tenant_feature_toggle', () => {
    const session = login(user, pass);
    if (!session) {
      sleep(2);
      return;
    }

    const meRes = http.get(`${BASE_URL}/auth/me`, { tags: { name: 'tenant_me_auth' } });
    const memberships = meRes.status === 200 ? meRes.json('user.tenantMemberships') : null;
    const tenantId = Array.isArray(memberships) && memberships.length > 0 ? memberships[0].tenantId : null;
    if (!tenantId) {
      sleep(2);
      return;
    }

    const res = http.post(`${BASE_URL}/tenant/features`, JSON.stringify({
      features: { drivers: true, trips: true, vehicles: true, audit: true, profiling: true },
    }), {
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
      tags: { name: 'tenant_feature_toggle' },
    });
    check(res, { 'tenant features 200/201': (r) => r.status === 200 || r.status === 201 });

    sleep(2);
  });
}

export function registrationUploadDocumentFlow() {
  if (!ADMIN_OTP || !REGISTRATION_ID || !podFile) {
    sleep(5);
    return;
  }
  group('registration_upload_document', () => {
    const session = login(ADMIN_USER, ADMIN_PASS, ADMIN_OTP);
    if (!session) {
      sleep(2);
      return;
    }

    const formData = {
      file: http.file(podFile, 'pixel.png', 'image/png'),
    };
    const res = http.post(`${BASE_URL}/admin/sppg-registrations/${encodeURIComponent(REGISTRATION_ID)}/documents/upload`, formData, {
      tags: { name: 'registration_upload_document' },
    });
    check(res, { 'registration upload 200/201': (r) => r.status === 200 || r.status === 201 });

    sleep(2);
  });
}


export function tripsLoadFlow() {
  if (!ADMIN_OTP) {
    sleep(5);
    return;
  }
  group('trips_load', () => {
    const session = login(ADMIN_USER, ADMIN_PASS, ADMIN_OTP);
    if (!session) {
      sleep(2);
      return;
    }

    const listRes = http.get(`${BASE_URL}/trips?page=1&pageSize=100`, { tags: { name: 'trips_list_100' } });
    check(listRes, { 'trips list 200': (r) => r.status === 200 });

    if (listRes.status === 200) {
      const data = listRes.json('data');
      if (Array.isArray(data)) {
        const ids = data.slice(0, 3).map((t) => t.id);
        for (const id of ids) {
          const detailRes = http.get(`${BASE_URL}/trips/${id}`, { tags: { name: 'trip_detail' } });
          check(detailRes, { 'trip detail 200': (r) => r.status === 200 });

          const trackRes = http.get(`${BASE_URL}/trips/${id}/track`, { tags: { name: 'trip_track' } });
          check(trackRes, { 'trip track 200/404': (r) => r.status === 200 || r.status === 404 });
        }
      }
    }

    sleep(1);
  });
}
