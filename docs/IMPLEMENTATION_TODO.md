# RADAR MBG — Checklist Implementasi


## Status saat ini

- Dashboard Control Tower memuat KPI, trip hari ini, exception, dan posisi GPS terakhir dari API; peta MapLibre hanya memakai tile raster OpenStreetMap.
- NestJS API, Prisma schema/migrasi, autentikasi sesi, helper permission/scope, state machine trip, trip API dasar, dan GPS ingestion sudah ada.
- API melaporkan database `ok`; seluruh 16 migrasi up-to-date dan extension PostGIS aktif. Database lokal menjalankan PostgreSQL 18.6/PostGIS 3.6.2, dengan 51 foreign key, 283 check constraints, dan 3 indeks GiST terdeteksi. Trigger append-only audit, rate limit lintas instance, serta lease PostgreSQL alert worker terpasang. Docker Desktop service berhenti dan MinIO tidak tersedia; semantik constraint/index, transaksi bisnis, dan query operasional belum diuji penuh.
- Geofence circle, deteksi kedatangan multi-fix, token QR dinamis, dan endpoint verifikasi sudah ada di source; alur bisnisnya belum diuji pada database hidup.
- Master data API (organisasi, wilayah, SPPG, lokasi tujuan, kendaraan, pengemudi) sudah ada di source; belum diuji terhadap database hidup.
- Exception case API (create/list/detail/triage/assign/investigate/resolve/escalate/close) dan worker alert otomatis sudah ada di source; exception terkait trip tampil di detail, halaman `/exceptions` menyediakan daftar terpadu dengan filter/pagination, dan tindak lanjut dari UI memakai pemilihan assignee ter-scope.
- Upload/akses bukti POD ke object storage privat (MinIO/S3-compatible) sudah ada di source; belum diuji terhadap storage/database hidup.
- Alert worker terjadwal (keterlambatan, GPS stale/offline, QR failure, selisih POD, POD incomplete) sudah ada di source; default nonaktif dan belum diuji terhadap database hidup.
- Aksi trip di detail (schedule, ready-to-depart, reschedule, reassignment, ubah tujuan, cancel) dan form create draft di `/trips` sudah tersedia dengan permission gate serta konfirmasi; belum diuji terhadap API/database hidup.
- Dashboard memakai navigasi dan pengambilan data berbasis permission; halaman trip/exception memiliki state unauthorized, dan sesi yang berakhir diarahkan ke login dengan pemberitahuan.
- Driver Console `/driver` sudah tersedia untuk alur inti (start, GPS, QR kamera/tempel token, POD, bukti); service worker menyediakan fallback offline, tetapi antrean aksi, tracking background, ETA, notifikasi keluar, dan retensi file POD belum tersedia.

## 0. Jalankan fondasi lokal — prasyarat implementasi

- [ ] Pasang dan jalankan Docker Desktop/Engine.
- [ ] Jalankan Docker Desktop/Engine dan `npm run db:up`; PostgreSQL yang dipakai saat ini berjalan di luar Docker.
- [ ] Jalankan `npm run storage:up` dan pastikan bucket `radar-mbg-pod` privat serta sehat.
- [ ] Salin `api/.env.example` menjadi `api/.env`; isi `DATABASE_URL`, `MFA_ENCRYPTION_KEY`, konfigurasi `S3_*`, dan `ALERT_WORKER_*` development.
- [x] Generate Prisma Client dan deploy seluruh 16 migrasi; `prisma migrate status` mengonfirmasi tidak ada migrasi tertunda.
- [x] Verifikasi `/api/v1/health` menunjukkan `database: ok`.
- [ ] Uji seluruh migrasi dari database kosong dan lakukan restore test.
- [x] Catat hasil pemeriksaan database lokal: PostgreSQL 18.6, PostGIS 3.6.2, 51 foreign key, 283 check constraints, dan 3 indeks GiST terdeteksi.

## 1. Identity, RBAC, dan isolasi SPPG — P0

**Sudah tersedia:** login Argon2id, cookie session, logout/revocation sesi sendiri, CSRF, TOTP verifikasi, bootstrap Superadmin, permission guard, scope helper, serta sesi memuat role dan scope.

