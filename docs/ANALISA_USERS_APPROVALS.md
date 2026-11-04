# Usulan Penyederhanaan Administrasi Akun & Persetujuan

**Proyek:** RADAR MBG
**Tanggal:** 4 November 2026
**Halaman:** `/users` dan `/approvals`
**Tujuan:** membuat alur mudah dipahami dan terlihat profesional, sekaligus menetapkan perbaikan keamanan serta perilaku sistem yang wajib.

> Ini adalah usulan alur dan UI/UX, bukan implementasi. Perubahan visual belum dilakukan. Pekerjaan keamanan backend harus dilakukan sebelum halaman administrasi digunakan lintas tenant.

---

## 1. Ringkasan untuk Pengambil Keputusan

Masalah utama kedua halaman bukan kekurangan fitur, tetapi banyaknya tindakan yang tampil sekaligus, istilah teknis, serta kurang jelasnya hubungan antara tindakan dan dampaknya.

Usulan sederhananya:

1. **`/users` menjadi tempat mengelola satu akun pada satu waktu.** Admin mencari akun, membuka detail, lalu memilih tindakan yang sesuai.
2. **`/approvals` menjadi antrean keputusan.** Approver membuka permintaan, membandingkan perubahan, lalu menyetujui atau menolak dengan alasan.
3. **Aksi penting selalu menyebut target dan dampak sebelum dikirim.** Contoh: “Cabut semua sesi milik Budi? Budi akan diminta masuk kembali.”
4. **UI hanya menawarkan data dalam kewenangan pengguna.** Scope/tenant wajib dibatasi di server, bukan sekadar disembunyikan di browser.
5. **Gunakan bahasa operasional.** UUID, kode error, dan istilah internal tidak ditampilkan sebagai informasi utama.

### Yang perlu didahulukan

| Urutan | Pekerjaan | Alasan |
|---|---|---|
| 0 | Batasi akses data dan tindakan akun per tenant/scope di backend | Ada risiko akun lintas tenant terlihat dan dapat terkena tindakan admin tenant |
| 1 | Rapikan alur akun dan cegah target assignment yang salah | Dampaknya dapat berupa role atau sesi akun yang keliru |
| 2 | Betulkan alur penolakan stale dan scope tenant di persetujuan | Keputusan bisa tidak tercatat sesuai niat; tenant admin tidak memperoleh daftar SPPG |
| 3 | Sederhanakan penyajian, pencarian, konfirmasi, serta pesan | Mengurangi kebingungan dan kesalahan pengguna |

---

## 2. Prinsip Desain

- **Satu halaman, satu tujuan utama.** Akun = mengelola akses; Persetujuan = meninjau permintaan.
- **Tampilkan tindakan sesuai konteks.** Jangan menaruh semua tindakan berisiko dengan bobot visual yang sama.
- **Tampilkan nama, bukan ID teknis.** Nama akun, role, organisasi, wilayah, dan SPPG harus bisa dikenali manusia.
- **Tunjukkan status dan langkah berikutnya.** Hindari pesan umum seperti “gagal”; jelaskan apa yang perlu dilakukan.
- **Konfirmasi berdasarkan dampak.** Tindakan berisiko perlu menyebutkan siapa/apa yang terdampak.
- **Akses ditentukan server.** UI boleh membantu menyaring pilihan, tetapi tidak boleh menjadi batas keamanan.
- **Konsisten.** Tombol setujui/tolak sama-sama jelas, alasan tercatat, dan hasil tindakan terlihat.

---

## 3. Usulan Alur `/users` — Administrasi Akun

### Tujuan halaman

Admin dapat menemukan akun, memahami status dan aksesnya, lalu melakukan tindakan yang benar tanpa perlu memahami UUID atau detail implementasi RBAC.

### Alur utama

```text
Daftar akun
  ├─ Cari/filter akun
  ├─ Undang pengguna baru
  └─ Pilih akun
       └─ Tinjau identitas, status, MFA, dan akses
            ├─ Ubah status
            ├─ Atur role dan scope
            ├─ Pulihkan akses (undangan/reset password/reset MFA)
            └─ Cabut sesi
```

