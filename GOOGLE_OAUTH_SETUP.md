# Setup Google Sign-In untuk Pendaftaran Penerima

Dokumen ini menjelaskan langkah mengaktifkan Google Sign-In pada halaman pendaftaran penerima RADAR MBG.

## 1. Buat project Google Cloud
1. Buka https://console.cloud.google.com/
2. Buat project baru (mis. `radar-mbg`).
3. Aktifkan **Google Identity Services** (otomatis saat membuat OAuth client).

## 2. Konfigurasi OAuth consent screen
1. Menu **APIs & Services → OAuth consent screen**.
2. Pilih **External** (atau Internal jika Google Workspace).
3. Isi:
   - App name: `RADAR MBG`
   - User support email: email Anda
   - Developer contact: email Anda
4. Scopes: tambahkan `email`, `profile`, `openid`.
5. Test users: tambahkan email yang akan diuji (jika External dan belum published).

## 3. Buat OAuth Client ID (Web application)
1. Menu **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Name: `RADAR MBG Web`.
4. **Authorized JavaScript origins:**
   - `http://localhost:3000`
   - `https://domain-anda.com`
5. **Authorized redirect URIs:** (tidak wajib untuk GIS, tapi tambahkan)
   - `http://localhost:3000`
   - `https://domain-anda.com`
6. Simpan → catat **Client ID** (format: `xxx.apps.googleusercontent.com`).

## 4. Set environment variables
### Frontend (`.env.local` / `.env.production`)
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
```

### Backend (`api/.env` / `api/.env.production`)
```env
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
```

## 5. Rebuild & restart
```bash
npm run build
npm --prefix api run build
# restart server & API
```

## 6. Uji
1. Buka `http://localhost:3000/radarapp/register?code=<KODE_VALID>`.
2. Tombol “Daftar dengan Google” akan muncul.
3. Klik → pilih akun Google → data pendaftaran otomatis terisi dari profil Google.
4. Cek di tenant admin: permintaan pendaftaran baru dengan `contactEmail` dari Google.

## 7. Troubleshooting
| Masalah | Solusi |
|---|---|
| Tombol Google tidak muncul | Pastikan `NEXT_PUBLIC_GOOGLE_CLIENT_ID` diset dan frontend di-rebuild. |
| Endpoint mengembalikan `GOOGLE_AUTH_DISABLED` | Set `GOOGLE_CLIENT_ID` di backend dan restart API. |
| `Token Google tidak valid` | Pastikan Client ID sama di frontend & backend; origin sudah di-allow. |
| Email tidak verified | Gunakan akun Google dengan email terverifikasi. |
| Kode registrasi invalid | Buat kode baru dari tenant admin (`/tenant/recipient-registrations`). |

## 8. Catatan keamanan
- Jangan commit Client ID ke repo publik (gunakan env).
- Backend memverifikasi token dengan `google-auth-library` (audience + issuer + email_verified).
- Token tidak disimpan; hanya data profil (nama, email) yang disimpan.