- [x] Verifikasi ada satu akun Superadmin aktif dengan MFA pada database lokal; bootstrap tidak dijalankan ulang agar akun yang ada tidak tertimpa.
- [x] Buat administrasi akun: undang/buat, suspend, nonaktifkan, reset password, assignment role/scope, dan pencabutan semua sesi. Token undangan/reset sekali pakai diberikan ke admin untuk dikirim manual; kanal email belum tersedia.
- [ ] Tetapkan katalog role/permission resmi untuk Superadmin, approver, Admin SPPG, dispatcher, driver, auditor, dan pimpinan.
- [x] Buat assignment dan pencabutan role sebagai aksi yang diaudit; role global dan role wajib MFA fail-closed.
- [x] Tambahkan alur enrollment, recovery, reset, dan rotasi MFA; secret aktif/pending dienkripsi, reset oleh admin lain memerlukan MFA dan alasan, token sekali pakai, password pengguna, serta mencabut sesi.
- [x] Sediakan enrollment TOTP dengan 10 kode pemulihan satu kali (hash di database), login recovery code dengan password, rotasi secret berbatas waktu, serta pemulihan MFA admin-terbit 30 menit; seluruh alur diaudit.
- [x] Catat login sukses/gagal/ditolak karena rate limit, logout, dan kegagalan MFA; kredensial, username, OTP, serta token sesi tidak disimpan pada event.
- [x] Audit explicit scope denial dan resource lookup ter-scope dengan response generik 404; perubahan akun/role dan sesi dicabut juga dicatat.
- [x] Cegah replay dedupe exception mengembalikan exception lain di luar scope pemohon; tambahkan policy regression test.
- [ ] Uji IDOR/BOLA untuk list, detail, mutasi, file, ekspor, dan channel realtime; Admin SPPG A tidak dapat mengakses SPPG B.
- [x] Verifikasi middleware CSRF/origin global pada route mutasi representatif, termasuk semua endpoint enrollment, rotasi, dan pemulihan MFA.
- [x] Uji rate limit proses tunggal terhadap pengulangan identitas dan password spraying dari IP yang sama.
- [x] Ganti rate limit login dengan counter PostgreSQL atomik untuk IP dan pasangan IP/identitas; counter hashed, masa hidup terbatas, dan fail-closed bila database tidak tersedia.

**Penerimaan:** akun nonaktif/ditangguhkan ditolak; Superadmin/approver tidak dapat masuk tanpa MFA; driver hanya mendapat tugas sendiri; setiap objek dibatasi ulang di backend.

## 2. Master data dan riwayat penugasan — P0

- [x] API create/list organisasi dan wilayah dengan validasi scope dan audit reason.
- [x] API create/list SPPG dan geospasial: koordinat WGS84, PostGIS geography, validasi rentang, status awal `PENDING`.
- [x] API create/list lokasi tujuan dengan koordinat WGS84 dan status aktif.
- [x] API create/list kendaraan dan pengemudi; `Driver` terpisah dari akun `User`.
- [x] API update/nonaktifkan master data dengan audit before/after; SPPG memakai optimistic version.
- [x] Riwayat perubahan master data (organisasi, wilayah, SPPG, tujuan, kendaraan, pengemudi, assignment) dapat ditelusuri dari audit explorer dengan filter scope.
- [x] Audit explorer mencakup riwayat geofence dan perubahan koordinat lokasi tujuan dalam scope.
- [x] Tambahkan riwayat assignment driver/kendaraan dengan tanggal efektif; trip historis tetap menyimpan `driverId`/`vehicleId` saat dibuat.
- [x] Tolak assignment driver/kendaraan yang bertabrakan pada rentang efektif; create memakai transaksi Serializabel.
- [ ] Uji concurrency assignment dan validasi bentrok terhadap trip terjadwal pada database hidup.
- [x] Tambahkan seed role dan permission minimal yang idempoten (`npm run db:seed-rbac`); tidak membuat akun/password demo.
- [ ] Tetapkan scope default tiap role saat assignment akun dan uji pemisahan tugas (requester/reviewer/approver).

**Penerimaan:** query master data mengikuti scope organisasi/wilayah/SPPG; perubahan penting menyimpan before/after dan aktor.

## 3. Trip management — P0

**Sudah tersedia:** create draft, daftar/detail dengan scope, schedule, ready-to-depart, start driver, state machine dasar, version check, idempotency, trip event, audit status, reschedule, reassignment, perubahan tujuan sebelum berangkat, dan pembatalan dengan reason.