### Bagian yang disarankan

1. **Daftar akun**
   - Kolom/isi ringkas: nama, username/email, status, role utama, scope, MFA, login terakhir.
   - Pencarian dan filter status berlaku terhadap seluruh hasil server, bukan hanya halaman yang sedang terlihat.
   - Tampilkan jumlah hasil yang konsisten dengan filter aktif.
   - Tombol utama: **Undang pengguna**.

2. **Detail akun**
   - Identitas dan status diletakkan paling atas.
   - Role dan scope ditulis sebagai nama yang mudah dikenali, bukan UUID.
   - Tindakan dikelompokkan berdasarkan tujuan:
     - **Akses & status:** ubah status, cabut sesi.
     - **Pemulihan akun:** reset password, reset MFA, kirim ulang undangan.
     - **Peran & cakupan:** tetapkan atau cabut role.
   - Tindakan yang tidak berlaku untuk akun tersebut tidak ditawarkan.

3. **Undang pengguna**
   - Langkah 1: isi username, nama tampilan, dan email bila diperlukan.
   - Langkah 2: tinjau ringkasan akun yang akan dibuat.
   - Langkah 3: buat undangan dan tampilkan token sekali pakai.
   - Setelah token dibuat, jelaskan masa berlaku dan instruksi pengiriman melalui kanal aman.

4. **Atur role dan scope**
   - Pilih akun yang jelas (nama + username), role, lalu scope yang relevan.
   - Jika role berlaku untuk SPPG, pilih nama/kode SPPG; jangan minta admin mengetik UUID.
   - Sebelum menyimpan, ringkas: **“Akun X akan mendapat role Y pada scope Z.”**
   - Jangan mempertahankan target tersembunyi ketika daftar akun atau halaman berubah.

### Contoh konfirmasi

| Aksi | Konfirmasi yang disarankan |
|---|---|
| Menangguhkan akun | “Tangguhkan akun **Budi Santoso**? Semua sesi aktifnya akan dicabut.” |
| Mencabut sesi | “Cabut semua sesi **Budi Santoso**? Ia harus masuk kembali di semua perangkat.” |
| Reset password | “Terbitkan token reset untuk **Budi Santoso**? Token sebelumnya yang belum digunakan akan tidak berlaku.” |
| Reset MFA | “Reset MFA **Budi Santoso**? Ia perlu mendaftarkan MFA kembali. Sesi aktif akan dicabut.” |
| Cabut role | “Cabut role **Admin SPPG** dari **Budi Santoso** pada **SPPG Cakung**?” |

### Keadaan yang wajib dirancang

- **Berhasil:** tampilkan hasil spesifik dan data terbaru.
- **Gagal validasi:** tunjukkan field dan cara memperbaikinya.
- **Tidak berizin:** jelaskan bahwa admin tidak memiliki kewenangan; jangan tampilkan data target yang tak boleh diakses.
- **Akun tidak ditemukan/tidak lagi dalam scope:** minta admin memuat ulang daftar.
- **Token tidak dapat disalin:** berikan status yang jelas, tanpa mencatat token ke log.
- **Daftar kosong:** bedakan “belum ada akun” dari “tidak ada akun yang cocok dengan pencarian”.

---

## 4. Usulan Alur `/approvals` — Persetujuan

### Tujuan halaman

Approver dapat melihat permintaan yang memerlukan keputusan, memahami perubahan dan alasannya, lalu menyetujui atau menolak dengan jejak keputusan yang jelas.

### Alur approver

```text
Inbox: permintaan menunggu
  └─ Buka detail
       ├─ Periksa SPPG dan status saat ini
       ├─ Periksa status yang diminta dan alasan pemohon
       ├─ Tulis catatan keputusan
       └─ Pilih Setujui atau Tolak
            └─ Konfirmasi keputusan
                 └─ Lihat hasil dan status terbaru
```

### Alur pengaju

```text
Ajukan perubahan
  └─ Pilih SPPG dalam kewenangan
  └─ Pilih status tujuan
  └─ Isi alasan
  └─ Tinjau ringkasan lalu kirim
       └─ Pantau pada “Permintaan saya”
```

