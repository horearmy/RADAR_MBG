export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  mfaEnabled?: boolean;
  driverId?: string | null;
  tenantRole?: string | null;
  roles: Array<{
    code: string;
    isGlobal: boolean;
    organizationId: string | null;
    regionId: string | null;
    sppgId: string | null;
    permissions: string[];
  }>;
};

export type TripSummary = {
  id: string;
  status: string;
  trackingStatus: string;
  verificationStatus: string;
  deliveryStatus: string;
  plannedDepartureAt: string;
  plannedArrivalAt: string;
  actualDepartureAt: string | null;
  plannedQuantity: number;
  dispatchedQuantity: number | null;
  receivedQuantity: number | null;
  version: number;
  sppg: { id: string; code: string; name: string };
  deliveryLocation: { id: string; code: string; name: string; latitude?: string | number | null; longitude?: string | number | null };
  driver: { id: string; code: string; name: string };
  vehicle: { id: string; plateNumber: string };
  positions: Array<{
    latitude: string | number;
    longitude: string | number;
    accuracyMeters: string | number | null;
    speedMps: string | number | null;
    headingDegrees: string | number | null;
    deviceTimestamp: string;
    serverReceivedAt: string;
    integrityFlags: unknown;
  }>;
};

export type TripEventSummary = {
  id: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  occurredAt: string;
};

export type DeliveryRecordSummary = {
  id: string;
  version: number;
  plannedQuantity: number;
  dispatchedQuantity: number;
  receivedQuantity: number;
  damagedQuantity: number;
  shortageQuantity: number;
  reviewStatus: string;
  reviewReason: string | null;
  createdAt: string;
};

export type TripDetail = TripSummary & {
  arrivalDetectedAt: string | null;
  arrivalVerifiedAt: string | null;
  deliveryStartedAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  deliveryLocation: {
    id: string;
    code: string;
    name: string;
    address: string | null;
  };
  vehicle: {
    id: string;
    plateNumber: string;
    label: string | null;
  };
  deliveryRecords: DeliveryRecordSummary[];
  events: TripEventSummary[];
};

export type ProofSummary = {
  id: string;
  deliveryRecordId: string;
  mimeType: string;
  originalName: string | null;
  byteSize: number;
  sha256: string;
  uploadedBy: string;
  uploadedAt: string;
  deduplicated: boolean;
  url: string | null;
};

export type ExceptionSummary = {
  id: string;
  organizationId: string;
  regionId: string;
  sppgId: string;
  tripId: string | null;
  source: string;
  dedupeKey: string | null;
  title: string;
  severity: "ATTENTION" | "HIGH" | "CRITICAL";
  status: string;
  assigneeUserId: string | null;
  version: number;
  openedAt: string;
  dueAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  updatedAt: string;
  sppg: { name: string };
  assignee: { id: string; username: string; displayName: string } | null;
};

export type ExceptionAssignee = {
  id: string;
  username: string;
  displayName: string;
  roles: Array<{
    code: string;
    name: string;
    isGlobal: boolean;
    organizationId: string | null;
    regionId: string | null;
    sppgId: string | null;
  }>;
};

export type ExceptionCloseOutcome = "FALSE_POSITIVE" | "DUPLICATE" | "CLOSED_WITH_NOTE";

export type ExceptionMutationResult = {
  id: string;
  status: string;
  version: number;
};

export type SppgSummary = {
  id: string;
  organizationId: string;
  regionId: string;
  code: string;
  name: string;
  status: string;
  address?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  organization?: { id: string; code: string; name: string };
  region?: { id: string; code: string; name: string };
};

export type DriverSummary = {
  id: string;
  sppgId: string;
  userId: string | null;
  code: string;
  name: string;
  phone?: string | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  sppg?: { id: string; code: string; name: string };
  user?: { id: string; username: string; displayName: string; status: string } | null;
};

export type VehicleSummary = {
  id: string;
  organizationId: string;
  sppgId: string;
  plateNumber: string;
  label?: string | null;
  capacity?: number | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  sppg?: { id: string; code: string; name: string };
};

