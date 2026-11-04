# TODO: Refactor /approvals ke tampilan profesional

> Audit 31/10/2026. Versi lama menandai semua item `[x]` padahal wrapper masih
> ganda, topbar masih di dalam `content-area`, `.approval-page` (min-height
> 100vh) masih dipakai, KPI 4 kartu di grid 5 kolom, dan warna belum memakai
> token. Checklist ini menggantikan versi sebelumnya.

## Keputusan desain

- Inbox berbentuk **tabel + drawer review** (bukan textarea di setiap kartu).
- Form pengajuan jadi **panel collapsible** yang dibuka dari tombol header.
- KPI ke-4: **Total permintaan saya** (tanpa endpoint baru).
- **Frontend-only**; filter/pencarian berlaku pada halaman yang dimuat.

## Fase 0 — Struktur

- [x] `layout.tsx`: buang `content-area`, sisakan `app-shell` + sidebar + `main-column`.
- [x] `page.tsx`: hapus `div.approval-page` dan `div.content-area` ganda.
- [x] Pindahkan `topbar` (breadcrumb + akun) ke root halaman, di luar `content-area`.
- [x] Root halaman memakai `<main>` sebagai landmark.

## Fase 1 — Header & KPI

- [x] Header: eyebrow + judul + deskripsi + aksi (`Muat ulang`, `Ajukan perubahan`).
- [x] Simpan `pagination` inbox & mine ke state (tidak dibuang).
- [x] KPI 4 kartu (`kpi-grid kpi-grid-4`) di atas daftar: Menunggu review
      (`inbox.total`), Disetujui, Ditolak, Total permintaan saya (`mine.total`).
- [x] Hapus metrik "Total" yang menghitung ganda (`inbox + mine`).

## Fase 2 — Inbox approver

- [x] Tabel: SPPG, Perubahan (before → after), Pemohon, Diajukan + umur, Status, Aksi.
- [x] Badge status dengan ikon + teks: Menunggu, Disetujui, Ditolak, Gagal, Dijalankan.
- [x] Drawer review: konteks lengkap, alasan, riwayat keputusan, textarea + counter.
- [x] Konfirmasi dua langkah untuk "Setujui dan jalankan".
- [x] ESC/backdrop menutup drawer, fokus awal ke tombol tutup, focus trap, scroll body dikunci.
- [x] Pagination inbox (server-side).
- [x] Permintaan milik sendiri tidak menampilkan tombol keputusan
      (`APPROVAL_SELF_REVIEW_FORBIDDEN`).

## Fase 3 — Permintaan saya

- [x] Tabel ringkas + badge status yang sudah diterjemahkan (bukan enum mentah).
- [x] Filter status + pencarian kode/nama SPPG (berlaku pada halaman ini).
- [x] Pagination mine (server-side).
- [x] Empty state terpisah untuk "belum ada permintaan" dan "tidak ada hasil filter".

## Fase 4 — Polish & aksesibilitas

- [x] Tipografi: body 12–14px, metadata 10–12px (sebelumnya 8–10px).
- [x] Kontras teks sekunder memakai `--color-content-secondary` (#62728A).
- [x] Token warna (`#1677FF`, `#16A765`, `#EF4444`, `#DCE4EF`), radius 8–10px.
- [x] Toast sukses/gagal dengan auto-hide 5 detik + `role="status"`.
- [x] Tombol disabled disertai helper text alasan (minimal 3 karakter).
- [x] Responsif: tabel scroll horizontal, kolom sekunder disembunyikan <900px,
      drawer full-width di mobile, footer tombol menumpuk.

## Catatan teknis

- CSS baru memakai prefix `.apv-*` sehingga tidak bertabrakan dengan
  `.approval-*` lama yang masih dipakai `account-access`, `audit`, dan `geofence`.
- `.kpi-grid` global masih 5 kolom; halaman ini memakai `.kpi-grid-4`.
- Halaman tetap platform-only: pengguna tanpa `approval:review` **dan**
  `sppg:manage` melihat "Akses terbatas" (mis. akun tenant).

## Verifikasi

- [x] `npx tsc --noEmit` (frontend) lulus.
- [x] `GET /approvals` merespons 200 tanpa error overlay.
- [x] `GET /admin/approval-requests/inbox|mine|eligible-sppgs` 200 sebagai `admin`.
- [ ] Uji manual browser: ajukan → setujui (2 langkah) → toast → daftar ter-refresh.
- [ ] Uji manual browser: tolak dengan alasan < 3 karakter tetap disabled.