### Bagian yang disarankan

1. **Inbox approver**
   - Tampilkan permintaan yang perlu tindakan saja.
   - Informasi ringkas: SPPG, status sekarang → status tujuan, pemohon, waktu pengajuan, umur permintaan.
   - Pencarian/filter harus berlaku pada seluruh hasil server.
   - Jumlah inbox harus memakai total server, bukan jumlah baris yang kebetulan terlihat.

2. **Detail permintaan**
   - Urutkan informasi sesuai keputusan: target → perubahan → alasan → riwayat.
   - Sorot dengan jelas status awal dan status tujuan.
   - Jika objek sudah berubah sejak pengajuan, jelaskan bahwa persetujuan tidak dapat dijalankan dan minta pengajuan baru.
   - Permintaan sendiri tidak dapat diputuskan oleh pengaju; tampilkan penjelasan, bukan tombol keputusan.

3. **Keputusan**
   - Minta catatan yang bermakna untuk persetujuan maupun penolakan.
   - Konfirmasi kedua keputusan dengan bobot setara.
   - Sebelum mengonfirmasi, sebutkan target, status tujuan, serta dampaknya.
   - Sesudah berhasil, tampilkan apakah permintaan disetujui dan dijalankan, ditolak, atau tidak dapat dijalankan karena data berubah.

4. **Permintaan saya**
   - Beri filter status dan pencarian server-side.
   - Tampilkan status, tanggal, dan catatan keputusan terakhir.
   - Angka ringkasan harus total sesuai status di seluruh data; jika hanya hitungan halaman, beri label eksplisit “di halaman ini”.

### Contoh konfirmasi

- **Setujui:** “Setujui perubahan status **SPPG Cakung** dari **Aktif** menjadi **Ditangguhkan**? Status SPPG akan berubah setelah keputusan ini.”
- **Tolak:** “Tolak permintaan perubahan status **SPPG Cakung**? Status SPPG tidak akan berubah. Keputusan ini akan tercatat.”
- **Data berubah:** “Permintaan ini dibuat berdasarkan data lama. Muat ulang detail dan minta pemohon mengajukan ulang bila perubahan masih diperlukan.”

---

## 5. Prioritas Implementasi

### P0 — keamanan dan kebenaran tindakan

1. **Batasi semua akses `/admin/users` berdasarkan tenant/scope** di backend, termasuk baca, perubahan status, reset, pencabutan sesi, assignment, dan revoke role.
2. **Perbaiki target assignment role** agar selalu cocok dengan akun yang terlihat dan divalidasi server.
3. **Perbaiki keputusan stale**: penolakan tetap dicatat sebagai penolakan; pemeriksaan stale mencegah eksekusi persetujuan, bukan mengubah niat menolak menjadi gagal.
4. **Satukan resolver scope** untuk `UserRole` dan `TenantMembership`; halaman tidak boleh memperlihatkan tindakan yang izin server-nya berbeda.

### P1 — kejelasan dan konsistensi proses

5. Ganti input UUID scope dengan opsi bernama yang sudah difilter berdasarkan kewenangan.
6. Tambahkan konfirmasi dampak untuk aksi destruktif di `/users` dan kedua keputusan di `/approvals`.
7. Pindahkan pencarian/filter approval ke server; hitung ringkasan berdasarkan seluruh data.
8. Validasi alasan agar tidak bisa hanya berisi spasi.
9. Saat versi data konflik, muat ulang data SPPG dan jelaskan tindakan berikutnya.
10. Tangani konflik transaksi bersamaan dengan pesan yang bisa dipahami, bukan error umum.

### P2 — polesan profesional

11. Ganti UUID di ringkasan role dengan nama scope.
12. Beri status salin token, rollback pilihan status jika penyimpanan gagal, dan pulihkan halaman daftar yang kosong setelah perubahan data.
13. Jaga posisi halaman dan beri pemberitahuan jika drawer berubah/ditutup karena data dimuat ulang.
14. Selaraskan korelasi request serta idempotensi endpoint mutasi.

---

## 6. Lampiran Teknis — Temuan dari Analisa Kode

