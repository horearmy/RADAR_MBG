# RADAR MBG Field App — UI/UX Todo (berdasarkan spec UI)

## Phase 0 — Audit UI
- [ ] Audit layout, design tokens, components, auth/role routing, API client, PWA
- [ ] Buat FIELD_APP_UI_CURRENT_STATE_AUDIT.md
- [ ] Buat FIELD_APP_UI_ROUTE_MAP.md
- [ ] Buat FIELD_APP_UI_IMPLEMENTATION_PLAN.md

## Phase 1 — Shell & Login
- [x] Field App shell (header, bottom nav)
- [ ] Login page (show/hide password, loading/error/rate-limit)
- [ ] Role/workspace resolution dari server
- [x] Shared loading/empty/error states
- [ ] Mobile responsive

## Phase 2 — Driver
- [x] Home (tugas aktif, KPI)
- [x] Daftar tugas + filter/search/sort/pagination
- [x] Detail trip modal
- [x] POD form + preview foto
- [x] Mulai/Selesai trip buttons
- [x] Detail stop timeline
- [x] GPS permission/state banner
- [x] Tracking indicator (aktif/stale/offline)
- [x] Riwayat (full)
- [x] Profil Driver
- [x] Status labels sesuai spec (bukan enum mentah)

## Phase 3 — Penerima
- [x] Workspace Penerima (KPI, daftar, modal)
- [x] Terima/laporan masalah button
- [x] Home penerima (pengiriman hari ini, ETA)
- [x] Daftar pengiriman + filter
- [x] Detail pengiriman + riwayat status
- [x] Notifikasi list + deep link
- [x] Verifikasi POD (confirm/report issue lengkap)
- [x] Riwayat penerimaan
- [x] Profil penerima

## Phase 4 — Integrasi & Polish
- [ ] API integration (ganti dummy data)
- [x] Offline/sync banner + last sync
- [ ] Responsive QA (360, 390, 768, 1440)
- [ ] Accessibility (kontras, focus, label)
- [ ] PWA install/offline cache
- [ ] Security/permission UI review
- [ ] Visual QA checklist

## Komponen reusable (target)
- [ ] FieldAppShell, Header, BottomNav
- [ ] StatusBadge (label + ikon)
- [ ] TripCard, StopTimeline
- [ ] LocationPermissionBanner, GpsTrackingIndicator
- [ ] OfflineSyncBanner, NotificationItem
- [ ] PodSummaryCard, PhotoUploadField
- [x] ConfirmActionSheet, EmptyState, ErrorState, LoadingSkeleton, RetryPanel