export type AssignmentSummary = {
  id: string;
  organizationId: string;
  sppgId: string;
  driverId: string;
  vehicleId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  reason: string;
  createdAt?: string;
  createdBy?: string;
  driver?: { id: string; code: string; name: string };
  vehicle?: { id: string; plateNumber: string; label?: string | null };
  sppg?: { id: string; code: string; name: string };
};

export type ApprovalSppgOption = {
  id: string;
  code: string;
  name: string;
  status: string;
  version: number;
};

export type ApprovalRequestSummary = {
  id: string;
  actionType: string;
  targetType: string;
  targetId: string;
  target: { id: string; code: string; name: string } | null;
  requestedBy: string;
  reason: string;
  payloadBefore: { status?: string; version?: number } | null;
  payloadAfter: { status?: string };
  status: string;
  objectVersion: number | null;
  submittedAt: string | null;
  executedAt: string | null;
  createdAt: string;
  requestedByUser: { id: string; username: string; displayName: string };
  decisions: Array<{
    id: string;
    decision: string;
    reason: string | null;
    decidedAt: string;
    approver: { id: string; username: string; displayName: string };
  }>;
};

export type AuditLogSummary = {
  id: string;
  actorUserId: string | null;
  actor: { id: string; username: string; displayName: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  result: string;
  reason: string | null;
  before: unknown;
  after: unknown;
  requestId: string | null;
  createdAt: string;
};

export type AdminUserSummary = {
  id: string;
  username: string;
  email: string | null;
  displayName: string;
  status: string;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: Array<{
    id: string;
    organizationId: string | null;
    regionId: string | null;
    sppgId: string | null;
    effectiveFrom: string;
    effectiveUntil: string | null;
    role: { code: string; name: string; isGlobal: boolean; requiresMfa: boolean };
  }>;
};

export type AdminRoleSummary = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isGlobal: boolean;
  requiresMfa: boolean;
  permissions: Array<{ permission: { code: string; description: string | null } }>;
};

export type IssuedAccountToken = {
  user: { id: string; username: string; email?: string | null; displayName?: string; status?: string };
  token: string;
  expiresAt: string;
};