Bagian ini mempertahankan bukti teknis dari analisa awal agar dapat dipakai developer. Pengguna operasional tidak perlu memahami istilah di bawah untuk menjalankan alur yang diusulkan.

### 6.1 Administrasi akun (`/users`)

| ID | Tingkat | Temuan | Bukti / dampak singkat |
|---|---|---|---|
| U1 | **Tinggi** | Daftar akun tidak dibatasi tenant | `user-admin.service.ts:31-79` hanya memfilter status/pencarian. Uji lokal: `TENANT_ADMIN` mendapat HTTP 200 dan melihat `admin`/SUPERADMIN serta akun lain. Risiko kebocoran data lintas tenant. |
| U2 | **Tinggi** | Aksi akun tidak memeriksa scope target | Controller memberi gate izin; service `updateStatus`, `revokeSessions`, `createPasswordReset`, MFA reset, dan resend tidak memvalidasi tenant target. Risiko gangguan akun/pemulihan akses lintas tenant. |
| U3 | **Tinggi** | Target assignment dapat tertinggal dari daftar akun | `users/page.tsx` mempertahankan `assignUserId` lama saat halaman berganti; submit memakai ID itu. Validasi target diperlukan di frontend dan backend. |
| U4 | Sedang | Scope role meminta UUID mentah dan relasi hierarki tidak divalidasi | `users/page.tsx` menampilkan input UUID; service memeriksa keberadaan organisasi/region/SPPG, tidak kecocokan hierarkinya. |
| U5 | Sedang | Assignment scope tidak dibatasi ke scope aktor | Service membatasi assignment role global, tetapi tidak membatasi scope non-global ke kewenangan aktor. Dampak bergantung pada role yang diberi izin `admin:manage_roles`. |
| U6 | Sedang | Scope role tampil sebagai UUID | `users/page.tsx` menampilkan `sppgId`/`regionId`/`organizationId`; sulit diverifikasi manusia. |
| U7 | Sedang | Pemilih target hanya berisi akun halaman aktif | Opsi assignment berasal dari `users` halaman aktif (`PAGE_SIZE = 20`). |
| U8 | Sedang | Aksi sensitif tidak memiliki konfirmasi | Status, pencabutan sesi/role, reset password/MFA langsung mengirim mutasi setelah alasan diisi. |
| U9 | Rendah | Status pilihan tidak kembali saat update gagal | `statusValues` tetap menyimpan nilai pilihan walau request gagal, berbeda dengan status pada kartu. |
| U10 | Rendah | Halaman dapat kosong sesudah data berubah | `page` tidak dikoreksi ketika total halaman menyusut. |
| U11 | Rendah | Salin token tidak memberi status berhasil/gagal | `navigator.clipboard.writeText` tidak ditangani dengan `try/catch`. Token hanya ditampilkan satu kali; jangan pernah memasukkannya ke log. |
| U12 | Rendah | Tanggal tidak valid dapat menggagalkan render | `formatDate` tidak menangani tanggal invalid. |
| U13 | Rendah | `idempotency-key` frontend tidak digunakan controller admin akun | Double-submit token bisa menginvalidasi token yang sebelumnya baru diterbitkan. |

### 6.2 Persetujuan (`/approvals`)

