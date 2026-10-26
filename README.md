# RADAR MBG

Fondasi aplikasi RADAR MBG berdasarkan PRD v1.3. Dashboard Control Tower memuat KPI, perjalanan hari ini, exception aktif, dan posisi GPS terakhir dari API; navigasi serta pemuatan data mengikuti permission pengguna, akses tanpa izin menampilkan state terbatas, dan sesi berakhir diarahkan ke login dengan pemberitahuan. Halaman `/exceptions` menyediakan daftar exception terpadu dengan filter status/severity/sumber, pencarian, tugas saya, pagination server, dan modal tindak lanjut dengan pemilihan assignee ter-scope. Halaman `/trips` menyediakan daftar trip dengan filter status, pagination server, dan form pembuatan draft sesuai scope; halaman detail trip menampilkan peta, timeline server-side, rekonsiliasi POD, bukti privat, exception terkait, aksi schedule, ready-to-depart, reschedule, reassignment, perubahan tujuan, cancel, start delivery, submit/koreksi POD, review POD, dan completion, serta tindak lanjut exception (triage, assignment, investigasi, resolusi, eskalasi, penutupan) sesuai permission. Peta memakai MapLibre; fallback development memakai raster OpenStreetMap dengan attribution. Driver Console `/driver` menyediakan alur mobile-first untuk start trip, GPS berkala, verifikasi QR lewat kamera atau tempel token, POD, dan unggah bukti.

## Menjalankan aplikasi

Persyaratan: Node.js 20.9+.

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

Halaman login tersedia di `/login`. Secara development, web menghubungi API di `http://localhost:4000/api/v1`; ubah `NEXT_PUBLIC_RADAR_API_URL` dari `.env.example` bila menggunakan URL lain. `WEB_ORIGINS` pada `api/.env` harus sesuai origin web, termasuk port.

Jalankan API NestJS di terminal lain:

```bash
npm run api:dev
```

Health check API tersedia di `http://localhost:4000/api/v1/health` dan membedakan kondisi API, database belum dikonfigurasi, serta database tidak tersedia.

### Database lokal

Docker Compose menyediakan PostgreSQL 16 dengan PostGIS dan MinIO untuk development lokal (Docker harus sudah terpasang):

```bash
npm run db:up
npm run storage:up
```

MinIO menyediakan object storage privat di `http://localhost:9000` (console `http://localhost:9001`) dan membuat bucket `radar-mbg-pod`. Bucket tidak dapat diakses anonim; API memakai signed URL berumur pendek.

Salin `api/.env.example` menjadi `api/.env`, lalu jalankan migrasi dan Prisma Client:

```bash
cd api
npm run db:generate
npm run db:migrate
npm run seed:rbac
```

Kredensial pada Compose hanya untuk development lokal; jangan gunakan untuk deployment.

### Alert worker

Worker exception berjalan di proses API dan default nonaktif. Aktifkan dengan `ALERT_WORKER_ENABLED=true` setelah database siap. Worker memindai keterlambatan, GPS stale/offline (sekaligus memperbarui `trackingStatus`), kegagalan QR, selisih kuantitas POD, dan POD yang belum direview. Setiap alert memakai dedupe key, cooldown, event, dan audit dengan aktor sistem (`null`).

Ambang waktu diatur melalui `ALERT_LATE_ARRIVAL_MINUTES`, `ALERT_LATE_HIGH_MINUTES`, `ALERT_GPS_STALE_MINUTES`, `ALERT_GPS_OFFLINE_MINUTES`, `ALERT_QR_LOOKBACK_MINUTES`, `ALERT_POD_REVIEW_MINUTES`, `ALERT_COOLDOWN_MINUTES`, dan `ALERT_WORKER_INTERVAL_SECONDS`. Jalankan worker hanya pada satu instance API; multi-instance memerlukan leader election/lock.

