# RADAR MBG Field App - Implementation Todo

Berdasarkan spec: RADAR_MBG_Field_App_Implementation_Spec.md

## Phase 0 — Audit repository dan desain final
- [ ] Audit framework, folder, schema/migration, tenant context/guard, auth/session, role/permission
- [ ] Audit SPPG, driver, vehicle, trip, geofence, notification, storage, audit, queue, PWA
- [ ] Buat FIELD_APP_CURRENT_STATE_AUDIT.md
- [ ] Buat FIELD_APP_API_GAP_ANALYSIS.md
- [ ] Buat FIELD_APP_IMPLEMENTATION_PLAN.md
- Exit: desain cocok dengan repository, gap diketahui, migration dan rollback disetujui

## Phase 1 — Data foundation dan authorization
- [ ] recipient organization/site
- [ ] recipient membership
- [ ] delivery stop
- [ ] assignment
- [ ] constraint/index
- [ ] tenant dan recipient authorization
- [ ] audit event
- Tests: SPPG A != SPPG B, Driver A != trip Driver B, Recipient Site A != stop/POD Site B, assignment invalid ditolak

## Phase 2 — Trip assignment dan Driver workspace
- [ ] Driver/kendaraan dari tenant
- [ ] Pembuatan trip dan stop
- [ ] Assignment
- [ ] Driver melihat tugas
- [ ] Accept/start/complete
- [ ] Status stop
- Integration tests

## Phase 3 — GPS dan geofence
- [ ] GPS lifecycle client
- [ ] Location ingestion
- [ ] Validasi assignment/payload
- [ ] Location event storage
- [ ] Geofence candidate/confirmed
- [ ] Deduplication dan audit

## Phase 4 — Notification
- [ ] Notification event
- [ ] Recipient targeting berdasarkan membership
- [ ] In-app notification
- [ ] Push jika tersedia
- [ ] Delivery status, retry, deduplication

## Phase 5 — POD dan Recipient workspace
- [ ] Form POD Driver
- [ ] Private upload
- [ ] Daftar pengiriman Penerima
- [ ] Detail POD
- [ ] Confirm/report issue
- [ ] Audit dan state transition

## Phase 6 — Monitoring, offline, hardening
- [ ] Dashboard per role
- [ ] Offline queue
- [ ] Retry/idempotency
- [ ] Queue/GPS monitoring
- [ ] Load/security tests
- [ ] Backup/restore dan runbook

## Phase 7 — Evaluasi Android native
- [ ] Hanya jika pilot membuktikan background tracking tidak dapat diandalkan melalui PWA
- [ ] Gunakan API yang sama

## Alur target
SPPG → Driver → Kendaraan → Trip → Delivery Stop → GPS → Geofence Arrival → Notifikasi Penerima → POD → Konfirmasi Penerimaan → Monitoring Platform

Prioritas pertama: memastikan relasi data dan authorization benar.