| ID | Tingkat | Temuan | Bukti / dampak singkat |
|---|---|---|---|
| A1 | Sedang | Pencarian/filter lokal hanya memproses halaman yang diambil | `visibleInbox`/`visibleMine` memfilter array halaman aktif; hasil di halaman berikutnya dapat tidak ditemukan. |
| A2 | Sedang | KPI setuju/tolak menghitung halaman aktif | `approvedCount`/`rejectedCount` berasal dari `mine`; total kartu lain memakai pagination seluruh data. |
| A3 | Sedang | Penolakan atas objek stale menghasilkan `FAILED` | `approval.service.ts` memeriksa stale sebelum percabangan keputusan. Penolakan seharusnya dicatat sebagai penolakan tanpa mengeksekusi perubahan. |
| A4 | Sedang | Alasan boleh berisi spasi saja | DTO approval hanya memakai `@Length`; service melakukan `trim()`. |
| A5 | Sedang | Konflik versi tidak memuat ulang data SPPG | Error 409 ditampilkan, tetapi versi pada pilihan tetap lama sampai pengguna memuat ulang. |
| A6 | Sedang | Scope approval mengabaikan `TenantMembership` | `scopedSppgWhere` hanya melihat `principal.roles`. Uji lokal `TENANT_ADMIN`: `eligible-sppgs` kosong padahal tenant punya `DEMO-SPPG`. |
| A7 | Rendah | Scope diubah menjadi daftar semua ID lalu `IN` | Query membawa daftar scope SPPG yang dapat membesar sesuai jumlah data. |
| A8 | Sedang | Transaksi serializable tidak memiliki retry khusus | Konflik konkurensi dapat menjadi error umum; perlu retry terbatas dan error domain yang jelas. |
| A9 | Rendah | Tombol tolak langsung final, setuju memakai konfirmasi | Dua keputusan final mendapat perlakuan berbeda. |
| A10 | Rendah | Keputusan mengembalikan inbox ke halaman pertama | `setInboxPage(1)` setelah keputusan mengganggu peninjauan halaman lain. |
| A11 | Rendah | Drawer dapat hilang saat data dimuat ulang tanpa penjelasan | `activeRequest` hanya dicari dari halaman inbox/mine yang sedang dimuat. |
| A12 | Rendah | Idempotency dan korelasi request tidak konsisten | Frontend mengirim `idempotency-key`; controller approval tidak membacanya. `x-request-id` juga bukan header yang digunakan helper mutasi. |
| A13 | Rendah | Pesan `FAILED` tidak membedakan keputusan | Toast mengasumsikan gagal eksekusi karena data berubah, termasuk bila aksi yang diminta adalah penolakan. |

### 6.3 Temuan lintas halaman

- Ada dua model scope: `UserRole` (organisasi/wilayah/SPPG) dan `TenantMembership` (role tenant). Permission guard mengenali role tenant, tetapi beberapa service membangun scope hanya dari `UserRole`.
- Hasil runtime menunjukkan ketidakselarasan: tenant admin bisa melihat daftar global `/admin/users`, tetapi tidak memperoleh SPPG pada `/approvals`.
- Ketiadaan sesi menghasilkan 401; ini konsisten dengan frontend yang mengarahkan pengguna ke login.
- Audit tersedia pada aksi utama. Perlu mempertahankan jejak alasan, aktor, target, dan hasil ketika menyederhanakan alur.

### 6.4 Matriks akses yang diperiksa

| Role | Kelola akun | Kelola role | Ajukan perubahan | Review approval | MFA |
|---|---:|---:|---:|---:|---|
| `SUPERADMIN` (global) | Ya | Ya | Ya | Ya | Wajib |
| `TENANT_ADMIN` | Ya (izin tenant) | Tidak | Ya | Tidak | Bergantung konfigurasi akun |
| `APPROVER` (scope) | Tidak | Tidak | Tidak | Ya | Wajib |
| `SPPG_ADMIN` (scope) | Tidak | Tidak | Ya | Tidak | Tidak |

> Izin tidak otomatis berarti data target boleh diakses. Seluruh endpoint tetap harus memverifikasi scope target di backend.

---

## 7. Skenario Penerimaan

Saran dianggap berhasil bila skenario berikut terpenuhi:

### Administrasi akun

- Admin tenant hanya melihat dan mengubah akun tenant yang menjadi kewenangannya; mencoba ID tenant lain ditolak server.
- Berpindah halaman tidak dapat membuat assignment terkirim ke akun yang tidak terlihat/terpilih.
- Admin dapat membedakan nama role dan scope tanpa membaca UUID.
- Aksi sensitif menjelaskan target dan dampak sebelum dikonfirmasi.
- Jika aksi gagal, status dan pilihan di layar kembali konsisten dengan data server.
- Token sekali pakai dapat disalin dengan umpan balik; token tidak masuk log.

### Persetujuan