Untuk membuat akun Superadmin pertama, isi `MFA_ENCRYPTION_KEY` (64 digit hex), `BOOTSTRAP_ADMIN_*`, serta kode TOTP aktif di `api/.env`, lalu jalankan satu kali:

```bash
cd api
npm run auth:bootstrap
```

Password minimal 14 karakter. Secret MFA dienkripsi sebelum disimpan; kode TOTP hanya dipakai untuk validasi bootstrap dan tidak disimpan.

Pemeriksaan sebelum perubahan dikirim:

```bash
npm run typecheck
npm run lint
npm run build
```

## Arah arsitektur dari PRD

- Web Control Tower dan Driver PWA: Next.js, React, TypeScript.
- Backend API modular: NestJS, Node.js, TypeScript.
- Data operasional/geospasial: PostgreSQL + PostGIS.
- Pembaruan dashboard: SSE atau WebSocket yang dibatasi scope akses.
- Bukti POD: object storage privat.

Backend berada di `api/` dan sudah memiliki prefix `/api/v1`, validasi request global, security headers, CORS berbasis allowlist `WEB_ORIGINS`, serta endpoint kesehatan API.

API autentikasi:

- `GET /api/v1/auth/csrf` — menerbitkan token CSRF untuk form login.
- `POST /api/v1/auth/login` — menerima `username`, `password`, dan `otpCode` saat MFA aktif; kirim cookie CSRF dan header `x-csrf-token`.
- `POST /api/v1/auth/logout` — mencabut sesi dan memerlukan CSRF.
- `GET /api/v1/auth/me` — mengembalikan principal dan permission dari sesi yang valid.
- `GET /api/v1/trips` dan `GET /api/v1/trips/:id` — daftar/detail trip yang dibatasi scope.
- `POST /api/v1/trips` — membuat draft trip, dengan `Idempotency-Key`.
- `POST /api/v1/trips/:id/schedule` dan `/ready-to-depart` — transisi terkontrol dispatcher.
- `PATCH /api/v1/trips/:id/schedule`, `/assignment`, `/destination` dan `POST /api/v1/trips/:id/cancel` — perubahan terkontrol dengan `version` + `reason`, cek bentrok, event, dan audit.
- `POST /api/v1/trips/:id/start` — hanya driver yang ditugaskan, dengan GPS berkualitas cukup dan geofence asal.
- `POST /api/v1/trips/:id/locations` — titik GPS idempoten; data usang/anomali disimpan dengan flag namun tidak menggeser posisi live.
- `GET /api/v1/trips/:id/track` — jejak GPS historis dengan batas rentang dan jumlah titik.
- `GET /api/v1/geofences` dan `POST /api/v1/geofences` — daftar/buat geofence circle berversi dan diaudit.
- `POST /api/v1/trips/:id/qr-token` — terbitkan QR token dinamis terikat trip/lokasi; token mentah hanya dikembalikan sekali.
- `POST /api/v1/trips/:id/arrival/verify` — verifikasi QR, tujuan, geofence, GPS, permission, dan anti-replay.
- `POST /api/v1/trips/:id/arrival/override` — override manual dengan `arrival:override`, `version`, `reason`, evidence note, dan audit; hasil otomatis tetap tersimpan.
- `GET /api/v1/exceptions` dan `GET /api/v1/exceptions/:id` — daftar/detail exception ter-scope dengan riwayat; daftar mendukung filter status/severity/source/assignedToMe, pencarian, serta pagination `page`/`pageSize`.
- `GET /api/v1/exceptions/assignees` — daftar pengguna aktif yang dapat ditugaskan exception sesuai scope dan permission `exception:manage`.
- `POST /api/v1/exceptions` — buat exception (source, SPPG/trip, severity, dedupe key, due date).
- `POST /api/v1/exceptions/:id/{triage|assign|investigate|resolve|escalate|close}` — transisi dengan `version` + `reason`, audit, dan event.
- `POST /api/v1/trips/:id/delivery/start` — mulai serah-terima setelah kedatangan terverifikasi.
- `POST /api/v1/trips/:id/delivery` — submit jumlah diterima/rusak/kurang sebagai versi POD.
- `POST /api/v1/trips/:id/delivery/review` — menerima atau menolak selisih dengan alasan dan pemisahan reviewer.
- `POST /api/v1/trips/:id/delivery/proofs` — unggah bukti POD multipart (`file`) ke object storage privat; JPEG/PNG/WebP/PDF maksimal 10 MB, hash SHA-256, deduplikasi per record.
- `GET /api/v1/trips/:id/delivery/proofs` dan `GET /api/v1/trips/:id/delivery/proofs/:proofId/url` — metadata bukti dan signed URL 5 menit dengan otorisasi scope.
- `POST /api/v1/trips/:id/complete` — menyelesaikan trip hanya setelah rekonsiliasi diterima.
- `GET|POST|PATCH /api/v1/admin/organizations`, `/regions`, `/sppg`, `/delivery-locations`, `/vehicles`, `/drivers` — master data dengan scope, filter `organizationId`/`regionId`/`sppgId`, dan audit; create/update memerlukan `reason`, read `master:read`, write `master:manage`. Update SPPG memerlukan `version`.
- `GET|POST /api/v1/admin/assignments` dan `PATCH /api/v1/admin/assignments/:id/end` — riwayat penugasan driver–kendaraan berbasis rentang waktu; bentrok ditolak.
- `GET /api/v1/admin/audit-logs` — audit read-only dengan pencarian, filter aksi/entitas/tanggal, pagination, identitas aktor, before/after, dan scope organisasi/wilayah/SPPG untuk SPPG, trip, exception, dan approval SPPG.
- `GET /api/v1/admin/users` dan `GET /api/v1/admin/roles` — daftar akun dan katalog role untuk administrasi berpermission.
- `POST /api/v1/admin/users/invitations`, `POST /api/v1/admin/users/:id/invitation-resend`, dan `POST /api/v1/admin/users/:id/password-reset` — token sekali pakai untuk aktivasi akun (48 jam) dan reset password (30 menit); token mentah hanya tampil satu kali kepada admin dan dikirim manual karena email belum terintegrasi.
- `PATCH /api/v1/admin/users/:id/status`, `POST /api/v1/admin/users/:id/revoke-sessions`, `POST /api/v1/admin/users/:id/roles`, dan `PATCH /api/v1/admin/users/:id/roles/revoke` — perubahan akun/role beralasan, diaudit, serta mencabut sesi saat status atau role berubah.
- `POST /api/v1/auth/mfa/enrollment` dan `/auth/mfa/enrollment/confirm` — enrollment TOTP mandiri; secret baru disimpan terenkripsi setelah kode valid dikonfirmasi.
- `POST /api/v1/auth/mfa/rotation` dan `/auth/mfa/rotation/confirm` — rotasi authenticator dengan verifikasi faktor lama, secret pending terenkripsi 10 menit, pencabutan seluruh sesi saat rotasi selesai, dan penerbitan ulang kode pemulihan.
- `POST /api/v1/auth/mfa/recovery` dan `/auth/mfa/recovery/confirm` — pemulihan MFA dengan token admin sekali pakai 30 menit, password pengguna, dan TOTP baru; pengguna harus login kembali setelahnya.
- Login menerima kode pemulihan MFA satu kali sebagai pengganti TOTP setelah password valid. Kode dibuat saat enrollment/rotasi/pemulihan, hanya hash disimpan dan hanya ditampilkan sekali.
- `POST /api/v1/admin/users/:id/mfa-reset` — reset MFA oleh admin lain yang memiliki `admin:manage_users` dan MFA aktif; butuh alasan, mencabut sesi, lalu token dikirim manual melalui kanal aman.
- `POST /api/v1/auth/account-access/consume` — menukar token undangan/reset satu kali dengan password baru minimal 14 karakter; reset mencabut semua sesi akun.

