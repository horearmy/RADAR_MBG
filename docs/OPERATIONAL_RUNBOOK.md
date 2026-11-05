# OPERATIONAL_RUNBOOK

## 1. Tujuan
Runbook ini menjelaskan cara menjalankan, memantau, dan memulihkan RADAR MBG pada lingkungan production.

## 2. Komponen utama
- Frontend: Next.js (`npm run start`, port 3000)
- Backend API: NestJS (`npm run start:prod`, port 4000)
- Database: PostgreSQL + PostGIS
- Storage: S3-compatible object storage
- Queue: jika diaktifkan (alert worker)

## 3. Konfigurasi penting

### Frontend
- `NEXT_PUBLIC_RADAR_API_URL`
- `RADAR_API_INTERNAL_URL`

### Backend
- `PORT=4000`
- `WEB_ORIGINS`
- `DATABASE_URL`
- `MFA_ENCRYPTION_KEY`
- `S3_*`
- `ALERT_WORKER_ENABLED`
- `ALERT_WORKER_INTERVAL_SECONDS`

## 4. Startup

### 4.1 Database
1. Pastikan PostgreSQL aktif.
2. Pastikan extension PostGIS tersedia.
3. Jalankan migration:
   ```bash
   cd api
   npm run db:deploy
   ```
4. Verifikasi migration:
   ```bash
   npx prisma migrate status
   ```

### 4.2 Backend
```bash
cd api
npm run build
npm run start:prod
```

Cek:
- `http://localhost:4000/api/v1/auth/csrf` mengembalikan JSON.

### 4.3 Frontend
```bash
npm run build
npm run start
```

Cek:
- `http://localhost:3000/` tampil.

## 5. Health check

### API
- `GET /api/v1/auth/csrf` → 200
- `GET /api/v1/auth/me` tanpa session → 401
- `GET /api/v1/platform/summary` sebagai admin → 200

### Database
- Query sederhana:
  ```sql
  SELECT 1;
  ```

### Storage
- Verifikasi upload/download POD bila storage aktif.

## 6. Monitoring

Pantau:
- error 401/403/500
- query lambat
- GPS ingestion
- notification delivery
- alert worker
- disk/database size
- storage availability

Log penting:
- auth.login.failed
- tenant.access.denied
- tenant.support_access
- geofence.create
- user.invitation.accept
- recipient registration approve/reject

## 7. Troubleshooting

### 7.1 Layanan belum tersedia
- Cek API aktif.
- Cek PostgreSQL aktif.
- Cek `NEXT_PUBLIC_RADAR_API_URL`.
- Cek CORS `WEB_ORIGINS`.

### 7.2 Login gagal
- cek username/password
- cek status user `ACTIVE`
- cek MFA
- cek rate limit
- cek session cookie

### 7.3 Tenant context tidak tersedia
- cek `x-tenant-id`
- cek `tenant_memberships`
- cek tenant status `ACTIVE`
- cek selected tenant di frontend

### 7.4 Driver tidak bisa masuk Field App
- cek status user `ACTIVE`
- cek role `TENANT_DRIVER`
- cek relasi `driverId`
- cek permission `trip:start`, `trip:location:update`

### 7.5 Recipient tidak bisa masuk
- cek `recipient_memberships` status `ACTIVE`
- cek `/recipient/me`
- cek site membership

### 7.6 Geofence tidak tampil
- cek `active = true`
- cek `tenantId`
- cek koordinat
- cek viewport peta

### 7.7 Upload POD gagal
- cek storage configured
- cek signed URL
- cek MIME/size
- cek permission

## 8. Backup dan restore

### Backup
```bash
pg_dump -Fc -d radar_mbg > radar_mbg.dump
```

### Restore
```bash
pg_restore -d radar_mbg radar_mbg.dump
```

Aturan:
- backup sebelum migration
- backup sebelum release besar
- uji restore berkala

## 9. Migration

### Deploy
```bash
cd api
npm run db:deploy
```

### Status
```bash
npx prisma migrate status
```

### Rollback
- jangan drop tabel/kolom produksi
- gunakan forward-fix
- feature flag untuk mematikan fitur

## 10. Feature flag

Gunakan feature flag untuk:
- GPS tracking
- geofence
- notifikasi
- recipient workspace
- recipient registration

Rollback:
- matikan feature flag
- jangan hapus event/data

## 11. Incident response

1. Identifikasi gejala.
2. Cek log API dan database.
3. Cek status service.
4. Isolasi tenant jika perlu.
5. Komunikasikan ke pengguna.
6. Pulihkan service.
7. Dokumentasikan insiden.

## 12. Rotasi secret

- `MFA_ENCRYPTION_KEY`
- JWT/session secret bila ada
- S3 credentials
- database password

Lakukan:
1. backup
2. update env
3. restart service
4. verifikasi login
5. audit akses

## 13. Maintenance berkala

- vacuum/analyze database
- cek ukuran tabel GPS
- cek retensi data
- cek log error
- cek backup
- cek migration status

## 14. Kontak dan eskalasi

Tentukan:
- PIC backend
- PIC frontend
- PIC database
- PIC infra
- PIC keamanan

Eskalasi:
1. Operator
2. Tech lead
3. Security/admin
4. Management

## 15. Catatan
Runbook ini harus diperbarui setiap ada perubahan arsitektur, env, atau prosedur operasional.