- Approver dapat mencari permintaan di luar halaman aktif dan memahami total hasil.
- Pemohon tidak dapat memutuskan permintaannya sendiri.
- Penolakan atas objek stale tercatat sebagai penolakan dan tidak mengubah status SPPG.
- Persetujuan atas objek stale tidak mengeksekusi perubahan dan memberi langkah berikutnya.
- Tenant admin hanya melihat SPPG yang berada dalam tenant/scope-nya.
- KPI menunjukkan total seluruh data atau diberi label jelas bila hanya menghitung halaman aktif.

---

## 8. Berkas yang Menjadi Dasar Analisa

**Frontend:** `src/app/users/page.tsx`, `src/app/approvals/page.tsx`, layout terkait, `src/lib/api.ts`.
**Backend:** controller, service, DTO, policy untuk user admin dan approval; `api/src/auth/permissions.ts`, `permission.guard.ts`, `session.guard.ts`, `tenant-context.resolver.ts`.
**Data/RBAC:** `api/prisma/schema.prisma`, `api/prisma/rbac-catalog.ts`, `api/prisma/seed-rbac.ts`.
**Verifikasi runtime sebelumnya:** halaman lokal dan endpoint API lokal; sesi pengujian sementara telah dicabut dan file probe dihapus.

---

## 9. TODO Implementasi — Satu Halaman Manajemen Pengguna

Daftar kerja ini mengikuti keputusan: **satu URL dengan tab, visibilitas berdasarkan izin, backend tetap menjadi pengendali akses, dan alur bisnis/API masing-masing tetap dipertahankan.** Belum ada pekerjaan dalam daftar ini yang dianggap selesai sebelum implementasi dan verifikasi dilakukan.

### Batasan dan keputusan yang tidak boleh berubah

- [ ] Gunakan satu URL kanonis, disarankan `/user-management`, dengan nama halaman **Manajemen Pengguna**.
- [ ] Sediakan tab **Akun** dan **Persetujuan**; jangan menampilkan semua form sekaligus.
- [ ] Pengguna hanya melihat tab/tindakan yang diizinkan. Pengguna tanpa izin ke kedua tab mendapat tampilan akses terbatas.
- [ ] Jangan menghapus atau melemahkan guard/permission backend saat menggabungkan UI.
- [ ] Pertahankan endpoint, aturan bisnis, jejak audit, dan pencegahan self-review yang sudah ada; ubah hanya bila diperlukan untuk memperbaiki scope/keamanan.
- [ ] Jangan menganggap filter UI sebagai kontrol keamanan. Semua pembatasan tenant dan scope harus diverifikasi server pada setiap request.
- [ ] Jangan mengubah halaman lain atau melakukan redesign di luar kebutuhan konsolidasi ini.

### Fase 0 — Baseline dan kontrak

- [ ] Catat status Git sebelum mulai; jangan menimpa perubahan kerja yang sudah ada.
- [ ] Periksa panduan Next.js yang terpasang di `node_modules/next/dist/docs/` sebelum mengubah routing/layout/API sesuai aturan repository.
- [ ] Petakan permission aktual untuk masing-masing tab dan tindakan dari backend; gunakan permission tersebut sebagai sumber kebenaran.
- [ ] Konfirmasi pola URL lama: tentukan apakah `/users` dan `/approvals` akan redirect ke tab yang sesuai atau tetap menjadi alias kompatibilitas.
- [ ] Tetapkan perilaku tab via query parameter, mis. `/user-management?tab=accounts` dan `/user-management?tab=approvals`, agar refresh/deep link mempertahankan tab.

**Kriteria selesai fase:** matriks izin, URL kanonis, serta kebijakan alias lama ditetapkan sebelum pekerjaan UI dimulai.

### Fase 1 — Perbaikan keamanan backend (wajib sebelum rilis)

