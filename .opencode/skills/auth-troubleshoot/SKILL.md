---
name: auth-troubleshoot
description: Troubleshoot autentikasi RADAR MBG - "Autentikasi belum dapat memeriksa akun", PostgreSQL, migrasi, rate limit, session, dan koneksi API. Gunakan saat login gagal atau error autentikasi.
---

# Auth Troubleshoot Skill

## Gejala Umum
- "Autentikasi belum dapat memeriksa akun. Pastikan PostgreSQL aktif dan migrasi database sudah diterapkan."
- "Username atau kata sandi tidak valid."
- "Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba lagi."
- "Layanan login tidak dapat dijangkau. Periksa koneksi API lalu coba lagi."
- HTTP 401/403/500 pada /auth/login atau /auth/me

## Checklist Diagnosis

### 1. Backend API
```powershell
# Cek apakah API berjalan
Invoke-RestMethod -Uri 'http://localhost:4000/api/v1/health'
# Harus return: {"status":"ok",...}
```
Jika tidak berjalan:
```powershell
cd "C:\Users\st4th\Documents\RADAR MBG\api"
npm run start:dev
```

### 2. PostgreSQL
```powershell
# Cek koneksi database
$env:PGPASSWORD = "radar_local_only"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U radar_dev -d radar_mbg -h localhost -p 5432 -c "SELECT 1;"
```
Jika gagal:
- Pastikan service PostgreSQL berjalan
- Cek .env API: DATABASE_URL=postgresql://radar_dev:radar_local_only@localhost:5432/radar_mbg

### 3. Rate Limit
Rate limit login disimpan di tabel `login_rate_limits`. Jika terlalu banyak percobaan:
```powershell
# Clear rate limit
$env:PGPASSWORD = "radar_local_only"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U radar_dev -d radar_mbg -h localhost -p 5432 -c "DELETE FROM login_rate_limits;"
```

### 4. Akun User
```powershell
$env:PGPASSWORD = "radar_local_only"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U radar_dev -d radar_mbg -h localhost -p 5432 -c "SELECT username, status, mfa_enabled FROM users WHERE username = 'andi';"
```
- status harus ACTIVE
- Jika password salah, reset:
```powershell
# Generate hash (gunakan argon2 dari api/node_modules)
node -e "const a=require('C:/Users/st4th/Documents/RADAR MBG/api/node_modules/argon2'); (async()=>{console.log(await a.hash('DriverPass123!'))})()"
# Update DB
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U radar_dev -d radar_mbg -h localhost -p 5432 -c "UPDATE users SET password_hash = 'HASH' WHERE username = 'andi';"
```

### 5. Migrasi
```powershell
cd "C:\Users\st4th\Documents\RADAR MBG\api"
npx prisma migrate dev
# atau
npx prisma db push
```

### 6. Session Cookie
- Browser: DevTools → Application → Cookies → hapus semua cookie untuk localhost:3000 dan localhost:4000
- Hard refresh: Ctrl+Shift+R

### 7. CORS
Pastikan WEB_ORIGINS di .env API mencakup origin frontend:
```
WEB_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### 8. Verifikasi Login
```powershell
# Test login via PowerShell
$csrf = Invoke-RestMethod -Uri 'http://localhost:4000/api/v1/auth/csrf' -Method GET -SessionVariable session
$token = $csrf.csrfToken
$body = @{ username = 'andi'; password = 'DriverPass123!' } | ConvertTo-Json
$login = Invoke-RestMethod -Uri 'http://localhost:4000/api/v1/auth/login' -Method POST -WebSession $session -Headers @{ 'X-CSRF-Token' = $token; 'Origin' = 'http://localhost:3000' } -ContentType 'application/json' -Body $body
Write-Host ($login | ConvertTo-Json)
```

## Akun Testing
| Username | Password | Role | MFA |
|----------|----------|------|-----|
| andi | DriverPass123! | TENANT_DRIVER | Tidak |
| tenantadmin | TenantPass123! | TENANT_ADMIN | Tidak |
| admin | LzmtZSmeuBBEtZEhqoEYVPYK | SUPERADMIN | Ya (TOTP) |

## Troubleshooting Flow
1. Cek API health → jika down, start API
2. Cek PostgreSQL → jika down, start service
3. Cek rate limit → clear jika perlu
4. Cek akun status → reset password jika perlu
5. Cek migrasi → jalankan jika perlu
6. Clear browser cookies → hard refresh
7. Test login via PowerShell → jika berhasil, masalah di browser
8. Jika browser tetap gagal, cek CORS dan Origin header