- [ ] Setelah DB aktif, uji create/list/detail, scope query, uniqueness idempotency, dan bentrok assignment menggunakan PostgreSQL.
- [x] Tambahkan form create draft trip di UI dengan filter SPPG/tujuan/kendaraan/pengemudi sesuai scope dan validasi jadwal/porsi.
- [x] Filter tujuan/kendaraan/pengemudi di server berdasarkan `sppgId` setelah SPPG dipilih, bukan memuat seluruh master lintas SPPG.
- [ ] Tambahkan pencarian/pagination pada dropdown master; daftar SPPG dan resource per SPPG masih dibatasi 100 opsi per request.
- [x] Tambahkan perubahan jadwal/tujuan, assignment ulang, dan pembatalan dengan reason wajib serta audit.
- [x] Tambahkan aksi ubah jadwal, ganti armada, dan ubah tujuan dari detail trip untuk status draf/terjadwal.
- [ ] Tambahkan workflow exception/resolusi dan permission khusus untuk perubahan tujuan/rute setelah keberangkatan; saat ini ditolak `DESTINATION_CHANGE_REQUIRES_EXCEPTION`.
- [ ] Perluas state machine untuk exception/resolution, arrival detected/verified, delivery, dan completion dengan aturan/transisi yang disetujui SOP.
- [ ] Pastikan setiap transisi atomik: optimistic version check + trip event + audit; kegagalan salah satu bagian membatalkan transaksi.
- [ ] Tambahkan test concurrency/replay untuk start, schedule, ready-to-depart, cancel, dan perubahan tujuan.
- [ ] Terapkan pagination/filter server-side dan konsistensi KPI trip.

**Penerimaan:** request klien tidak dapat menetapkan status langsung; `COMPLETED` tidak dapat dicapai sebelum verifikasi dan POD wajib.

## 4. GPS tracking dan freshness — P0

**Sudah tersedia:** start trip mencatat fix awal; endpoint `POST /trips/:id/locations`; GPS disimpan terpisah dari waktu server; endpoint track historis; idempotency; batas laju; scope driver; flag akurasi buruk, data lama/tidak berurutan, sequence replay, dan lompatan tidak wajar.

- [ ] Uji ingestion di PostGIS hidup untuk titik valid, duplikat, offline/backfill, timestamp masa depan, akurasi buruk, urutan salah, dan lompatan.
- [ ] Tambahkan strategi partisi, indeks spasial GPS bila query memerlukan, retensi, kompresi/agregasi, dan purging terkontrol.
- [x] Alert worker mengubah `LIVE` menjadi `STALE`/`OFFLINE` berdasarkan umur penerimaan; status kualitas/freshness tidak menyimpulkan kendaraan berhenti.
- [x] Titik lama/backfill tetap disimpan untuk riwayat, tetapi tidak menggantikan posisi live atau mengubah status tracking menjadi `LIVE`.
- [ ] Tambahkan device registration/revocation dan provenance perangkat; minimalkan data perangkat yang disimpan.
- [ ] Tambahkan offline queue/outbox PWA dengan retry, idempotency key stabil, conflict state, dan status belum tersinkron.
- [ ] Tambahkan metrik jumlah titik diterima/ditolak, umur lokasi, queue depth, dan integritas data.

**Penerimaan:** dashboard menampilkan `device_timestamp`, `server_received_at`, umur data, akurasi, dan status freshness secara berbeda.

## 5. Geofence kedatangan dan QR verification — P0

- [x] Tambahkan model/migrasi geofence circle untuk SPPG/tujuan, radius, akurasi minimum, jumlah fix, durasi konfirmasi, versi, dan status aktif.
- [x] Implementasikan API create/list geofence dengan scope, alasan wajib, audit before/after, idempotency, serta spatial index PostGIS.
- [x] Bangun deteksi arrival dari beberapa fix berkualitas di radius tujuan; transisi hanya `IN_TRANSIT → ARRIVAL_DETECTED`.
- [x] Tambahkan QR dinamis: token acak, hash penyimpanan, ikatan trip/lokasi, expiry, one-time use, dan pencabutan token sebelumnya.
- [x] Implementasikan verifikasi server-side untuk session/permission, trip, tujuan, QR, geofence, akurasi, freshness, idempotency, audit, dan anti-replay.
- [x] Tambahkan manual arrival override dengan permission `arrival:override`, reason, evidence note, actor, idempotency, dan audit; record override terpisah dari hasil verifikasi otomatis.
- [ ] Uji override dan pastikan UI membedakan `VERIFIED` otomatis vs `OVERRIDDEN`.
- [ ] Uji flow business terhadap database untuk QR invalid, expired, replay, wrong destination, GPS poor/stale, duplikasi, serta offline pending verification.
- [ ] Uji geofence polygon; versi awal hanya mendukung circle.

