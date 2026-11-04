# RADAR MBG - Troubleshooting Guide

## Aplikasi Tidak Bisa Dijalanakn (ERR_CONNECTION_REFUSED)

### 🔍 Penyebab dan Solusi

#### 1. Next.js Dev Server (Port 3000) Tidak Aktif
**Gejala:** `localhost menolak untuk terhubung`, `ERR_CONNECTION_REFUSED`

**Penyebab:**
- Server belum di-start
- Port 3000 di-occupy process lain
- Compilation error yang menyembunyikan error nyata

**Solusi:**
```cmd
# 1. Masuk ke direktori project
cd C:\Users\st4th\Documents\RADAR MBG

# 2. Jalankan dev server (toleransi timeout 30 detik)
npm run dev

# 3. Tunggu output: "✓ Ready in ~838ms"
# 4. Akses: http://localhost:3000/radarapp?tab=home

# 5. Jika gagal, cek error compilation dan perbaiki
```

#### 2. NestJS API Server (Port 4000) Tidak Aktif
**Gejala:** API endpoint tidak responsive, `404` atau `Connection Refused`

**Penyebab:**
- `.env` memiliki `PORT=4000` tapi server binding ke port lain
- PostgreSQL/S3 belum ready sebelum NestJS start
- Port 4000 sudah dipakai process lain

**Solusi:**
```cmd
# 1. Masuk ke direktori API
cd C:\Users\st4th\Documents\RADAR MBG\api

# 2. Start NestJS server
nest start --legacy-watch

# 3. Cek health endpoint
# http://localhost:4000/api/v1/health

# 4. Jika port conflict, ganti di .env
# PORT=4001 lalu restart
```

#### 3. Konflik Port Keduanya
**Gejala:** Keduanya bermasalah sekaligus

**Solusi:**
```cmd
# Cek port yang sedang dipakai
netstat -an | findstr "3000\|4000"

# Matikan process yang memakan port
taskkill /f /im "node.exe" 2>nul
timeout 2

# Restart keduanya
# 1. Frontend: cd radar-mbg && npm run dev
# 2. Backend:   cd api && nest start --legacy-watch
```

#### 4. Database/Service Belum Ready
**Gejala:** Server start tapi fitur tertentu error

**Penyebab:**
- PostgreSQL belum Running
- Minio/S3 belum start
- Migrasi database belum dijalankan

**Solusi:**
```cmd
# Pastikan PostgreSQL running
# Jalankan services docker jika ada
docker compose -f docker-compose.yml up -d db minio minio-init

# Atau migrasi manual
cd C:\Users\st4th\Documents\RADAR MBG\api
npm run db:migrate

# Cek konfigurasi S3 di .env
# S3_ENDPOINT=http://localhost:9000
# S3_BUCKET=radar-mbg-pod
```

#### 4. TypeScript/Bulid Error yang Menyembunyikan Server
**Gejala:** `npm run dev` berhenti di tengah jalan, tidak ada server

**Solusi:**
```cmd
# Pastikan typecheck lulus dulu
npm run typecheck  # Harus keluar tanpa error

# Lalu jalankan dev
npm run dev

# Atau build terlebih dahulu
npm run build  # di radar-mbg
npm run build  # di api
```

### 🛠️ Langkah Troubleshooting Terperinci

#### Langkah 1: Cek Kondisi Awal
```cmd
# Cek port 3000
cd C:\Users\st4th\Documents\RADAR MBG
echo "--- Port 3000 check ---"

# Cek port 4000  
cd C:\Users\st4th\Documents\RADAR MBG\api
echo "--- Port 4000 check ---"
```

#### Langkah 2: Bersihkan dan Mulai Ulang
```cmd
# Kill semua node processes di project ini
taskkill /f /im "node.exe" >nul 2>&1
timeout 3

# Bersihkan cache
cd C:\Users\st4th\Documents\RADAR MBG
rm -rf .next 2>nul
rm -rf node_modules/.cache 2>nul

cd C:\Users\st4th\Documents\RADAR MBG\api
rm -rf dist 2>nul

# Install ulang dependencies (jika perlu)
cd C:\Users\st4th\Documents\RADAR MBG
npm install --legacy-peer-deps

cd C:\Users\st4th\Documents\RADAR MBG\api
npm install --legacy-peer-deps
```

#### Langkah 3: Mulai Server Secara Urut
```cmd
# 1. Pertama: StartBackend API
cd C:\Users\st4th\Documents\RADAR MBG\api
nest start --legacy-watch &
# Wait for: "[Nest] ... Nest application successfully started"

# 2. Kedua: Start Frontend  
cd C:\Users\st4th\Documents\RADAR MBG
npm run dev
# Wait for: "✓ Ready in ~838ms"
```

#### Langkah 4: Verify Endpoints
```cmd
# Test frontend
curl -s http://localhost:3000/radarapp?tab=home
# Harus return HTML

# Test backend
curl -s http://localhost:4000/api/v1/health
# Harus return JSON status

# Test recipient API
curl -s http://localhost:4000/api/v1/recipient/me
# Harus return user profile (jika auth valid)
```

### 📊 Status Diagnostic

| Check | Expected | Actual | Action |
|-------|----------|--------|--------|
| `npm run typecheck` | 0 errors | 0 errors | ✅ Lulus |
| `nest start` | Server running port 4000 | Belum cek | Jalankan |
| `npm run dev` | Server running port 3000 | Partial (output ada) | Cek koneksi |
| `http://localhost:3000` | Aplikasi terbuka | Koneksi refused | Solusikan di bawah |
| `http://localhost:4000/api/v1/health` | JSON response | Connection refused | Start API |

### ⚡ Perintah Cepat Emergency

```cmd
# 1. Tutup semua
taskkill /f /im "node.exe" >nul 2>&1
timeout 2

# 2. Start API backend
cd C:\Users\st4th\Documents\RADAR MBG\api
nest start --legacy-watch >nul 2>&1 &
timeout 5

# 3. Start Frontend  
cd C:\Users\st4th\Documents\RADAR MBG
npm run dev >nul 2>&1 &
timeout 5

# 4. Verify
echo "Checking ports..."
echo "Frontend (3000): "
echo "Backend (4000): "
```

### 📋 Catatan Penting

1. **Jangan langsung `npm run build`** sebelum `npm run typecheck` lulus
2. **Pastikan `.env` benar-benar disave** setelah di-edit (ada kasus perubahan tidak disave)
3. **Port 3000 dan 4000 harus free** sebelum server start
4. **Jika menggunakan WSL atau Docker**, pastikan network bridging benar
5. **Clear browser cache** jika halaman tampil tapi resource 404

### 🆘 Emergency Recovery

Jika semuanya gagal:
```cmd
# Full reset
cd C:\Users\st4th\Documents\RADAR MBG
rm -rf .next node_modules api/dist api/.next
cd C:\Users\st4th\Documents\RADAR MBG\api
rm -rf dist node_modules

# Reinstall
cd C:\Users\st4th\Documents\RADAR MBG
npm install
cd C:\Users\st4th\Documents\RADAR MBG\api
npm install

# Mulai dari nol
cd C:\Users\st4th\Documents\RADAR MBG\api
nest start --legacy-watch

cd C:\Users\st4th\Documents\RADAR MBG
npm run dev
```