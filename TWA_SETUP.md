# Setup TWA (Trusted Web Activity) untuk Play Store

## Prasyarat
- Domain production dengan HTTPS.
- PWA lulus audit (manifest, service worker, icons).
- Akun Google Play Developer ($25).

## Langkah
1. **Install Bubblewrap CLI:**
   ```bash
   npm i -g @bubblewrap/cli
   ```

2. **Buat keystore signing key:**
   ```bash
   keytool -genkey -v -keystore android.keystore -alias radar-mbg -keyalg RSA -keysize 2048 -validity 10000
   ```

3. **Dapatkan SHA-256 fingerprint:**
   ```bash
   keytool -list -v -keystore android.keystore -alias radar-mbg
   ```
   Salin fingerprint (format: `AA:BB:CC:...`).

4. **Update `public/.well-known/assetlinks.json`:**
   - Ganti `package_name` dengan `com.radar.mbg`.
   - Ganti `sha256_cert_fingerprints` dengan fingerprint dari step 3.

5. **Update `twa-manifest.json`:**
   - Ganti `host` dengan domain production.
   - Ganti URL icon dengan domain production.

6. **Generate APK:**
   ```bash
   bubblewrap init --manifest https://domain-anda.com/manifest.webmanifest
   bubblewrap build
   ```

7. **Upload ke Play Store:**
   - Buat aplikasi baru di Google Play Console.
   - Upload APK/AAB dari folder `app-release-bundle`.
   - Isi metadata (deskripsi, screenshot, dll.).

## Catatan
- **Background GPS:** TWA menggunakan browser (Chrome) di belakang layar; background tracking terbatas. Untuk tracking kontinu, pertimbangkan **Capacitor**.
- **Update:** Setiap perubahan web app otomatis tercermin di TWA (tanpa update APK).
- **Offline:** Service worker menangani offline mode.

## Alternatif: Capacitor (native hybrid)
Jika memerlukan akses native (background GPS, push notification native):
```bash
npm install @capacitor/core @capacitor/cli
npx cap init "RADAR MBG" "com.radar.mbg" --web-dir=.next
npx cap add android
npx cap sync
npx cap open android
```
Build APK dari Android Studio.

## Rekomendasi
- **Mulai dengan TWA** (lebih mudah, update otomatis).
- **Migrasi ke Capacitor** jika memerlukan background GPS yang lebih andal.