Seed katalog role/permission: `npm run db:seed-rbac` (idempoten, tanpa akun demo).

Cookie sesi bersifat HttpOnly. Hash password menggunakan Argon2id, sesi menyimpan hash token saja, dan login dibatasi per IP serta identitas. Role global atau role dengan `requiresMfa` wajib memiliki TOTP aktif; akun tanpa penugasan role tidak memperoleh permission.

Dashboard awal adalah prototype UI dalam satu aplikasi Next.js. Halaman login web memakai API auth, MFA challenge, CSRF, dan sesi cookie; dashboard meminta sesi tervalidasi sebelum ditampilkan. Backend memiliki health check, skema/migrasi untuk organisasi, wilayah, SPPG, pengguna, role/permission, sesi, approval, audit, kendaraan, pengemudi, tujuan, trip, GPS, geofence, QR, verifikasi kedatangan, POD, rekonsiliasi, dan bukti privat. State machine trip sudah tersedia sebagai domain function. Autentikasi tetap memerlukan database serta bootstrap akun awal. Trip API menerapkan permission, scope SPPG, optimistic versioning, idempotency, audit/event, validasi keberangkatan, GPS track ingestion, deteksi arrival multi-fix, token QR dinamis anti-replay, verifikasi kedatangan, submission/review POD, rekonsiliasi, gate completion, serta upload/akses bukti POD melalui object storage privat. Dashboard Control Tower memuat KPI, trip hari ini, exception aktif, dan posisi GPS terakhir langsung dari API dengan navigasi serta pemuatan data berbasis permission; `/exceptions` memuat daftar exception ter-scope dengan filter/pagination dan tindak lanjut, sedangkan `/trips` memuat daftar trip dengan filter status/pagination server dan form create draft yang memfilter SPPG serta memuat tujuan/kendaraan/pengemudi dari server sesuai SPPG terpilih, dan `/trips/[id]` menampilkan detail trip, timeline, rekonsiliasi POD, signed URL bukti, exception terkait, aksi transisi status, start delivery, submit/koreksi POD, review POD, completion, dan tindak lanjut exception dengan permission gate serta konfirmasi. Peta memakai MapLibre dengan fallback raster OSM untuk development. Worker exception dapat membuat alert otomatis dengan cooldown dan audit aktor sistem. Provider peta produksi, audit explorer, sinkronisasi offline PWA, dan realtime masih tahap berikutnya. Driver Console `/driver` menyediakan tugas milik pengemudi, start trip dengan GPS, pengiriman posisi berkala, verifikasi QR (pindai kamera dengan fallback tempel token), POD, dan unggah bukti; indikator online/offline menonaktifkan aksi server saat tanpa koneksi; service worker production menyajikan fallback `/offline.html`, sedangkan antrean aksi offline dan tracking background belum tersedia. Upload POD serta alert worker belum diuji terhadap MinIO/DB hidup di lingkungan ini.

## Prinsip produk yang harus dipertahankan

- Kedatangan terdeteksi, kedatangan terverifikasi, dan penyaluran selesai merupakan status berbeda.
- Server menjadi sumber otoritatif untuk izin, verifikasi, serta transisi perjalanan.
- Data stale/offline tidak boleh ditampilkan seolah-olah live atau menjadi bukti pelanggaran.
- Aksi sensitif mengikuti Model B: approval terpisah, tanpa self-approval, dengan audit.
- PWA tidak menjanjikan tracking GPS berkelanjutan saat tab ditutup atau layar terkunci.
- Dashboard tidak memakai fixture KPI/trip/exception. Marker peta berasal dari posisi GPS terakhir; set `NEXT_PUBLIC_MAP_STYLE_URL` untuk provider produksi, jika tidak memakai raster OSM development.

## Keputusan produk yang masih perlu dikonfirmasi

Sebelum produksi, tetapkan metode MFA dan approver, matriks aksi sensitif, ambang GPS/geofence/ETA, provider peta, SOP kondisi offline, retensi data, kapasitas operasional, serta target RPO/RTO sesuai PRD.
