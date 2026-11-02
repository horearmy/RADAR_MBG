# RADAR MBG Field App — Todo Lengkap (berdasarkan spec)

## Phase 0 — Audit
- [ ] Read-only audit repo → FIELD_APP_CURRENT_STATE_AUDIT.md
- [ ] API gap analysis → FIELD_APP_API_GAP_ANALYSIS.md
- [ ] Implementation plan → FIELD_APP_IMPLEMENTATION_PLAN.md

## Phase 1 — Data foundation & authorization
- [ ] Audit entitas existing (recipient org/site/membership, delivery stop, assignment)
- [ ] Additive migration plan + index/constraint
- [ ] Tenant & recipient authorization rules
- [ ] Audit event model
- [ ] Tests: cross-tenant, cross-recipient, invalid assignment

## Phase 2 — Driver & trip
- [x] Driver workspace trip list
- [x] Trip detail
- [x] Start/complete trip (UI)
- [x] POD form (UI + upload)
- [ ] Accept/reject trip flow
- [ ] Status stop list
- [ ] Integration tests

## Phase 3 — GPS & geofence
- [ ] GPS lifecycle client (start only during trip)
- [ ] Location ingestion + validation
- [ ] Geofence candidate/confirmed
- [ ] Deduplication + audit
- [ ] Tests geofence distance/accuracy

## Phase 4 — Notification
- [ ] Notification event + targeting membership
- [ ] In-app notification
- [ ] Push if available
- [ ] Delivery status/retry/dedup
- [ ] Tests targeting

## Phase 5 — POD & Recipient
- [ ] Recipient workspace UI
- [ ] Connect confirm/report issue to reviewTripDelivery
- [ ] State transition server-side
- [ ] Audit + tests

## Phase 6 — Hardening/release
- [ ] Dashboard per role
- [ ] Offline queue + retry/idempotency
- [ ] GPS monitoring
- [ ] Security review (IDOR/BOLA, rate limit)
- [ ] Load tests
- [ ] Release checklist & runbook

## Frontend radarapp specific
- [x] KPI cards
- [x] Search/filter
- [x] Sort/pagination
- [x] Dark mode
- [x] Photo preview
- [x] Pull-to-refresh
- [x] POD validation
- [x] Offline draft POD
- [x] Browser notification permission
- [ ] Recipient confirm/report UI connected
- [ ] GPS indicator/tracking UI
- [ ] Map route view