- [ ] Buat satu resolver scope yang konsisten untuk aktor global, `UserRole` (organisasi/wilayah/SPPG), dan `TenantMembership`.
- [ ] Batasi `GET /admin/users` berdasarkan scope aktor; pengguna non-global tidak boleh menerima akun di luar kewenangannya.
- [ ] Terapkan pemeriksaan scope target pada semua mutasi akun: status, pencabutan sesi, reset password, reset MFA, undangan ulang, assignment role, dan revoke role.
- [ ] Pastikan pemeriksaan dilakukan pada objek target yang sebenarnya di backend; jangan hanya percaya ID dari frontend.
- [ ] Batasi `GET /admin/roles` dan assignment/revoke role sesuai kewenangan yang memang dimaksudkan; jangan memberi izin `admin:manage_roles` hanya demi membuat tab bekerja.
- [ ] Validasi hierarki scope: organisasi, wilayah, dan SPPG harus saling konsisten bila dikirim bersama.
- [ ] Batasi assignment role non-global agar aktor hanya dapat menetapkan role dalam scope yang boleh dikelolanya.
- [ ] Gunakan sumber scope yang sama untuk inbox, permintaan saya, daftar SPPG, serta keputusan approval; pastikan `TenantMembership` dipetakan ke SPPG/tenant yang benar.
- [ ] Pastikan ID di luar scope ditolak tanpa membocorkan keberadaan data target.
- [ ] Tambahkan/ubah tes policy dan service untuk akses global, akses tenant sendiri, akses scope sendiri, target lintas tenant, dan tanpa scope.

**Kriteria selesai fase:** tes otomatis membuktikan akun dan SPPG lintas scope tidak dapat dibaca maupun dimutasi oleh aktor yang tidak berwenang.

### Fase 2 — Perbaikan kebenaran alur backend

- [ ] Perbaiki keputusan approval stale: keputusan `REJECTED` tercatat sebagai penolakan dan tidak mengubah objek; pemeriksaan versi stale hanya menghalangi eksekusi `APPROVED`.
- [ ] Pastikan transaksi approval konkurens menghasilkan respons konflik yang terkontrol, bukan error server mentah; tambahkan retry terbatas bila sesuai.
- [ ] Tolak alasan yang hanya berisi spasi pada DTO request dan decision.
- [ ] Saat versi SPPG konflik, sediakan respons/kode yang konsisten agar frontend dapat memuat ulang pilihan SPPG.
- [ ] Pertahankan satu rekam audit untuk tindakan/keputusan, dengan aktor, target, alasan, hasil, dan request ID.
- [ ] Pastikan mutasi yang menerbitkan token tidak menampilkan token lama yang sudah tidak berlaku setelah double-submit.

**Kriteria selesai fase:** tes unit/integrasi mencakup keputusan stale, self-review, double-submit yang relevan, alasan kosong, serta konflik transaksi.

### Fase 3 — Konsolidasi UI menjadi satu URL

- [ ] Buat route `/user-management` dan jadikan **Manajemen Pengguna** sebagai judul/nama navigasi.
- [ ] Pindahkan pengalaman `/users` ke tab **Akun** tanpa mengubah fitur bisnis undangan, status, role, scope, token, dan sesi.
- [ ] Pindahkan pengalaman `/approvals` ke tab **Persetujuan** tanpa mengubah alur pengajuan, inbox, keputusan, histori, dan audit.
- [ ] Tampilkan tab Akun hanya bila izin kelola akun tersedia; tampilkan tab Persetujuan bila pengguna memiliki izin review dan/atau mengajukan sesuai kapabilitasnya.
- [ ] Bila pengguna hanya memiliki salah satu izin, buka tab yang diizinkan secara otomatis.
- [ ] Bila pengguna memiliki kedua izin, pilih tab default yang konsisten dan mudah dipahami; pertahankan pilihan tab pada query parameter.
- [ ] Bila pengguna tidak memiliki izin ke kedua tab, tampilkan akses terbatas tanpa memanggil endpoint yang tidak diizinkan.
- [ ] Pastikan perubahan tab tidak mengirim mutasi, menghapus form yang belum dikirim tanpa peringatan, atau mengganti target akun/permintaan secara tidak sengaja.
- [ ] Perbarui sidebar/navigation dan breadcrumb agar mengarah ke URL kanonis.
- [ ] Pertahankan `/users` dan `/approvals` sebagai redirect/alias sesuai keputusan fase 0, termasuk membawa pengguna ke tab yang relevan.
- [ ] Hindari duplikasi implementasi halaman: gunakan komponen/tab bersama atau ekstraksi yang menjaga satu sumber perilaku untuk tiap alur.