**Penerimaan:** `ARRIVAL_DETECTED` bukan `ARRIVAL_VERIFIED`; QR valid saja tidak menyelesaikan penyaluran.

## 6. Reconciliation dan Digital POD — P0

- [x] Tambahkan model planned/dispatched/received/damaged/shortage, review status, record versions, proof metadata, dan adjustment history.
- [x] Validasi kuantitas di server; selisih/rusak memerlukan alasan dan masuk review.
- [x] Simpan koreksi sebagai record version baru serta adjustment sebelum/sesudah; jangan menimpa nilai historis.
- [x] Implementasikan start delivery, POD digital berisi receiver terautentikasi, waktu perangkat/server, catatan, dan versi.
- [x] Tambahkan reviewer terpisah dari submitter; completion ditolak sampai rekonsiliasi diterima.
- [x] Implementasikan upload ke object storage privat: batas tipe/ukuran, deteksi MIME, hash SHA-256, deduplikasi, bucket privat, signed URL 5 menit, dan authorization scope tiap akses.
- [x] Tambahkan UI review POD (accept/reject), koreksi POD setelah rejection, start delivery, submit POD, dan completion di detail trip.
- [ ] Tambahkan kebijakan retensi/legal hold, pemindaian malware, dan lifecycle object storage.
- [ ] Uji flow bisnis dengan PostgreSQL/MinIO: selisih, correction after reject, retry idempotent, file privat, deduplikasi, dan completion sebelum review.

**Penerimaan:** planned, dispatched, dan received tetap terpisah; trip tidak selesai sebelum bukti dan konfirmasi wajib valid.

## 7. Exception, risk, alert, dan ETA — P1

- [x] Tambahkan exception case dengan severity, source, pemilik, dedupe key, due date, optimistic version, dan riwayat status.
- [x] Implementasikan alur `DETECTED → TRIAGED → ASSIGNED → INVESTIGATING → RESOLVED/ESCALATED` serta penutupan beralasan (`FALSE_POSITIVE`, `DUPLICATE`, `CLOSED_WITH_NOTE`).
- [x] Tambahkan cooldown alert otomatis serta wiring alert/exception worker (keterlambatan, GPS stale/offline, QR failure, selisih, POD incomplete).
- [x] Tambahkan modal tindak lanjut exception dari detail trip: triage severity, assign ke pengguna aktif, investigasi, resolusi, eskalasi, dan penutupan dengan outcome.
- [x] Buat halaman `/exceptions` terpadu dengan filter status/severity/source, pencarian, tugas saya, pagination server, serta pemilihan assignee ter-scope melalui `GET /exceptions/assignees` dan enforcement scope di endpoint assign.
- [x] Tambahkan worker terjadwal untuk keterlambatan, GPS stale/offline, QR failure, selisih porsi, dan POD incomplete; worker memperbarui `trackingStatus`.
- [ ] Uji alert worker pada database hidup: cooldown, deduplikasi, multi-instance, timezone, dan eskalasi severity.
- [x] Cegah scan alert bersamaan lintas instance dengan lease PostgreSQL; owner memperbarui lease berkala dan lease berakhir otomatis setelah crash.
- [ ] Pisahkan gangguan data/perangkat/jaringan dari indikator risiko perjalanan; risiko bukan keputusan sanksi otomatis.
- [ ] Bangun ETA hanya saat input cukup; sertakan waktu dan kualitas data, selain status `ETA_UNAVAILABLE`.
- [ ] Tambahkan route plan/version, corridor deviation, serta pencatatan pengalihan rute yang disetujui.
- [ ] Tambahkan notification outbox, delivery log, retry, dan status kegagalan kanal.

## 8. Dashboard Control Tower dan Driver PWA — P0/P1

