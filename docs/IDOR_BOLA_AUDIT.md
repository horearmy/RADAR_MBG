# IDOR_BOLA_AUDIT

## 1. Tujuan
Audit akses resource by ID untuk mencegah IDOR/BOLA pada RADAR MBG.

## 2. Endpoint yang diaudit

### 2.1 Recipient
- `GET /recipient/stops/:stopId`
- `GET /recipient/stops/:stopId/pod`
- `POST /recipient/stops/:stopId/confirm`
- `POST /recipient/stops/:stopId/report-issue`
- `POST /recipient/notifications/:id/read`

Kontrol:
- `ensureMember(userId, stop.recipientSiteId)`
- membership ACTIVE divalidasi
- site scope dibatasi

Status: **Aman untuk scope site**

### 2.2 Trip
- `GET /trips/:id`
- `POST /trips/:id/schedule`
- `PATCH /trips/:id/schedule`
- `PATCH /trips/:id/assignment`
- `PATCH /trips/:id/destination`
- `POST /trips/:id/cancel`
- `POST /trips/:id/ready-to-depart`
- `POST /trips/:id/start`
- `POST /trips/:id/locations`
- `GET /trips/:id/track`

Kontrol:
- `scopeWhere(principal, tenantContext)`
- permission guard
- tenant context

Status: **Aman dengan tenant scope**

### 2.3 Master data
- `GET /admin/drivers/:id` (via getDriver)
- `PATCH /admin/sppg/:id`
- `PATCH /admin/drivers/:id`
- `PATCH /admin/vehicles/:id`

Kontrol:
- `assertSppgAccess`
- tenant context
- permission guard

Status: **Aman dengan scope SPPG/tenant**

### 2.4 Geofence
- `GET /geofences` by location
- `POST /geofences`
- geofence by location scoped

Kontrol:
- `getScopedLocationWhere`
- tenant scope
- permission guard

Status: **Aman**

### 2.5 User admin
- `GET /admin/users/:id`
- `PATCH /admin/users/:id`
- `POST /admin/users/:id/...`

Kontrol:
- `userScopeWhere`
- `assertUserInScope`
- permission guard

Status: **Aman dengan scope tenant**

### 2.6 Registration
- `GET /admin/sppg-registrations/:id`
- `PATCH /admin/sppg-registrations/:id/approve`
- `PATCH /admin/sppg-registrations/:id/reject`
- `PATCH /admin/sppg-registrations/:id/request-revision`
- `POST /admin/sppg-registrations/:id/provision`

Kontrol:
- platform guard
- permission guard
- status validation

Status: **Aman untuk platform admin**

### 2.7 Recipient registration
- `GET /tenant/recipient-registrations/:id` (via review)
- `PATCH .../approve`
- `PATCH .../reject`
- `PATCH .../request-revision`

Kontrol:
- tenant scope
- permission guard
- recipient site validation

Status: **Aman untuk tenant scope**

## 3. Risiko yang masih perlu ditutup

1. Pastikan semua endpoint by ID memvalidasi ownership/assignment.
2. Pastikan tenant context selalu ada.
3. Pastikan permission backend dan frontend selaras.
4. Tambahkan test IDOR/BOLA untuk setiap endpoint by ID.
5. Audit akses superadmin ke tenant.

## 4. Rekomendasi

1. Tambahkan test negatif untuk setiap endpoint by ID.
2. Dokumentasikan scope resolver sebagai single source of truth.
3. Lakukan review berkala permission per role.
4. Pastikan audit log mencatat akses sensitif.

## 5. Kesimpulan
IDOR/BOLA pada endpoint utama sudah dikontrol dengan scope dan permission, tetapi perlu test menyeluruh dan audit berkala sebelum production.