export type Paginated<T> = {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type DashboardData = {
  trips: TripSummary[];
  tripTotal: number;
  exceptions: ExceptionSummary[];
  sppgs: SppgSummary[] | null;
  sppgTotal: number;
  refreshedAt: string;
};

export type PlatformDashboardSummary = {
  tenants: {
    total: number;
    active: number;
    pendingActivation: number;
    suspended: number;
  };
  registrations: { pendingReview: number };
  approvals: { pending: number };
  refreshedAt: string;
};

const configuredBaseUrl = process.env.NEXT_PUBLIC_RADAR_API_URL;
const isBrowser = typeof window !== "undefined";
const serverApiBase = process.env.RADAR_API_INTERNAL_URL ?? "http://localhost:4000";
export const apiBaseUrl =
  configuredBaseUrl ?? (isBrowser ? "/api/v1" : `${serverApiBase}/api/v1`);

export async function apiGet<T>(path: string): Promise<T> {
  if (!apiBaseUrl) throw new Error('API_NOT_CONFIGURED');

  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(response.status === 401 ? 'UNAUTHENTICATED' : `REQUEST_FAILED_${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function getCsrfToken(): Promise<string> {
  const csrfResponse = await fetch(`${apiBaseUrl}/auth/csrf`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!csrfResponse.ok) throw new Error('CSRF_UNAVAILABLE');
  const { csrfToken } = await csrfResponse.json() as { csrfToken?: string };
  if (!csrfToken) throw new Error('CSRF_UNAVAILABLE');
  return csrfToken;
}

export async function apiMutate<T>(
  path: string,
  method: 'POST' | 'PATCH',
  body?: unknown,
  idempotencyKey: string = crypto.randomUUID(),
): Promise<T> {
  if (!apiBaseUrl) throw new Error('API_NOT_CONFIGURED');

  const csrfToken = await getCsrfToken();

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'x-csrf-token': csrfToken,
      'idempotency-key': idempotencyKey,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    let code: string | undefined;
    try {
      const payload = await response.json() as { code?: string };
      if (typeof payload.code === 'string') code = payload.code;
    } catch {
      code = undefined;
    }
    if (response.status === 401) throw new Error('UNAUTHENTICATED');
    throw new Error(code ?? `REQUEST_FAILED_${response.status}`);
  }

  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

async function apiUpload<T>(
  path: string,
  file: File,
  idempotencyKey: string = crypto.randomUUID(),
): Promise<T> {
  if (!apiBaseUrl) throw new Error('API_NOT_CONFIGURED');

  const csrfToken = await getCsrfToken();
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'x-csrf-token': csrfToken,
      'idempotency-key': idempotencyKey,
    },
    body: formData,
  });

  if (!response.ok) {
    let code: string | undefined;
    try {
      const payload = await response.json() as { code?: string };
      if (typeof payload.code === 'string') code = payload.code;
    } catch {
      code = undefined;
    }
    if (response.status === 401) throw new Error('UNAUTHENTICATED');
    throw new Error(code ?? `REQUEST_FAILED_${response.status}`);
  }

  return response.json() as Promise<T>;
}

export type TripMutationResult = {
  trip: TripSummary;
  replayed: boolean;
};

export type StartTripInput = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  deviceTimestamp?: string;
};

export type TripLocationInput = StartTripInput & {
  speedMps?: number;
  headingDegrees?: number;
};

export type ArrivalVerificationResult = {
  result: string;
  reasonCode: string | null;
  verificationId?: string;
  verifiedAt?: string;
  replayed?: boolean;
  attemptId?: string;
};

export type DeliveryStartResult = {
  tripId: string;
  status: string;
  startedAt?: string;
  replayed: boolean;
};

export type DeliverySubmitResult = {
  deliveryRecordId: string;
  tripId: string;
  version: number;
  plannedQuantity: number;
  dispatchedQuantity: number;
  receivedQuantity: number;
  damagedQuantity: number;
  shortageQuantity: number;
  varianceReason: string | null;
  reviewStatus: string;
  serverReceivedAt: string;
  replayed: boolean;
};

export type DeliveryLocationOption = {
  id: string;
  organizationId: string;
  regionId: string;
  code: string;
  name: string;
  address: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  active: boolean;
};

export type GeofenceLocationType = "SPPG" | "DELIVERY";

export type GeofenceSummary = {
  id: string;
  type: GeofenceLocationType;
  shapeType?: "CIRCLE" | "POLYGON";
  name: string;
  centerLatitude: string | number | null;
  centerLongitude: string | number | null;
  radiusMeters: string | number | null;
  polygonCoordinates?: Array<{ latitude: number; longitude: number }> | null;
  minGpsAccuracyMeters: string | number;
  confirmationFixes: number;
  confirmationDurationSeconds: number;
  active: boolean;
  version: number;
  createdAt: string;
};

export type CreateGeofenceInput = {
  locationType: GeofenceLocationType;
  locationId: string;
  shapeType?: "CIRCLE" | "POLYGON";
  name: string;
  centerLatitude?: number;
  centerLongitude?: number;
  radiusMeters?: number;
  polygonCoordinates?: Array<{ latitude: number; longitude: number }>;
  minGpsAccuracyMeters: number;
  confirmationFixes: number;
  confirmationDurationSeconds: number;
  reason: string;
};

export type VehicleOption = {
  id: string;
  organizationId: string;
  sppgId: string;
  plateNumber: string;
  label: string | null;
  capacity: number | null;
  status: string;
};

export type DriverOption = {
  id: string;
  sppgId: string;
  code: string;
  name: string;
  status: string;
};

export type TripResourceOptions = {
  deliveryLocations: DeliveryLocationOption[];
  vehicles: VehicleOption[];
  drivers: DriverOption[];
};

export type CreateTripInput = {
  sppgId: string;
  deliveryLocationId: string;
  vehicleId: string;
  driverId: string;
  plannedDepartureAt: string;
  plannedArrivalAt: string;
  plannedQuantity: number;
};

export type RouteSummary = {
  id: string;
  name: string;
  sppgId: string;
  deliveryLocationId: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
  distanceMeters: string | number | null;
  estimatedDurationSeconds: number | null;
  active: boolean;
  version: number;
  createdAt: string;
  sppg?: { id: string; code: string; name: string };
  deliveryLocation?: { id: string; code: string; name: string };
};

export async function getRoutes(query: { sppgId?: string; deliveryLocationId?: string; page?: number; pageSize?: number } = {}): Promise<{ data: RouteSummary[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (query.sppgId) params.set("sppgId", query.sppgId);
  if (query.deliveryLocationId) params.set("deliveryLocationId", query.deliveryLocationId);
  params.set("page", String(query.page ?? 1));
  params.set("pageSize", String(query.pageSize ?? 25));
  return apiGet(`/routes?${params.toString()}`);
}

export function archiveRoute(id: string, reason: string, idempotencyKey = crypto.randomUUID()) {
  return apiMutate<{ route: RouteSummary; replayed: boolean }>(`/routes/${encodeURIComponent(id)}/archive`, "PATCH", { reason }, idempotencyKey);
}

export function createRoute(input: { name: string; sppgId: string; deliveryLocationId: string; coordinates: Array<{ latitude: number; longitude: number }>; reason?: string }) {
  return apiMutate<{ route: RouteSummary; replayed: boolean }>("/routes", "POST", input);
}

export async function getSppgOptions(): Promise<SppgSummary[]> {
  const result = await apiGet<Paginated<SppgSummary>>('/admin/sppg?page=1&pageSize=100');
  return result.data;
}

export async function getDeliveryLocationOptions(): Promise<DeliveryLocationOption[]> {
  const result = await apiGet<Paginated<DeliveryLocationOption>>('/admin/delivery-locations?page=1&pageSize=100');
  return result.data;
}

export async function getGeofences(
  locationType: GeofenceLocationType,
  locationId: string,
): Promise<GeofenceSummary[]> {
  const query = new URLSearchParams({ locationType, locationId });
  return apiGet<GeofenceSummary[]>(`/geofences?${query.toString()}`);
}

export function createGeofence(input: CreateGeofenceInput, idempotencyKey = crypto.randomUUID()) {
  return apiMutate<{ geofence: GeofenceSummary; replayed: boolean }>(
    '/geofences',
    'POST',
    input,
    idempotencyKey,
  );
}

export async function getTripResourceOptions(sppgId: string): Promise<TripResourceOptions> {
  const query = new URLSearchParams({
    sppgId,
    page: '1',
    pageSize: '100',
  });
  const [deliveryLocations, vehicles, drivers] = await Promise.all([
    apiGet<Paginated<DeliveryLocationOption>>(`/admin/delivery-locations?${query.toString()}`),
    apiGet<Paginated<VehicleOption>>(`/admin/vehicles?${query.toString()}`),
    apiGet<Paginated<DriverOption>>(`/admin/drivers?${query.toString()}`),
  ]);
  return {
    deliveryLocations: deliveryLocations.data,
    vehicles: vehicles.data,
    drivers: drivers.data,
  };
}

export function createTrip(input: CreateTripInput) {
  return apiMutate<TripMutationResult>('/trips', 'POST', input);
}

export function createTenantTrip(input: {
  deliveryLocationId: string;
  vehicleId: string;
  driverId: string;
  plannedDepartureAt: string;
  plannedArrivalAt: string;
  plannedQuantity: number;
}) {
  return apiMutate<unknown>('/tenant/trips', 'POST', input);
}

export function scheduleTrip(id: string) {
  return apiMutate<TripMutationResult>(`/trips/${encodeURIComponent(id)}/schedule`, 'POST');
}

export function readyTrip(id: string) {
  return apiMutate<TripMutationResult>(`/trips/${encodeURIComponent(id)}/ready-to-depart`, 'POST');
}

export function cancelTrip(id: string, version: number, reason: string) {
  return apiMutate<TripMutationResult>(
    `/trips/${encodeURIComponent(id)}/cancel`,
    'POST',
    { version, reason },
  );
}

export function rescheduleTrip(
  id: string,
  input: { plannedDepartureAt: string; plannedArrivalAt: string; version: number; reason: string },
) {
  return apiMutate<TripMutationResult>(
    `/trips/${encodeURIComponent(id)}/schedule`,
    'PATCH',
    input,
  );
}

export function reassignTrip(
  id: string,
  input: { vehicleId: string; driverId: string; version: number; reason: string },
) {
  return apiMutate<TripMutationResult>(
    `/trips/${encodeURIComponent(id)}/assignment`,
    'PATCH',
    input,
  );
}

export function changeTripDestination(
  id: string,
  input: { deliveryLocationId: string; version: number; reason: string },
) {
  return apiMutate<TripMutationResult>(
    `/trips/${encodeURIComponent(id)}/destination`,
    'PATCH',
    input,
  );
}

const TENANT_ROLE_PERMISSIONS: Record<string, string[]> = {
  TENANT_ADMIN: ['trip:read', 'trip:create', 'trip:schedule', 'trip:dispatch', 'trip:manage', 'trip:start', 'trip:location:update', 'trip:track:read', 'master:read', 'master:manage', 'sppg:read', 'sppg:manage', 'organization:read', 'geofence:read', 'geofence:manage', 'exception:read', 'report:read', 'tenant:read', 'tenant:manage', 'admin:manage_users'],
  TENANT_OPERATOR: ['trip:read', 'trip:create', 'trip:schedule', 'trip:dispatch', 'trip:manage', 'trip:track:read', 'master:read', 'sppg:read', 'geofence:read', 'exception:read', 'report:read', 'tenant:read'],
  TENANT_DRIVER: ['trip:read', 'trip:start', 'trip:location:update', 'trip:track:read'],
  TENANT_VIEWER: ['trip:read', 'trip:track:read', 'master:read', 'sppg:read', 'report:read', 'tenant:read'],
};

export function hasPlatformPermission(user: SessionUser | null | undefined, permission: string): boolean {
  if (!user?.roles) return false;
  return user.roles.some((role) => Array.isArray(role?.permissions) && role.permissions.includes(permission));
}

export function isPlatformAdmin(user: SessionUser | null | undefined): boolean {
  if (!user?.roles) return false;
  return user.roles.some((role) => Boolean(role?.isGlobal));
}

export function hasPermission(user: SessionUser | null | undefined, permission: string): boolean {
  if (!user) return false;
  if (user.roles?.some((role) => Array.isArray(role?.permissions) && role.permissions.includes(permission))) {
    return true;
  }
  const tenantRole = user.tenantRole;
  if (tenantRole && TENANT_ROLE_PERMISSIONS[tenantRole]?.includes(permission)) return true;
  return false;
}

export async function getCurrentSession(): Promise<SessionUser> {
  const payload = await apiGet<{ user?: SessionUser }>('/auth/me');
  if (!payload.user) throw new Error('INVALID_SESSION_RESPONSE');
  return payload.user;
}

function jakartaDayRange(now = new Date()) {
  const offsetMs = 7 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + offsetMs);
  const start = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offsetMs,
  );
  return { from: start.toISOString(), to: new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString() };
}

export async function getDashboardData(user: SessionUser): Promise<DashboardData> {
  const range = jakartaDayRange();
  const tripsQuery = new URLSearchParams({
    from: range.from,
    to: range.to,
    page: '1',
    pageSize: '100',
  });
  const canReadTrips = hasPermission(user, 'trip:read');
  const canReadExceptions = hasPermission(user, 'exception:read');
  const canReadSppg = hasPermission(user, 'master:read');

  const [trips, exceptions, sppgs] = await Promise.all([
    canReadTrips
      ? apiGet<Paginated<TripSummary>>(`/trips?${tripsQuery.toString()}`)
      : Promise.resolve(null),
    canReadExceptions
      ? apiGet<Paginated<ExceptionSummary>>('/exceptions?page=1&pageSize=100')
      : Promise.resolve(null),
    canReadSppg
      ? apiGet<Paginated<SppgSummary>>('/admin/sppg?page=1&pageSize=100').catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    trips: trips?.data ?? [],
    tripTotal: trips?.pagination.total ?? 0,
    exceptions: exceptions?.data ?? [],
    sppgs: sppgs?.data ?? null,
    sppgTotal: sppgs?.pagination.total ?? 0,
    refreshedAt: new Date().toISOString(),
  };
}

export async function getPlatformDashboardSummary(): Promise<PlatformDashboardSummary> {
  return apiGet<PlatformDashboardSummary>('/platform/dashboard-summary');
}

export async function getTrips(query: { status?: string; q?: string; page?: number; pageSize?: number } = {}): Promise<Paginated<TripSummary>> {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.q) params.set('q', query.q);
  params.set('page', String(query.page ?? 1));
  params.set('pageSize', String(query.pageSize ?? 25));
  return apiGet<Paginated<TripSummary>>(`/trips?${params.toString()}`);
}

export async function getTripDetail(id: string): Promise<TripDetail> {
  return apiGet<TripDetail>(`/trips/${encodeURIComponent(id)}`);
}

export async function getTripProofs(id: string): Promise<ProofSummary[]> {
  return apiGet<ProofSummary[]>(`/trips/${encodeURIComponent(id)}/delivery/proofs`);
}

export async function getTripExceptions(id: string): Promise<ExceptionSummary[]> {
  const query = new URLSearchParams({ tripId: id, page: '1', pageSize: '50' });
  const result = await apiGet<Paginated<ExceptionSummary>>(`/exceptions?${query.toString()}`);
  return result.data;
}

export function startTrip(id: string, input: StartTripInput) {
  return apiMutate<TripMutationResult>(
    `/trips/${encodeURIComponent(id)}/start`,
    'POST',
    input,
  );
}

export function appendTripLocation(id: string, input: TripLocationInput, idempotencyKey?: string) {
  return apiMutate<{ positionId: string; replayed: boolean }>(
    `/trips/${encodeURIComponent(id)}/locations`,
    'POST',
    input,
    idempotencyKey,
  );
}

export function verifyTripArrival(
  id: string,
  input: StartTripInput & { qrToken: string },
) {
  return apiMutate<ArrivalVerificationResult>(
    `/trips/${encodeURIComponent(id)}/arrival/verify`,
    'POST',
    input,
  );
}

export function startTripDelivery(id: string) {
  return apiMutate<DeliveryStartResult>(
    `/trips/${encodeURIComponent(id)}/delivery/start`,
    'POST',
  );
}

export function submitTripDelivery(
  id: string,
  input: {
    receivedQuantity: number;
    damagedQuantity: number;
    varianceReason?: string;
    confirmationNote?: string;
    deviceTimestamp?: string;
  },
  idempotencyKey?: string,
) {
  return apiMutate<DeliverySubmitResult>(
    `/trips/${encodeURIComponent(id)}/delivery`,
    'POST',
    input,
    idempotencyKey,
  );
}

export function reviewTripDelivery(
  id: string,
  input: { decision: "ACCEPT" | "REJECT"; reason: string },
) {
  return apiMutate<{ record: DeliverySubmitResult | null; replayed: boolean }>(
    `/trips/${encodeURIComponent(id)}/delivery/review`,
    'POST',
    input,
  );
}

export function completeTrip(id: string) {
  return apiMutate<{
    tripId: string;
    status: string;
    completedAt?: string;
    replayed: boolean;
  }>(`/trips/${encodeURIComponent(id)}/complete`, 'POST');
}

export function uploadTripProof(id: string, file: File, idempotencyKey?: string) {
  return apiUpload<ProofSummary>(
    `/trips/${encodeURIComponent(id)}/delivery/proofs`,
    file,
    idempotencyKey,
  );
}

export type ExceptionListQuery = {
  status?: string;
  severity?: string;
  source?: string;
  assignedToMe?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function getExceptions(
  query: ExceptionListQuery = {},
): Promise<Paginated<ExceptionSummary>> {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.severity) params.set('severity', query.severity);
  if (query.source) params.set('source', query.source);
  if (query.assignedToMe) params.set('assignedToMe', 'true');
  if (query.search) params.set('search', query.search);
  params.set('page', String(query.page ?? 1));
  params.set('pageSize', String(query.pageSize ?? 25));
  return apiGet<Paginated<ExceptionSummary>>(`/exceptions?${params.toString()}`);
}

export async function getExceptionAssignees(search?: string): Promise<ExceptionAssignee[]> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  const encoded = params.toString();
  return apiGet<ExceptionAssignee[]>(`/exceptions/assignees${encoded ? `?${encoded}` : ''}`);
}

export function triageException(
  id: string,
  input: { version: number; severity: ExceptionSummary["severity"]; reason: string; note?: string },
) {
  return apiMutate<ExceptionMutationResult>(
    `/exceptions/${encodeURIComponent(id)}/triage`,
    'POST',
    input,
  );
}

export function assignException(
  id: string,
  input: { version: number; assigneeUserId: string; reason: string; note?: string },
) {
  return apiMutate<ExceptionMutationResult>(
    `/exceptions/${encodeURIComponent(id)}/assign`,
    'POST',
    input,
  );
}

export function investigateException(
  id: string,
  input: { version: number; reason: string; note?: string },
) {
  return apiMutate<ExceptionMutationResult>(
    `/exceptions/${encodeURIComponent(id)}/investigate`,
    'POST',
    input,
  );
}

export function resolveException(
  id: string,
  input: { version: number; reason: string; resolutionNote: string },
) {
  return apiMutate<ExceptionMutationResult>(
    `/exceptions/${encodeURIComponent(id)}/resolve`,
    'POST',
    input,
  );
}

export function escalateException(
  id: string,
  input: { version: number; reason: string; note?: string },
) {
  return apiMutate<ExceptionMutationResult>(
    `/exceptions/${encodeURIComponent(id)}/escalate`,
    'POST',
    input,
  );
}

export function closeException(
  id: string,
  input: { version: number; outcome: ExceptionCloseOutcome; reason: string; note?: string },
) {
  return apiMutate<ExceptionMutationResult>(
    `/exceptions/${encodeURIComponent(id)}/close`,
    'POST',
    input,
  );
}

export async function getApprovalSppgs(): Promise<ApprovalSppgOption[]> {
  return apiGet<ApprovalSppgOption[]>('/admin/approval-requests/eligible-sppgs');
}

export async function getApprovalInbox(query: { page?: number; pageSize?: number } = {}) {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 25),
  });
  return apiGet<Paginated<ApprovalRequestSummary>>(
    `/admin/approval-requests/inbox?${params.toString()}`,
  );
}

export async function getMyApprovalRequests(query: { page?: number; pageSize?: number } = {}) {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 25),
  });
  return apiGet<Paginated<ApprovalRequestSummary>>(
    `/admin/approval-requests/mine?${params.toString()}`,
  );
}

export function requestSppgStatusChange(
  sppgId: string,
  input: { version: number; targetStatus: string; reason: string },
) {
  return apiMutate<ApprovalRequestSummary>(
    `/admin/sppg/${encodeURIComponent(sppgId)}/status-approval`,
    'POST',
    input,
  );
}

export function decideApprovalRequest(
  id: string,
  input: { decision: 'APPROVED' | 'REJECTED'; reason: string },
) {
  return apiMutate<ApprovalRequestSummary>(
    `/admin/approval-requests/${encodeURIComponent(id)}/decision`,
    'POST',
    input,
  );
}

export async function getAuditLogs(query: {
  page?: number;
  pageSize?: number;
  search?: string;
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return apiGet<Paginated<AuditLogSummary>>(`/admin/audit-logs?${params.toString()}`);
}

export function beginMfaEnrollment() {
  return apiMutate<{ secret: string; provisioningUri: string }>(
    '/auth/mfa/enrollment',
    'POST',
    {},
  );
}

export function confirmMfaEnrollment(input: { secret: string; otpCode: string }) {
  return apiMutate<{ success: boolean; mfaEnabled: boolean; recoveryCodes: string[] }>(
    '/auth/mfa/enrollment/confirm',
    'POST',
    input,
  );
}

export function beginMfaRotation(input: { otpCode?: string; recoveryCode?: string }) {
  return apiMutate<{ secret: string; provisioningUri: string; expiresAt: string }>(
    '/auth/mfa/rotation',
    'POST',
    input,
  );
}

export function confirmMfaRotation(input: { otpCode: string }) {
  return apiMutate<{ success: boolean; recoveryCodes: string[]; sessionsRevoked: number }>(
    '/auth/mfa/rotation/confirm',
    'POST',
    input,
  );
}

export function beginMfaRecovery(input: { token: string; password: string }) {
  return apiMutate<{ secret: string; provisioningUri: string; expiresAt: string }>(
    '/auth/mfa/recovery',
    'POST',
    input,
  );
}

export function confirmMfaRecovery(input: { token: string; password: string; otpCode: string }) {
  return apiMutate<{ success: boolean; recoveryCodes: string[]; username: string }>(
    '/auth/mfa/recovery/confirm',
    'POST',
    input,
  );
}

export function resetAdminUserMfa(id: string, input: { reason: string }) {
  return apiMutate<IssuedAccountToken>(
    `/admin/users/${encodeURIComponent(id)}/mfa-reset`,
    'POST',
    input,
  );
}

export async function getAdminUsers(query: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return apiGet<Paginated<AdminUserSummary>>(`/admin/users?${params.toString()}`);
}

export function getAdminRoles() {
  return apiGet<AdminRoleSummary[]>('/admin/roles');
}

export function updateAdminUserStatus(id: string, input: { status: string; reason: string }) {
  return apiMutate(`/admin/users/${encodeURIComponent(id)}/status`, 'PATCH', input);
}

export function revokeAdminUserSessions(id: string, input: { reason: string }) {
  return apiMutate(`/admin/users/${encodeURIComponent(id)}/revoke-sessions`, 'POST', input);
}

export function assignAdminUserRole(
  id: string,
  input: {
    roleCode: string;
    organizationId?: string;
    regionId?: string;
    sppgId?: string;
    reason: string;
  },
) {
  return apiMutate(`/admin/users/${encodeURIComponent(id)}/roles`, 'POST', input);
}

export function revokeAdminUserRole(
  id: string,
  input: { userRoleId: string; reason: string },
) {
  return apiMutate(`/admin/users/${encodeURIComponent(id)}/roles/revoke`, 'PATCH', input);
}

export function createAdminInvitation(input: {
  username: string;
  email?: string;
  displayName: string;
  reason: string;
}) {
  return apiMutate<IssuedAccountToken>('/admin/users/invitations', 'POST', input);
}

export function createAdminPasswordReset(id: string, input: { reason: string }) {
  return apiMutate<IssuedAccountToken>(
    `/admin/users/${encodeURIComponent(id)}/password-reset`,
    'POST',
    input,
  );
}

export function resendAdminInvitation(id: string, input: { reason: string }) {
  return apiMutate<IssuedAccountToken>(
    `/admin/users/${encodeURIComponent(id)}/invitation-resend`,
    'POST',
    input,
  );
}

export function consumeAccountToken(input: { token: string; password: string }) {
  return apiMutate<{ success: boolean; purpose: 'INVITATION' | 'PASSWORD_RESET'; username: string }>(
    '/auth/account-access/consume',
    'POST',
    input,
  );
}

export function getSessionRole(user: SessionUser): string {
  return user.roles.map((role) => role.code).join(', ') || 'Pengguna';
}
