# STAGING_DEPLOY_PILOT

## 1. Tujuan
Menyediakan checklist deploy staging dan pilot satu tenant untuk RADAR MBG.

## 2. Pre-deploy

### 2.1 Repository
- [ ] Branch target: `feat/multi-tenant-foundation`
- [ ] Working tree bersih.
- [ ] Semua migration tercatat.
- [ ] Semua test lulus.

### 2.2 Environment
- [ ] `WEB_ORIGINS` sesuai staging.
- [ ] `DATABASE_URL` staging.
- [ ] `MFA_ENCRYPTION_KEY` valid.
- [ ] S3 credentials valid.
- [ ] `ALERT_WORKER_ENABLED` sesuai.

### 2.3 Backup
- [ ] Backup database staging.
- [ ] Backup konfigurasi.

## 3. Deploy database
```bash
cd api
npm run db:deploy
npx prisma migrate status
```

Verifikasi:
- [ ] Semua migration applied.
- [ ] Tidak ada migration failed.

## 4. Deploy backend
```bash
cd api
npm run build
npm run start:prod
```

Verifikasi:
- [ ] API aktif di port 4000.
- [ ] `GET /api/v1/auth/csrf` → 200.
- [ ] `GET /api/v1/auth/me` tanpa session → 401.

## 5. Deploy frontend
```bash
npm run build
npm run start
```

Verifikasi:
- [ ] Frontend aktif di port 3000.
- [ ] Halaman login tampil.

## 6. Smoke test platform
- [ ] Login superadmin.
- [ ] `GET /platform/summary` → 200.
- [ ] `GET /platform/tenants` → 200.
- [ ] Buat SPPG/registrasi uji.
- [ ] Approve dan provision.

## 7. Smoke test tenant
- [ ] Login tenant admin.
- [ ] Pilih tenant context.
- [ ] `GET /tenant/me` → 200.
- [ ] `GET /tenant/summary` → 200.
- [ ] Buat driver.
- [ ] Buat user driver.
- [ ] Buat kendaraan.
- [ ] Buat trip.

## 8. Smoke test driver
- [ ] Login driver di `/radarapp/login`.
- [ ] Workspace driver tampil.
- [ ] Tugas tampil.
- [ ] Mulai trip.
- [ ] GPS tracking aktif.
- [ ] Buat POD.

## 9. Smoke test recipient
- [ ] Buat QR pendaftaran penerima.
- [ ] Submit registration request.
- [ ] Approve request.
- [ ] Aktivasi akun penerima.
- [ ] Login penerima.
- [ ] Lihat pengiriman.
- [ ] Lihat POD.
- [ ] Konfirmasi / report issue.

## 10. Smoke test geofence
- [ ] Buat geofence tenant.
- [ ] Geofence tampil di peta tenant.
- [ ] Geofence tampil di peta platform.
- [ ] Tidak bocor ke tenant lain.

## 11. Monitoring
- [ ] Cek log error.
- [ ] Cek query lambat.
- [ ] Cek GPS ingestion.
- [ ] Cek notification delivery.
- [ ] Cek alert worker.

## 12. Pilot satu tenant
1. Pilih satu tenant pilot.
2. Aktifkan driver workspace.
3. Aktifkan geofence.
4. Aktifkan notifikasi.
5. Aktifkan recipient workspace.
6. Evaluasi setelah 1–2 minggu.

## 13. Rollback
- [ ] Matikan feature flag.
- [ ] Jangan hapus event/data.
- [ ] Dokumentasikan insiden.
- [ ] Pulihkan service jika perlu.

## 14. Exit criteria pilot
- [ ] Tidak ada cross-tenant data leakage.
- [ ] Driver hanya melihat trip miliknya.
- [ ] Recipient hanya melihat site miliknya.
- [ ] POD dan konfirmasi berfungsi.
- [ ] Geofence berfungsi.
- [ ] Notifikasi terkirim.
- [ ] Tidak ada error kritis.