**Kriteria selesai fase:** semua kombinasi permission membuka tab yang tepat; deep link, refresh, back/forward, dan alias URL berfungsi; backend tetap menolak request tanpa izin.

### Fase 4 — Penyederhanaan pengalaman penggunaan

- [ ] Pada tab Akun, prioritaskan pencarian/daftar akun dan satu tindakan utama **Undang pengguna**.
- [ ] Sajikan detail dan tindakan akun dalam kelompok yang jelas: status/sesi, pemulihan akses, dan role/scope.
- [ ] Ganti input UUID scope dengan pilihan bernama yang dibatasi hasil backend sesuai kewenangan.
- [ ] Pastikan target assignment selalu terlihat dan masih ada pada data yang dimuat; tambahkan validasi guard di frontend sebagai perlindungan tambahan.
- [ ] Tambahkan konfirmasi yang menyebut target dan dampak untuk tindakan berisiko, tanpa mengandalkan alasan sebagai satu-satunya pengaman.
- [ ] Pada tab Persetujuan, bedakan inbox approver dan permintaan saya dengan label yang jelas.
- [ ] Jadikan pencarian/filter approval server-side agar hasilnya mencakup semua halaman.
- [ ] Pastikan KPI berasal dari seluruh dataset; jika masih berupa hitungan halaman, beri label yang eksplisit.
- [ ] Beri konfirmasi setara untuk Setujui dan Tolak; pesan setelah tindakan harus menyebut hasil sebenarnya.
- [ ] Beri status berhasil/gagal yang spesifik untuk salin token, penyimpanan, muat ulang, konflik versi, dan konflik akses.
- [ ] Tampilkan nama role/scope, bukan UUID mentah, bila API menyediakan label yang aman.

**Kriteria selesai fase:** pengguna uji dapat menyelesaikan tugas rutin tanpa memahami UUID/RBAC, dan setiap aksi memberi umpan balik serta langkah berikutnya yang jelas.

### Fase 5 — Pengujian dan verifikasi rilis

- [ ] Jalankan typecheck frontend dan backend.
- [ ] Jalankan tes unit/policy/service yang relevan dan tes baru dari fase 1–2.
- [ ] Uji manual sebagai `SUPERADMIN`, `TENANT_ADMIN`, `APPROVER`, `SPPG_ADMIN`, dan pengguna tanpa izin.
- [ ] Uji akun tenant sendiri dan akun tenant lain untuk daftar serta setiap jenis mutasi akun.
- [ ] Uji SPPG dalam scope sendiri dan di luar scope untuk daftar pilihan, request, inbox, dan keputusan approval.
- [ ] Uji refresh, deep link tiap tab, navigasi back/forward, sesi berakhir, dan respons 401/403.
- [ ] Uji pencarian/filter pada data lintas halaman dan pastikan total/KPI akurat.
- [ ] Uji keputusan stale: REJECTED tetap tercatat sebagai REJECTED; APPROVED tidak mengeksekusi objek yang stale.
- [ ] Tinjau diff untuk memastikan tidak ada UI/route lain yang berubah tanpa kebutuhan.
- [ ] Perbarui dokumen ini dengan hasil tes, keputusan alias URL, dan keterbatasan yang masih tersisa.

**Kriteria rilis:** seluruh tes keamanan lintas tenant/scope lulus; alur tiap tab bekerja sesuai permission; typecheck dan tes wajib lulus; tidak ada endpoint yang hanya terlindungi oleh UI.

### Definisi selesai keseluruhan

- Satu halaman kanonis **Manajemen Pengguna** dengan tab Akun/Persetujuan dan URL yang dapat dibagikan.
- Pengguna hanya dapat melihat tab dan melakukan tindakan sesuai izin.
- Data dan mutasi selalu dibatasi tenant/scope oleh backend.
- Alur bisnis/API kedua modul tetap berfungsi, termasuk audit dan aturan self-review.
- Tidak ada target akun/scope tersembunyi atau UUID yang perlu diketik untuk alur normal.
- Uji lintas tenant, uji role, typecheck, dan tes terkait lulus.
