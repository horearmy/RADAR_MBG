# Cutover & Rollback (Opsional)

## Cutover
- Backup DB + storage final.
- Final reconciliation (counts).
- Enable tenant enforcement via feature flag.
- Aktifkan UI baru.
- Monitor errors/access denied/anomalies.

## Rollback
- Nonaktifkan fitur baru via feature flag.
- Restore DB/storage dari backup tervalidasi bila perlu.
- Rekonsiliasi data setelah pemulihan.
- Dokumentasikan insiden & RCA.