- [x] Buat login web, MFA challenge, dan guard sesi untuk dashboard.
- [x] Tambahkan navigasi berbasis permission pada dashboard, state unauthorized untuk dashboard/trip/exception, pengambilan data dashboard yang menyesuaikan permission, serta pemberitahuan sesi berakhir di halaman login.
- [x] Ganti fixture KPI, daftar trip, dan exception dashboard dengan API; sediakan loading, empty, error, dan retry state.
- [x] Tambahkan posisi GPS terakhir dan waktu penerimaan server ke endpoint list/detail trip serta ringkasan dashboard.
- [x] Ganti ilustrasi peta dengan MapLibre, tile raster OpenStreetMap saja, atribusi, marker posisi GPS, legend, dan detail marker.
- [ ] Konfigurasikan CSP untuk tile OpenStreetMap; tambahkan overlay rute/geofence atau filter wilayah hanya setelah data dan scope operasional mendukungnya.
- [ ] Hubungkan dashboard ke delivery dan filter scope; trip, exception, serta freshness GPS sudah terhubung.
- [x] Buat halaman detail trip dengan peta, timeline event, rekonsiliasi POD, bukti privat, dan exception terkait.
- [x] Buat halaman trip list terpisah dengan pagination server dan filter status.
- [x] Tambahkan aksi status transition (schedule, ready-to-depart, cancel) dari UI dengan permission gate, konfirmasi, alasan pembatalan, dan refresh detail.
- [x] Buat Driver Console mobile-first `/driver`: sesi/permission, tugas sendiri, start trip, izin GPS, kirim lokasi berkala, verifikasi QR, POD, unggah bukti, serta error/session/empty state.
- [x] Tambahkan pemindaian QR kamera memakai BarcodeDetector dengan fallback tempel token dan pesan izin/HTTPS/browser.
- [x] Tambahkan indikator online/offline, pesan tanpa antrean otomatis, dan penonaktifan aksi server saat offline.
- [x] Tambahkan service worker production, ikon manifest, dan halaman fallback `/offline.html` saat navigasi tanpa koneksi.
- [ ] Tambahkan antrean GPS/POD/bukti dengan idempotency stabil serta status pending/conflict; service worker belum menyimpan aksi lapangan.
- [x] UI Driver menjelaskan bahwa pelacakan bergantung pada halaman/browser aktif dan dapat berhenti saat tab tertutup atau layar terkunci.
- [ ] Uji keyboard, aksesibilitas, layar mobile, browser Android sasaran, serta fallback ketika kamera/geolocation/map gagal.

## 9. Laporan, audit, observability, dan operasi — P0 sebelum produksi

- [ ] Laporan trip/KPI dengan definisi eksplisit, filter yang sama, pagination, dan ekspor sesuai permission.
- [ ] Audit explorer append-only untuk aksi sensitif; ekspor dan akses bukti juga diaudit.
- [x] Sediakan audit explorer read-only dengan filter/pagination dan pembatasan scope untuk master data, trip, exception, approval SPPG, geofence, serta akses daftar/signed URL bukti POD.
- [x] Terapkan trigger database append-only untuk UPDATE, DELETE, dan TRUNCATE audit log.
- [ ] Audit ekspor setelah fitur ekspor tersedia.
- [ ] Health center: API/database, error/latency, queue, freshness GPS, notifikasi, backup, storage, dan integrasi peta.
- [ ] Logging terstruktur dengan request/correlation ID; redaksi password, OTP, session token, QR secret, dan data pribadi.
- [ ] Atur secret manager, rotasi secret, MFA admin, session revoke, HTTPS, CORS allowlist, CSP, rate limits, payload/file limits.
- [ ] Siapkan backup terenkripsi, restore test, RPO/RTO, retensi per kategori data, incident runbook, dan rollback.
- [ ] Jalankan dependency/secret scan, SAST, security review, uji akses lintas SPPG, dan uji beban GPS.
- [ ] Pilot lapangan untuk radius geofence, batas akurasi/freshness GPS, konsumsi data/baterai, jaringan buruk, dan SOP exception.

## Gerbang rilis

- [ ] Semua acceptance criteria P0 PRD lulus atau memiliki pengecualian risiko tertulis yang disetujui.
- [ ] Semua migrasi diuji dari database kosong dan memiliki prosedur rollback.
- [ ] Uji isolasi organisasi/wilayah/SPPG lulus untuk API, data GPS, laporan, file POD, dan realtime.
- [ ] MFA, sesi, CSRF, rate limit, idempotency, state machine, audit, backup/restore, dan observability terbukti lewat test.
- [ ] Tidak ada kerentanan kritis/tinggi yang belum ditangani tanpa persetujuan risiko formal.
- [ ] Kebijakan retensi dan penggunaan tile OpenStreetMap sesuai skala trafik, ambang operasional, approver, RPO/RTO, dan SOP lapangan disetujui.
- [ ] UAT/pilot dan persetujuan Product Owner/operasional terdokumentasi.
