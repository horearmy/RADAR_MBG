# RELEASE_CHECKLIST

## 1. Pre-release
- [ ] Backup database.
- [ ] `git status` bersih.
- [ ] Branch target benar.
- [ ] Semua migration tercatat.
- [ ] Env production lengkap.
- [ ] Secret tidak ada di repo.

## 2. Build dan test
- [ ] `npm run build` frontend lulus.
- [ ] `npm run build` API lulus.
- [ ] `npm test` API lulus.
- [ ] Typecheck/lint lulus.

## 3. Database
- [ ] Migration deploy berhasil.
- [ ] Tidak ada migration gagal.
- [ ] Backup tersedia.
- [ ] Rollback plan siap.

## 4. Auth dan multi-tenant
- [ ] Login platform admin berfungsi.
- [ ] Login tenant admin berfungsi.
- [ ] Login driver berfungsi.
- [ ] Login penerima berfungsi.
- [ ] Tenant context tersedia.
- [ ] Cross-tenant access ditolak.
- [ ] Cross-recipient-site access ditolak.

## 5. Field App
- [ ] Landing page tampil.
- [ ] Driver workspace berfungsi.
- [ ] Recipient workspace berfungsi.
- [ ] GPS hanya aktif saat trip berjalan.
- [ ] Offline state tampil.
- [ ] POD upload berfungsi.

## 6. Recipient
- [ ] Registration code dapat dibuat.
- [ ] QR pendaftaran dapat dipindai.
- [ ] Request pendaftaran masuk PENDING_REVIEW.
- [ ] Approval membuat akun INVITED.
- [ ] Aktivasi akun berfungsi.
- [ ] Recipient hanya melihat site membership-nya.

## 7. Geofence
- [ ] Tenant geofence tersimpan dengan tenantId.
- [ ] Platform dapat melihat geofence aktif.
- [ ] Peta utama menampilkan geofence.
- [ ] Geofence tidak bocor ke tenant lain.

## 8. Notifikasi
- [ ] Notifikasi arrival terkirim ke recipient yang berhak.
- [ ] Delivery status tercatat.
- [ ] Retry tersedia jika gagal.

## 9. Security
- [ ] CSRF aktif.
- [ ] Rate limit aktif.
- [ ] IDOR/BOLA dicegah.
- [ ] Audit log tersedia.
- [ ] Superadmin access teraudit.

## 10. Monitoring
- [ ] Log aplikasi tersedia.
- [ ] Error monitoring aktif.
- [ ] Backup/restore diuji.
- [ ] Runbook tersedia.

## 11. Rollback
- [ ] Feature flag siap.
- [ ] Migration rollback plan siap.
- [ ] Event tidak dihapus saat rollback.